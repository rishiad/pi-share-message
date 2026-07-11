# pi-share-message

A pi extension for selecting user and assistant messages in the current session tree and rendering them as a standalone, HedgeDoc-style page.

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
- `/share-message` — select a message, create a secret GitHub Gist, and open it in the Pi session viewer.

## GitHub Gists

Authenticate with `gh auth login`, or set `GITHUB_TOKEN` to a token with the **Gists: write** permission:

```bash
gh auth refresh -s gist
```

The shared URL has this form:

```text
https://pi.dev/session/#<gist-id>
```

The extension always stores the page as `session.html`, which is consumed by the Pi session viewer.

The Gist is secret, so it is not publicly listed, but anyone with the Gist ID can view it. The complete HTML page still requires internet access for its CDN assets.

## Layout

- `extension/` contains the Pi extension and its tests.

## Development

```bash
pnpm typecheck
pnpm test
```
