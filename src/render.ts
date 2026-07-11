import MarkdownIt from "markdown-it";

export interface SharedMessage {
  role: string;
  markdown: string;
  timestamp?: number;
}

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function renderPage(message: SharedMessage, css: string): string {
  const body = md.render(message.markdown);
  const title = `${message.role[0]?.toUpperCase() ?? ""}${message.role.slice(1)} message`;
  const date = message.timestamp ? new Date(message.timestamp).toLocaleString() : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>${css}</style></head>
<body><main class="mx-auto grid min-h-screen max-w-[1100px] grid-cols-1 gap-12 px-6 py-8 lg:grid-cols-[minmax(0,760px)_260px]">
<article><header class="mb-8 border-b border-[#e5e5e5] pb-4"><div class="text-xs font-semibold uppercase tracking-widest text-[#999]">pi · ${escapeHtml(message.role)}</div>${date ? `<time class="mt-1 block text-sm text-[#999]">${escapeHtml(date)}</time>` : ""}</header><div id="content" class="markdown-body">${body}</div></article>
<aside class="hidden border-l border-[#e5e5e5] pl-7 lg:block"><nav id="toc" class="toc sticky top-8"></nav></aside>
</main><script>
const toc=document.querySelector('#toc');document.querySelectorAll('#content h1,#content h2,#content h3,#content h4').forEach((h,i)=>{h.id=h.id||'heading-'+i;const a=document.createElement('a');a.href='#'+h.id;a.dataset.level=h.tagName.slice(1);a.textContent=h.textContent;toc.appendChild(a)});if(!toc.children.length)toc.parentElement.remove();
</script></body></html>`;
}
