(def slack-plugin-version "0.1.0")

(defn env [name]
  (or (os/getenv name) ""))
