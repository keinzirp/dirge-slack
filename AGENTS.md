# Agent Guide

Read `README.md` and `package.just` first.

Commands:

```bash
just fix
just check
just test
just qa
just start
```

Rules:

- Use argv arrays. Do not shell-interpolate Slack, Git, or Dirge input.
- Startup must install and verify the Slack plugin.
- Read-only jobs do not create branches or worktrees.
- Code jobs use one thread, session, worktree, and branch.
- Dirge edits, commits, pushes, and opens PRs; the bridge checks and reports.
- Keep docs short.
