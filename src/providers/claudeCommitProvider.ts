import { buildPrompt } from "../prompt/buildPrompt";
import { cleanMessage } from "../util/cleanMessage";
import {
  runClaudeText,
  type ClaudeCoreConfig,
} from "./claudeQuery";
import type { CommitMessageProvider, CommitMessageRequest } from "./types";

export interface ClaudeProviderConfig extends ClaudeCoreConfig {
  onLog?: (message: string) => void;
}

export class ClaudeCommitProvider implements CommitMessageProvider {
  readonly id = "claude";

  constructor(private readonly cfg: ClaudeProviderConfig) {}

  async generate(req: CommitMessageRequest): Promise<string> {
    const { system, user } = buildPrompt(req);

    const started = Date.now();
    const collected = await runClaudeText(this.cfg, {
      system,
      user,
      signal: req.signal,
      workspaceRoot: req.workspaceRoot,
    });

    const text = cleanMessage(collected);
    this.cfg.onLog?.(
      `claude commit message in ${Date.now() - started}ms, ${text.length} chars`
    );
    return text;
  }
}
