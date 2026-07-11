# pi-share-message

A pi extension for selecting any text message in the current session tree and rendering it as a standalone, HedgeDoc-style page.

## Install

```bash
pi install git:github.com/yourname/pi-share-message
```

For local development:

```bash
pnpm install
pi -e .
```

## Commands

- `/view-message` — select a message, write a temporary HTML file, and open it in the default browser.
- `/share-message` — select a message, create a secret GitHub Gist, and open it through `html-preview.github.io`.

## GitHub Gists

Authenticate with `gh auth login`, or set `GITHUB_TOKEN` to a token with the **Gists: write** permission:

```bash
gh auth refresh -s gist
```

The shared URL has this form:

```text
https://html-preview.github.io/?url=<gist-raw-url>
```

The Gist is secret, so it is not publicly listed, but anyone with the raw URL can view it. The preview page and Tailwind styling require internet access.

## Layout

- `extension/` contains the Pi extension and its tests.
- `server/` is reserved for the future Go preview server.

## Development

```bash
pnpm typecheck
pnpm test
```
