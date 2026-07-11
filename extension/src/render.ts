import { readFileSync } from "node:fs";
import MarkdownIt from "markdown-it";
import { bundledLanguages, codeToHtml, type BundledLanguage } from "shiki";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export interface SharedMessage {
  role: string;
  markdown: string;
  timestamp?: number;
}

export interface SharedTurn {
  id: string;
  user?: SharedMessage;
  assistant: SharedMessage;
  entries: SessionEntry[];
}

export interface SharedDocument {
  title?: string;
  summary?: string;
  turns: SharedTurn[];
}

interface CodeBlock {
  placeholder: string;
  code: string;
  language: string;
}

const template = readFileSync(new URL("./template.html", import.meta.url), "utf8");
const shikiTheme = "github-light";

function shikiLanguage(language: string): BundledLanguage | "text" {
  const name = language.trim().split(/\s+/)[0]?.toLowerCase();
  return name && name in bundledLanguages ? (name as BundledLanguage) : "text";
}

function markdown(blocks: CodeBlock[]): MarkdownIt {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
  md.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index];
    const placeholder = `<!--pi-code-block-${blocks.length}-->`;
    blocks.push({ placeholder, code: token.content, language: token.info });
    return `${placeholder}\n`;
  };
  return md;
}

async function renderMarkdown(markdownText: string): Promise<string> {
  const blocks: CodeBlock[] = [];
  let html = markdown(blocks).render(markdownText);
  const highlighted = await Promise.all(
    blocks.map((block) => codeToHtml(block.code, { lang: shikiLanguage(block.language), theme: shikiTheme })),
  );
  blocks.forEach((block, index) => {
    html = html.replace(block.placeholder, highlighted[index]);
  });
  return html;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
}

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

function isDocument(value: SharedMessage | SharedDocument): value is SharedDocument {
  return "turns" in value;
}

function dateRange(turns: SharedTurn[]): string {
  const timestamps = turns.flatMap((turn) => [turn.user?.timestamp, turn.assistant.timestamp]).filter((value): value is number => typeof value === "number");
  if (!timestamps.length) return "";
  const first = new Date(Math.min(...timestamps)).toLocaleString();
  const last = new Date(Math.max(...timestamps)).toLocaleString();
  return first === last ? first : `${first} – ${last}`;
}

async function renderTurn(turn: SharedTurn, index: number): Promise<string> {
  const user = turn.user ? await renderMarkdown(turn.user.markdown) : "";
  const assistant = await renderMarkdown(turn.assistant.markdown);
  const date = turn.assistant.timestamp ? new Date(turn.assistant.timestamp).toLocaleString() : "";
  return `<section class="turn">
<h1 id="turn-${escapeHtml(turn.id)}">Turn ${index + 1}</h1>
${date ? `<div class="turn-meta">${escapeHtml(date)}</div>` : ""}
${turn.user ? `<section class="turn-card turn-card-user"><h2>User</h2><div>${user}</div></section>` : ""}
<section class="turn-card turn-card-assistant"><h2>Assistant</h2><div>${assistant}</div></section>
</section>`;
}

async function renderDocument(document: SharedDocument): Promise<{ title: string; role: string; date: string; body: string }> {
  const summary = document.summary ? `<section class="summary-card"><h1 id="summary">Summary</h1>${await renderMarkdown(document.summary)}</section>` : "";
  const turns = await Promise.all(document.turns.map(renderTurn));
  const count = document.turns.length;
  return {
    title: document.title ?? `${count} selected message pair${count === 1 ? "" : "s"}`,
    role: `${count} selected message pair${count === 1 ? "" : "s"}`,
    date: dateRange(document.turns),
    body: `${summary}${turns.join("\n")}`,
  };
}

export async function renderPage(message: SharedMessage | SharedDocument): Promise<string> {
  const data = isDocument(message) ? await renderDocument(message) : {
    title: `${message.role[0]?.toUpperCase() ?? ""}${message.role.slice(1)} message`,
    role: message.role,
    date: message.timestamp ? new Date(message.timestamp).toLocaleString() : "",
    body: await renderMarkdown(message.markdown),
  };

  return template.replace("{{data}}", escapeJsonForHtml(data));
}
