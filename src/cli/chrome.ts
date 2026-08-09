import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

const CANDIDATES = [
  "google-chrome-stable",
  "google-chrome",
  "chromium",
  "chromium-browser",
  "chrome",
  "msedge",
  "microsoft-edge",
];

export function findChromePath(explicit?: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (explicit) return isExecutable(explicit) ? explicit : null;
  if (env.CHROME_PATH && isExecutable(env.CHROME_PATH)) return env.CHROME_PATH;

  const pathEnv = env.PATH ?? "";
  const dirs = pathEnv.split(delimiter).filter(Boolean);
  for (const name of CANDIDATES) {
    for (const dir of dirs) {
      const full = join(dir, name);
      if (isExecutable(full)) return full;
    }
  }

  // Common absolute installs when PATH is minimal (CI images, containers).
  for (const full of [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ]) {
    if (isExecutable(full)) return full;
  }
  return null;
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
