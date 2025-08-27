// desktop/frontend/src/utils/cli.ts
const CMD_LIMIT_WIN = 8000; // conservative cmd.exe limit
const isWindows = () => navigator.userAgent.includes('Windows');

function collapseWhitespace(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

// POSIX-safe single-quote quoting: 'foo'\''bar'
function posixQuote(s: string) {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

// PowerShell double-quote escaping: `", ``, `$
// Also collapse newlines to spaces to keep a single arg.
function pwshQuote(s: string) {
  const t = s.replace(/`/g, '``').replace(/"/g, '`"').replace(/\$/g, '`$');
  return `"${t}"`;
}

// Fallback double-quote escaping for generic shells.
// Works on bash/zsh; in PowerShell it will show \" literally.
// We try to detect Windows and use pwsh quoting instead.
function genericDoubleQuote(s: string) {
  const t = s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${t}"`;
}

export type ClaudeFormat =
  | 'posix'       // macOS/Linux (bash/zsh)
  | 'powershell'  // Windows PowerShell
  | 'generic';

export function detectShellFormat(): ClaudeFormat {
  if (isWindows()) return 'powershell';
  return 'posix';
}

export function buildClaudeCommand(
  text: string,
  opts?: { format?: ClaudeFormat; collapse?: boolean }
): string {
  const format = opts?.format ?? detectShellFormat();
  const collapse = opts?.collapse ?? true;

  // Keep it single-arg by default
  const payload = collapse ? collapseWhitespace(text) : text;

  let quoted: string;
  if (format === 'posix') quoted = posixQuote(payload);
  else if (format === 'powershell') quoted = pwshQuote(payload);
  else quoted = genericDoubleQuote(payload);

  // Basic length warning mitigation for Windows cmd.exe users.
  // We don't show UI here; callers can decide to surface a toast.
  if (isWindows() && quoted.length > CMD_LIMIT_WIN) {
    // Still return the command; user can paste into PowerShell,
    // or we can add a future heredoc fallback.
  }

  return `claude ${quoted}`;
}