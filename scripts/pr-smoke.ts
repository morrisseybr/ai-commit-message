// Headless smoke test for the live PR-generation boundary: feed sample patches
// + commit messages through the real flatten → Claude → parse path and print the
// generated title, description, and latency. Run with:
//   npm run pr-smoke
// Requires the Claude Code CLI installed and authenticated.
//
// This is a MANUAL check, not part of `npm test`: it exercises the live Claude
// boundary, which the automated suite deliberately does not.
import { flattenPatches, type Patches } from "../src/pr/flattenPatches";
import { ClaudePrProvider } from "../src/providers/claudePrProvider";
import { resolveClaudePath } from "../src/util/resolveClaude";

// Object-shaped patches mirror what the GitHub PR extension hands us in
// `context.patches`: per-file patch text plus the file URIs (including renames).
const SAMPLE_PATCHES: Patches = [
  {
    fileUri: "file:///repo/src/auth/login.ts",
    patch: `@@ -10,6 +10,14 @@ export async function login(email: string, password: string) {
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
 }`,
  },
  {
    fileUri: "file:///repo/src/auth/lockout.ts",
    previousFileUri: "file:///repo/src/auth/attempts.ts",
    patch: `@@ -1,3 +1,7 @@
-export function attempts() {}
+export async function incrementFailedAttempts(userId: string): Promise<void> {
+  await db.users.update(userId, { $inc: { failedAttempts: 1 } });
+}`,
  },
];

const SAMPLE_COMMIT_MESSAGES = [
  "feat(auth): lock accounts after 5 failed login attempts",
  "refactor(auth): rename attempts module to lockout",
];

async function main(): Promise<void> {
  const resolution = resolveClaudePath(process.env.CLAUDE_PATH ?? "");
  if (!resolution.path) {
    console.error(
      `Could not find the claude binary (${resolution.error}). Set CLAUDE_PATH or install Claude Code.`
    );
    process.exit(1);
  }
  console.log(`Using claude at: ${resolution.path}`);

  const { diff, truncated } = flattenPatches(SAMPLE_PATCHES);

  const provider = new ClaudePrProvider({
    model: "claude-sonnet-4-6",
    disableThinking: false,
    executablePath: resolution.path,
    onLog: (m) => console.log(`[provider] ${m}`),
  });

  const started = Date.now();
  const result = await provider.generate({
    diff,
    truncated,
    commitMessages: SAMPLE_COMMIT_MESSAGES,
    language: "auto",
    workspaceRoot: process.cwd(),
    signal: new AbortController().signal,
  });
  const elapsed = Date.now() - started;

  if (!result) {
    console.error("\nProvider returned no usable title/description.");
    process.exit(1);
  }

  console.log("\n--- generated PR title ---");
  console.log(result.title);
  console.log("\n--- generated PR description ---");
  console.log(result.description ?? "(none)");
  console.log("------------------------------");
  console.log(`latency: ${elapsed}ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
