import { fileURLToPath } from "node:url";
import { CustomEditor, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";

const TERM_TIMEOUT_MS = 1_000;
const MAX_BUFFER = 128 * 1024;
const MAX_SUGGESTIONS = 8;
const EXCLUDE_FILE = fileURLToPath(new URL("./exclude.json", import.meta.url));
const CODE_EXTENSIONS = new Set([
  "c", "cc", "cpp", "cs", "go", "h", "hpp", "java", "js", "jsx", "kt", "php", "py", "rb", "rs",
  "swift", "ts", "tsx", "vue",
]);
let suggestNextSubmission = false;
let editorInstalled = false;

function promptTerms(prompt: string): string[] {
  const words = prompt
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? [];
  return [...new Set(words.filter((word) => word.length > 1))];
}

async function isExcludedTerm(pi: ExtensionAPI, term: string): Promise<boolean> {
  const result = await pi.exec(
    "rg",
    ["--quiet", "--fixed-strings", "-e", `"${term}",`, "-e", `"${term}"`, "--", EXCLUDE_FILE],
    { timeout: TERM_TIMEOUT_MS, maxBuffer: MAX_BUFFER },
  );
  return result.code === 0;
}

async function filesMatchingTerm(pi: ExtensionAPI, cwd: string, term: string): Promise<string[]> {
  const result = await pi.exec(
    "rg",
    ["--files", "--hidden", "--null", "--glob", "!.git/**", "--iglob", `**/*${term}*`],
    { cwd, timeout: TERM_TIMEOUT_MS, maxBuffer: MAX_BUFFER },
  );
  if (result.code !== 0 || result.killed || result.truncated) return [];
  return result.stdout.split("\0").filter(Boolean);
}

function pathTerms(path: string): {
  filename: Set<string>;
  directories: Set<string>;
  extension: Set<string>;
  isCode: boolean;
} {
  const pieces = path.split("/");
  const filename = pieces.pop() ?? "";
  const extensionName = filename.split(".").pop()?.toLowerCase() ?? "";
  const base = filename.replace(/\.[^.]+$/, "");
  const tokenize = (value: string) =>
    new Set(value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().match(/[a-z0-9]+/g) ?? []);
  return {
    filename: tokenize(base),
    directories: new Set(pieces.flatMap((part) => [...tokenize(part)])),
    extension: tokenize(extensionName),
    isCode: CODE_EXTENSIONS.has(extensionName),
  };
}

function termMatches(term: string, values: Set<string>): boolean {
  return values.has(term) || (term.endsWith("s") ? values.has(term.slice(0, -1)) : values.has(`${term}s`));
}

function rankFiles(prompt: string, paths: string[]): Array<{ path: string; terms: string[]; score: number; isCode: boolean }> {
  const terms = promptTerms(prompt);
  return paths
    .map((path) => {
      const tokens = pathTerms(path);
      const matched: string[] = [];
      let score = 0;
      for (const term of terms) {
        const extensionMatch = termMatches(term, tokens.extension);
        const filenameMatch = termMatches(term, tokens.filename);
        const directoryMatch = termMatches(term, tokens.directories);
        if (extensionMatch || filenameMatch || directoryMatch) {
          matched.push(term);
          score += extensionMatch ? 8 : filenameMatch ? 4 : 2;
        }
      }
      return { path, terms: matched, score, isCode: tokens.isCode };
    })
    .filter(({ terms, score }) => score > 0 && (terms.length >= 2 || score >= 4))
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.isCode) - Number(a.isCode) ||
        b.terms.length - a.terms.length ||
        a.path.localeCompare(b.path),
    )
    .slice(0, MAX_SUGGESTIONS);
}

async function chooseFiles(
  ctx: ExtensionContext,
  suggestions: Array<{ path: string; terms: string[] }>,
): Promise<string[]> {
  const selected = new Set<string>();
  for (;;) {
    const choices = [
      ...suggestions.map(({ path, terms }) =>
        `${selected.has(path) ? "[x]" : "[ ]"} ${path}  (matches: ${terms.join(", ")})`,
      ),
      "Send with selected files",
      "Send unchanged",
    ];
    const choice = await ctx.ui.select("Relevant paths — toggle files to include:", choices);
    if (!choice || choice === "Send unchanged") return [];
    if (choice === "Send with selected files") return [...selected];

    const suggestion = suggestions.find(({ path, terms }) =>
      choice.endsWith(`${path}  (matches: ${terms.join(", ")})`),
    );
    if (suggestion) {
      if (selected.has(suggestion.path)) selected.delete(suggestion.path);
      else selected.add(suggestion.path);
    }
  }
}

export default function promptFileSuggestions(pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (editorInstalled || !ctx.hasUI) return;
    editorInstalled = true;
    const previousEditor = ctx.ui.getEditorComponent();
    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      const editor = previousEditor
        ? previousEditor(tui, theme, keybindings)
        : new CustomEditor(tui, theme, keybindings);
      const handleInput = editor.handleInput.bind(editor);
      editor.handleInput = (data: string) => {
        if (matchesKey(data, "ctrl+shift+enter")) {
          const text = editor.getText().trimStart();
          suggestNextSubmission = Boolean(text && !text.startsWith("/"));
          handleInput("\r");
          return;
        }
        handleInput(data);
      };
      return editor;
    });
  });

  pi.on("input", async (event, ctx) => {
    const shouldSuggest = suggestNextSubmission;
    suggestNextSubmission = false;
    if (
      !shouldSuggest ||
      event.source !== "interactive" ||
      event.streamingBehavior ||
      !ctx.hasUI
    ) return { action: "continue" as const };

    const terms = promptTerms(event.text);
    if (!terms.length) return { action: "continue" as const };

    try {
      // Each term is checked and searched with its own timeout; term workers run concurrently.
      const matches = await Promise.all(terms.map(async (term) =>
        await isExcludedTerm(pi, term) ? [] : filesMatchingTerm(pi, ctx.cwd, term),
      ));
      const suggestions = rankFiles(event.text, [...new Set(matches.flat())]);
      if (!suggestions.length) return { action: "continue" as const };

      const selected = await chooseFiles(ctx, suggestions);
      if (!selected.length) return { action: "continue" as const };

      return {
        action: "transform" as const,
        text: `${event.text}\n\nPotentially relevant files selected by you:\n${selected.map((path) => `- ${path}`).join("\n")}`,
        images: event.images,
      };
    } catch {
      return { action: "continue" as const };
    }
  });
}
