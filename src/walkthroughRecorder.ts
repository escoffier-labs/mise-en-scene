// Browser-only walkthrough video encoding. MediaBunny path uses CanvasSource
// with explicit timestamps from the shared frame plan; MediaRecorder remains
// the WebM fallback when WebCodecs/VP9 is unavailable.

import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  canEncodeVideo,
} from "mediabunny";
import { SCENE_HEIGHT, SCENE_WIDTH } from "./scene/raster";
import type { Viewport } from "./scene/walkthrough";
import type { WalkthroughPlan } from "./scene/walkthroughPlan";
import {
  encodeProgressLabel,
  pickMediaRecorderMime,
  selectEncodeStrategy,
  videoExportMediaSupported,
  walkthroughOutputMeta,
  type EncodeCapabilities,
  type WalkthroughVideoFormat,
} from "./scene/walkthroughEncode";

export type DrawCrop = (img: HTMLImageElement, viewport: Viewport) => void;

export type EncodeWalkthroughOptions = {
  format: WalkthroughVideoFormat;
  plan: WalkthroughPlan;
  images: HTMLImageElement[];
  canvas: HTMLCanvasElement;
  drawCrop: DrawCrop;
  onProgress?: (label: string) => void;
  sleep?: (ms: number) => Promise<void>;
  probeCaps?: () => Promise<EncodeCapabilities>;
};

export type EncodeWalkthroughResult =
  | { ok: true; blob: Blob; filename: string; mimeType: string }
  | { ok: false; notice: string };

const MEDIA_RECORDER_SUPPORT_HINTS = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

function mediaRecorderAvailable(): boolean {
  const Recorder = (globalThis as { MediaRecorder?: { isTypeSupported?: (t: string) => boolean } }).MediaRecorder;
  const probe = globalThis.document?.createElement?.("canvas");
  const captureOk = typeof (probe as { captureStream?: unknown } | undefined)?.captureStream === "function";
  if (typeof Recorder === "undefined" || !captureOk) return false;
  if (typeof Recorder.isTypeSupported !== "function") return true;
  return MEDIA_RECORDER_SUPPORT_HINTS.some((mime) => Recorder.isTypeSupported!(mime));
}

export async function probeWalkthroughEncodeCapabilities(
  width = SCENE_WIDTH,
  height = SCENE_HEIGHT,
): Promise<EncodeCapabilities> {
  const mediaRecorderWebm = mediaRecorderAvailable();
  const quality = new Quality("high");
  const [mediabunnyVp9Webm, mediabunnyAvcMp4] = await Promise.all([
    canEncodeVideo("vp9", { width, height, quality }).catch(() => false),
    canEncodeVideo("avc", { width, height, quality }).catch(() => false),
  ]);
  return { mediabunnyVp9Webm, mediabunnyAvcMp4, mediaRecorderWebm };
}

export function isVideoExportSupported(caps: EncodeCapabilities): boolean {
  return videoExportMediaSupported(caps);
}

export async function encodeWalkthroughVideo(
  opts: EncodeWalkthroughOptions,
): Promise<EncodeWalkthroughResult> {
  const Recorder = (globalThis as {
    MediaRecorder?: {
      new (stream: MediaStream, init?: { mimeType?: string }): {
        ondataavailable: ((e: { data?: Blob }) => void) | null;
        onstop: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      isTypeSupported?: (t: string) => boolean;
    };
  }).MediaRecorder;

  const mimePick = pickMediaRecorderMime((t) =>
    typeof Recorder?.isTypeSupported === "function" ? Recorder.isTypeSupported(t) : t === "video/webm",
  );
  const caps = await (opts.probeCaps ?? probeWalkthroughEncodeCapabilities)();
  const strategy = selectEncodeStrategy(opts.format, caps, mimePick);
  if (strategy.kind === "unavailable") {
    return { ok: false, notice: strategy.reason };
  }

  const meta = walkthroughOutputMeta(strategy.format);
  try {
    if (strategy.kind === "mediabunny") {
      const blob = await encodeWithMediaBunny({
        codec: strategy.codec,
        format: strategy.format,
        plan: opts.plan,
        images: opts.images,
        canvas: opts.canvas,
        drawCrop: opts.drawCrop,
        mimeType: meta.mimeType,
        onProgress: opts.onProgress,
      });
      return { ok: true, blob, filename: meta.filename, mimeType: meta.mimeType };
    }

    const blob = await encodeWithMediaRecorder({
      plan: opts.plan,
      images: opts.images,
      canvas: opts.canvas,
      drawCrop: opts.drawCrop,
      mimeType: strategy.mimeType,
      sleep: opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
      onProgress: opts.onProgress,
      Recorder: Recorder!,
    });
    return { ok: true, blob, filename: meta.filename, mimeType: meta.mimeType };
  } catch (error) {
    return {
      ok: false,
      notice: `Video encoding failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

async function encodeWithMediaBunny(opts: {
  codec: "vp9" | "avc";
  format: "webm" | "mp4";
  plan: WalkthroughPlan;
  images: HTMLImageElement[];
  canvas: HTMLCanvasElement;
  drawCrop: DrawCrop;
  mimeType: string;
  onProgress?: (label: string) => void;
}): Promise<Blob> {
  const target = new BufferTarget();
  const output = new Output({
    format: opts.format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target,
  });

  let packets = 0;
  const source = new CanvasSource(opts.canvas, {
    codec: opts.codec,
    quality: new Quality("high"),
    onEncodedPacket: () => {
      packets += 1;
      opts.onProgress?.(encodeProgressLabel(Math.min(packets, opts.plan.frames.length), opts.plan.frames.length));
    },
  });

  output.addVideoTrack(source, { frameRate: opts.plan.fps });

  try {
    await output.start();
    let completed = 0;
    for (const frame of opts.plan.frames) {
      opts.drawCrop(opts.images[frame.stepIndex], frame.viewport);
      await source.add(frame.timestampMs / 1000, frame.durationMs / 1000);
      completed += 1;
      opts.onProgress?.(encodeProgressLabel(completed, opts.plan.frames.length));
    }
    source.close();
    await output.finalize();
  } catch (error) {
    try {
      await output.cancel();
    } catch {
      // Best-effort cancel so a failed encode never yields a partial download.
    }
    throw error;
  }

  const buffer = target.buffer;
  if (!buffer || buffer.byteLength === 0) {
    throw new Error("encoder produced an empty file");
  }
  return new Blob([buffer], { type: opts.mimeType });
}

async function encodeWithMediaRecorder(opts: {
  plan: WalkthroughPlan;
  images: HTMLImageElement[];
  canvas: HTMLCanvasElement;
  drawCrop: DrawCrop;
  mimeType: string;
  sleep: (ms: number) => Promise<void>;
  onProgress?: (label: string) => void;
  Recorder: {
    new (stream: MediaStream, init?: { mimeType?: string }): {
      ondataavailable: ((e: { data?: Blob }) => void) | null;
      onstop: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
  };
}): Promise<Blob> {
  const stream = (opts.canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(
    opts.plan.fps,
  );
  const recorder = new opts.Recorder(stream, { mimeType: opts.mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data?.size) chunks.push(e.data);
  };
  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: opts.mimeType }));
  });
  recorder.start();
  let completed = 0;
  for (const frame of opts.plan.frames) {
    opts.drawCrop(opts.images[frame.stepIndex], frame.viewport);
    await opts.sleep(frame.durationMs);
    completed += 1;
    opts.onProgress?.(encodeProgressLabel(completed, opts.plan.frames.length));
  }
  recorder.stop();
  const blob = await finished;
  if (!blob.size) throw new Error("recorder produced an empty file");
  return blob;
}
