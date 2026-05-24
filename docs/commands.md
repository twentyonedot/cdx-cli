# Commands

## `cdx add [label]`

Runs `codex login --device-auth` in a temporary isolated `CODEX_HOME`, imports the resulting ChatGPT/Codex auth snapshot, and removes the temp folder. If no label is provided, the login email becomes the label.

## `cdx accounts [--json]`

Lists saved snapshots, proxy selection, and autoswitch eligibility.

## `cdx use <label>`

Selects the account used by the managed proxy. This does not rewrite `~/.codex/auth.json`; it changes the selected proxy snapshot used after `cdx autoswitch enable`.

## `cdx refresh <label>`

Reauthenticates in an isolated temp home and replaces the saved snapshot only if identity matches.

## `cdx remove <label> [--force]`

Removes a saved snapshot. Refuses selected accounts unless `--force` is provided.

## `cdx usage [label|--all] [--json]`

Fetches live usage windows for one account or all eligible accounts.

## `cdx autoswitch enable|disable|start|stop|status|run`

Controls proxy-backed autoswitch and the portable daemon.

`cdx autoswitch enable [label]` is the default setup for no-quit switching. It starts the authenticated loopback proxy, writes the managed Codex config block, and starts the daemon. Manual account commands do not need proxy mode, but automatic switching for an already-running Codex session does.

`cdx autoswitch disable` is the opt-out path. It stops managed processes and restores the Codex config values previously changed by `cdx`.

## `cdx config autoswitch show|set|reset`

Shows or updates autoswitch thresholds.

## `cdx doctor [--json]`

Validates Codex availability, account store, proxy state, daemon state, and beta readiness.
