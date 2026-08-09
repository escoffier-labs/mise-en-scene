import type { Audience, SceneView } from "../scene/types.ts";

export type ExportFormat = "svg" | "png" | "html" | "json" | "walkthrough";

export type CliArgs = {
  help: boolean;
  inputPath?: string;
  outputPath?: string;
  format?: ExportFormat;
  view?: SceneView;
  audience: Audience;
  review: boolean;
  chromePath?: string;
  scale: number;
  error?: string;
};

const FORMATS = new Set<ExportFormat>(["svg", "png", "html", "json", "walkthrough"]);
const VIEWS = new Set<SceneView>(["architecture", "sequence"]);
const AUDIENCES = new Set<Audience>(["engineer", "exec", "student", "customer"]);

export function usage(): string {
  return `Usage: mise-en-scene <input> [-o <output>] [options]

Render a saved scene JSON or source file to SVG, PNG, HTML, JSON, or walkthrough HTML.
SVG/HTML/JSON run fully headless via React SSR. PNG uses a local Chromium binary
(CHROME_PATH or auto-detect) so foreignObject text matches studio exports.

Arguments:
  <input>                      Scene JSON, or source text/Markdown/OpenAPI to extract

Options:
  -o, --output <path>          Output file (default: stdout for text formats; required for png)
  -f, --format <fmt>           svg | png | html | json | walkthrough
                               (default: from output extension, else svg)
  --view <architecture|sequence>
                               Layout view (default: document view, or architecture)
  --audience <name>            engineer | exec | student | customer (source extract only)
  --review                     Apply review-mode dimming for ungrounded elements
  --chrome-path <path>         Chromium binary for PNG (overrides CHROME_PATH)
  --scale <n>                  PNG device scale factor (default: 2)
  -h, --help                   Show this help

Examples:
  mise-en-scene scene.json -o scene.svg
  mise-en-scene scene.json -f png -o scene.png
  mise-en-scene examples/brigade-source.md --view sequence -o sequence.svg
  mise-en-scene scene.json -f walkthrough -o walk.html
`;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { help: false, audience: "engineer", review: false, scale: 2 };
  const positionals: string[] = [];
  let i = 0;

  // Allow an optional leading "export" subcommand for npm run export -- ...
  if (argv[0] === "export") i = 1;

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      args.help = true;
      i += 1;
      continue;
    }
    if (arg === "--review") {
      args.review = true;
      i += 1;
      continue;
    }
    const take = (flag: string): string | undefined => {
      if (i + 1 >= argv.length) {
        args.error = `${flag} requires a value`;
        return undefined;
      }
      i += 1;
      return argv[i];
    };
    if (arg === "-o" || arg === "--output") {
      const value = take(arg);
      if (value === undefined) return args;
      args.outputPath = value;
      i += 1;
      continue;
    }
    if (arg === "-f" || arg === "--format") {
      const value = take(arg);
      if (value === undefined) return args;
      if (!FORMATS.has(value as ExportFormat)) {
        args.error = `unsupported format "${value}" (expected svg, png, html, json, or walkthrough)`;
        return args;
      }
      args.format = value as ExportFormat;
      i += 1;
      continue;
    }
    if (arg === "--view") {
      const value = take(arg);
      if (value === undefined) return args;
      if (!VIEWS.has(value as SceneView)) {
        args.error = `unsupported view "${value}" (expected architecture or sequence)`;
        return args;
      }
      args.view = value as SceneView;
      i += 1;
      continue;
    }
    if (arg === "--audience") {
      const value = take(arg);
      if (value === undefined) return args;
      if (!AUDIENCES.has(value as Audience)) {
        args.error = `unsupported audience "${value}"`;
        return args;
      }
      args.audience = value as Audience;
      i += 1;
      continue;
    }
    if (arg === "--chrome-path") {
      const value = take(arg);
      if (value === undefined) return args;
      args.chromePath = value;
      i += 1;
      continue;
    }
    if (arg === "--scale") {
      const value = take(arg);
      if (value === undefined) return args;
      const scale = Number(value);
      if (!Number.isFinite(scale) || scale <= 0 || scale > 8) {
        args.error = `--scale must be a number between 0 and 8`;
        return args;
      }
      args.scale = scale;
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      args.error = `unknown option ${arg}`;
      return args;
    }
    positionals.push(arg);
    i += 1;
  }

  if (positionals.length > 1) {
    // Convenience: mise-en-scene input.json output.svg
    if (positionals.length === 2 && !args.outputPath) {
      args.inputPath = positionals[0];
      args.outputPath = positionals[1];
    } else {
      args.error = "expected at most one input path (use -o for output)";
      return args;
    }
  } else if (positionals.length === 1) {
    args.inputPath = positionals[0];
  }

  return args;
}

export function formatFromPath(path: string): ExportFormat | undefined {
  const lower = path.toLowerCase();
  if (lower.endsWith(".svg")) return "svg";
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".pdf")) return undefined;
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return lower.includes("walk") ? "walkthrough" : "html";
  }
  return undefined;
}

export function resolveFormat(args: CliArgs): ExportFormat | { error: string } {
  if (args.format) return args.format;
  if (args.outputPath) {
    const fromPath = formatFromPath(args.outputPath);
    if (fromPath) return fromPath;
    if (args.outputPath.toLowerCase().endsWith(".pdf")) {
      return { error: "PDF export is not available in the CLI yet; use svg, png, html, json, or walkthrough" };
    }
  }
  return "svg";
}
