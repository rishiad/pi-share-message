import { TreeSelectorComponent, type ExtensionAPI, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { nanoid } from "nanoid";
import { createSecretGist, sessionUrl } from "./gist.js";
import { renderPage, type SharedTurn } from "./render.js";
import { selectSummary } from "./summarize.js";
import { assistantTree, latestAssistantId, turnForAssistantId } from "./turns.js";

async function selectTurns(ctx: ExtensionCommandContext): Promise<SharedTurn[] | undefined> {
  if (ctx.mode !== "tui") {
    ctx.ui.notify("Message selection requires interactive mode", "error");
    return;
  }

  const tree = assistantTree(ctx.sessionManager.getTree());
  if (!tree.length) {
    ctx.ui.notify("No assistant messages in this session", "warning");
    return;
  }

  const selectedId = latestAssistantId(ctx);
  const choice = await ctx.ui.custom<string | null>((tui, _theme, _keybindings, done) =>
    new TreeSelectorComponent(
      tree,
      selectedId,
      tui.terminal.rows,
      (entryId) => done(entryId),
      () => done(null),
      undefined,
      selectedId ?? undefined,
      "all",
    ),
  );

  if (!choice) return;
  const turn = turnForAssistantId(ctx, choice);
  return turn ? [turn] : undefined;
}

async function pageFor(ctx: ExtensionCommandContext): Promise<string | undefined> {
  const turns = await selectTurns(ctx);
  if (!turns) return;
  const summary = await selectSummary(ctx, turns);
  if (summary === null) return;
  return renderPage({ title: "Pi selected messages", summary, turns });
}

async function openBrowser(pi: ExtensionAPI, target: string): Promise<void> {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", target] : [target];
  const result = await pi.exec(command, args);
  if (result.code !== 0) throw new Error(result.stderr || `Could not open ${target}`);
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("view-message", {
    description: "Render a selected message and open it locally",
    handler: async (_args, ctx) => {
      try {
        const html = await pageFor(ctx);
        if (!html) return;
        const path = join(tmpdir(), `pi-message-${nanoid(10)}.html`);
        await writeFile(path, html);
        await openBrowser(pi, pathToFileURL(path).href);
        ctx.ui.notify(`Opened ${path}`, "info");
      } catch (error) { ctx.ui.notify((error as Error).message, "error"); }
    },
  });

  pi.registerCommand("share-message", {
    description: "Share a selected message through a secret GitHub Gist",
    handler: async (_args, ctx) => {
      try {
        const html = await pageFor(ctx);
        if (!html) return;
        const token = process.env.GITHUB_TOKEN || (await pi.exec("gh", ["auth", "token"])).stdout.trim();
        if (!token) throw new Error("Set GITHUB_TOKEN or authenticate with gh");
        const gist = await createSecretGist(html, { token });
        const url = sessionUrl(gist.id);
        await openBrowser(pi, url);
        ctx.ui.notify(`Published ${url}`, "info");
      } catch (error) { ctx.ui.notify((error as Error).message, "error"); }
    },
  });
}
