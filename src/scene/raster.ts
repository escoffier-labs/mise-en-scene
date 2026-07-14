// Rasterization helpers for exporting a scene as a PNG screenshot.
//
// The pure part builds the data URL and pixel-sized SVG that feed an <img>.
// The actual canvas draw and PNG encode happen in the browser (App.tsx),
// the only place a real Image and canvas exist. Because the scene stylesheet
// (sceneStyles.sceneCss) references no external resources, the raster stays
// same-origin and the canvas is never tainted.

export const SCENE_WIDTH = 1280;
export const SCENE_HEIGHT = 780;
export const PNG_SCALE = 2; // Retina-friendly raster of the scene canvas.

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// An SVG loaded into an <img> needs explicit pixel dimensions to rasterize at a
// predictable size across browsers; the viewBox alone is not reliable.
export function sizedSvg(svg: string, width = SCENE_WIDTH, height = SCENE_HEIGHT): string {
  return svg.replace(/^<svg/, `<svg width="${width}" height="${height}"`);
}
