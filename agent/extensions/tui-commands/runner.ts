/**
 * Runner — register /<name> commands and execute them in a Pi terminal overlay.
 */

import { createRequire } from "node:module";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { IPty, spawn as SpawnPty } from "node-pty";
import type { Terminal as HeadlessTerminal } from "@xterm/headless";
import { TerminalOverlay } from "./terminal-view.js";

const require = createRequire(import.meta.url);
const { spawn } = require("node-pty") as { spawn: typeof SpawnPty };
const { Terminal } = require("@xterm/headless") as typeof import("@xterm/headless");

const registeredNames = new Set<string>();

export function registerTuiCommand(pi: ExtensionAPI, name: string, command: string): void {
  if (registeredNames.has(name)) return;
  registeredNames.add(name);

  pi.registerCommand(name, {
    description: `Run: ${command}`,
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("Interactive commands require TUI mode", "error");
        return;
      }

      const fullCmd = args ? `${command} ${args}` : command;
      let pty: IPty | undefined;
      let terminal: HeadlessTerminal | undefined;
      let exitCode: number | undefined;
      let spawnError: unknown;
      let exited = false;

      try {
        await ctx.ui.custom<void>(
          (tui, theme, _keybindings, done) => {
            const columns = Math.max(1, tui.terminal.columns - 2);
            const rows = Math.max(1, tui.terminal.rows - 2);
            terminal = new Terminal({ cols: columns, rows, scrollback: 0, allowProposedApi: true });

            try {
              pty = spawn(process.env.SHELL || "/bin/sh", ["-c", fullCmd], {
                cols: columns,
                rows,
                cwd: process.cwd(),
                env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" },
                name: "xterm-256color",
              });
            } catch (error) {
              spawnError = error;
              terminal.dispose();
              terminal = undefined;
              queueMicrotask(() => done());
              return { render: () => [], invalidate: () => {} };
            }

            pty.onData((data) => {
              terminal?.write(data, () => tui.requestRender());
            });
            pty.onExit(({ exitCode: code }) => {
              exitCode = code;
              exited = true;
              terminal?.dispose();
              terminal = undefined;
              done();
            });

            return new TerminalOverlay(tui, theme, name, terminal, pty);
          },
          {
            overlay: true,
            overlayOptions: { anchor: "center", width: "100%", maxHeight: "100%" },
          },
        );
      } catch (error) {
        spawnError ??= error;
      } finally {
        if (!exited) pty?.kill();
        terminal?.dispose();
      }

      if (spawnError) {
        ctx.ui.notify(`Could not start ${name}: ${String(spawnError)}`, "error");
        return;
      }

      const msg =
        exitCode === 0
          ? `"${fullCmd}" done`
          : `"${fullCmd}" exited with code ${exitCode}`;
      ctx.ui.notify(msg, exitCode === 0 ? "info" : "error");
    },
  });
}

export function syncEnabled(
  pi: ExtensionAPI,
  enabled: string[],
  knownTools: { name: string; cmd: string }[],
  customs: Record<string, string>,
): void {
  for (const name of enabled) {
    const known = knownTools.find((t) => t.name === name);
    if (known) {
      registerTuiCommand(pi, name, known.cmd);
    } else if (customs[name]) {
      registerTuiCommand(pi, name, customs[name]);
    }
  }
}
