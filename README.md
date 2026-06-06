# AI Commit Message

Generate a git commit message from your staged changes and fill the native
Source Control (SCM) input — powered by the Claude Code CLI.

## Usage

- Click the **✨ AI Commit Message** button in the Source Control view's
  title bar (top of the panel).
- Or run **AI Commit Message** from the Command Palette.

It reads your diff (staged, with a working-tree fallback), asks Claude to write a
message, and fills the SCM input box. A spinner shows in the Source Control view
while it works.

## Requirements

> **The Claude Code CLI must be installed and authenticated.** This extension is
> a thin client — it does not bundle Claude. It runs the `claude` binary already
> on your machine, so you must
> [install Claude Code](https://docs.claude.com/en/docs/claude-code/setup)
> and log in (`claude` via OAuth, or `ANTHROPIC_API_KEY` set) first.

- `claude` available on your `PATH`. If it lives somewhere non-standard, set
  `aiCommitMessage.claude.executablePath` to its full path. The extension auto-detects
  it on `PATH` and common locations (e.g. `~/.local/bin`); if it can't be found,
  you'll get a notification with a link to install it.
- VS Code 1.85+.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `aiCommitMessage.style` | `conventional` | `conventional` (Conventional Commits) or `free`. |
| `aiCommitMessage.language` | `en` | `en`, `pt`, or `auto` (match recent commits). |
| `aiCommitMessage.includeUnstagedFallback` | `true` | When nothing is staged, use the working-tree diff (and warn). |
| `aiCommitMessage.claude.model` | `claude-sonnet-4-6` | Claude model used to generate the message. |
| `aiCommitMessage.claude.executablePath` | `""` | Path to the `claude` binary. Empty = auto-detect. |
| `aiCommitMessage.fastMode` | `false` | Use a fast model (haiku) with thinking disabled. |

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # bundle with esbuild
npm run smoke       # headless: generate a message from a sample diff
```

Press `F5` to launch an Extension Development Host and try it in a real repo.

### Packaging

```bash
npx @vscode/vsce package --allow-missing-repository
```

The package ships only the agent SDK's JavaScript; its per-platform native
binaries (~228 MB) are excluded — the extension spawns your installed `claude`
instead. Expect a `.vsix` of ~1–2 MB.
