# Conversion quality loop

This loop is the deterministic checkpoint used by the active Codex Goal. It does not decide that a product is sellable by itself. The Goal reviews the screenshots and purchase flow, makes scoped presentation changes, and creates `READY` only after the qualitative completion criteria are met.

Each checkpoint runs the unit suite, typecheck, lint, production build, and a Playwright audit at 320px, 390px, and 1280px. Reports and screenshots are written under `.quality-loop/runs/`.

Start in the isolated design worktree:

```sh
nohup scripts/quality-loop/run.sh > .quality-loop/nohup.log 2>&1 &
```

To include a read-only existing group in every responsive audit, provide its URL when starting the loop:

```sh
QUALITY_GROUP_URL="http://127.0.0.1:3100/g/<invite-token>" scripts/quality-loop/run.sh
```

Stop safely:

```sh
scripts/quality-loop/stop.sh
```

The loop also exits when the active Goal creates `scripts/quality-loop/READY`.
