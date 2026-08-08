import assert from "node:assert/strict";
import test from "node:test";
import { onActivateKeyDown } from "./activateKey.ts";

function event(key: string) {
  let prevented = false;
  return {
    key,
    prevented: () => prevented,
    preventDefault() {
      prevented = true;
    },
  };
}

test("Enter activates once and preventDefaults", () => {
  const calls: string[] = [];
  const handler = onActivateKeyDown(() => calls.push("go"));
  const e = event("Enter");
  handler(e);
  assert.deepEqual(calls, ["go"]);
  assert.equal(e.prevented(), true);
});

test("Space activates once and preventDefaults", () => {
  const calls: string[] = [];
  const handler = onActivateKeyDown(() => calls.push("go"));
  const e = event(" ");
  handler(e);
  assert.deepEqual(calls, ["go"]);
  assert.equal(e.prevented(), true);
});

test("other keys are ignored", () => {
  const calls: string[] = [];
  const handler = onActivateKeyDown(() => calls.push("go"));
  for (const key of ["Escape", "Tab", "a", "ArrowDown"]) {
    const e = event(key);
    handler(e);
    assert.equal(e.prevented(), false, key);
  }
  assert.deepEqual(calls, []);
});

test("each handled keypress activates exactly once", () => {
  const calls: string[] = [];
  const handler = onActivateKeyDown(() => calls.push("go"));
  handler(event("Enter"));
  handler(event(" "));
  assert.deepEqual(calls, ["go", "go"]);
});
