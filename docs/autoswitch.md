# Autoswitch

Autoswitch is the main feature of `cdx`. It monitors usage for saved ChatGPT/Codex login snapshots and switches the selected account when the current account drops below configured thresholds.

## How It Works

Autoswitch is set up by `cdx add [label]`. After a login snapshot is saved, `cdx` starts a local authenticated loopback service, writes a marked managed block to `~/.codex/config.toml`, and starts the portable daemon. After that setup, autoswitch decisions update the account selected by the local service instead of asking you to quit Codex.

A running Codex app or CLI session should not be expected to re-read a changed `auth.json`, so `cdx` does not use auth-file swapping as the live switching mechanism.

To opt out of autoswitch, run:

```bash
cdx autoswitch disable
```

To save a snapshot without starting autoswitch, run:

```bash
cdx add --no-autoswitch [label]
```

`cdx autoswitch enable [label]` remains available as a repair or re-enable command.

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
cdx add work
cdx autoswitch status
cdx autoswitch run
cdx autoswitch run --apply
cdx autoswitch disable
```

Candidate selection uses highest 5-hour remaining capacity, then highest 7-day capacity, then most recent successful health check. If usage cannot be read or no candidate is eligible, `cdx` fails closed and does not switch.

The v1 daemon is portable and manually started. Reboot-persistent launchd, systemd, and Windows service installers are intentionally deferred.
