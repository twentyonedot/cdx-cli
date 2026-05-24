import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

function tempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cdx-test-"));
}

function fakeJwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.sig`;
}

function fakeAuth({ email = "user@example.com", userId = "user-1", accountId = "acct-1", usedPercent = 0 } = {}) {
  return {
    tokens: {
      id_token: fakeJwt({
        email,
        "https://api.openai.com/auth": {
          chatgpt_user_id: userId,
          chatgpt_account_id: accountId,
          chatgpt_plan_type: "plus"
        }
      }),
      access_token: `token-${accountId}-${usedPercent}`,
      account_id: accountId
    }
  };
}

async function withHome(fn) {
  const previous = process.env.CDX_HOME;
  const previousCodex = process.env.CODEX_HOME;
  const home = tempHome();
  const codexHome = tempHome();
  process.env.CDX_HOME = home;
  process.env.CODEX_HOME = codexHome;
  try {
    await fn(home, codexHome);
  } finally {
    if (previous === undefined) delete process.env.CDX_HOME;
    else process.env.CDX_HOME = previous;
    if (previousCodex === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodex;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(codexHome, { recursive: true, force: true });
  }
}

test("label validation rejects unsafe labels", async () => {
  const { validateLabel } = await import("../dist/labels.js");
  assert.equal(validateLabel("work-1"), "work-1");
  assert.equal(validateLabel("user+codex@example.com"), "user+codex@example.com");
  assert.throws(() => validateLabel("../x"), /path separators|parent-directory/);
  assert.throws(() => validateLabel("autoswitch"), /reserved/);
});

test("account snapshots save and list without exposing tokens", async () => {
  await withHome(async (home) => {
    const { upsertAccountFromSnapshot, listAccounts, serializeAccount } = await import("../dist/store.js");
    const authPath = path.join(home, "auth.json");
    fs.writeFileSync(authPath, `${JSON.stringify(fakeAuth())}\n`);
    const saved = upsertAccountFromSnapshot("work", authPath);
    assert.equal(saved.label, "work");
    const accounts = listAccounts();
    assert.equal(accounts.length, 1);
    const json = JSON.stringify(serializeAccount(accounts[0]));
    assert.equal(json.includes("access_token"), false);
    assert.equal(json.includes("token-acct"), false);
  });
});

test("email labels are valid account labels", async () => {
  await withHome(async (home) => {
    const { upsertAccountFromSnapshot, listAccounts } = await import("../dist/store.js");
    const authPath = path.join(home, "auth.json");
    fs.writeFileSync(authPath, `${JSON.stringify(fakeAuth({ email: "user+codex@example.com" }))}\n`);
    const saved = upsertAccountFromSnapshot("user+codex@example.com", authPath);
    assert.equal(saved.label, "user+codex@example.com");
    assert.equal(listAccounts()[0].label, "user+codex@example.com");
  });
});

test("cdx paths include an internal temp dir for isolated logins", async () => {
  await withHome(async (home) => {
    const { getPaths } = await import("../dist/paths.js");
    assert.equal(getPaths().tempDir, path.join(home, "tmp"));
  });
});

test("autoswitch chooses the strongest eligible candidate", async () => {
  await withHome(async (home) => {
    const { upsertAccountFromSnapshot } = await import("../dist/store.js");
    const { selectProxyAccount } = await import("../dist/proxy.js");
    const { buildAutoswitchDecision } = await import("../dist/autoswitch.js");

    for (const spec of [
      ["current", "acct-current", 95],
      ["candidate-a", "acct-a", 20],
      ["candidate-b", "acct-b", 10]
    ]) {
      const [label, accountId, usedPercent] = spec;
      const authPath = path.join(home, `${label}.json`);
      fs.writeFileSync(authPath, `${JSON.stringify(fakeAuth({ email: `${label}@example.com`, accountId, userId: `user-${accountId}`, usedPercent }))}\n`);
      upsertAccountFromSnapshot(label, authPath);
    }
    selectProxyAccount("current");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      const auth = init.headers.Authorization;
      const used = auth.includes("acct-current") ? 95 : auth.includes("acct-a") ? 20 : 10;
      return new Response(JSON.stringify({
        primary: { window_minutes: 300, used_percent: used, reset_at: 9999999999 },
        secondary: { window_minutes: 10080, used_percent: used, reset_at: 9999999999 }
      }), { status: 200 });
    };
    try {
      const decision = await buildAutoswitchDecision(false, {
        triggerFiveHourPercent: 10,
        minFiveHourPercent: 25,
        minSevenDayPercent: 25,
        intervalSeconds: 60,
        cooldownMinutes: 0
      });
      assert.equal(decision.action, "would-switch");
      assert.equal(decision.candidate.account.label, "candidate-b");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("autoswitch setup selects account, writes config, and preserves original backup", async () => {
  await withHome(async (home, codexHome) => {
    const { upsertAccountFromSnapshot } = await import("../dist/store.js");
    const { enableAutoswitchRuntime } = await import("../dist/autoswitchSetup.js");
    const { readProxyState } = await import("../dist/proxy.js");
    const { getPaths } = await import("../dist/paths.js");

    const codexConfigPath = path.join(codexHome, "config.toml");
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(codexConfigPath, "model = \"gpt-5\"\n");

    const authPath = path.join(home, "auth.json");
    fs.writeFileSync(authPath, `${JSON.stringify(fakeAuth())}\n`);
    upsertAccountFromSnapshot("work", authPath);

    const fakeDaemon = () => ({
      running: true,
      pid: 12345,
      pidPath: getPaths().daemonPidPath,
      logPath: getPaths().daemonLogPath,
      errorLogPath: getPaths().daemonErrorLogPath
    });
    const first = await enableAutoswitchRuntime("work", { port: 45678 }, {
      ensureProxyServer: async () => {},
      startDaemon: fakeDaemon
    });
    const second = await enableAutoswitchRuntime("work", { port: 45679 }, {
      ensureProxyServer: async () => {},
      startDaemon: fakeDaemon
    });

    assert.equal(first.selectedLabel, "work");
    assert.equal(second.port, 45679);
    const state = readProxyState();
    assert.equal(state.enabled, true);
    assert.equal(state.selectedLabel, "work");
    assert.equal(state.port, 45679);
    assert.ok(state.token);
    assert.ok(state.configBackupPath);
    assert.equal(fs.readFileSync(state.configBackupPath, "utf8"), "model = \"gpt-5\"\n");
    const config = fs.readFileSync(codexConfigPath, "utf8");
    assert.match(config, /BEGIN CDX AUTOSWITCH/);
    assert.match(config, /openai_base_url = "http:\/\/127\.0\.0\.1:45679\/v1"/);
    assert.equal(config.includes(state.token), false);
  });
});

test("removing selected account fails closed without force", async () => {
  await withHome(async () => {
    const { upsertAccountFromSnapshot, removeAccount } = await import("../dist/store.js");
    const { selectProxyAccount } = await import("../dist/proxy.js");
    const authPath = path.join(process.env.CDX_HOME, "auth.json");
    fs.writeFileSync(authPath, `${JSON.stringify(fakeAuth())}\n`);
    upsertAccountFromSnapshot("work", authPath);
    selectProxyAccount("work");
    assert.throws(() => removeAccount("work", false), /Refusing to remove selected account/);
    assert.equal(removeAccount("work", true).label, "work");
  });
});
