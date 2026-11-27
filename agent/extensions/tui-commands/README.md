# Pi TUI Commands

Register interactive tools (lazygit, nvim, htop, and custom commands) as Pi
slash commands. Each runs in the foreground in a PTY rendered inside a Pi
overlay; it is not a background terminal.

## Commands

| Command                  | What it does                 |
| ------------------------ | ---------------------------- |
| `/tuicmd`                | Open the interactive manager |
| `/tuicmd add lg lazygit` | Register `/lg` → `lazygit`   |
| `/tuicmd rm lg`          | Remove `/lg`                 |
| `/lazygit`               | (if enabled) Run lazygit     |

In the manager, Enter toggles a tool and / searches. Type the tool's normal quit
key to return to Pi. The overlay title identifies the active Pi command.

## Settings

The extension and its settings live together in
`~/.pi/agent/extensions/tui-commands/`. Enabled commands and custom commands
are saved in `tui-commands.json`.

Pi auto-loads extensions from this folder. Run `/reload` after installing or
updating the extension.
