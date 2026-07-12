import type { SharedDocument, SharedSelectedMessage } from "./render.js";

export interface CachedDocument {
  key: string;
  title: string;
  document: SharedDocument & { document: string };
  createdAt: Date;
}

const cache = new Map<string, CachedDocument[]>();

export function selectionKey(messages: SharedSelectedMessage[]): string {
  return messages
    .map((message) => message.id)
    .sort()
    .join("\0");
}

function titleFromMarkdown(markdown: string): string {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || "Generated document";
}

export function rememberDocument(
  messages: SharedSelectedMessage[],
  document: SharedDocument,
): CachedDocument | undefined {
  if (document.document === undefined) return;
  const key = selectionKey(messages);
  const cached = {
    key,
    title: document.title ?? titleFromMarkdown(document.document),
    document: { ...document, document: document.document },
    createdAt: new Date(),
  };
  const entries = cache.get(key) ?? [];
  cache.set(key, [cached, ...entries].slice(0, 5));
  return cached;
}

export function documentsFor(messages: SharedSelectedMessage[]): CachedDocument[] {
  return cache.get(selectionKey(messages)) ?? [];
}
