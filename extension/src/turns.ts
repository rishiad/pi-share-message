import type { ExtensionCommandContext, SessionEntry, SessionTreeNode, Theme } from "@earendil-works/pi-coding-agent";
import type { Component, KeybindingsManager } from "@earendil-works/pi-tui";
import { truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { SharedMessage, SharedTurn } from "./render.js";

export interface TurnNode {
  turn: SharedTurn;
  children: TurnNode[];
}

interface FlatTurn {
  node: TurnNode;
  prefix: string;
}

export function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((part) => part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part ? [String(part.text)] : []).join("\n\n");
}

function messageOf(entry: SessionEntry | undefined, role: "user" | "assistant"): SharedMessage | undefined {
  if (entry?.type !== "message" || entry.message.role !== role) return;
  const markdown = textOf(entry.message.content).trim();
  if (!markdown) return;
  const timestamp = typeof entry.message.timestamp === "number" ? entry.message.timestamp : Date.parse(entry.timestamp);
  return { role, markdown, timestamp: Number.isFinite(timestamp) ? timestamp : undefined };
}

function turnForAssistant(ctx: ExtensionCommandContext, entry: SessionEntry): SharedTurn | undefined {
  const assistant = messageOf(entry, "assistant");
  if (!assistant) return;
  const branch = ctx.sessionManager.getBranch(entry.id);
  const userEntry = [...branch].reverse().find((item) => item.id !== entry.id && item.type === "message" && item.message.role === "user");
  return { id: entry.id, user: messageOf(userEntry, "user"), assistant, entries: userEntry ? [userEntry, entry] : [entry] };
}

export function turnTree(ctx: ExtensionCommandContext, nodes: SessionTreeNode[]): TurnNode[] {
  return nodes.flatMap((node) => {
    const turn = turnForAssistant(ctx, node.entry);
    const children = turnTree(ctx, node.children);
    return turn ? [{ turn, children }] : children;
  });
}

export function latestTurnId(ctx: ExtensionCommandContext): string | undefined {
  return [...ctx.sessionManager.getBranch()].reverse().find((entry) => messageOf(entry, "assistant"))?.id;
}

function flatten(nodes: TurnNode[], prefix = ""): FlatTurn[] {
  return nodes.flatMap((node, index) => {
    const last = index === nodes.length - 1;
    const branch = prefix ? `${prefix}${last ? "└─ " : "├─ "}` : nodes.length > 1 ? `${last ? "└─ " : "├─ "}` : "";
    const childPrefix = `${prefix}${last ? "   " : "│  "}`;
    return [{ node, prefix: branch }, ...flatten(node.children, childPrefix)];
  });
}

function excerpt(markdown: string, limit = 120): string {
  const text = markdown.replace(/[#*_`>\-[\]()]/g, " ").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

export class MultiTurnSelector implements Component {
  private rows: FlatTurn[];
  private selected = new Set<string>();
  private index = 0;
  private maxRows: number;

  constructor(nodes: TurnNode[], initialId: string | undefined, terminalRows: number, private theme: Theme, private keybindings: KeybindingsManager, private done: (turns: SharedTurn[] | null) => void) {
    this.rows = flatten(nodes);
    this.maxRows = Math.max(5, Math.floor(terminalRows * 0.45));
    if (initialId) {
      this.index = Math.max(0, this.rows.findIndex((row) => row.node.turn.id === initialId));
      this.selected.add(initialId);
    }
  }

  invalidate(): void {}

  render(width: number): string[] {
    const lines = [
      this.theme.bold("  Select messages"),
      this.theme.fg("muted", "  Space toggle · A all · X clear · Enter continue · Esc cancel"),
      this.theme.fg("borderMuted", "  " + "─".repeat(Math.max(0, width - 2))),
    ];

    if (!this.rows.length) return [...lines, this.theme.fg("muted", "  No assistant messages found")];

    const start = Math.max(0, Math.min(this.index - Math.floor(this.maxRows / 2), this.rows.length - this.maxRows));
    const end = Math.min(start + this.maxRows, this.rows.length);
    for (let rowIndex = start; rowIndex < end; rowIndex += 1) {
      const row = this.rows[rowIndex];
      const selected = this.selected.has(row.node.turn.id);
      const cursor = rowIndex === this.index ? this.theme.fg("accent", "›") : " ";
      const box = selected ? this.theme.fg("accent", "☑") : this.theme.fg("muted", "☐");
      const title = `${row.prefix}${excerpt(row.node.turn.user?.markdown ?? row.node.turn.assistant.markdown)}`;
      let line = truncateToWidth(` ${cursor} ${box} ${title}`, width);
      if (rowIndex === this.index) line = this.theme.bg("selectedBg", line);
      lines.push(line);
    }

    lines.push(this.theme.fg("muted", `  (${this.index + 1}/${this.rows.length}) ${this.selected.size} selected`));
    const current = this.rows[this.index]?.node.turn;
    if (current) {
      lines.push(this.theme.fg("borderMuted", "  " + "─".repeat(Math.max(0, width - 2))));
      lines.push(this.theme.fg("muted", "  Preview"));
      const preview = [`user: ${excerpt(current.user?.markdown ?? "(no paired user message)", 180)}`, `assistant: ${excerpt(current.assistant.markdown, 220)}`];
      for (const text of preview) lines.push(...wrapTextWithAnsi(`  ${text}`, Math.max(1, width)).slice(0, 2).map((line) => this.theme.fg("dim", line)));
    }
    return lines;
  }

  handleInput(keyData: string): void {
    if (this.keybindings.matches(keyData, "tui.select.up")) this.index = this.index === 0 ? this.rows.length - 1 : this.index - 1;
    else if (this.keybindings.matches(keyData, "tui.select.down")) this.index = this.index === this.rows.length - 1 ? 0 : this.index + 1;
    else if (this.keybindings.matches(keyData, "tui.select.pageUp")) this.index = Math.max(0, this.index - this.maxRows);
    else if (this.keybindings.matches(keyData, "tui.select.pageDown")) this.index = Math.min(this.rows.length - 1, this.index + this.maxRows);
    else if (this.keybindings.matches(keyData, "tui.select.confirm")) this.done(this.chosenTurns());
    else if (this.keybindings.matches(keyData, "tui.select.cancel")) this.done(null);
    else if (keyData === " ") this.toggleCurrent();
    else if (keyData.toLowerCase() === "a") this.rows.forEach((row) => this.selected.add(row.node.turn.id));
    else if (keyData.toLowerCase() === "x") this.selected.clear();
  }

  private toggleCurrent(): void {
    const id = this.rows[this.index]?.node.turn.id;
    if (!id) return;
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
  }

  private chosenTurns(): SharedTurn[] {
    if (!this.selected.size && this.rows[this.index]) return [this.rows[this.index].node.turn];
    return this.rows.filter((row) => this.selected.has(row.node.turn.id)).map((row) => row.node.turn);
  }
}
