biome := "./node_modules/.bin/biome"

help:
    @just --justfile package.just --list

start:
    node ./src/index.ts

dev:
    node --watch ./src/index.ts

check *args:
    tsc {{ args }}

test *args:
    vitest --config vite.config.ts {{ args }}

lint:
    {{ biome }} check --colors=force .

fix:
    {{ biome }} check --unsafe --write --colors=force .
    just --justfile justfile --fmt
    just --justfile package.just --fmt

qa: fix check test
