import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { extractScene } from "./scene/extract.ts";
import {
  bindShareHash,
  decodeShareEnvelope,
  encodeShareEnvelope,
  readShareTokenFromHash,
} from "./scene/share.ts";

const appSource = readFileSync(fileURLToPath(new URL("./App.tsx", import.meta.url)), "utf8");

test("App wires share hash hydration without persisting imported scene or theme", () => {
  assert.match(appSource, /\bbindShareHash\b/);
  assert.match(appSource, /\bhashchange\b/);
  assert.match(appSource, /readShareTokenFromHash|bindShareHash/);
  assert.match(appSource, /Copy share link|Share link|Copy embed link|Embed link/);
  assert.match(appSource, /token === null|readShareTokenFromHash/);
  // Imported share state must stay in memory: no localStorage writes of mise-source/mise-theme inside the share path.
  assert.doesNotMatch(appSource, /decodeShareEnvelope[\s\S]{0,400}localStorage\.setItem\(["']mise-(source|theme)["']/);
});

test("Studio share hashchange replaces tokens, ignores stale results, errors on empty #s=, and preserves local persistence", async () => {
  const store = new Map<string, string>([
    ["mise-source", "Local saved source"],
    ["mise-theme", "paper"],
  ]);
  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };

  let hash = "";
  const listeners = new Set<() => void>();
  const applied: Array<{ title: string; theme: string }> = [];
  const errors: string[] = [];
  let resolveSlow: ((value: Awaited<ReturnType<typeof decodeShareEnvelope>>) => void) | undefined;

  const first = await encodeShareEnvelope({
    document: extractScene("A -> B: one", "engineer").document,
    theme: "ledger",
  });
  const secondDoc = extractScene("C -> D: two", "engineer").document;
  secondDoc.title = "Second shared";
  const second = await encodeShareEnvelope({ document: secondDoc, theme: "ledger" });

  const decode = (token: string) =>
    new Promise<Awaited<ReturnType<typeof decodeShareEnvelope>>>((resolve) => {
      if (token === first) {
        resolveSlow = resolve;
        return;
      }
      void decodeShareEnvelope(token).then(resolve);
    });

  // Mirrors Studio behavior: apply share into memory only; never write localStorage.
  const binding = bindShareHash({
    getHash: () => hash,
    decode,
    onChange: (state) => {
      if (state.status === "ready") {
        applied.push({ title: state.document.title, theme: state.theme });
      } else if (state.status === "error") {
        errors.push(state.error);
      }
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

  assert.deepEqual(applied.map((item) => item.title), ["Second shared"]);

  resolveSlow?.({
    ok: true,
    value: {
      document: extractScene("S -> T: stale", "engineer").document,
      theme: "paper",
    },
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(applied.map((item) => item.title), ["Second shared"]);

  hash = "#s=";
  for (const handler of listeners) handler();
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(errors.some((error) => /invalid shared scene/i.test(error)));

  assert.equal(localStorage.getItem("mise-source"), "Local saved source");
  assert.equal(localStorage.getItem("mise-theme"), "paper");
  assert.equal(store.get("mise-source"), "Local saved source");
  assert.equal(store.get("mise-theme"), "paper");

  // Empty token classification for the Studio path.
  assert.equal(readShareTokenFromHash("#s="), "");
  assert.notEqual(readShareTokenFromHash("#s="), null);

  binding.dispose();
  assert.equal(listeners.size, 0);
});
