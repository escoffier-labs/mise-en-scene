// Pure walkthrough encode strategy: format selection, capability gating, and
// output naming. No DOM, WebCodecs, or MediaBunny imports. Browser adapters
// probe capabilities and call selectEncodeStrategy before encoding.

export type WalkthroughVideoFormat = "webm" | "mp4";

export type EncodeCapabilities = {
  mediabunnyVp9Webm: boolean;
  mediabunnyAvcMp4: boolean;
  mediaRecorderWebm: boolean;
};

export type EncodeStrategy =
  | { kind: "mediabunny"; format: "webm"; codec: "vp9" }
  | { kind: "mediabunny"; format: "mp4"; codec: "avc" }
  | { kind: "mediarecorder"; format: "webm"; mimeType: string }
  | { kind: "unavailable"; reason: string };

export type FormatControlState = { webm: boolean; mp4: boolean };

export type WalkthroughOutputMeta = { filename: string; mimeType: string };

export const DEFAULT_MEDIA_RECORDER_MIME = "video/webm;codecs=vp9";

const MEDIA_RECORDER_MIME_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

export function pickMediaRecorderMime(
  isTypeSupported: (mimeType: string) => boolean,
): string {
  return MEDIA_RECORDER_MIME_CANDIDATES.find((mime) => isTypeSupported(mime)) || "video/webm";
}

export function formatControlState(caps: EncodeCapabilities): FormatControlState {
  return {
    webm: caps.mediabunnyVp9Webm || caps.mediaRecorderWebm,
    mp4: caps.mediabunnyAvcMp4,
  };
}

export function selectEncodeStrategy(
  format: WalkthroughVideoFormat,
  caps: EncodeCapabilities,
  mediaRecorderMime = DEFAULT_MEDIA_RECORDER_MIME,
): EncodeStrategy {
  if (format === "mp4") {
    if (caps.mediabunnyAvcMp4) {
      return { kind: "mediabunny", format: "mp4", codec: "avc" };
    }
    return {
      kind: "unavailable",
      reason: "MP4 (AVC/H.264) encoding is not available in this browser",
    };
  }

  if (caps.mediabunnyVp9Webm) {
    return { kind: "mediabunny", format: "webm", codec: "vp9" };
  }
  if (caps.mediaRecorderWebm) {
    return { kind: "mediarecorder", format: "webm", mimeType: mediaRecorderMime };
  }
  return {
    kind: "unavailable",
    reason: "WebM video encoding is not available in this browser",
  };
}

export function walkthroughOutputMeta(format: WalkthroughVideoFormat): WalkthroughOutputMeta {
  if (format === "mp4") {
    return { filename: "mise-en-scene-walkthrough.mp4", mimeType: "video/mp4" };
  }
  return { filename: "mise-en-scene-walkthrough.webm", mimeType: "video/webm" };
}

export function encodeProgressLabel(completed: number, total: number): string {
  return `Encoding walkthrough... ${completed}/${total} frames`;
}

export function videoExportMediaSupported(caps: EncodeCapabilities): boolean {
  return formatControlState(caps).webm || formatControlState(caps).mp4;
}
