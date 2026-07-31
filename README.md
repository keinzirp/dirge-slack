# Dirge Slack

Slack Socket Mode bridge for running Dirge from Slack.

## Why this app exists

Dirge is a local coding agent. Slack needs a small boundary service that handles Slack events, access control, queueing, worktrees, checks, commits, pushes, and PRs without adding Slack-specific code to Dirge itself.

## What lives here

- Slack event handling in `src/index.ts`
- Dirge CLI invocation in `src/dirge/`
- Git worktree, check, commit, push, and PR helpers in `src/git/`
- per-thread state in `src/state/`
- queueing in `src/queue/`
- the required Dirge Slack plugin in `plugins/slack/`

## Behavior

- One Slack thread maps to one Dirge session.
- Read-only requests run in `DIRGE_SLACK_WORKDIR` with `--prompt ask --restrictive`.
- Code requests run in a per-thread worktree with `--prompt code --accept-all`.
- The bridge runs checks, commits, pushes, opens or updates a PR, then replies in Slack.
- The plugin blocks agent-run `git push` and `gh pr create`; the bridge owns shipping.
- Replies in a Dirge thread only run when they mention the bot.

## Setup

```bash
pnpm install
cp .env.example .env
```

Required `.env` values:

```bash
SLACK_APP_TOKEN=xapp-...
SLACK_BOT_TOKEN=xoxb-...
DIRGE_SLACK_WORKDIR=/path/to/repo
DIRGE_SLACK_ALLOWED_CHANNELS=C123,C456
DIRGE_SLACK_ALLOWED_USERS=U123,U456
```

For Rough app:

```bash
DIRGE_SLACK_WORKDIR=/Users/keinzirp/Development/Work/rough.app
DIRGE_SLACK_CHECK_COMMANDS=just qa
```

Slack app requirements:

- Socket Mode enabled
- app token scope: `connections:write`
- bot token scopes: `app_mentions:read`, `chat:write`, `reactions:write`

Run `gh auth login` before using PR creation.

## Common commands

```bash
just fix
just check
just test
just qa
just start
```

## Slack usage

```text
@dirge explain how auth works
@dirge fix the failing auth test
@dirge cancel
```

## State and branches

Default state dir:

```text
../.dirge-slack/<repo-name>
```

Worktrees:

```text
<DIRGE_SLACK_STATE_DIR>/worktrees/<name>
```

Branches:

```text
dirge/<name>
```

Default checks are `just qa`. Set `DIRGE_SLACK_CHECK_COMMANDS=off` or empty to disable checks. Other check commands are rejected.

## Fresh Rough setup

```bash
brew install git gh node pnpm just rustup
rustup-init -y
source ~/.cargo/env

mkdir -p ~/Development/Personal ~/Development/Work

cd ~/Development/Personal
git clone <dirge-repo-url> dirge
git clone <dirge-slack-repo-url> dirge-slack

cd ~/Development/Work
git clone <rough-app-repo-url> rough.app

cd ~/Development/Personal/dirge
cargo install --path .

cd ~/Development/Work/rough.app
pnpm install
just qa
dirge -p --prompt ask --restrictive -- "what repo is this?"

cd ~/Development/Personal/dirge-slack
pnpm install
cp .env.example .env
just qa
just start
```

## Dirge config

The bridge copies your normal Dirge `config.json` into its runtime config dir and installs only the bundled Slack plugin. Recommended defaults:

```json
{
  "context_target": 250000,
  "compaction_fold_threshold": 0.75,
  "critic_provider": "main",
  "code_review": "blocking",
  "dynamic_tool_search": true,
  "code_mode_rubric": true,
  "context_depth_reminder_threshold": 8,
  "default_permission_mode": "accept",
  "tools": {
    "webfetch": true,
    "websearch": true
  },
  "permission": {
    "rules": [
      { "op": "network", "match": "*", "effect": "allow" },
      { "op": "agent", "match": "*", "effect": "allow" },
      { "op": "execute", "match": "gh *", "effect": "allow" },
      { "op": "execute", "match": "git *", "effect": "allow" },
      { "op": "execute", "match": "just qa", "effect": "allow" }
    ]
  }
}
```
