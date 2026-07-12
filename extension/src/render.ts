import { readFileSync } from "node:fs";
import MarkdownIt from "markdown-it";
import { bundledLanguages, codeToHtml, type BundledLanguage } from "shiki";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export interface SharedMessage {
  role: string;
  markdown: string;
  timestamp?: number;
}

export interface SharedSelectedMessage extends SharedMessage {
  id: string;
  role: "user" | "assistant";
  entries: SessionEntry[];
}

export interface SharedDocument {
  title?: string;
  document?: string;
  messages?: SharedSelectedMessage[];
}

interface CodeBlock {
  placeholder: string;
  code: string;
  language: string;
}

const template = readFileSync(
  new URL("./template/document.html", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("./template/styles.css", import.meta.url),
  "utf8",
);
const script = readFileSync(
  new URL("./template/client.js", import.meta.url),
  "utf8",
);
const pageTemplate = template
  .replace("{{styles}}", styles)
  .replace("{{script}}", script);
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
    blocks.map((block) =>
      codeToHtml(block.code, {
        lang: shikiLanguage(block.language),
        theme: shikiTheme,
      }),
    ),
  );
  blocks.forEach((block, index) => {
    html = html.replace(block.placeholder, highlighted[index]);
  });
  return html;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!,
  );
}

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function isDocument(
  value: SharedMessage | SharedDocument,
): value is SharedDocument {
  return "document" in value || "messages" in value;
}

async function renderSelectedMessage(message: SharedSelectedMessage): Promise<string> {
  const body = await renderMarkdown(message.markdown);
  const role = message.role[0].toUpperCase() + message.role.slice(1);
  return `<article class="message message-${escapeHtml(message.role)}" id="message-${escapeHtml(message.id)}">
<div class="message-role">${escapeHtml(role)}</div>
<div class="message-body">${body}</div>
</article>`;
}

async function renderTranscript(messages: SharedSelectedMessage[]): Promise<string> {
  const rendered = await Promise.all(messages.map(renderSelectedMessage));
  return `<section class="conversation">${rendered.join("\n")}</section>`;
}

async function renderDocument(
  document: SharedDocument,
): Promise<{ title: string; role: string; date: string; body: string }> {
  if (document.document !== undefined) {
    return {
      title: document.title ?? "Pi shared document",
      role: "document",
      date: "",
      body: await renderMarkdown(document.document),
    };
  }

  const messages = document.messages ?? [];
  const count = messages.length;
  return {
    title: document.title ?? `${count} selected message${count === 1 ? "" : "s"}`,
    role: `${count} selected message${count === 1 ? "" : "s"}`,
    date: "",
    body: await renderTranscript(messages),
  };
}

export async function renderPage(
  message: SharedMessage | SharedDocument,
): Promise<string> {
  const data = isDocument(message)
    ? await renderDocument(message)
    : {
        title: `${message.role[0]?.toUpperCase() ?? ""}${message.role.slice(1)} message`,
        role: message.role,
        date: "",
        body: await renderMarkdown(message.markdown),
      };

  return pageTemplate.replace("{{data}}", escapeJsonForHtml(data));
}
