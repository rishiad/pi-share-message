import type { ExtensionCommandContext, SessionEntry, SessionTreeNode } from "@earendil-works/pi-coding-agent";
import type { SharedMessage, SharedTurn } from "./render.js";

export function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((part) => part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part ? [String(part.text)] : []).join("\n\n");
}

function messageOf(entry: SessionEntry | undefined, role: "user" | "assistant"): SharedMessage | undefined {
  if (entry?.type !== "message" || entry.message.role !== role) return;
  const markdown = textOf(entry.message.content).trim();
  if (!markdown) return;
  const timestamp = typeof entry.message.timestamp === "number" ? entry.message.timestamp : Date.parse(entry.timestamp);
  return { role, markdown, timestamp: Number.isFinite(timestamp) ? timestamp : undefined };
}

function assistantText(node: SessionTreeNode): string | undefined {
  return messageOf(node.entry, "assistant")?.markdown;
}

export function assistantTree(nodes: SessionTreeNode[], parentId: string | null = null): SessionTreeNode[] {
  return nodes.flatMap((node) => {
    const kept = assistantText(node) !== undefined;
    const children = assistantTree(node.children, kept ? node.entry.id : parentId);
    if (!kept) return children;
    return [{ ...node, entry: { ...node.entry, parentId }, children }];
  });
}

export function latestAssistantId(ctx: ExtensionCommandContext): string | null {
  return [...ctx.sessionManager.getBranch()].reverse().find((entry) => messageOf(entry, "assistant"))?.id ?? null;
}

export function turnForAssistantId(ctx: ExtensionCommandContext, id: string): SharedTurn | undefined {
  const entry = ctx.sessionManager.getEntry(id);
  const assistant = messageOf(entry, "assistant");
  if (!entry || !assistant) return;
  const branch = ctx.sessionManager.getBranch(id);
  const userEntry = [...branch].reverse().find((item) => item.id !== id && item.type === "message" && item.message.role === "user");
  return { id, user: messageOf(userEntry, "user"), assistant, entries: userEntry ? [userEntry, entry] : [entry] };
}
