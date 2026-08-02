# Dirge Slack

Slack Socket Mode bridge for Dirge.

One Slack thread becomes one Dirge session. Questions run in the target repo. Code requests get a worktree, branch, commit, push, and PR.

## Setup

```bash
pnpm install
cp .env.example .env
```

Edit `.env`:

```bash
SLACK_APP_TOKEN=xapp-...
SLACK_BOT_TOKEN=xoxb-...
DIRGE_SLACK_WORKDIR=/path/to/repo
DIRGE_SLACK_ALLOWED_CHANNELS=C123
DIRGE_SLACK_ALLOWED_USERS=U123
DIRGE_DATA_DIR=/srv/dirge-stack/dirge-data
```

`just start` loads `.env` with Node's `--env-file`.

## Use

```text
@dirge explain how auth works
@dirge fix the failing auth test
@dirge cancel
```

## Notes

- Default checks: `just qa`.
- Checks: `just qa` by default. Use `just check` for read-only checks, or `off` to disable.
- Branches use `dirge/<name>`.
- Worktrees live under `<DIRGE_SLACK_STATE_DIR>/worktrees/`.
- The bundled plugin blocks Dirge from running `git push` or `gh pr create` directly.
- Run `gh auth login` before PR creation.
