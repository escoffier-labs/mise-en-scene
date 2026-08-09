import assert from "node:assert/strict";
import test from "node:test";
import { findChromePath } from "./chrome.ts";

test("findChromePath prefers an explicit executable path", () => {
  const chrome = findChromePath("/usr/bin/google-chrome-stable") ?? findChromePath("/usr/bin/google-chrome");
  if (!chrome) {
    // Environment without Chromium; still assert explicit miss.
    assert.equal(findChromePath("/no/such/chrome"), null);
    return;
  }
  assert.equal(findChromePath(chrome), chrome);
  assert.equal(findChromePath("/no/such/chrome"), null);
});

test("findChromePath honors CHROME_PATH when executable", () => {
  const existing = findChromePath();
  if (!existing) return;
  assert.equal(findChromePath(undefined, { ...process.env, CHROME_PATH: existing, PATH: "" }), existing);
});
