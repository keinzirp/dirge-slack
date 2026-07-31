# Agent Guide

## Scope

Workflow guidance for `dirge-slack`.

## Read first

- `README.md` — product overview and setup
- `package.just` — command surface

## Key commands

Run these from anywhere in the repo:

```bash
just fix
just check
just test
just qa
just start
```

## Critical rules

- Spawn commands with argv arrays. Do not shell-interpolate Slack, Git, or Dirge input.
- Startup must install the runtime Dirge config and verify the Slack plugin.
- Read-only jobs must not create branches or worktrees.
- Code jobs use one Slack thread, one Dirge session, one worktree, and one branch.
- Dirge leaves changes uncommitted; the bridge runs checks, commits, pushes, and opens PRs.
- Keep docs short and direct.

## Style

- `pnpm`
- `just`
- Biome
- strict TypeScript
- ESM with `.ts` imports
- zod/v4 env parsing
- named exports
- small modules

## Verification

```bash
just qa
```
