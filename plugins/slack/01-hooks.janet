(defn on-prompt [_ctx]
  (when (= (env "DIRGE_SLACK_STATUS_CHECK") "1")
    (harness/replace-prompt "Reply exactly: dirge-slack plugin 0.1.0 ok"))
  nil)

(defn before-agent-start [_ctx]
  (when (not= (env "DIRGE_SLACK_THREAD_TS") "")
    (harness/append-system-prompt ```
# Slack bridge mode

You are running for a Slack thread. Reply with one final answer; the bridge posts it to Slack. Do not attempt to post to Slack yourself.

For read-only requests, inspect and explain only. For code-changing requests, make the smallest safe change, run the configured checks, and leave changes uncommitted. The Slack bridge commits, pushes, and creates pull requests only after Dirge exits green and checks pass.

Do not run git push or gh pr create. The Slack bridge plugin blocks those commands; the bridge owns shipping.
```))
  nil)
