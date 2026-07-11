# pi-share-message

A pi extension for selecting any text message in the current session tree and rendering it as a standalone, HedgeDoc-style page.

## Install

```bash
pi install git:github.com/yourname/pi-share-message
```

For local development:

```bash
pnpm install
pnpm build:css
pi -e .
```

## Commands

- `/view-message` — select a message, write a temporary HTML file, and open it in the default browser.
- `/share-message` — select a message, upload `<nano-id>.html`, and open its GitHub Pages URL.

## GitHub Pages setup

1. Create a public repository named `pi-messages`.
2. In **Settings → Pages**, deploy from the `main` branch and `/ (root)` folder.
3. Authenticate with `gh auth login`, or set `GITHUB_TOKEN` to a token with **Contents: write** access to that repository.

The default published URL is:

```text
https://yourname.github.io/pi-messages/<nano-id>.html
```

Optional environment variables:

| Variable | Default |
| --- | --- |
| `PI_MESSAGES_OWNER` | Login resolved from the token |
| `PI_MESSAGES_REPO` | `pi-messages` |
| `PI_MESSAGES_BRANCH` | `main` |

Pages are standalone: markdown is rendered with markdown-it and Tailwind's generated CSS is embedded in each file.

## Development

```bash
pnpm typecheck
pnpm test
```
