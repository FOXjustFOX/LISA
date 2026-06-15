const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type Level = keyof typeof LEVELS;

const RESET = "\x1b[0m";
const COLORS: Record<Level, string> = {
  error: "\x1b[1m\x1b[31m", // bold red
  warn:  "\x1b[1m\x1b[33m", // bold yellow
  info:  "\x1b[1m\x1b[32m", // bold green
  debug: "\x1b[90m",         // dim gray
};

function currentLevel(): number {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase() as Level;
  return LEVELS[raw] ?? LEVELS.info;
}

function tryParseJson(val: any): any {
  if (typeof val !== "string") return val;
  try { return JSON.parse(val); } catch { return val; }
}

function log(level: Level, message: string, ...args: any[]): void {
  if (LEVELS[level] > currentLevel()) return;

  const ts = new Date().toISOString();
  const label = `${COLORS[level]}[${level.toUpperCase().padEnd(5)}]${RESET}`;

  if (level === "error") {
    const entry: Record<string, any> = { ts, msg: message };
    if (args.length === 1) entry.data = tryParseJson(args[0]);
    else if (args.length > 1) entry.data = args.map(tryParseJson);
    console.error(`${label}\n${JSON.stringify(entry, null, 2)}`);
  } else {
    const line = `${label} ${ts} — ${message}`;
    if (level === "warn") console.warn(line);
    else console.log(line);
  }
}

export const logger = {
  error: (msg: string, ...args: any[]) => log("error", msg, ...args),
  warn:  (msg: string, ...args: any[]) => log("warn",  msg, ...args),
  info:  (msg: string, ...args: any[]) => log("info",  msg, ...args),
  debug: (msg: string, ...args: any[]) => log("debug", msg, ...args),
};
