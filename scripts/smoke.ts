// Headless smoke test: feed a sample diff to the Claude commit provider and
// print the cleaned message + latency. Run with:
//   npm run smoke
// Requires the Claude Code CLI installed and authenticated.
import { ClaudeCommitProvider } from "../src/providers/claudeCommitProvider";
import type { CommitMessageRequest } from "../src/providers/types";
import { resolveClaudePath } from "../src/util/resolveClaude";

const SAMPLE_DIFF = `diff --git a/src/auth/login.ts b/src/auth/login.ts
index 1a2b3c4..5d6e7f8 100644
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -10,6 +10,14 @@ export async function login(email: string, password: string) {
   const user = await findUser(email);
   if (!user) {
     throw new AuthError("user not found");
   }
+
+  // Lock the account after 5 consecutive failed attempts.
+  if (user.failedAttempts >= 5) {
+    throw new AuthError("account locked");
+  }
+
   const ok = await verifyPassword(password, user.passwordHash);
+  if (!ok) {
+    await incrementFailedAttempts(user.id);
+  }
   return ok ? issueSession(user) : null;
 }
`;

async function main(): Promise<void> {
  const resolution = resolveClaudePath(process.env.CLAUDE_PATH ?? "");
  if (!resolution.path) {
    console.error(
      `Could not find the claude binary (${resolution.error}). Set CLAUDE_PATH or install Claude Code.`
    );
    process.exit(1);
  }
  console.log(`Using claude at: ${resolution.path}`);

  const provider = new ClaudeCommitProvider({
    model: "claude-sonnet-4-6",
    disableThinking: false,
    executablePath: resolution.path,
    onLog: (m) => console.log(`[provider] ${m}`),
  });

  const req: CommitMessageRequest = {
    diff: SAMPLE_DIFF,
    truncated: false,
    files: [{ path: "src/auth/login.ts", status: "modified" }],
    style: "conventional",
    language: "en",
    recentSubjects: [],
    workspaceRoot: process.cwd(),
    signal: new AbortController().signal,
  };

  const started = Date.now();
  const message = await provider.generate(req);
  const elapsed = Date.now() - started;

  console.log("\n--- generated commit message ---");
  console.log(message);
  console.log("--------------------------------");
  console.log(`latency: ${elapsed}ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
