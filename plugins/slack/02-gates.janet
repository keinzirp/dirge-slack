(defn bash-command [ctx]
  (or (get-in ctx [:args "command"]) ""))

(defn on-tool-start [ctx]
  (when (= (ctx :tool) "bash")
    (def cmd (bash-command ctx))
    (when (or (string/find "git push" cmd) (string/find "gh pr create" cmd))
      (harness/block "dirge-slack blocks agent push/PR; the bridge owns shipping")))
  nil)
