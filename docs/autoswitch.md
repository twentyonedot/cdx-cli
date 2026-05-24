# Autoswitch

Autoswitch is the main feature of `cdx`. It monitors usage for saved ChatGPT/Codex login snapshots and switches the selected proxy account when the current account drops below configured thresholds.

## Proxy Requirement

Autoswitch needs proxy mode for live, no-quit switching. A running Codex app or CLI session should not be expected to re-read a changed `auth.json`, so `cdx` does not use auth-file swapping as the live switching mechanism.

`cdx autoswitch enable [label]` opts in to proxy mode. It starts the authenticated loopback proxy, writes a marked managed block to `~/.codex/config.toml`, and starts the portable daemon. After that setup, autoswitch decisions update the account selected by the proxy instead of asking you to quit Codex.

Manual snapshot commands remain useful without proxy mode:

```bash
cdx add [label]
cdx accounts
cdx refresh <label>
cdx remove <label>
```

## Defaults

- Poll interval: `60s`
- Switch trigger: below `10%` remaining in the 5-hour window
- Candidate minimum 5-hour remaining: `25%`
- Candidate minimum 7-day remaining: `25%`
- Cooldown after switching: `15m`

## Configure

```bash
cdx config autoswitch set --interval 60 --trigger-5h 10 --min-5h 25 --min-7d 25 --cooldown 15
cdx config autoswitch show
cdx config autoswitch reset
```

## Run

```bash
cdx autoswitch enable work
cdx autoswitch status
cdx autoswitch run
cdx autoswitch run --apply
cdx autoswitch disable
```

Candidate selection uses highest 5-hour remaining capacity, then highest 7-day capacity, then most recent successful health check. If usage cannot be read or no candidate is eligible, `cdx` fails closed and does not switch.

The v1 daemon is portable and manually started. Reboot-persistent launchd, systemd, and Windows service installers are intentionally deferred.
