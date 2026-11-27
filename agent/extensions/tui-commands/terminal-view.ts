import type { Theme } from "@earendil-works/pi-coding-agent";
import {
  CURSOR_MARKER,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import type { Component, Focusable, TUI, TuiMouseEvent, TuiMouseEventResult } from "@earendil-works/pi-tui";
import type { IPty } from "node-pty";
import type { Terminal } from "@xterm/headless";

type BufferLine = NonNullable<ReturnType<Terminal["buffer"]["active"]["getLine"]>>;
type BufferCell = NonNullable<ReturnType<BufferLine["getCell"]>>;

function sgr(cell: BufferCell | undefined): string {
  if (!cell) return "0";
  const codes = ["0"];
  if (cell.isBold()) codes.push("1");
  if (cell.isDim()) codes.push("2");
  if (cell.isItalic()) codes.push("3");
  if (cell.isUnderline()) codes.push("4");
  if (cell.isBlink()) codes.push("5");
  if (cell.isInverse()) codes.push("7");
  if (cell.isInvisible()) codes.push("8");
  if (cell.isStrikethrough()) codes.push("9");
  if (cell.isOverline()) codes.push("53");
  const color = (foreground: boolean) => {
    const prefix = foreground ? 38 : 48;
    const isRgb = foreground ? cell.isFgRGB() : cell.isBgRGB();
    const isPalette = foreground ? cell.isFgPalette() : cell.isBgPalette();
    const value = foreground ? cell.getFgColor() : cell.getBgColor();
    if (isRgb) return `${prefix};2;${(value >> 16) & 255};${(value >> 8) & 255};${value & 255}`;
    if (isPalette) return `${prefix};5;${value}`;
    return foreground ? "39" : "49";
  };
  codes.push(color(true), color(false));
  return codes.join(";");
}

export function renderTerminalRow(
  terminal: Terminal,
  row: number,
  cols: number,
  cursor = false,
): string {
  const buffer = terminal.buffer.active;
  const line = buffer.getLine(buffer.viewportY + row);
  const cell = buffer.getNullCell();
  let result = "";
  let previousStyle = "";
  for (let x = 0; x < cols; x++) {
    if (cursor && buffer.cursorY === row && buffer.cursorX === x) result += CURSOR_MARKER;
    const current = line?.getCell(x, cell) ?? cell;
    if (current.getWidth() === 0) continue;
    const style = sgr(line ? current : undefined);
    if (style !== previousStyle) {
      result += `\x1b[${style}m`;
      previousStyle = style;
    }
    result += current.getChars() || " ";
  }
  if (cursor && buffer.cursorY === row && buffer.cursorX >= cols) result += CURSOR_MARKER;
  return result + "\x1b[0m";
}

export class TerminalOverlay implements Component, Focusable {
  focused = false;
  private readonly tui: TUI;
  private readonly theme: Theme;
  private readonly name: string;
  private readonly terminal: Terminal;
  private readonly pty: IPty;

  constructor(tui: TUI, theme: Theme, name: string, terminal: Terminal, pty: IPty) {
    this.tui = tui;
    this.theme = theme;
    this.name = name;
    this.terminal = terminal;
    this.pty = pty;
  }

  render(width: number): string[] {
    const columns = Math.max(1, width - 2);
    const rows = Math.max(1, (this.tui.terminal.rows || 24) - 2);
    if (this.terminal.cols !== columns || this.terminal.rows !== rows) {
      this.terminal.resize(columns, rows);
      this.pty.resize(columns, rows);
    }

    const title = truncateToWidth(` Pi · /${this.name} `, Math.max(0, width - 3));
    const footer = truncateToWidth(" quit the command to return to Pi ", Math.max(0, width - 3));
    const topFill = Math.max(0, width - visibleWidth(title) - 3);
    const bottomFill = Math.max(0, width - visibleWidth(footer) - 3);
    const top = `╭─${title}${"─".repeat(topFill)}╮`;
    const bottom = `╰─${footer}${"─".repeat(bottomFill)}╯`;
    const lines = [this.theme.fg("borderAccent", top)];
    for (let row = 0; row < rows; row++) {
      lines.push(
        this.theme.fg("borderAccent", "│") +
          renderTerminalRow(this.terminal, row, columns, this.focused) +
          this.theme.fg("borderAccent", "│"),
      );
    }
    lines.push(this.theme.fg("borderAccent", bottom));
    return lines;
  }

  handleInput(data: string): void {
    this.pty.write(data);
  }

  handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
    const mode = this.terminal.modes.mouseTrackingMode;
    if (mode === "none" || event.x < 1 || event.x >= event.width - 1 || event.y < 1 || event.y >= event.height - 1) {
      return;
    }
    if (event.type === "click") return;

    let button: number;
    if (event.type === "wheel") {
      button = event.wheelDelta && event.wheelDelta < 0 ? 64 : 65;
    } else {
      if (event.type === "move" && mode !== "any") return;
      if (event.type === "drag" && mode !== "drag" && mode !== "any") return;
      if (event.type === "release" && mode === "x10") return;
      button = { left: 0, middle: 1, right: 2, none: 3 }[event.button];
      if (event.type === "move" || event.type === "drag") button += 32;
    }
    if (event.shift) button += 4;
    if (event.alt) button += 8;
    if (event.ctrl) button += 16;
    const release = event.type === "release";
    this.pty.write(`\x1b[<${button};${event.x};${event.y}${release ? "m" : "M"}`);
    return { handled: true, focus: true };
  }

  invalidate(): void {}
}
