// Browser-only public GitHub importer. Pure enough to unit-test with an injected
// fetch: resolve default branch, read the recursive tree, then raw-fetch a small
// candidate set. Fail closed when GitHub marks the recursive tree truncated so a
// partial listing is never presented as a complete repository.

import { selectRemoteCandidatePaths, type CrawlFile, type RepoRef } from "./crawl.ts";

export const INCOMPLETE_TREE_MESSAGE =
  "incomplete repository tree (GitHub truncated the recursive listing); open the folder locally or use a smaller branch";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function fetchRepoFiles(ref: RepoRef, fetchImpl: FetchLike = fetch): Promise<CrawlFile[]> {
  const api = `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
  let branch = ref.branch ?? "";
  if (!branch) {
    const meta = await fetchImpl(api);
    if (!meta.ok) throw new Error(meta.status === 403 ? "GitHub API rate limit reached" : `repository not found (${meta.status})`);
    branch = String((await meta.json()).default_branch || "main");
  }
  const treeRes = await fetchImpl(`${api}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  if (!treeRes.ok) throw new Error(`could not read repository tree (${treeRes.status})`);
  const payload = await treeRes.json() as { truncated?: boolean; tree?: unknown[] };
  if (payload.truncated === true) throw new Error(INCOMPLETE_TREE_MESSAGE);
  const tree = (payload.tree || []) as Array<{ type: string; path?: string; size?: number }>;
  const paths = selectRemoteCandidatePaths(tree);
  const files: CrawlFile[] = [];
  for (const path of paths) {
    const raw = await fetchImpl(`https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${branch}/${path.split("/").map(encodeURIComponent).join("/")}`);
    if (raw.ok) files.push({ path, text: await raw.text() });
  }
  return files;
}
