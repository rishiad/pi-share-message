import { generateSummary, sessionEntryToContextMessages, type ExtensionCommandContext, type SessionEntry } from "@earendil-works/pi-coding-agent";
import type { SharedSelectedMessage } from "./render.js";

const choices = ["No summary", "Summarize", "Summarize with custom prompt"] as const;
type SummaryChoice = typeof choices[number];

function uniqueEntries(messages: SharedSelectedMessage[]): SessionEntry[] {
  const seen = new Set<string>();
  return messages.flatMap((message) => message.entries).filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

export async function selectSummary(ctx: ExtensionCommandContext, messages: SharedSelectedMessage[]): Promise<string | undefined | null> {
  const choice = await ctx.ui.select("Summarize selection?", [...choices]);
  if (choice === undefined) return null;
  if ((choice as SummaryChoice) === "No summary") return undefined;

  const customInstructions = (choice as SummaryChoice) === "Summarize with custom prompt"
    ? await ctx.ui.editor("Custom summarization instructions")
    : undefined;
  if ((choice as SummaryChoice) === "Summarize with custom prompt" && customInstructions === undefined) return null;

  const model = ctx.model;
  if (!model) throw new Error("No model available for summarization");
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) throw new Error(auth.error);
  const contextMessages = uniqueEntries(messages).flatMap(sessionEntryToContextMessages);

  ctx.ui.setStatus("pi-share-message", "Summarizing selection...");
  try {
    return await generateSummary(contextMessages, model, 16384, auth.apiKey, auth.headers, undefined, customInstructions?.trim() || undefined, undefined, undefined, undefined, auth.env);
  } finally {
    ctx.ui.setStatus("pi-share-message", undefined);
  }
}
