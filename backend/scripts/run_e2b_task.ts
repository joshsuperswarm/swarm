/**
 *  E2B task runner (using E2B v1 API)
 *
 *  Usage:
 *    E2B_API_KEY=... OPENAI_API_KEY=... backend/scripts/run_e2b.sh \
 *        "Print DONE and exit."
 *    # add   --claude   to use Claude Code instead of Codex
 */

import pkg from "@e2b/code-interpreter";
const { Sandbox, CommandHandle } = pkg;
import * as path from "node:path";
import * as fs from "node:fs";
import * as process from "node:process";

// ──────────────────────────── env helpers ────────────────────────────
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const envPath = path.join(SCRIPT_DIR, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [k, ...v] = trimmed.split("=");
      if (k && v.length && !process.env[k]) process.env[k] = v.join("=");
    }
  }
}

if (!process.env.E2B_API_KEY) {
  console.error("✗  E2B_API_KEY missing");
  process.exit(1);
}

// ──────────────────────────── cli flags ──────────────────────────────
const argv = process.argv.slice(2);
const useClaude = argv.includes("--claude");
const prompt = argv.filter((a) => a !== "--claude").join(" ") || "echo hello";

// ──────────────────────────── main flow ──────────────────────────────
(async () => {
  console.log("📦  Starting E2B sandbox …");

  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    envs: useClaude
      ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "" }
      : { OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "" },
  });

  console.log(`🟢  sandboxId=${sandbox.sandboxId}`);

  try {
    // Quick Node.js version check (E2B default image has Node 20)
    console.log("🔍  Checking Node.js...");
    const nodeCheck = await sandbox.commands.run("node -v");
    console.log(`Node version: ${nodeCheck.stdout.trim()}`);

    // Set npm prefix to user directory to avoid permission issues
    await sandbox.commands.run("mkdir -p ~/.npm-global");
    await sandbox.commands.run("npm config set prefix ~/.npm-global");
    await sandbox.commands.run(
      'echo "export PATH=~/.npm-global/bin:$PATH" >> ~/.bashrc',
    );

    // Install the AI tool
    if (useClaude) {
      console.log("\n⬇  Installing Claude Code …");
      const claudeInstall = await sandbox.commands.run(
        "PATH=~/.npm-global/bin:$PATH npm i -g @anthropic-ai/claude-code@1.0.43",
      );
      if (claudeInstall.exitCode === 0) {
        console.log("✅ Claude Code installed successfully");
      } else {
        console.error("Failed to install Claude Code:", claudeInstall.stderr);
      }
    } else {
      console.log("\n⬇  Installing Codex CLI …");
      const codexInstall = await sandbox.commands.run(
        "PATH=~/.npm-global/bin:$PATH npm i -g @openai/codex",
      );
      if (codexInstall.exitCode === 0) {
        console.log("✅ Codex CLI installed successfully");
      } else {
        console.error("Failed to install Codex:", codexInstall.stderr);
      }
    }

    // Build and execute the command
    const runCmd = useClaude
      ? `bash -c "PATH=~/.npm-global/bin:$PATH claude -p \\"${prompt.replace(/"/g, '\\\\"')}\\" --print --output-format json --max-turns 1 < /dev/null"`
      : `bash -c "PATH=~/.npm-global/bin:$PATH codex exec --full-auto --no-terminal \\"${prompt.replace(/"/g, '\\\\"')}\\" < /dev/null"`;

    console.log(`\n🚀  Running: ${runCmd}`);

    const result = await sandbox.commands.run(runCmd, { timeout: 0 });

    console.log("\n─── STDOUT ─────────────────");
    console.log(result.stdout || "(empty)");
    if (result.stderr) {
      console.log("\n─── STDERR ─────────────────");
      console.error(result.stderr);
    }
    console.log(`\nExit code: ${result.exitCode}`);
  } finally {
    await sandbox.kill();
    console.log("\n🏁  Sandbox terminated");
  }
})();
