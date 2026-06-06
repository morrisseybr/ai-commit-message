import * as vscode from "vscode";
import { readConfig } from "./config";
import {
  collectCommitContext,
  type CommitContext,
  GitServiceError,
  recentSubjects,
  resolveRepository,
} from "./git/gitService";
import type { Repository } from "./types/git";
import { createProvider } from "./providers/registry";
import { ensureClaudePath } from "./util/claudeStatus";
import { disposeLogger, initLogger, log, logError } from "./util/logger";

export function activate(context: vscode.ExtensionContext): void {
  initLogger();
  log("AI Commit Message activated");

  // Tell the user up front if the Claude Code CLI isn't available.
  ensureClaudePath(readConfig().claudeExecutablePath);

  // The scm/inputBox menu passes the SourceControl as the argument, but the
  // shape is under-documented; log it once to confirm.
  let loggedArgShape = false;

  const generate = vscode.commands.registerCommand(
    "aiCommitMessage.generate",
    async (sourceControl?: vscode.SourceControl) => {
      if (!loggedArgShape) {
        loggedArgShape = true;
        log(`aiCommitMessage.generate invoked; arg=${describeArg(sourceControl)}`);
      }
      await runGenerate(sourceControl);
    }
  );

  context.subscriptions.push(generate);
}

export function deactivate(): void {
  disposeLogger();
}

async function runGenerate(
  sourceControl?: vscode.SourceControl
): Promise<void> {
  const cfg = readConfig();

  // Resolve the repository and the diff to summarize.
  let repo: Repository;
  let context: CommitContext;
  try {
    repo = await resolveRepository(sourceControl);
    context = await collectCommitContext(repo, cfg.includeUnstagedFallback);
  } catch (err) {
    if (err instanceof GitServiceError) {
      if (err.code === "nothing") {
        vscode.window.showInformationMessage(`AI Commit Message: ${err.message}`);
      } else {
        vscode.window.showErrorMessage(`AI Commit Message: ${err.message}`);
      }
      return;
    }
    logError("failed to read git changes", err);
    vscode.window.showErrorMessage(
      "AI Commit Message: failed to read git changes (see the output channel)."
    );
    return;
  }

  // The Claude binary is required; if missing the user has been notified.
  const claudePath = ensureClaudePath(cfg.claudeExecutablePath);
  if (!claudePath) {
    return;
  }

  if (context.usedFallback) {
    vscode.window.setStatusBarMessage(
      "AI Commit Message: nothing staged — using working-tree changes.",
      4000
    );
  }

  const subjects =
    cfg.language === "auto" ? await recentSubjects(repo) : [];

  const provider = createProvider({
    claudeModel: cfg.claudeModel,
    fastMode: cfg.fastMode,
    claudeExecutablePath: claudePath,
    onLog: log,
  });

  try {
    const message = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.SourceControl,
        title: "Generating commit message…",
        cancellable: true,
      },
      async (_progress, token) => {
        const controller = new AbortController();
        const sub = token.onCancellationRequested(() => controller.abort());
        try {
          return await provider.generate({
            diff: context.diff,
            truncated: context.truncated,
            files: context.files,
            style: cfg.style,
            language: cfg.language,
            recentSubjects: subjects,
            workspaceRoot: repo.rootUri.fsPath,
            signal: controller.signal,
          });
        } finally {
          sub.dispose();
        }
      }
    );

    if (!message) {
      vscode.window.showWarningMessage(
        "AI Commit Message: the model returned an empty message."
      );
      return;
    }

    repo.inputBox.value = message;
    log("commit message written to input box");
  } catch (err) {
    logError("commit message generation failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(
      `AI Commit Message: generation failed — ${detail}`
    );
  }
}

// Compact, safe description of the command argument for the log.
function describeArg(arg: unknown): string {
  if (arg === undefined) {
    return "undefined (likely Command Palette)";
  }
  if (arg && typeof arg === "object") {
    const sc = arg as vscode.SourceControl;
    return `SourceControl{ id=${sc.id}, label=${sc.label}, rootUri=${sc.rootUri?.toString()} }`;
  }
  return `${typeof arg}: ${String(arg)}`;
}
