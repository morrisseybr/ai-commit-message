import {
  buildPrPrompt,
  PR_SPLIT_MARKER,
  type PrPromptRequest,
} from "../prompt/buildPrPrompt";
import {
  parseTitleAndDescription,
  type TitleAndDescription,
} from "../pr/parseTitleAndDescription";
import { runClaudeText, type ClaudeCoreConfig } from "./claudeQuery";

export interface PrProviderConfig extends ClaudeCoreConfig {
  onLog?: (message: string) => void;
}

export interface PrGenerateRequest extends PrPromptRequest {
  workspaceRoot?: string;
  signal: AbortSignal;
}

// Generates a PR title + description in a single Claude call, reusing the same
// model selection / abort wiring as commit generation.
export class ClaudePrProvider {
  readonly id = "claude";

  constructor(private readonly cfg: PrProviderConfig) {}

  async generate(
    req: PrGenerateRequest
  ): Promise<TitleAndDescription | undefined> {
    const { system, user } = buildPrPrompt(req);

    const started = Date.now();
    const collected = await runClaudeText(this.cfg, {
      system,
      user,
      signal: req.signal,
      workspaceRoot: req.workspaceRoot,
    });

    const parsed = parseTitleAndDescription(collected, PR_SPLIT_MARKER);
    this.cfg.onLog?.(
      `claude PR title+description in ${Date.now() - started}ms, ${
        parsed ? "ok" : "unusable"
      }`
    );
    return parsed;
  }
}
