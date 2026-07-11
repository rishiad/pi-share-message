# pi-share-message

A pi extension for selecting any text message in the current session tree and rendering it as a webpage.

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

- `/view-message` — select messages, optionally summarize the selection, write a temporary HTML file, and open it in the default browser.
- `/share-message` — select messages, optionally summarize the selection, create a secret GitHub Gist, and open it in the Pi session viewer.

The selector uses Pi's native tree UI. User and assistant messages are shown; press `Space` to toggle multiple messages, then `Enter` to continue. If nothing is toggled, `Enter` selects the highlighted message.

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
