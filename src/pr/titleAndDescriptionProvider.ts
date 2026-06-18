import * as vscode from "vscode";
import { readConfig } from "../config";
import { createPrProvider } from "../providers/registry";
import { ensureClaudePath } from "../util/claudeStatus";
import { log, logError } from "../util/logger";
import { flattenPatches, type Patches } from "./flattenPatches";

// The GitHub Pull Requests extension. We depend on it *softly*: if it isn't
// installed we do nothing (no error, no `extensionDependencies` entry), so
// activation and commit-message behavior are unchanged without it.
const PR_EXTENSION_ID = "github.vscode-pull-request-github";

// The slice of the host-provided context we consume. We never compute our own
// diff: `patches`/`commitMessages` come from the host, so changing the base or
// compare branch re-invokes us with a fresh diff automatically. When `template`
// is present the generated body mirrors it. `issues` and `compareBranch` are
// intentionally ignored in this slice.
interface ProvideContext {
  commitMessages: string[];
  patches: Patches;
  issues?: { reference: string; content: string }[];
  template?: string;
  compareBranch?: string;
}

interface TitleAndDescriptionProvider {
  provideTitleAndDescription(
    context: ProvideContext,
    token: vscode.CancellationToken
  ): Promise<{ title: string; description?: string } | undefined>;
}

// The minimal surface of the PR extension's API that we call.
interface PrExtensionApi {
  registerTitleAndDescriptionProvider(
    title: string,
    provider: TitleAndDescriptionProvider
  ): vscode.Disposable;
}

const provider: TitleAndDescriptionProvider = {
  async provideTitleAndDescription(context, token) {
    const cfg = readConfig();

    const claudePath = ensureClaudePath(cfg.claudeExecutablePath);
    if (!claudePath || token.isCancellationRequested) {
      return undefined;
    }

    const { diff, truncated } = flattenPatches(context.patches);
    if (!diff.trim()) {
      return undefined;
    }

    const prProvider = createPrProvider({
      claudeModel: cfg.claudeModel,
      fastMode: cfg.fastMode,
      disableThinking: cfg.disableThinking,
      claudeExecutablePath: claudePath,
      onLog: log,
    });

    // Bridge the host's cancellation token to the abort path.
    const controller = new AbortController();
    const sub = token.onCancellationRequested(() => controller.abort());
    try {
      const result = await prProvider.generate({
        diff,
        truncated,
        commitMessages: context.commitMessages ?? [],
        language: cfg.language,
        template: context.template,
        workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        signal: controller.signal,
      });

      // Empty/unusable or cancelled → undefined leaves the user's fields alone.
      if (!result || token.isCancellationRequested) {
        return undefined;
      }
      return result;
    } catch (err) {
      logError("PR title/description generation failed", err);
      return undefined;
    } finally {
      sub.dispose();
    }
  },
};

// Soft-dependency registration: only wires up if the PR extension is present.
export async function registerPrProvider(
  context: vscode.ExtensionContext
): Promise<void> {
  const ext = vscode.extensions.getExtension<PrExtensionApi>(PR_EXTENSION_ID);
  if (!ext) {
    return;
  }
  try {
    const api = ext.isActive ? ext.exports : await ext.activate();
    context.subscriptions.push(
      api.registerTitleAndDescriptionProvider("AI Commit Message", provider)
    );
    log("registered PR title/description provider");
  } catch (err) {
    logError("failed to register PR title/description provider", err);
  }
}
