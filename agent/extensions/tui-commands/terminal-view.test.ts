import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { CURSOR_MARKER, visibleWidth } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import type { IPty } from "node-pty";
import { renderTerminalRow, TerminalOverlay } from "./terminal-view.ts";

const require = createRequire(import.meta.url);
const { Terminal } = require("@xterm/headless") as typeof import("@xterm/headless");
const { spawn } = require("node-pty") as typeof import("node-pty");

test("renders ANSI colors and wide characters at the PTY row width", async () => {
  const terminal = new Terminal({ cols: 10, rows: 2, allowProposedApi: true });
  await new Promise<void>((resolve) => {
    terminal.write("\x1b[38;2;12;34;56mA\x1b[0m猫", resolve);
  });

  const row = renderTerminalRow(terminal, 0, terminal.cols);
  assert.match(row, /A/);
  assert.match(row, /猫/);
  assert.match(row, /38;2;12;34;56/);
  assert.equal(visibleWidth(row), terminal.cols);
  assert.ok(renderTerminalRow(terminal, 0, terminal.cols, true).includes(CURSOR_MARKER));
  terminal.dispose();
});

test("wraps the PTY view in a Pi overlay frame", async () => {
  const terminal = new Terminal({ cols: 58, rows: 6, allowProposedApi: true });
  await new Promise<void>((resolve) => terminal.write("lazygit\x1b[?1000h", resolve));
  const tui = { terminal: { rows: 8 } } as unknown as TUI;
  const theme = { fg: (_color: string, value: string) => value } as unknown as Theme;
  const received: string[] = [];
  const pty = { write(data: string) { received.push(data); }, resize() {} } as unknown as IPty;
  const overlay = new TerminalOverlay(tui, theme, "lazygit", terminal, pty);

  const frame = overlay.render(60);
  assert.equal(frame.length, 8);
  assert.ok(frame[0].startsWith("╭─ Pi · /lazygit"));
  assert.match(frame[1], /lazygit/);
  assert.match(frame.at(-1)!, /quit the command to return to Pi/);
  assert.equal(visibleWidth(frame[0]), 60);
  overlay.handleInput("q");
  assert.equal(received[0], "q");
  const mouseResult = overlay.handleMouse({
    type: "press", button: "left", x: 4, y: 2, screenX: 4, screenY: 2,
    width: 60, height: 8, shift: false, alt: false, ctrl: false,
  });
  assert.equal(received[1], "\x1b[<0;4;2M");
  assert.equal(mouseResult?.handled, true);
  terminal.dispose();
});

test("runs an interactive command in a foreground PTY", async () => {
  const pty = spawn("/bin/sh", ["-c", "printf PTY_OK"], {
    cols: 80,
    rows: 24,
    name: "xterm-256color",
    cwd: process.cwd(),
    env: process.env,
  });
  let output = "";
  await new Promise<void>((resolve) => {
    pty.onData((data) => (output += data));
    pty.onExit(() => resolve());
  });
  assert.match(output, /PTY_OK/);
});
