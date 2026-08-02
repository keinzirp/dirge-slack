(def check-passed false)

(defn bash-command [ctx]
  (or (get-in ctx [:args "command"]) ""))

(defn configured-check []
  (let [value (string/trim (env "DIRGE_SLACK_CHECK_COMMANDS"))]
    (if (or (= value "") (= (string/ascii-lower value) "off")) nil value)))

(defn branch-prefix []
  (let [value (env "DIRGE_SLACK_BRANCH_PREFIX")]
    (if (= value "") "dirge/" value)))

(defn capture [cmd]
  (let [tmp (string "/tmp/dirge-slack-" (os/time) "-" (math/random))]
    (os/execute ["/bin/sh" "-c" (string cmd " > " tmp " 2>/dev/null")] :x)
    (try
      (let [f (file/open tmp :r)
            data (file/read f :all)]
        (file/close f)
        (os/execute ["/bin/rm" "-f" tmp])
        (string/trim data))
      ([_]
        (os/execute ["/bin/rm" "-f" tmp])
        ""))))

(defn current-branch []
  (capture "git branch --show-current"))

(defn slack-mode? []
  (not= (env "DIRGE_SLACK_THREAD_TS") ""))

(defn allowed-branch? []
  (= (string/find (branch-prefix) (current-branch)) 0))

(defn command-failed? [output]
  (or (string/find "Command exited with code" output)
      (string/find "Command failed" output)))

(defn check-command? [cmd]
  (if-let [check (configured-check)]
    (= (string/trim cmd) check)
    false))

(defn shipping-command? [cmd]
  (or (string/find "git push" cmd) (string/find "gh pr create" cmd)))

(defn harmless-git-command? [cmd]
  (or (string/find "git status" cmd)
      (string/find "git diff" cmd)
      (string/find "git log" cmd)
      (string/find "git branch" cmd)
      (string/find "git rev-parse" cmd)
      (string/find "git add" cmd)
      (string/find "git commit" cmd)))

(defn mutation-tool? [tool]
  (or (= tool "write")
      (= tool "edit")
      (= tool "edit_lines")
      (= tool "edit_minified")
      (= tool "apply_patch")))

(defn reset-check! []
  (set check-passed false))

(defn guard-shipping! [cmd]
  (when (string/find "--force" cmd)
    (harness/block "dirge-slack blocks force pushes"))
  (when (not (allowed-branch?))
    (harness/block (string "dirge-slack only allows shipping from " (branch-prefix) " branches")))
  (when (and (configured-check) (not check-passed))
    (harness/block (string "run " (configured-check) " successfully before git push or gh pr create"))))

(defn on-tool-start [ctx]
  (when (and (slack-mode?) (mutation-tool? (ctx :tool)))
    (reset-check!))
  (when (and (slack-mode?) (= (ctx :tool) "bash"))
    (def cmd (bash-command ctx))
    (when (or (string/find "git checkout main" cmd)
              (string/find "git switch main" cmd)
              (string/find "git checkout master" cmd)
              (string/find "git switch master" cmd))
      (harness/block "dirge-slack blocks switching to main/master in Slack worktrees"))
    (when (shipping-command? cmd)
      (guard-shipping! cmd)))
  nil)

(defn on-tool-end [ctx]
  (when (and (slack-mode?) (= (ctx :tool) "bash"))
    (def cmd (bash-command ctx))
    (def output (or (ctx :output) ""))
    (if (check-command? cmd)
      (set check-passed (not (command-failed? output)))
      (when (and (not (shipping-command? cmd))
                 (not (harmless-git-command? cmd)))
        (reset-check!))))
  nil)
