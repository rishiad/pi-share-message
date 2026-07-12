import { completeSimple } from "@earendil-works/pi-ai/compat";
import {
  convertToLlm,
  serializeConversation,
  sessionEntryToContextMessages,
  type ExtensionCommandContext,
  type SessionEntry,
} from "@earendil-works/pi-coding-agent";
import type { SharedDocument, SharedSelectedMessage } from "./render.js";
import { rewriteInstructions, rewriteSystemPrompt } from "./rewrite-prompt.js";

const choices = [
  "Transcript",
  "Rewrite as document",
  "Rewrite as document with custom instructions",
] as const;
type OutputChoice = (typeof choices)[number];

function uniqueEntries(messages: SharedSelectedMessage[]): SessionEntry[] {
  const seen = new Set<string>();
  return messages
    .flatMap((message) => message.entries)
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
}

async function rewriteSelection(
  ctx: ExtensionCommandContext,
  messages: SharedSelectedMessage[],
  customInstructions: string | undefined,
): Promise<string> {
  const model = ctx.model;
  if (!model) throw new Error("No model available for rewriting");
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok) throw new Error(auth.error);

  const contextMessages = uniqueEntries(messages).flatMap(
    sessionEntryToContextMessages,
  );
  const source = serializeConversation(convertToLlm(contextMessages));
  const instructions = [rewriteInstructions, customInstructions?.trim()]
    .filter(Boolean)
    .join("\n\nAdditional instructions:\n");
  const prompt = `<source>\n${source}\n</source>\n\n${instructions}`;

  ctx.ui.setStatus("pi-share-message", "Rewriting selection...");
  try {
    const response = await completeSimple(
      model,
      {
        systemPrompt: rewriteSystemPrompt,
        messages: [
          {
            role: "user" as const,
            content: [{ type: "text" as const, text: prompt }],
            timestamp: Date.now(),
          },
        ],
      },
      {
        maxTokens: Math.min(
          12000,
          model.maxTokens > 0 ? model.maxTokens : 12000,
        ),
        apiKey: auth.apiKey,
        headers: auth.headers,
        env: auth.env,
      },
    );
    if (response.stopReason === "error") {
      throw new Error(response.errorMessage || "Document rewrite failed");
    }
    return response.content
      .filter(
        (part): part is { type: "text"; text: string } =>
          part.type === "text",
      )
      .map((part) => part.text)
      .join("\n")
      .trim();
  } finally {
    ctx.ui.setStatus("pi-share-message", undefined);
  }
}

export async function buildSharedDocument(
  ctx: ExtensionCommandContext,
  messages: SharedSelectedMessage[],
): Promise<SharedDocument | null> {
  const choice = await ctx.ui.select("Output format", [...choices]);
  if (choice === undefined) return null;
  if ((choice as OutputChoice) === "Transcript")
    return { title: "Pi Shared Messages", messages };

  const customInstructions =
    (choice as OutputChoice) === "Rewrite as document with custom instructions"
      ? await ctx.ui.editor("Custom rewrite instructions")
      : undefined;
  if (
    (choice as OutputChoice) ===
      "Rewrite as document with custom instructions" &&
    customInstructions === undefined
  )
    return null;

  return {
    document: await rewriteSelection(ctx, messages, customInstructions),
  };
}
