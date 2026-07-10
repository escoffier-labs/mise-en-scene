import assert from "node:assert/strict";
import test from "node:test";
import { htmlDocument, svgDocument } from "./exportText.ts";

test("HTML export embeds safe scene data and interaction hooks", () => {
  const html = htmlDocument("<svg></svg>", { schemaVersion: 1, title: "</script><b>x</b>" });
  assert.match(html, /application\/json/);
  assert.match(html, /data-view/);
  assert.doesNotMatch(html, /<\/script><b>/);
  assert.match(html, /schemaVersion/);
});

test("SVG export adds namespace and contains no script", () => {
  const svg = svgDocument("<svg viewBox=\"0 0 10 10\"><style>.x{}</style></svg>");
  assert.match(svg, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.doesNotMatch(svg, /<script/);
});
