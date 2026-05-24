#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { parseAuthFile } from "./auth.js";
import { runAutoswitch, latestAutoswitchDecision, autoswitchLoop } from "./autoswitch.js";
import { enableAutoswitchRuntime } from "./autoswitchSetup.js";
import { detectCodexCompatibility, runIsolatedCodexLogin } from "./codex.js";
import { disableCodexProxyConfig } from "./codexConfig.js";
import { loadConfig, resetAutoswitchConfig, updateAutoswitchConfig } from "./config.js";
import { CdxError } from "./errors.js";
import { safeRemoveDir } from "./fsx.js";
import { withLock, withLockAsync } from "./lock.js";
import { bold, info, muted, printError, printJson, printKeyValue, success, warn } from "./output.js";
import { defaultProxyState, processIsAlive, readProxyState, runProxyServer, selectProxyAccount, writeProxyState } from "./proxy.js";
import { listAccounts, removeAccount, requireAccount, serializeAccount, upsertAccountFromSnapshot } from "./store.js";
import { fetchUsage, remainingPercent } from "./usage.js";
import { daemonStatus, startDaemon, stopDaemon } from "./daemon.js";
function parseNumberOption(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new CdxError("invalid-option", `Expected a number, got "${value}".`);
    }
    return parsed;
}
function configPatchFromOptions(options) {
    const patch = {};
    if (typeof options.interval === "number") {
        patch.intervalSeconds = options.interval;
    }
    if (typeof options.trigger5h === "number") {
        patch.triggerFiveHourPercent = options.trigger5h;
    }
    if (typeof options.min5h === "number") {
        patch.minFiveHourPercent = options.min5h;
    }
    if (typeof options.min7d === "number") {
        patch.minSevenDayPercent = options.min7d;
    }
    if (typeof options.cooldown === "number") {
        patch.cooldownMinutes = options.cooldown;
    }
    return patch;
}
function portOption(port) {
    return port === undefined ? {} : { port };
}
function renderAccounts(json) {
    const accounts = listAccounts();
    if (json) {
        printJson({ accounts: accounts.map(serializeAccount) });
        return;
    }
    console.log(bold("CDX Accounts"));
    if (accounts.length === 0) {
        console.log(warn("No accounts saved yet. Run `cdx add [label]` to add one."));
        return;
    }
    for (const account of accounts) {
        const marker = account.selected ? success("selected") : account.eligible ? info("ready") : warn("issue");
        console.log(`${marker.padEnd(16)} ${bold(account.label)} ${muted(account.email || "unknown email")}`);
        if (account.issue) {
            printKeyValue("issue", warn(account.issue));
        }
    }
}
function importIsolatedLogin(label, expectedRecordKey) {
    const tempHome = runIsolatedCodexLogin();
    try {
        const authPath = path.join(tempHome, "auth.json");
        const authInfo = parseAuthFile(authPath);
        const effectiveLabel = label || authInfo.email;
        if (!effectiveLabel) {
            throw new CdxError("missing-label", "No label was provided and the Codex login did not expose an email address.");
        }
        const account = upsertAccountFromSnapshot(effectiveLabel, authPath, expectedRecordKey);
        return account;
    }
    finally {
        safeRemoveDir(tempHome);
    }
}
async function enableAutoswitch(label, options) {
    await withLockAsync("global", async () => {
        const result = await enableAutoswitchRuntime(label, portOption(options.port));
        if (options.json) {
            printJson(result);
            return;
        }
        console.log(success("Autoswitch enabled"));
        printKeyValue("account", result.selectedLabel);
        printKeyValue("port", String(result.port));
        printKeyValue("daemon", result.daemon.running ? `running pid ${result.daemon.pid}` : "not running");
        printKeyValue("restore", "cdx autoswitch disable");
    });
}
async function addAccount(label, options) {
    await withLockAsync("global", async () => {
        const account = importIsolatedLogin(label);
        console.log(success(`Saved ${account.label}`));
        printKeyValue("email", account.email || "unknown");
        if (options.autoswitch === false) {
            printKeyValue("autoswitch", warn("skipped"));
            printKeyValue("start", `cdx autoswitch enable ${account.label}`);
            return;
        }
        const result = await enableAutoswitchRuntime(account.label, portOption(options.port));
        printKeyValue("autoswitch", success("running"));
        printKeyValue("account", result.selectedLabel);
        printKeyValue("port", String(result.port));
        printKeyValue("daemon", result.daemon.running ? `running pid ${result.daemon.pid}` : "not running");
        printKeyValue("status", "cdx autoswitch status");
        printKeyValue("restore", "cdx autoswitch disable");
    });
}
function disableAutoswitch(options) {
    withLock("global", () => {
        stopDaemon();
        const state = readProxyState();
        if (state.serverPid && processIsAlive(state.serverPid)) {
            process.kill(state.serverPid, "SIGTERM");
        }
        disableCodexProxyConfig(state.configBackupPath);
        writeProxyState({ ...defaultProxyState(), port: state.port, updatedAt: new Date().toISOString() });
        if (options.json) {
            printJson({ enabled: false });
            return;
        }
        console.log(success("Autoswitch disabled and managed Codex config restored."));
    });
}
async function runUsage(label, all, json) {
    const accounts = all ? listAccounts().filter((account) => account.eligible) : [requireAccount(label || readProxyState().selectedLabel || "")];
    const results = [];
    for (const account of accounts) {
        try {
            const usage = await fetchUsage(account);
            results.push({
                account: serializeAccount(account),
                usage,
                fiveHourLeft: remainingPercent(usage.fiveHour),
                sevenDayLeft: remainingPercent(usage.sevenDay),
                issue: null
            });
        }
        catch (error) {
            results.push({
                account: serializeAccount(account),
                usage: null,
                fiveHourLeft: null,
                sevenDayLeft: null,
                issue: error instanceof Error ? error.message : String(error)
            });
        }
    }
    if (json) {
        printJson({ results });
        return;
    }
    for (const result of results) {
        console.log(bold(result.account.label));
        printKeyValue("5h left", result.fiveHourLeft === null ? "unknown" : `${result.fiveHourLeft}%`);
        printKeyValue("7d left", result.sevenDayLeft === null ? "unknown" : `${result.sevenDayLeft}%`);
        if (result.issue) {
            printKeyValue("issue", warn(result.issue));
        }
    }
}
function renderStatus(json) {
    const proxy = readProxyState();
    const daemon = daemonStatus();
    const config = loadConfig();
    const latest = latestAutoswitchDecision();
    if (json) {
        printJson({ proxy: { ...proxy, token: proxy.token ? "<redacted>" : "" }, daemon, config, latest });
        return;
    }
    console.log(bold("CDX Autoswitch"));
    printKeyValue("service", proxy.enabled ? success("enabled") : warn("disabled"));
    printKeyValue("selected", proxy.selectedLabel || "none");
    printKeyValue("daemon", daemon.running ? success(`running pid ${daemon.pid}`) : warn("stopped"));
    printKeyValue("interval", `${config.autoswitch.intervalSeconds}s`);
    printKeyValue("threshold", `${config.autoswitch.triggerFiveHourPercent}% 5h trigger`);
    if (latest) {
        printKeyValue("last", `${latest.action}: ${latest.reason}`);
    }
}
function runDoctor(json) {
    const compatibility = detectCodexCompatibility();
    const accounts = listAccounts();
    const proxy = readProxyState();
    const daemon = daemonStatus();
    const report = {
        codex: compatibility,
        accounts: accounts.map(serializeAccount),
        proxy: { ...proxy, token: proxy.token ? "<redacted>" : "" },
        daemon,
        ok: compatibility.supported && accounts.length > 0
    };
    if (json) {
        printJson(report);
        return;
    }
    console.log(bold("CDX Doctor"));
    printKeyValue("codex", compatibility.supported ? success(compatibility.version || "available") : warn(compatibility.issue || "unavailable"));
    printKeyValue("accounts", String(accounts.length));
    printKeyValue("service", proxy.enabled ? success("enabled") : warn("disabled"));
    printKeyValue("daemon", daemon.running ? success("running") : warn("stopped"));
}
async function main() {
    if (process.argv[2] === "__proxy") {
        const portIndex = process.argv.indexOf("--port");
        const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : readProxyState().port;
        await runProxyServer(port);
        return;
    }
    if (process.argv[2] === "__daemon") {
        await autoswitchLoop();
        return;
    }
    const program = new Command();
    program
        .name("cdx")
        .description("Public beta CLI for automatic Codex account switching using an authenticated local service.")
        .showHelpAfterError()
        .addHelpText("after", `

Quick start:
  cdx add work
  cdx autoswitch status

State:
  cdx stores snapshots and runtime files under ~/.cdx.
  Autoswitch mutates only a marked managed block in ~/.codex/config.toml.

How autoswitch works:
  cdx routes Codex through a local authenticated service so live sessions can switch without quitting.
  Opt out and restore with: cdx autoswitch disable
`);
    program.command("add")
        .argument("[label]", "optional label for this ChatGPT/Codex account; defaults to the login email")
        .option("--no-autoswitch", "save the snapshot without starting live autoswitch")
        .option("--port <port>", "local autoswitch service port", parseNumberOption)
        .description("Add an account and start live autoswitch. Use --no-autoswitch for snapshot-only setup.")
        .action((label, options) => addAccount(label, options));
    program.command("accounts")
        .option("--json", "emit secret-free JSON")
        .description("List saved account snapshots and autoswitch eligibility.")
        .action((options) => renderAccounts(Boolean(options.json)));
    program.command("use")
        .argument("<label>", "saved account label")
        .description("Select the account used by the local autoswitch service.")
        .action((label) => withLock("global", () => {
        const state = selectProxyAccount(label);
        console.log(success(`Selected ${state.selectedLabel || label}`));
    }));
    program.command("refresh")
        .argument("<label>", "saved account label")
        .description("Re-login in an isolated temp CODEX_HOME and replace the snapshot only if identity matches.")
        .action((label) => withLock("global", () => {
        const existing = requireAccount(label);
        const account = importIsolatedLogin(existing.label, existing.recordKey);
        console.log(success(`Refreshed ${account.label}`));
        printKeyValue("email", account.email || "unknown");
    }));
    program.command("remove")
        .argument("<label>", "saved account label")
        .option("--force", "allow removing the currently selected account")
        .description("Remove a saved snapshot. Refuses selected accounts unless --force is provided.")
        .action((label, options) => withLock("global", () => {
        const removed = removeAccount(label, Boolean(options.force));
        console.log(success(`Removed ${removed.label}`));
    }));
    program.command("usage")
        .argument("[label]", "saved account label")
        .option("--all", "show all eligible accounts")
        .option("--json", "emit secret-free JSON")
        .description("Fetch live usage windows for one account or all accounts.")
        .action((label, options) => runUsage(label, Boolean(options.all), Boolean(options.json)));
    const autoswitch = program.command("autoswitch").description("Configure and run live automatic account switching.");
    autoswitch.command("enable")
        .argument("[label]", "saved account label to select")
        .option("--port <port>", "local service port", parseNumberOption)
        .option("--json", "emit secret-free JSON")
        .description("Set up live autoswitch, select an account, and start the portable daemon.")
        .action((label, options) => enableAutoswitch(label, options));
    autoswitch.command("disable")
        .option("--json", "emit secret-free JSON")
        .description("Opt out of live autoswitch, stop managed processes, and restore the backed-up Codex config.")
        .action((options) => disableAutoswitch(options));
    autoswitch.command("start")
        .option("--json", "emit secret-free JSON")
        .description("Start the portable autoswitch daemon.")
        .action((options) => {
        const status = startDaemon();
        if (options.json) {
            printJson(status);
        }
        else {
            console.log(success(`Daemon ${status.running ? `running pid ${status.pid}` : "not running"}`));
        }
    });
    autoswitch.command("stop")
        .option("--json", "emit secret-free JSON")
        .description("Stop the portable autoswitch daemon.")
        .action((options) => {
        const status = stopDaemon();
        if (options.json) {
            printJson(status);
        }
        else {
            console.log(success("Daemon stopped."));
        }
    });
    autoswitch.command("status")
        .option("--json", "emit secret-free JSON")
        .description("Show local service, daemon, config, and latest decision state.")
        .action((options) => renderStatus(Boolean(options.json)));
    autoswitch.command("run")
        .option("--apply", "apply the recommended switch")
        .option("--json", "emit secret-free JSON")
        .description("Run one autoswitch decision cycle.")
        .action((options) => withLockAsync("global", async () => {
        const decision = await runAutoswitch(Boolean(options.apply));
        if (options.json) {
            printJson(decision);
        }
        else {
            console.log(`${bold(decision.action)} ${muted(decision.reason)}`);
        }
    }));
    const config = program.command("config").description("Manage cdx configuration.");
    const configAutoswitch = config.command("autoswitch").description("Manage autoswitch thresholds.");
    configAutoswitch.command("show")
        .option("--json", "emit JSON")
        .action(() => {
        printJson(loadConfig().autoswitch);
    });
    configAutoswitch.command("reset")
        .option("--json", "emit JSON")
        .action((options) => {
        const next = resetAutoswitchConfig();
        if (options.json) {
            printJson(next.autoswitch);
        }
        else {
            console.log(success("Autoswitch config reset."));
        }
    });
    configAutoswitch.command("set")
        .option("--interval <seconds>", "poll interval in seconds", parseNumberOption)
        .option("--trigger-5h <percent>", "switch current account below this 5h remaining percent", parseNumberOption)
        .option("--min-5h <percent>", "candidate must have at least this 5h remaining percent", parseNumberOption)
        .option("--min-7d <percent>", "candidate must have at least this 7d remaining percent", parseNumberOption)
        .option("--cooldown <minutes>", "cooldown after applied switch", parseNumberOption)
        .option("--json", "emit JSON")
        .action((options) => {
        const next = updateAutoswitchConfig(configPatchFromOptions(options));
        if (next.autoswitch.minFiveHourPercent < next.autoswitch.triggerFiveHourPercent) {
            console.error(warn("Warning: candidate min 5h is below the switch trigger; this may switch into a low-reserve account."));
        }
        if (options.json) {
            printJson(next.autoswitch);
        }
        else {
            console.log(success("Autoswitch config updated."));
        }
    });
    program.command("doctor")
        .option("--json", "emit secret-free JSON")
        .description("Validate Codex, account store, local service, daemon, and public beta readiness.")
        .action((options) => runDoctor(Boolean(options.json)));
    await program.parseAsync(process.argv);
}
main().catch(printError);
//# sourceMappingURL=cli.js.map