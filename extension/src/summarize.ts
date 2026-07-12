import { completeSimple } from "@earendil-works/pi-ai/compat";
import {
  convertToLlm,
  serializeConversation,
  sessionEntryToContextMessages,
  type ExtensionCommandContext,
  type SessionEntry,
} from "@earendil-works/pi-coding-agent";
import type { SharedDocument, SharedSelectedMessage } from "./render.js";

const choices = [
  "Transcript",
  "Rewrite as document",
  "Rewrite as document with custom instructions",
] as const;
type OutputChoice = (typeof choices)[number];

const rewriteSystemPrompt = `You are a senior engineer writing a technical article for other engineers.
Write in clear explanatory prose. Do not write a project-status report, task tracker, meeting notes, or AI summary.`;

const rewriteInstructions = `Turn the selected conversation into a polished technical article that can be shared with someone who has not read the conversation.

The article should preserve the reasoning and discoveries from the discussion, not merely extract decisions or produce a project-status document.

Mandatory output shape:
- Start with exactly one concise, descriptive H1 title.
- Follow with connected paragraphs that explain the problem, why it matters, and the central design conclusion.
- Use H2/H3 sections only when they help the article's argument.
- Lists are allowed only for genuinely enumerable APIs, data structures, trade-offs, or criteria. Most sections should be prose.
- Do not use checkbox lists.
- Do not use status-report headings or labels, including: Goal, Constraints & Preferences, Progress, Done, In Progress, Blocked, Key Decisions, Next Steps, Critical Context.
- Do not include a TODO list, implementation checklist, or project plan unless the selected source is itself only about a project plan.

Writing requirements:
- Organize the article around the technical argument and progression of ideas.
- Explain alternatives that were considered, why they were rejected or retained, and the trade-offs involved.
- Clearly distinguish established facts, design decisions, recommendations, unresolved questions, and speculative future work in prose.
- Preserve important code, trait names, file paths, commands, data layouts, constraints, and implementation details.
- Include code blocks only when they materially clarify the design.
- Integrate questions and answers into continuous explanatory prose.
- Avoid chat language, repetition, filler, and references to “the conversation,” “the user,” or “the assistant.”
- Do not invent decisions, implementation status, certainty, or terminology that was not present in the source.
- Preserve important nuance rather than compressing everything into conclusions.
- End with a brief prose conclusion about the resulting design and remaining engineering questions.

The finished article should read like a technical design essay or engineering note written by a knowledgeable author.`;

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
