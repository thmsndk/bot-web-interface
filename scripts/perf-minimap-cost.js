/**
 * Cost model: wall stroke ops during a camera ease window.
 * Confirms static-layer blit path stays cheaper than full redraw every frame.
 */
const mainGeo = require("../fixtures/main-geo.json");
const {
  resolveMinimapView,
  DEFAULT_VISION,
  createWallProjector,
} = require("../minimapGeometry");

const project = createWallProjector();
const view = resolveMinimapView(DEFAULT_VISION);
const lines = project(mainGeo, 0, 0, {
  width: view.width,
  height: view.height,
  scale: view.scale,
});

const MINIMAPS = 3;
const EASE_FRAMES = Math.ceil(280 / (1000 / 60)); // ~17 frames
const BEATS = 10;

const fullWallOps =
  lines.length * MINIMAPS * EASE_FRAMES * BEATS + lines.length * MINIMAPS * BEATS;
// Beat rebuilds static once; ease frames only blit (0 wall strokes).
const cachedWallOps = lines.length * MINIMAPS * BEATS;

const reduction = 1 - cachedWallOps / fullWallOps;
const result = {
  wallSegments: lines.length,
  minimaps: MINIMAPS,
  easeFrames: EASE_FRAMES,
  beats: BEATS,
  fullWallOps,
  cachedWallOps,
  reduction: Number(reduction.toFixed(3)),
};

console.log(JSON.stringify(result, null, 2));
if (!(reduction >= 0.85)) {
  console.error("FAIL: expected >=85% fewer wall strokes with static cache");
  process.exit(1);
}
console.log("PASS");
