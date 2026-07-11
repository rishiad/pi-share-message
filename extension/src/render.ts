import { readFileSync } from "node:fs";
import MarkdownIt from "markdown-it";
import { bundledLanguages, codeToHtml, type BundledLanguage } from "shiki";

export interface SharedMessage {
  role: string;
  markdown: string;
  timestamp?: number;
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

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

export async function renderPage(message: SharedMessage): Promise<string> {
  const data = {
    title: `${message.role[0]?.toUpperCase() ?? ""}${message.role.slice(1)} message`,
    role: message.role,
    date: message.timestamp ? new Date(message.timestamp).toLocaleString() : "",
    body: await renderMarkdown(message.markdown),
  };

  return template.replace("{{data}}", escapeJsonForHtml(data));
}
