# pi

Personal configuration and tooling for the [pi coding agent](https://github.com/earendil-works/pi-coding-agent) — settings, custom extensions, curated skills, and workflows. Clone into `~/.pi` to use.

## Layout

| Path | Contents |
| --- | --- |
| `agent/settings.json` | Agent configuration: models, themes, packages, follow-up/steering modes |
| `agent/AGENTS.md`, `agent/PYTHON.md` | Coding rules enforced for every session |
| `agent/extensions/` | Custom pi extensions: `ask-user`, `background-terminals`, `copy-all`, `file-search`, `git-info`, `model-info`, `pi-permission-system`, `ui-customization` |
| `agent/skills/` | 35+ curated skills: planning (`spec-driven-development`, `scoping-cutting`, `to-spec`, `grilling`), workflows (`implement`, `research`, `handoff`, `prototype`), review/debugging (`code-review`, `systematic-debugging`, `diagnosing-bugs`, `codebase-design`, `simplify`), plus TDD, wizard, writing-for-agents, and more |
| `agent/themes/` | Custom theme (`github-dark-default`) |
| `byte-pi-web/` | Companion web-tooling config |

## Install

```sh
git clone git@github.com:hs094/Pi.git ~/.pi
```

The `agent/` directory is pi's default config location; extensions and skills are picked up automatically. See `agent/settings.json` for the enabled package list.