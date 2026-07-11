import { TreeSelectorComponent, type ExtensionAPI, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { nanoid } from "nanoid";
import { createSecretGist, sessionUrl } from "./gist.js";
import { renderPage, type SharedSelectedMessage } from "./render.js";
import { selectSummary } from "./summarize.js";
import { latestMessageId, messageTree, selectedMessageForId } from "./turns.js";

function patchMultiSelect(selector: TreeSelectorComponent, keybindings: Parameters<Parameters<ExtensionCommandContext["ui"]["custom"]>[0]>[2], theme: Parameters<Parameters<ExtensionCommandContext["ui"]["custom"]>[0]>[1], done: (ids: string[] | null) => void): void {
  const treeList = selector.getTreeList() as unknown as {
    handleInput: (keyData: string) => void;
    getSelectedNode: () => { entry: { id: string } } | undefined;
    getStatusLabels?: () => string;
    getEntryDisplayText?: (node: { entry: { id: string } }, isSelected: boolean) => string;
  };
  const selected = new Set<string>();
  const originalHandleInput = treeList.handleInput.bind(treeList);
  const originalStatus = treeList.getStatusLabels?.bind(treeList);
  const originalDisplay = treeList.getEntryDisplayText?.bind(treeList);
  const selectedId = () => treeList.getSelectedNode()?.entry.id;

  treeList.handleInput = (keyData) => {
    if (keyData === " ") {
      const id = selectedId();
      if (!id) return;
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      return;
    }
    if (keybindings.matches(keyData, "tui.select.confirm")) {
      const ids = selected.size ? [...selected] : selectedId() ? [selectedId()!] : [];
      done(ids.length ? ids : null);
      return;
    }
    originalHandleInput(keyData);
  };

  if (originalStatus) {
    treeList.getStatusLabels = () => `${originalStatus()} | ${selected.size} selected`;
  }
  if (originalDisplay) {
    treeList.getEntryDisplayText = (node, isSelected) => {
      const box = selected.has(node.entry.id) ? theme.fg("accent", "☑ ") : theme.fg("muted", "☐ ");
      return box + originalDisplay(node, isSelected);
    };
  }
}

async function selectMessages(ctx: ExtensionCommandContext): Promise<SharedSelectedMessage[] | undefined> {
  if (ctx.mode !== "tui") {
    ctx.ui.notify("Message selection requires interactive mode", "error");
    return;
  }

  const tree = messageTree(ctx.sessionManager.getTree());
  if (!tree.length) {
    ctx.ui.notify("No user or assistant messages in this session", "warning");
    return;
  }

  const selectedId = latestMessageId(ctx);
  const ids = await ctx.ui.custom<string[] | null>((tui, theme, keybindings, done) => {
    const selector = new TreeSelectorComponent(
      tree,
      selectedId,
      tui.terminal.rows,
      (entryId) => done([entryId]),
      () => done(null),
      undefined,
      selectedId ?? undefined,
      "all",
    );
    patchMultiSelect(selector, keybindings, theme, done);
    return selector;
  });

  const messages = ids?.flatMap((id) => {
    const message = selectedMessageForId(ctx, id);
    return message ? [message] : [];
  });
  return messages?.length ? messages : undefined;
}

async function pageFor(ctx: ExtensionCommandContext): Promise<string | undefined> {
  const messages = await selectMessages(ctx);
  if (!messages) return;
  const summary = await selectSummary(ctx, messages);
  if (summary === null) return;
  return renderPage({ title: "Pi selected messages", summary, messages });
}

async function openBrowser(pi: ExtensionAPI, target: string): Promise<void> {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", target] : [target];
  const result = await pi.exec(command, args);
  if (result.code !== 0) throw new Error(result.stderr || `Could not open ${target}`);
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("view-message", {
    description: "Render selected messages and open them locally",
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
    description: "Share selected messages through a secret GitHub Gist",
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
