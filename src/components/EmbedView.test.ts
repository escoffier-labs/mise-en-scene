import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("EmbedView loads hash state without touching localStorage", () => {
  const source = readFileSync(fileURLToPath(new URL("./EmbedView.tsx", import.meta.url)), "utf8");
  assert.match(source, /\bdecodeShareEnvelope\b/);
  assert.match(source, /\breadShareTokenFromHash\b/);
  assert.match(source, /\bSceneSvg\b/);
  assert.match(source, /\blayoutScene\b/);
  assert.equal(/localStorage\.(get|set)Item/.test(source), false);
});
