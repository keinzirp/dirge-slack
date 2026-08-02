(defn on-prompt [_ctx]
  (when (= (env "DIRGE_SLACK_STATUS_CHECK") "1")
    (harness/replace-prompt "Reply exactly: dirge-slack plugin 0.1.0 ok"))
  nil)

(defn bridge-check []
  (let [value (string/trim (env "DIRGE_SLACK_CHECK_COMMANDS"))]
    (if (or (= value "") (= (string/ascii-lower value) "off")) "checks disabled" value)))

(defn before-agent-start [_ctx]
  (when (not= (env "DIRGE_SLACK_THREAD_TS") "")
    (harness/append-system-prompt (string ```
# Slack bridge mode

You are running for a Slack thread. Reply with one final answer; the bridge posts it to Slack. Do not attempt to post to Slack yourself.

For read-only requests, inspect and explain only. For code-changing requests, make the smallest safe change, run the configured bridge check, commit, push the Slack worktree branch, and create or update the pull request.

Shipping guardrails: stay on the Slack worktree branch, do not force push, and run the exact configured bridge check successfully after your last mutation before git push or gh pr create.
```
"
Configured bridge check: " (bridge-check) "\n")))
  nil)
