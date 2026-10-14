# orx for Claude Code

A Claude Code mod for [OpenResearch](../README.md): an `/orx` pane plus guard hooks.

- **`/orx` pane** – projects, the experiment tree (with latest run status), active runs, and run logs. Reads `orx projects --json`, `orx project view <id> --json`, `orx runs <id> --json`, `orx logs <run>`; refreshes every 5 s. "Child" buttons hand Claude a task; nothing mutates state directly.
- **Guards** – deny `orx` calls that break the cardinal rules in `SKILL.md`: env-prefixed `orx exp run`/`create`/`project edit`, env-prefixed `--run-command` values, and `--run-command` edits on a project that already has runs.
- **No skills bundled** – run `orx install-skills` for those.

A mod cannot add a left-sidebar tab; the pane docks beside the conversation.

## Install

```
/plugin install orx --marketplace mberrys/openresearch
```

Requires `orx` on `PATH` (version with `--json` on `runs` and `project view`).

## Develop

```
claude plugin validate claude-code-plugin
claude plugin test claude-code-plugin
```
