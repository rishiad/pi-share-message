import { readFileSync } from "node:fs";
import MarkdownIt from "markdown-it";

export interface SharedMessage {
  role: string;
  markdown: string;
  timestamp?: number;
}

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
const template = readFileSync(new URL("./template.html", import.meta.url), "utf8");

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function renderPage(message: SharedMessage): string {
  const body = md.render(message.markdown);
  const title = `${message.role[0]?.toUpperCase() ?? ""}${message.role.slice(1)} message`;
  const values: Record<string, string> = {
    title: escapeHtml(title),
    role: escapeHtml(message.role),
    date: message.timestamp ? escapeHtml(new Date(message.timestamp).toLocaleString()) : "",
    body,
  };

  return template.replace(/\{\{(title|role|date|body)\}\}/g, (_match, key: string) => values[key]!);
}
