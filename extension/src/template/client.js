const themes = ["light", "sepia", "dark"];
const themeLabels = { light: "Light", sepia: "Sepia", dark: "Dark" };
const themeButton = document.querySelector("#theme-cycle");
const storedTheme = localStorage.getItem("pi-share-theme");
const setTheme = (theme) => {
  const selected = themes.includes(theme) ? theme : "light";
  document.documentElement.dataset.theme = selected;
  document.documentElement.style.colorScheme = selected === "dark" ? "dark" : "light";
  themeButton.textContent = themeLabels[selected];
  localStorage.setItem("pi-share-theme", selected);
};
setTheme(storedTheme ?? "light");
themeButton.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme || "light";
  setTheme(themes[(themes.indexOf(current) + 1) % themes.length]);
});

const message = JSON.parse(document.querySelector("#message-data").value);
const page = document.querySelector("#page-template").content.cloneNode(true);
page.querySelector("[data-content]").innerHTML = message.body;
document.querySelector("#app").replaceChildren(page);
document.title = message.title;

const shareBaseUrl = document.querySelector(
  'meta[name="pi-share-base-url"]',
)?.content;
const headingUrl = (id) =>
  shareBaseUrl
    ? `${shareBaseUrl}/session.html&heading=${encodeURIComponent(id)}`
    : `#${id}`;
const toc = document.querySelector("#toc");
const headings = [
  ...document.querySelectorAll(
    "#content h1,#content h2,#content h3,#content h4",
  ),
];
const baseLevel = headings.length
  ? Math.min(...headings.map((heading) => Number(heading.tagName.slice(1))))
  : 1;
const groups = [];
const groupForHeading = [];
const links = [];
const usedHeadingIds = new Set();
const slugHeading = (text) => {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "heading";
};
const uniqueHeadingId = (heading) => {
  const existing = heading.id?.trim();
  const base = existing && !/^heading-\d+$/.test(existing) ? existing : slugHeading(heading.textContent ?? "");
  let id = base;
  let suffix = 2;
  while (usedHeadingIds.has(id)) id = `${base}-${suffix++}`;
  usedHeadingIds.add(id);
  return id;
};

headings.forEach((heading, index) => {
  heading.id = uniqueHeadingId(heading);
  const level = Number(heading.tagName.slice(1));
  const tocLevel = Math.max(1, level - baseLevel + 1);
  if (tocLevel === 1 || !groups.length) groups.push({ items: [] });
  const link = document.createElement("a");
  link.href = headingUrl(heading.id);
  link.dataset.level = String(tocLevel);
  link.textContent = heading.textContent;
  groups.at(-1).items.push({ heading, link });
  groupForHeading[index] = groups.length - 1;
  links.push(link);
});

if (!links.length) {
  toc.remove();
} else {
  groups.forEach((group) => {
    const element = document.createElement("div");
    element.className = "toc-group";
    group.items.forEach(({ link }) => element.appendChild(link));
    toc.appendChild(element);
  });

  const actions = document.createElement("div");
  actions.className = "toc-actions";
  const expandButton = document.createElement("button");
  expandButton.type = "button";
  expandButton.textContent = "Expand all";
  const topButton = document.createElement("button");
  topButton.type = "button";
  topButton.textContent = "Back to top";
  const bottomButton = document.createElement("button");
  bottomButton.type = "button";
  bottomButton.textContent = "Go to bottom";
  actions.append(expandButton, topButton, bottomButton);
  toc.appendChild(actions);

  let allExpanded = false;
  let activeGroupIndex = 0;
  const updateVisibility = () =>
    groups.forEach((group, index) => {
      group.items.slice(1).forEach(({ link }) => {
        link.hidden = !allExpanded && index !== activeGroupIndex;
      });
    });
  const updateActiveHeading = () => {
    const atBottom =
      document.documentElement.scrollHeight > window.innerHeight &&
      window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 1;
    const activeIndex = atBottom
      ? headings.length - 1
      : headings.reduce(
          (active, heading, index) =>
            heading.getBoundingClientRect().top <= 112 ? index : active,
          0,
        );
    activeGroupIndex = groupForHeading[activeIndex] ?? 0;
    links.forEach((link, index) => {
      const active = index === activeIndex;
      link.classList.toggle("active", active);
      link.classList.toggle(
        "active-parent",
        groupForHeading[index] === activeGroupIndex &&
          index !== activeIndex &&
          links[index].dataset.level === "1",
      );
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    updateVisibility();
  };

  expandButton.addEventListener("click", () => {
    allExpanded = !allExpanded;
    expandButton.textContent = allExpanded ? "Collapse all" : "Expand all";
    updateVisibility();
  });
  topButton.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" }),
  );
  bottomButton.addEventListener("click", () =>
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    }),
  );
  window.addEventListener("scroll", updateActiveHeading, {
    passive: true,
  });
  window.addEventListener("resize", updateActiveHeading);
  updateActiveHeading();

  const requestedHeading = new URLSearchParams(
    document.querySelector('meta[name="pi-url-params"]')?.content ?? "",
  ).get("heading");
  const target =
    requestedHeading &&
    document.getElementById(requestedHeading.replace(/^#/, ""));
  if (target) requestAnimationFrame(() => target.scrollIntoView());
}
