/**
 * Shared minimap geometry projection — keep caracAL + BWI demo identical.
 *
 * AL GEO uses sorted collision segments:
 *   x_lines: [x, y1, y2]  (vertical walls)
 *   y_lines: [y, x1, x2]  (horizontal walls)
 *
 * Output lines are pixel-space segments tagged with a style key:
 *   [x1, y1, x2, y2, style]
 *
 * AL character.vision is half-extents (default [700, 500] → 1400×1000 full
 * rectangle). The minimap window matches that vision box.
 */

/** AL default vision half-extents [x, y]. Full sight = 2x × 2y. */
const DEFAULT_VISION = [700, 500];
/** World→pixel density (same as historical caracAL minimap). */
const MMAP_SCALE = 1 / 3;
/** Extra world margin past vision so walls aren't flush with the frame. */
const VISION_PAD = 1.12;
/** Fallback pixel size when vision is unavailable (pre-vision window). */
const MMAP_W = 200;
const MMAP_H = 150;

function clip(v, lo, hi) {
  return Math.max(lo, Math.min(v, hi));
}

/**
 * Map AL vision half-extents to minimap pixel size + scale.
 * @param {[number, number]|null|undefined} vision
 * @param {{ scale?: number, pad?: number }} [opts]
 * @returns {{ width: number, height: number, scale: number, vision: [number, number] }}
 */
function resolveMinimapView(vision, opts) {
  const vx =
    vision && typeof vision[0] === "number" && vision[0] > 0
      ? vision[0]
      : DEFAULT_VISION[0];
  const vy =
    vision && typeof vision[1] === "number" && vision[1] > 0
      ? vision[1]
      : DEFAULT_VISION[1];
  const scale =
    opts && opts.scale != null && opts.scale > 0 ? opts.scale : MMAP_SCALE;
  const pad =
    opts && opts.pad != null && opts.pad > 0 ? opts.pad : VISION_PAD;
  return {
    width: Math.max(1, Math.round(vx * 2 * pad * scale)),
    height: Math.max(1, Math.round(vy * 2 * pad * scale)),
    scale,
    vision: [vx, vy],
  };
}

/**
 * @param {{ x_lines?: number[][], y_lines?: number[][] }} geom
 * @param {number} cx world camera x
 * @param {number} cy world camera y
 * @param {{ width?: number, height?: number, scale?: number }} [opts]
 * @returns {Array<[number, number, number, number, string]>}
 */
function projectMinimapLines(geom, cx, cy, opts) {
  const mmap_w = (opts && opts.width) || MMAP_W;
  const mmap_h = (opts && opts.height) || MMAP_H;
  const mmap_scale = (opts && opts.scale) != null ? opts.scale : MMAP_SCALE;
  const lines = [];
  const x_lines = (geom && geom.x_lines) || [];
  const y_lines = (geom && geom.y_lines) || [];

  // horizontal collision (x_lines: [x, y1, y2]) — sorted by x; break once past viewport
  for (let i = 0; i < x_lines.length; i++) {
    const [r_x, r_y1, r_y2] = x_lines[i];
    const l_x = (r_x - cx) * mmap_scale + mmap_w / 2;
    if (l_x < 0) continue;
    if (l_x >= mmap_w) break;
    const y1 = clip((r_y1 - cy) * mmap_scale + mmap_h / 2, 0, mmap_h);
    const y2 = clip((r_y2 - cy) * mmap_scale + mmap_h / 2, 0, mmap_h);
    if (Math.abs(y1 - y2) > 0.05) {
      lines.push([l_x, y1, l_x, y2, "wall"]);
    }
  }

  // vertical collision (y_lines: [y, x1, x2]) — sorted by y; break once past viewport
  for (let i = 0; i < y_lines.length; i++) {
    const [r_y, r_x1, r_x2] = y_lines[i];
    const l_y = (r_y - cy) * mmap_scale + mmap_h / 2;
    if (l_y < 0) continue;
    if (l_y >= mmap_h) break;
    const x1 = clip((r_x1 - cx) * mmap_scale + mmap_w / 2, 0, mmap_w);
    const x2 = clip((r_x2 - cx) * mmap_scale + mmap_w / 2, 0, mmap_w);
    if (Math.abs(x1 - x2) > 0.05) {
      lines.push([x1, l_y, x2, l_y, "wall"]);
    }
  }

  return lines;
}

/**
 * @returns {[number, number]}
 */
function projectMinimapPoint(x, y, cx, cy, opts) {
  const mmap_w = (opts && opts.width) || MMAP_W;
  const mmap_h = (opts && opts.height) || MMAP_H;
  const mmap_scale = (opts && opts.scale) != null ? opts.scale : MMAP_SCALE;
  return [
    (x - cx) * mmap_scale + mmap_w / 2,
    (y - cy) * mmap_scale + mmap_h / 2,
  ];
}

/**
 * Cache wall projection on a quantized camera so multi-char / high-rate beats
 * don't re-scan full GEO every time. Returns lines in the true (cx,cy) frame.
 * @param {{ quant?: number }} [opts] quant = world units (default 8)
 */
function createWallProjector() {
  let qKey = "";
  let linesAtQ = null;
  let qx = 0;
  let qy = 0;
  let mmap_scale = MMAP_SCALE;

  return function projectWalls(geom, cx, cy, opts) {
    const quant =
      opts && opts.quant != null && opts.quant > 0 ? opts.quant : 8;
    const mmap_w = (opts && opts.width) || MMAP_W;
    const mmap_h = (opts && opts.height) || MMAP_H;
    mmap_scale = (opts && opts.scale) != null ? opts.scale : MMAP_SCALE;
    const nqx = Math.round(cx / quant) * quant;
    const nqy = Math.round(cy / quant) * quant;
    const key =
      nqx +
      ":" +
      nqy +
      ":" +
      mmap_w +
      ":" +
      mmap_h +
      ":" +
      mmap_scale;
    if (key !== qKey || !linesAtQ) {
      qKey = key;
      qx = nqx;
      qy = nqy;
      linesAtQ = projectMinimapLines(geom, nqx, nqy, opts);
    }
    const ox = (qx - cx) * mmap_scale;
    const oy = (qy - cy) * mmap_scale;
    if (ox === 0 && oy === 0) return linesAtQ;
    const out = new Array(linesAtQ.length);
    for (let i = 0; i < linesAtQ.length; i++) {
      const L = linesAtQ[i];
      out[i] = [L[0] + ox, L[1] + oy, L[2] + ox, L[3] + oy, L[4]];
    }
    return out;
  };
}

module.exports = {
  DEFAULT_VISION,
  VISION_PAD,
  MMAP_W,
  MMAP_H,
  MMAP_SCALE,
  clip,
  resolveMinimapView,
  projectMinimapLines,
  projectMinimapPoint,
  createWallProjector,
};
