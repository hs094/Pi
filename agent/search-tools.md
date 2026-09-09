# Search tools

Use the installed command-line search tools through `bash`:

## `fd`

Find files and directories by name. It respects `.gitignore` by default.

```bash
fd [pattern] [path]
```

Useful options:

- `--type file|directory|symlink`
- `--extension <ext>`
- `--glob`
- `--hidden`
- `--max-depth <1-64>`
- `--max-results <1-10000>`

Use `fd` for file and directory discovery. Prefer it over `find` or `ls -R`.

## `rg`

Search file contents with ripgrep. It respects `.gitignore` by default.

```bash
rg [options] <pattern> [path]
```

Useful options:

- `--glob <pattern>`
- `--type <type>`
- `--fixed-strings` for literal text
- `--hidden`
- `--context <0-20>`
- `--max-count <1-1000>`
- `--line-number --no-heading --with-filename` for stable output

Use `rg` for content searches. Prefer it over `grep`.

Keep using `bash` for pipelines and other multi-step processing. Limit output when possible.
