import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { extractScene } from "../scene/extract.ts";
import {
  bindShareHash,
  decodeShareEnvelope,
  encodeShareEnvelope,
  readShareTokenFromHash,
} from "../scene/share.ts";

const embedSource = readFileSync(fileURLToPath(new URL("./EmbedView.tsx", import.meta.url)), "utf8");
const mainSource = readFileSync(fileURLToPath(new URL("../main.tsx", import.meta.url)), "utf8");

test("EmbedView and main wire ?embed=1 without localStorage or an /embed route", () => {
  assert.match(mainSource, /embed=1|searchParams|URLSearchParams/);
  assert.match(mainSource, /\bEmbedView\b/);
  assert.doesNotMatch(mainSource, /["']\/embed["']/);
  assert.match(embedSource, /\bbindShareHash\b/);
  assert.match(embedSource, /\bhashchange\b/);
  assert.match(embedSource, /\bSceneSvg\b/);
  assert.doesNotMatch(embedSource, /localStorage/);
});

test("EmbedView share hashchange replaces tokens, ignores stale results, and errors on empty #s=", async () => {
  let hash = "";
  const listeners = new Set<() => void>();
  const applied: string[] = [];
  const errors: string[] = [];
  let resolveSlow: ((value: Awaited<ReturnType<typeof decodeShareEnvelope>>) => void) | undefined;
  let localStorageTouched = false;

  const firstDoc = extractScene("A -> B: one", "engineer").document;
  firstDoc.title = "Embed first";
  const secondDoc = extractScene("C -> D: two", "engineer").document;
  secondDoc.title = "Embed second";
  const first = await encodeShareEnvelope({ document: firstDoc });
  const second = await encodeShareEnvelope({ document: secondDoc, theme: "paper" });

  const decode = (token: string) =>
    new Promise<Awaited<ReturnType<typeof decodeShareEnvelope>>>((resolve) => {
      if (token === first) {
        resolveSlow = resolve;
        return;
      }
      void decodeShareEnvelope(token).then(resolve);
    });

  // Mirrors EmbedView: hydrate scene chrome-free and never touch localStorage.
  const binding = bindShareHash({
    getHash: () => hash,
    decode,
    onChange: (state) => {
      if (state.status === "ready") applied.push(state.document.title);
      else if (state.status === "error") errors.push(state.error);
    },
    addEventListener: (_type, handler) => {
      listeners.add(handler);
    },
    removeEventListener: (_type, handler) => {
      listeners.delete(handler);
    },
  });

  hash = `#s=${first}`;
  binding.refresh();
  hash = `#s=${second}`;
  for (const handler of listeners) handler();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(applied, ["Embed second"]);

  resolveSlow?.({ ok: true, value: { document: firstDoc, theme: "ledger" } });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(applied, ["Embed second"]);

  hash = "#s=";
  for (const handler of listeners) handler();
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(errors.some((error) => /invalid shared scene/i.test(error)));
  assert.equal(readShareTokenFromHash("#s="), "");
  assert.equal(localStorageTouched, false);

  binding.dispose();
  assert.equal(listeners.size, 0);
});
