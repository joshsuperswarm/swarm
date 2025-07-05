/**
 *  E2B version of run_daytona_task.ts (using E2B v1 API)
 *
 *  Usage:
 *    E2B_API_KEY=... OPENAI_API_KEY=... backend/scripts/run_e2b.sh \
 *        "Print DONE and exit."
 *    # add   --claude   to use Claude Code instead of Codex
 */

import pkg from '@e2b/code-interpreter';
const { Sandbox } = pkg;
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as process from 'node:process';

// ──────────────────────────── env helpers ────────────────────────────
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const envPath = path.join(SCRIPT_DIR, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [k, ...v] = trimmed.split('=');
      if (k && v.length && !process.env[k]) process.env[k] = v.join('=');
    }
  }
}

if (!process.env.E2B_API_KEY) {
  console.error('✗  E2B_API_KEY missing');
  process.exit(1);
}

// ──────────────────────────── cli flags ──────────────────────────────
const argv = process.argv.slice(2);
const useClaude = argv.includes('--claude');
const prompt = argv.filter((a) => a !== '--claude').join(' ') || 'echo hello';

// Helper function to extract output from E2B result
function getOutput(result: any): string {
  if (result.results && result.results.length > 0) {
    const lastResult = result.results[result.results.length - 1];
    return lastResult.text || lastResult.stdout || '';
  }
  if (result.logs && result.logs.stdout && result.logs.stdout.length > 0) {
    return result.logs.stdout.join('\n');
  }
  return '';
}

// ──────────────────────────── main flow ──────────────────────────────
(async () => {
  console.log('📦  Starting E2B sandbox …');
  
  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    envs: useClaude
      ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '' }
      : { OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '' },
  });
  
  console.log(`🟢  sandboxId=${sandbox.sandboxId}`);

  try {
    // Check which OS we're running on
    console.log('🔍  Checking system...');
    const osCheck = await sandbox.runCode(`
import subprocess
import platform

print(f"Platform: {platform.system()}")
print(f"Distribution: {platform.platform()}")

# Try to detect package manager
try:
    subprocess.run(['apt', '--version'], capture_output=True, check=True)
    print("Package manager: apt (Debian/Ubuntu)")
except:
    try:
        subprocess.run(['apk', '--version'], capture_output=True, check=True)
        print("Package manager: apk (Alpine)")
    except:
        print("Package manager: unknown")
`);
    console.log(getOutput(osCheck));
    
    // Install Node.js and npm
    console.log('\n📦  Installing Node.js and npm...');
    const installResult = await sandbox.runCode(`
import subprocess
import os

# Update package list and install Node.js
try:
    # First try apt-get (Ubuntu/Debian)
    subprocess.run(['apt-get', 'update'], capture_output=True, check=True)
    result = subprocess.run(['apt-get', 'install', '-y', 'nodejs', 'npm', 'curl'], 
                           capture_output=True, text=True)
    print("✅ Node.js and npm installed via apt-get")
    print(f"stdout: {result.stdout}")
    if result.stderr:
        print(f"stderr: {result.stderr}")
except Exception as e:
    print(f"Failed to install with apt-get: {e}")
    # Try without sudo
    try:
        subprocess.run(['curl', '-fsSL', 'https://deb.nodesource.com/setup_20.x', '-o', 'nodesource_setup.sh'], check=True)
        subprocess.run(['bash', 'nodesource_setup.sh'], check=True)
        subprocess.run(['apt-get', 'install', '-y', 'nodejs'], check=True)
        print("✅ Node.js installed via NodeSource")
    except Exception as e2:
        print(f"Failed to install via NodeSource: {e2}")

# Check Node version
try:
    node_version = subprocess.run(['node', '--version'], capture_output=True, text=True)
    npm_version = subprocess.run(['npm', '--version'], capture_output=True, text=True)
    print(f"Node version: {node_version.stdout.strip()}")
    print(f"NPM version: {npm_version.stdout.strip()}")
except:
    print("⚠️  Node.js or npm not found")
`);
    const installOutput = getOutput(installResult);
    console.log(installOutput);
    
    if (installResult.error) {
      console.error('Install error:', installResult.error);
    }

    if (useClaude) {
      console.log('\n⬇  Installing Claude Code …');
      const claudeInstall = await sandbox.runCode(`
import subprocess
import os

# Set npm prefix to user directory to avoid permission issues
os.environ['NPM_CONFIG_PREFIX'] = os.path.expanduser('~/.npm-global')
os.environ['PATH'] = os.path.expanduser('~/.npm-global/bin') + ':' + os.environ.get('PATH', '')

result = subprocess.run(['npm', 'i', '-g', '@anthropic-ai/claude-code@1.0.43'], 
                       capture_output=True, text=True)
if result.returncode != 0:
    print(f"Error installing Claude Code: {result.stderr}")
    # Try without -g flag
    print("Trying local install...")
    result2 = subprocess.run(['npm', 'i', '@anthropic-ai/claude-code@1.0.43'], 
                           capture_output=True, text=True)
    if result2.returncode == 0:
        print("✅ Claude Code installed locally")
        print(result2.stdout)
    else:
        print(f"Local install also failed: {result2.stderr}")
else:
    print("✅ Claude Code installed globally")
    print(result.stdout)

# Check if claude is available
claude_check = subprocess.run(['which', 'claude'], capture_output=True, text=True)
if claude_check.returncode == 0:
    print(f"Claude binary found at: {claude_check.stdout.strip()}")
else:
    # Check in node_modules
    subprocess.run(['find', '.', '-name', 'claude', '-type', 'f'], capture_output=True, text=True)
`);
      console.log(getOutput(claudeInstall));
      
    } else {
      console.log('\n⬇  Installing Codex CLI …');
      const codexInstall = await sandbox.runCode(`
import subprocess
import os

# Set npm prefix to user directory
os.environ['NPM_CONFIG_PREFIX'] = os.path.expanduser('~/.npm-global')
os.environ['PATH'] = os.path.expanduser('~/.npm-global/bin') + ':' + os.environ.get('PATH', '')

result = subprocess.run(['npm', 'i', '-g', '@openai/codex'], 
                       capture_output=True, text=True)
if result.returncode != 0:
    print(f"Error installing Codex: {result.stderr}")
else:
    print("✅ Codex CLI installed")
    print(result.stdout)
`);
      console.log(getOutput(codexInstall));
    }

    // Build the command string
    const runCmd = useClaude
      ? `claude -p "${prompt.replace(/"/g, '\\"')}" --print --output-format json --max-turns 1`
      : `codex exec --full-auto --quiet --no-terminal "${prompt.replace(/"/g, '\\"')}"`;

    console.log(`\n🚀  Running: ${runCmd}`);
    
    // Execute the command using Python subprocess
    const result = await sandbox.runCode(`
import subprocess
import os
import shlex

# Set environment variables
${useClaude 
  ? `os.environ['ANTHROPIC_API_KEY'] = '${process.env.ANTHROPIC_API_KEY}'`
  : `os.environ['OPENAI_API_KEY'] = '${process.env.OPENAI_API_KEY}'`
}

# Update PATH to include npm global bin
os.environ['PATH'] = os.path.expanduser('~/.npm-global/bin') + ':' + os.environ.get('PATH', '')

# Run the command
cmd = ${JSON.stringify(runCmd)}
print(f"Running command: {cmd}")
print(f"PATH: {os.environ.get('PATH')}")

# First check if the command exists
cmd_parts = shlex.split(cmd)
which_result = subprocess.run(['which', cmd_parts[0]], capture_output=True, text=True)
if which_result.returncode != 0:
    print(f"Command '{cmd_parts[0]}' not found in PATH")
    # Try to find it
    find_result = subprocess.run(['find', os.path.expanduser('~'), '-name', cmd_parts[0], '-type', 'f'], 
                                capture_output=True, text=True)
    if find_result.stdout:
        print(f"Found at: {find_result.stdout}")
        # Use the full path
        cmd_parts[0] = find_result.stdout.strip().split('\\n')[0]
        cmd = ' '.join(cmd_parts)
        print(f"Using full path: {cmd}")

result = subprocess.run(shlex.split(cmd), 
                       capture_output=True, text=True)

print("\\n=== STDOUT ===")
print(result.stdout if result.stdout else "(empty)")
if result.stderr:
    print("\\n=== STDERR ===")
    print(result.stderr)
print(f"\\n=== EXIT CODE: {result.returncode} ===")
`);

    console.log('\n─── Output ────────────────────────────────────────────');
    const output = getOutput(result);
    console.log(output || '(no output)');
    
    if (result.error) {
      console.log('\n─── Error ─────────────────────────────────────────────');
      console.error(result.error);
    }

  } finally {
    await sandbox.kill();
    console.log('\n🏁  Sandbox terminated');
  }
})();