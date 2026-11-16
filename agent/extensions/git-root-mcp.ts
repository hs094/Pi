import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const cwd = process.cwd();
  let root: string;
  try { root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim(); } catch { return; }
  if (resolve(root) === resolve(cwd)) return;
  const file = join(root, ".pi", "mcp.json");
  if (!existsSync(file)) return;
  const servers = JSON.parse(readFileSync(file, "utf8")).mcpServers ?? {};
  for (const [name, config] of Object.entries(servers)) pi.registerMcpServer(name, config as any);
}
