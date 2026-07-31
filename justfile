root_bin := justfile_directory() / "node_modules/.bin"
export PATH := root_bin + ":./node_modules/.bin:" + env("PATH")

set dotenv-load

import? 'package.just'
