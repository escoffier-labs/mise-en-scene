// Browser-only public GitHub importer. Pure enough to unit-test with an injected
// fetch: resolve default branch, read the recursive tree, then raw-fetch a small
// candidate set. Fail closed when GitHub marks the recursive tree truncated so a
// partial listing is never presented as a complete repository.

import { REMOTE_CANDIDATE_CAP_WARNING, selectRemoteCandidatePaths, type CrawlFile, type RepoRef } from "./crawl.ts";

export const INCOMPLETE_TREE_MESSAGE =
  "incomplete repository tree (GitHub truncated the recursive listing); open the folder locally or use a smaller branch";

export const GITHUB_RATE_LIMIT_MESSAGE =
  "GitHub API rate limit reached (unauthenticated requests are limited to about 60 per hour). Wait and retry, open the folder locally, or see README for rate-limit guidance.";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type FetchRepoResult = { files: CrawlFile[]; warnings: string[] };

export async function fetchRepoFiles(ref: RepoRef, fetchImpl: FetchLike = fetch): Promise<FetchRepoResult> {
  const api = `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
  let branch = ref.branch ?? "";
  if (!branch) {
    const meta = await fetchImpl(api);
    if (!meta.ok) throw new Error(meta.status === 403 ? GITHUB_RATE_LIMIT_MESSAGE : `repository not found (${meta.status})`);
    branch = String((await meta.json()).default_branch || "main");
  }
  const treeRes = await fetchImpl(`${api}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  if (!treeRes.ok) throw new Error(`could not read repository tree (${treeRes.status})`);
  const payload = await treeRes.json() as { truncated?: boolean; tree?: unknown[] };
  if (payload.truncated === true) throw new Error(INCOMPLETE_TREE_MESSAGE);
  const tree = (payload.tree || []) as Array<{ type: string; path?: string; size?: number }>;
  const { paths, truncated } = selectRemoteCandidatePaths(tree);
  const warnings = truncated ? [REMOTE_CANDIDATE_CAP_WARNING] : [];
  const files: CrawlFile[] = [];
  for (const path of paths) {
    const raw = await fetchImpl(`https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${branch}/${path.split("/").map(encodeURIComponent).join("/")}`);
    if (raw.ok) files.push({ path, text: await raw.text() });
  }
  return { files, warnings };
}
