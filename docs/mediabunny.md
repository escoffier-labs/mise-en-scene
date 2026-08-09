# MediaBunny walkthrough encode

Approved runtime-dependency exception for walkthrough video export.

## Why

Deterministic frame plans (`planWalkthroughFrames`) need exact timestamps,
encoder backpressure, named quality, and optional MP4. `MediaRecorder` alone
cannot provide those controls.

## Package

- npm: `mediabunny` ^1.52.0
- License: MPL-2.0 (see [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md))
- Default: VP9 WebM when `canEncodeVideo('vp9', { width, height, quality })` passes
- Optional: AVC MP4 when the same check passes for `'avc'`
- Quality: `new Quality('high')` (no pinned codec-native quantizer)
- Fallback: MediaRecorder WebM when WebCodecs/codec support is missing
- Out of scope: HEVC, AV1

## Modules

- Pure strategy: `src/scene/walkthroughEncode.ts`
- Browser adapter: `src/walkthroughRecorder.ts`
- UI: format-gated Record WebM / Record MP4 in `src/App.tsx`
