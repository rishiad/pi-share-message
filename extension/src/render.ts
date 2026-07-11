import { readFileSync } from "node:fs";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js/lib/common";

export interface SharedMessage {
  role: string;
  markdown: string;
  timestamp?: number;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(code, language): string {
    const name = language.trim().split(/\s+/)[0];
    if (!name || !hljs.getLanguage(name)) return "";
    try {
      const highlighted = hljs.highlight(code, { language: name }).value;
      return `<pre><code class="hljs language-${escapeHtml(name)}">${highlighted}</code></pre>`;
    } catch {
      return "";
    }
  },
});
const template = readFileSync(new URL("./template.html", import.meta.url), "utf8");

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

export function renderPage(message: SharedMessage): string {
  const data = {
    title: `${message.role[0]?.toUpperCase() ?? ""}${message.role.slice(1)} message`,
    role: message.role,
    date: message.timestamp ? new Date(message.timestamp).toLocaleString() : "",
    body: md.render(message.markdown),
  };

  return template.replace("{{data}}", escapeJsonForHtml(data));
}
