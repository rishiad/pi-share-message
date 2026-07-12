# pi-share-message

A pi extension for selecting any text message in the current session tree and rendering it as a webpage.

## Install

```bash
pi install git:github.com/rishiad/pi-share-message
```

For local development:

```bash
pnpm install
pi install .
```

## Commands

| Command | Description |
| --- | --- |
| `/view-message` | Select messages, choose transcript or rewritten-document output, write a temporary HTML file, and open it in the default browser. |
| `/share-message` | Select messages, reuse a previously generated rewritten document for the same selection or choose a new output, create a secret GitHub Gist, and open it in the Pi session viewer. |

The selector uses Pi's native tree UI. User and assistant messages are shown; press `Space` to toggle multiple messages, then `Enter` to continue. If nothing is toggled, `Enter` selects the highlighted message.

## Examples

| Output | Example |
| --- | --- |
| Transcript | <https://pi.dev/session/#e3a81a767285a82642d95da566e07d46> |
| Rewritten document | <https://pi.dev/session/#8e8c778dd7050edcd124b175c2201ee2> |

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

## Development

```bash
pnpm typecheck
pnpm test
```
