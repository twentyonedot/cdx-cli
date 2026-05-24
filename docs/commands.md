# Commands

## `cdx add [label]`

Runs `codex login --device-auth` in a temporary isolated `CODEX_HOME`, imports the resulting ChatGPT/Codex auth snapshot, removes the temp folder, and starts live autoswitch. If no label is provided, the login email becomes the label.

Options:

- `--no-autoswitch`: save the snapshot without starting live autoswitch.
- `--port <port>`: choose the local service port used by autoswitch.

## `cdx accounts [--json]`

Lists saved snapshots, selected account, and autoswitch eligibility.

## `cdx use <label>`

Selects the account used by the local autoswitch service. This does not rewrite `~/.codex/auth.json`; it changes the selected saved snapshot.

## `cdx refresh <label>`

Reauthenticates in an isolated temp home and replaces the saved snapshot only if identity matches.

## `cdx remove <label> [--force]`

Removes a saved snapshot. Refuses selected accounts unless `--force` is provided.

## `cdx usage [label|--all] [--json]`

Fetches live usage windows for one account or all eligible accounts.

## `cdx autoswitch enable|disable|start|stop|status|run`

Controls live autoswitch and the portable daemon.

`cdx add [label]` starts autoswitch during normal setup. `cdx autoswitch enable [label]` is still available for repair or re-enable flows; it starts the authenticated loopback service, writes the managed Codex config block, and starts the daemon.

`cdx autoswitch disable` is the opt-out path. It stops managed processes and restores the Codex config values previously changed by `cdx`.

## `cdx config autoswitch show|set|reset`

Shows or updates autoswitch thresholds.

## `cdx doctor [--json]`

Validates Codex availability, account store, local service state, daemon state, and beta readiness.
