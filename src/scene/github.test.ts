import assert from "node:assert/strict";
import test from "node:test";
import { fetchRepoFiles, GITHUB_RATE_LIMIT_MESSAGE, INCOMPLETE_TREE_MESSAGE } from "./github.ts";
import { REMOTE_CANDIDATE_CAP_WARNING, REMOTE_CANDIDATE_LIMIT } from "./crawl.ts";

type MockResponse = {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
};

function jsonResponse(body: unknown, ok = true, status = 200): MockResponse {
  return { ok, status, json: async () => body };
}

function textResponse(body: string, ok = true, status = 200): MockResponse {
  return { ok, status, text: async () => body };
}

test("truncated recursive tree throws before blob fetches and yields no files", async () => {
  const calls: string[] = [];
  const fetchMock = async (input: RequestInfo | URL): Promise<MockResponse> => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/repos/acme/huge")) return jsonResponse({ default_branch: "main" });
    if (url.includes("/git/trees/main?recursive=1")) {
      return jsonResponse({
        truncated: true,
        tree: [
          { type: "blob", path: "README.md", size: 32 },
          { type: "blob", path: "docs/guide.md", size: 64 },
        ],
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  await assert.rejects(
    () => fetchRepoFiles({ owner: "acme", repo: "huge" }, fetchMock as typeof fetch),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, INCOMPLETE_TREE_MESSAGE);
      return true;
    },
  );

  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => !url.includes("raw.githubusercontent.com")));
  assert.ok(calls.every((url) => !url.includes("/git/blobs/")));
});

test("complete recursive tree fetches candidate blobs and returns their text", async () => {
  const calls: string[] = [];
  const fetchMock = async (input: RequestInfo | URL): Promise<MockResponse> => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/repos/acme/demo")) return jsonResponse({ default_branch: "main" });
    if (url.includes("/git/trees/main?recursive=1")) {
      return jsonResponse({
        truncated: false,
        tree: [
          { type: "blob", path: "README.md", size: 40 },
          { type: "blob", path: "src/index.ts", size: 20 },
          { type: "blob", path: "openapi.yaml", size: 50 },
        ],
      });
    }
    if (url.includes("raw.githubusercontent.com/acme/demo/main/README.md")) {
      return textResponse("Web -> API: hello");
    }
    if (url.includes("raw.githubusercontent.com/acme/demo/main/openapi.yaml")) {
      return textResponse("openapi: 3.1.0\ninfo:\n  title: Demo\npaths: {}");
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const { files } = await fetchRepoFiles({ owner: "acme", repo: "demo" }, fetchMock as typeof fetch);
  assert.deepEqual(
    files.map((file) => file.path).sort(),
    ["README.md", "openapi.yaml"],
  );
  assert.ok(files.some((file) => file.path === "README.md" && file.text.includes("Web -> API")));
  assert.ok(calls.some((url) => url.includes("raw.githubusercontent.com")));
  assert.ok(!calls.some((url) => url.includes("src/index.ts")));
});

test("remote candidate cap surfaces a truncation warning without failing the fetch", async () => {
  const tree: Array<{ type: string; path?: string; size?: number }> = [];
  for (let index = 0; index < REMOTE_CANDIDATE_LIMIT + 3; index++) {
    tree.push({ type: "blob", path: `docs/file-${String(index).padStart(3, "0")}.md`, size: 64 });
  }
  const fetchMock = async (input: RequestInfo | URL): Promise<MockResponse> => {
    const url = String(input);
    if (url.endsWith("/repos/acme/big")) return jsonResponse({ default_branch: "main" });
    if (url.includes("/git/trees/main?recursive=1")) return jsonResponse({ truncated: false, tree });
    if (url.includes("raw.githubusercontent.com")) return textResponse("A -> B: relates");
    throw new Error(`unexpected fetch: ${url}`);
  };

  const { files, warnings } = await fetchRepoFiles({ owner: "acme", repo: "big" }, fetchMock as typeof fetch);
  assert.equal(files.length, REMOTE_CANDIDATE_LIMIT);
  assert.deepEqual(warnings, [REMOTE_CANDIDATE_CAP_WARNING]);
});

test("rate-limit error wording points at guidance", () => {
  assert.match(GITHUB_RATE_LIMIT_MESSAGE, /rate limit/i);
  assert.match(GITHUB_RATE_LIMIT_MESSAGE, /README/i);
});

test("incomplete-tree error wording stays actionable", () => {
  assert.match(INCOMPLETE_TREE_MESSAGE, /incomplete/i);
  assert.match(INCOMPLETE_TREE_MESSAGE, /truncated/i);
  assert.match(INCOMPLETE_TREE_MESSAGE, /open the folder locally/i);
});
