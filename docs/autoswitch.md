# Autoswitch

Autoswitch is the main feature of `cdx`. It monitors usage for saved ChatGPT/Codex login snapshots and switches the selected proxy account when the current account drops below configured thresholds.

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
