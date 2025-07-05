/**
 * TypeScript script that:
 *   1. Creates a sandbox
 *   2. Waits until it is running
 *   3. Opens a Toolbox process session
 *   4. Installs Node 20 + Codex (sync)
 *   5. Executes your PROMPT command (async)
 *   6. Streams the live logs back to stdout
 *
 * Usage (run via the shell wrapper below):
 *   DAYTONA_API_KEY=... OPENAI_API_KEY=... ./run_daytona.sh "clean up any unused rust code"
 */

import apiClient from "@daytonaio/api-client";
const { SandboxApi, ToolboxApi, Configuration } = apiClient;
import { randomUUID } from "crypto";
import * as process from "process";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// Load .env file from backend directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=");
        // Only set if not already defined in environment
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

// --- PARSE ARGS -------------------------------------------------------------
const args = process.argv.slice(2);
let useClaude = false;
let prompt = "echo hello";

// Check for --claude flag
const claudeIndex = args.indexOf("--claude");
if (claudeIndex !== -1) {
  useClaude = true;
  args.splice(claudeIndex, 1); // Remove the flag
}

// Remaining args are the prompt
if (args.length > 0) {
  prompt = args.join(" ");
}

// --- ENV --------------------------------------------------------------------
const apiKey = process.env.DAYTONA_API_KEY!;
const orgId = process.env.DAYTONA_ORGANIZATION_ID;
const basePath = process.env.DAYTONA_URL ?? "https://app.daytona.io/api";
const region = process.env.DAYTONA_REGION ?? "us";
const openai = process.env.OPENAI_API_KEY;
const anthropic = process.env.ANTHROPIC_API_KEY;

// --- CONFIGURATION ----------------------------------------------------------
const config = new Configuration({
  basePath,
  baseOptions: {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(orgId && { "X-Daytona-Organization-ID": orgId }),
    },
  },
});

// --- CLIENTS ----------------------------------------------------------------
const sandboxApi = new SandboxApi(config);
const toolboxApi = new ToolboxApi(config);

(async () => {
  try {
    // 1. create sandbox
    const envVars: any = {};
    if (useClaude) {
      envVars.ANTHROPIC_API_KEY = anthropic;
    } else {
      envVars.OPENAI_API_KEY = openai;
    }

    const { data: sandbox } = await sandboxApi.createSandbox({
      target: region,
      env: envVars,
    });
    const sandboxId = sandbox.id!;
    console.log(`🟢  sandbox=${sandboxId}`);

    // 2. wait until started/running
    let state = "starting";
    process.stdout.write("⏳  waiting for sandbox …");
    while (!["started", "running"].includes(state)) {
      await new Promise((r) => setTimeout(r, 2500));
      const { data: updatedSandbox } = await sandboxApi.getSandbox(sandboxId);
      state = updatedSandbox.state?.toLowerCase() ?? "unknown";
      process.stdout.write(`\r⏳  state=${state.padEnd(10)}`);
      if (["failed", "error"].includes(state))
        throw new Error(`Sandbox failed (${state})`);
    }
    console.log("\n✅  sandbox ready");

    // 3. create session
    const sessionId = randomUUID();
    const { data: session } = await toolboxApi.createSession(sandboxId, {
      sessionId,
    });
    console.log(`🗝   session=${sessionId}`);

    // 4. install tool (sync)
    let installCmd: string;
    let toolName: string;

    if (useClaude) {
      installCmd = `bash -lc 'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get -y install nodejs && npm i -g @anthropic-ai/claude-code@1.0.24'`;
      toolName = "Claude Code";
    } else {
      installCmd = `bash -lc 'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get -y install nodejs && npm i -g @openai/codex'`;
      toolName = "Codex CLI";
    }

    console.log(`📦  Installing Node.js and ${toolName}...`);
    const { data: installResult } = await toolboxApi.executeSessionCommand(
      sandboxId,
      sessionId,
      { command: installCmd, cwd: "/home/daytona", runAsync: false },
    );
    console.log("    Installation complete");

    // 5. run your prompt (async)
    let runCmd: string;
    if (useClaude) {
      runCmd = `bash -c "CI=true claude -p \\"${prompt.replace(/"/g, '\\\\"')}\\" --print --verbose --output-format stream-json --max-turns 10 < /dev/null"`;
    } else {
      runCmd = `bash -c "codex exec --full-auto --quiet --no-terminal \\"${prompt.replace(/"/g, '\\\\"')}\\" < /dev/null"`;
    }
    console.log(`🚀  Running: ${runCmd}`);
    const { data: cmdResult } = await toolboxApi.executeSessionCommand(
      sandboxId,
      sessionId,
      { command: runCmd, cwd: "/home/daytona", runAsync: true },
    );
    const cmdId = cmdResult.id || cmdResult.cmdId || cmdResult.commandId;
    console.log(`    cmd=${cmdId}`);

    // 6. stream logs
    console.log("\n--- live logs (Ctrl-C to stop) ---\n");
    const resp = await fetch(
      `${basePath}/toolbox/${sandboxId}/toolbox/process/session/${sessionId}/command/${cmdId}/logs?follow=true`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(orgId && { "X-Daytona-Organization-ID": orgId }),
        },
      },
    );
    if (!resp.ok || !resp.body)
      throw new Error(`Log stream failed: ${resp.statusText}`);

    // Pipe the ReadableStream to stdout
    for await (const chunk of resp.body) process.stdout.write(chunk);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
})();
