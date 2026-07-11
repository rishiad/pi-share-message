import type { ExtensionCommandContext, SessionEntry, SessionTreeNode } from "@earendil-works/pi-coding-agent";
import type { SharedSelectedMessage } from "./render.js";

export function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((part) => part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part ? [String(part.text)] : []).join("\n\n");
}

function selectedMessageOf(entry: SessionEntry | undefined): SharedSelectedMessage | undefined {
  if (entry?.type !== "message" || (entry.message.role !== "user" && entry.message.role !== "assistant")) return;
  const markdown = textOf(entry.message.content).trim();
  if (!markdown) return;
  const timestamp = typeof entry.message.timestamp === "number" ? entry.message.timestamp : Date.parse(entry.timestamp);
  return { id: entry.id, role: entry.message.role, markdown, timestamp: Number.isFinite(timestamp) ? timestamp : undefined, entries: [entry] };
}

export function messageTree(nodes: SessionTreeNode[], parentId: string | null = null): SessionTreeNode[] {
  return nodes.flatMap((node) => {
    const kept = selectedMessageOf(node.entry) !== undefined;
    const children = messageTree(node.children, kept ? node.entry.id : parentId);
    if (!kept) return children;
    return [{ ...node, entry: { ...node.entry, parentId }, children }];
  });
}

export function latestMessageId(ctx: ExtensionCommandContext): string | null {
  return [...ctx.sessionManager.getBranch()].reverse().find((entry) => selectedMessageOf(entry))?.id ?? null;
}

export function selectedMessageForId(ctx: ExtensionCommandContext, id: string): SharedSelectedMessage | undefined {
  return selectedMessageOf(ctx.sessionManager.getEntry(id));
}
