import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SCENE_THEME,
  SCENE_THEME_IDS,
  SCENE_THEMES,
  getSceneTheme,
  isSceneThemeId,
  sceneCssFor,
} from "./sceneStyles.ts";

test("scene theme ledger is default with exact ids and validation", () => {
  assert.equal(DEFAULT_SCENE_THEME, "ledger");
  assert.deepEqual([...SCENE_THEME_IDS], ["ledger", "paper"]);
  assert.equal(isSceneThemeId("ledger"), true);
  assert.equal(isSceneThemeId("paper"), true);
  assert.equal(isSceneThemeId("noir"), false);
  assert.equal(isSceneThemeId(1), false);
});

test("ledger preserves existing bg and accent literals", () => {
  const ledger = getSceneTheme("ledger");
  assert.equal(ledger.bg, "#0d1014");
  assert.equal(ledger.accent, "#e0a45c");
  assert.equal(SCENE_THEMES.ledger.bg, "#0d1014");
  assert.equal(SCENE_THEMES.ledger.accent, "#e0a45c");
});

test("paper uses distinct palette and literal CSS without variables or ledger accent", () => {
  const paper = getSceneTheme("paper");
  const ledger = getSceneTheme("ledger");
  assert.notEqual(paper.bg, ledger.bg);
  assert.notEqual(paper.accent, ledger.accent);

  const css = sceneCssFor("paper");
  assert.match(css, /#1b1b19/);
  assert.match(css, /#d0c8b8/);
  assert.match(css, /#9b4d24/);
  assert.doesNotMatch(css, /var\(/);
  assert.doesNotMatch(css, /#e0a45c/);
});

test("paper scene CSS uses accent-derived drop shadows, not ledger rgba", () => {
  const paper = getSceneTheme("paper");
  const css = sceneCssFor("paper");
  assert.equal(css.includes("rgba(224, 164, 92"), false);
  assert.equal(css.includes(`${paper.accent}59`), true);
  assert.equal(css.includes(`${paper.accent}73`), true);
});

test("ledger scene CSS keeps accent-equivalent eight-digit hex shadows", () => {
  const ledger = getSceneTheme("ledger");
  const css = sceneCssFor("ledger");
  assert.equal(css.includes("rgba(224, 164, 92"), false);
  assert.equal(css.includes(`${ledger.accent}59`), true);
  assert.equal(css.includes(`${ledger.accent}73`), true);
});
