import { generateSummary, sessionEntryToContextMessages, type ExtensionCommandContext, type SessionEntry } from "@earendil-works/pi-coding-agent";
import type { SharedDocument, SharedSelectedMessage } from "./render.js";

const choices = ["Transcript", "Rewrite as document", "Rewrite as document with custom instructions"] as const;
type OutputChoice = typeof choices[number];

const rewriteInstructions = `Rewrite the selected conversation into one cohesive standalone document.

Rules:
- Start with one concise H1 heading that names the document.
- Do not mention that this is a summary.
- Do not preserve chat turn structure.
- Organize the content as a readable document with headings.
- Preserve important code, file paths, commands, decisions, constraints, and conclusions.
- If the user asked questions and the assistant answered them, merge them into explanatory prose.
- Remove conversational filler.
- Keep technical details accurate.`;

function uniqueEntries(messages: SharedSelectedMessage[]): SessionEntry[] {
  const seen = new Set<string>();
  return messages.flatMap((message) => message.entries).filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

async function rewriteSelection(ctx: ExtensionCommandContext, messages: SharedSelectedMessage[], customInstructions: string | undefined): Promise<string> {
  const model = ctx.model;
  if (!model) throw new Error("No model available for rewriting");
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) throw new Error(auth.error);

  const contextMessages = uniqueEntries(messages).flatMap(sessionEntryToContextMessages);
  const instructions = [rewriteInstructions, customInstructions?.trim()].filter(Boolean).join("\n\nAdditional instructions:\n");

  ctx.ui.setStatus("pi-share-message", "Rewriting selection...");
  try {
    return await generateSummary(contextMessages, model, 16384, auth.apiKey, auth.headers, undefined, instructions, undefined, undefined, undefined, auth.env);
  } finally {
    ctx.ui.setStatus("pi-share-message", undefined);
  }
}

export async function buildSharedDocument(ctx: ExtensionCommandContext, messages: SharedSelectedMessage[]): Promise<SharedDocument | null> {
  const choice = await ctx.ui.select("Output format", [...choices]);
  if (choice === undefined) return null;
  if ((choice as OutputChoice) === "Transcript") return { title: "Pi Shared Messages", messages };

  const customInstructions = (choice as OutputChoice) === "Rewrite as document with custom instructions"
    ? await ctx.ui.editor("Custom rewrite instructions")
    : undefined;
  if ((choice as OutputChoice) === "Rewrite as document with custom instructions" && customInstructions === undefined) return null;

  return { document: await rewriteSelection(ctx, messages, customInstructions) };
}
