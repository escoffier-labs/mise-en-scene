import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MEDIA_RECORDER_MIME,
  encodeProgressLabel,
  formatControlState,
  pickMediaRecorderMime,
  selectEncodeStrategy,
  videoExportMediaSupported,
  walkthroughOutputMeta,
  type EncodeCapabilities,
} from "./walkthroughEncode.ts";

const allCaps: EncodeCapabilities = {
  mediabunnyVp9Webm: true,
  mediabunnyAvcMp4: true,
  mediaRecorderWebm: true,
};

test("selectEncodeStrategy prefers MediaBunny VP9 WebM when capable", () => {
  const strategy = selectEncodeStrategy("webm", allCaps);
  assert.deepEqual(strategy, { kind: "mediabunny", format: "webm", codec: "vp9" });
});

test("selectEncodeStrategy offers MediaBunny AVC MP4 when capable", () => {
  const strategy = selectEncodeStrategy("mp4", allCaps);
  assert.deepEqual(strategy, { kind: "mediabunny", format: "mp4", codec: "avc" });
});

test("selectEncodeStrategy falls back to MediaRecorder WebM when VP9 encode is unavailable", () => {
  const strategy = selectEncodeStrategy("webm", {
    mediabunnyVp9Webm: false,
    mediabunnyAvcMp4: true,
    mediaRecorderWebm: true,
  });
  assert.equal(strategy.kind, "mediarecorder");
  if (strategy.kind === "mediarecorder") {
    assert.equal(strategy.format, "webm");
    assert.equal(strategy.mimeType, DEFAULT_MEDIA_RECORDER_MIME);
  }
});

test("selectEncodeStrategy rejects unsupported codecs and MP4 without MediaBunny AVC", () => {
  const noAvc = selectEncodeStrategy("mp4", {
    mediabunnyVp9Webm: true,
    mediabunnyAvcMp4: false,
    mediaRecorderWebm: true,
  });
  assert.equal(noAvc.kind, "unavailable");
  if (noAvc.kind === "unavailable") {
    assert.match(noAvc.reason, /MP4|AVC|H\.264/i);
  }

  const nothing = selectEncodeStrategy("webm", {
    mediabunnyVp9Webm: false,
    mediabunnyAvcMp4: false,
    mediaRecorderWebm: false,
  });
  assert.equal(nothing.kind, "unavailable");
});

test("format controls enable only formats that pass runtime checks", () => {
  assert.deepEqual(formatControlState(allCaps), { webm: true, mp4: true });
  assert.deepEqual(
    formatControlState({
      mediabunnyVp9Webm: false,
      mediabunnyAvcMp4: false,
      mediaRecorderWebm: true,
    }),
    { webm: true, mp4: false },
  );
  assert.deepEqual(
    formatControlState({
      mediabunnyVp9Webm: false,
      mediabunnyAvcMp4: true,
      mediaRecorderWebm: false,
    }),
    { webm: false, mp4: true },
  );
  assert.deepEqual(
    formatControlState({
      mediabunnyVp9Webm: false,
      mediabunnyAvcMp4: false,
      mediaRecorderWebm: false,
    }),
    { webm: false, mp4: false },
  );
});

test("walkthroughOutputMeta names files and MIME types by format", () => {
  assert.deepEqual(walkthroughOutputMeta("webm"), {
    filename: "mise-en-scene-walkthrough.webm",
    mimeType: "video/webm",
  });
  assert.deepEqual(walkthroughOutputMeta("mp4"), {
    filename: "mise-en-scene-walkthrough.mp4",
    mimeType: "video/mp4",
  });
});

test("pickMediaRecorderMime prefers VP9 then VP8 then generic WebM", () => {
  assert.equal(
    pickMediaRecorderMime((t) => t.includes("vp9")),
    "video/webm;codecs=vp9",
  );
  assert.equal(
    pickMediaRecorderMime((t) => t.includes("vp8")),
    "video/webm;codecs=vp8",
  );
  assert.equal(
    pickMediaRecorderMime(() => false),
    "video/webm",
  );
});

test("encodeProgressLabel reports completed frames against the plan", () => {
  assert.equal(encodeProgressLabel(0, 116), "Encoding walkthrough... 0/116 frames");
  assert.equal(encodeProgressLabel(58, 116), "Encoding walkthrough... 58/116 frames");
  assert.equal(encodeProgressLabel(116, 116), "Encoding walkthrough... 116/116 frames");
});

test("videoExportMediaSupported is true when any encode path is available", () => {
  assert.equal(videoExportMediaSupported(allCaps), true);
  assert.equal(
    videoExportMediaSupported({
      mediabunnyVp9Webm: false,
      mediabunnyAvcMp4: false,
      mediaRecorderWebm: false,
    }),
    false,
  );
  assert.equal(
    videoExportMediaSupported({
      mediabunnyVp9Webm: false,
      mediabunnyAvcMp4: true,
      mediaRecorderWebm: false,
    }),
    true,
  );
});

test("App wires MediaBunny encode strategy and format-gated record controls", () => {
  const app = readFileSync(fileURLToPath(new URL("../App.tsx", import.meta.url)), "utf8");
  assert.match(app, /from\s+["']\.\/walkthroughRecorder["']/);
  assert.match(app, /from\s+["']\.\/scene\/walkthroughEncode["']/);
  assert.match(app, /\bencodeWalkthroughVideo\b/);
  assert.match(app, /\bprobeWalkthroughEncodeCapabilities\b/);
  assert.match(app, /Record WebM/);
  assert.match(app, /Record MP4/);
  assert.match(app, /videoFormats\.webm/);
  assert.match(app, /videoFormats\.mp4/);
});
