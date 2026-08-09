import {
  renderHtmlDocument,
  renderJsonDocument,
  renderSvgDocument,
  renderWalkthroughDocument,
} from "./render.tsx";
import { runCli } from "./run.ts";

export function main(argv = process.argv.slice(2)): number {
  const result = runCli(argv, {
    renderSvg: renderSvgDocument,
    renderHtml: renderHtmlDocument,
    renderWalkthrough: renderWalkthroughDocument,
    renderJson: renderJsonDocument,
  });
  if (!result.ok) {
    process.stderr.write(`${result.error}\n`);
    return result.exitCode;
  }
  if (result.outputPath) {
    process.stderr.write(`Wrote ${result.format} to ${result.outputPath}\n`);
  }
  return 0;
}

export { runCli };
