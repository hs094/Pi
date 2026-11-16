import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);
const POLL_INTERVAL_MS = 2 * 60 * 1000;

type PullRequest = {
  number: number;
  isDraft: boolean;
  title: string;
  url: string;
  repository: { nameWithOwner: string };
};

type Check = {
  bucket: string;
  name: string;
  state: string;
  link: string;
};

async function ghJson<T>(args: string[]): Promise<T> {
  const { stdout } = await execFileAsync("gh", args, {
    timeout: 30_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout) as T;
}

export default function (pi: ExtensionAPI) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let polling = false;
  const failedChecks = new Set<string>();

  async function poll(ctx: ExtensionContext) {
    if (polling) return;
    polling = true;

    try {
      const prs = await ghJson<PullRequest[]>([
        "search", "prs", "--author", "@me", "--state", "open",
        "--json", "number,isDraft,title,url,repository", "--limit", "100",
      ]);
      const currentFailures = new Set<string>();

      for (const pr of prs) {
        if (pr.isDraft) continue;
        let checks: Check[];
        try {
          checks = await ghJson<Check[]>([
            "pr", "checks", String(pr.number), "--repo", pr.repository.nameWithOwner,
            "--json", "bucket,name,state,link",
          ]);
        } catch (error) {
          // gh returns a nonzero exit code when checks have failed; its JSON is still useful.
          const stdout = (error as { stdout?: string }).stdout;
          if (!stdout) throw error;
          checks = JSON.parse(stdout) as Check[];
        }

        for (const check of checks.filter(({ bucket }) => bucket === "fail")) {
          const key = `${pr.repository.nameWithOwner}#${pr.number}:${check.name}`;
          currentFailures.add(key);
          if (!failedChecks.has(key)) {
            ctx.ui.notify(
              `CI failed: ${pr.repository.nameWithOwner}#${pr.number} — ${pr.title}\n${check.name} (${check.state})\n${check.link || pr.url}`,
              "error",
            );
          }
        }
      }

      failedChecks.clear();
      for (const key of currentFailures) failedChecks.add(key);
    } catch (error) {
      ctx.ui.notify(`PR CI monitor: ${error instanceof Error ? error.message : String(error)}`, "warning");
    } finally {
      polling = false;
    }
  }

  pi.on("session_start", (_event, ctx) => {
    if (timer) clearInterval(timer);
    void poll(ctx);
    timer = setInterval(() => void poll(ctx), POLL_INTERVAL_MS);
  });

  pi.on("session_shutdown", () => {
    if (timer) clearInterval(timer);
    timer = undefined;
  });
}
