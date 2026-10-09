/**
 * Adventure Land icon atlas helpers for BWI.
 *
 * caracAL extracts a compact atlas from `G` once; the browser crops sheets
 * via CSS (and optional HTML chrome for level/qty/title).
 */

const AL_ORIGIN = "https://adventure.land";

/**
 * @param {string} file G sheet path (e.g. /images/tiles/items/pack_20vt8.png)
 * @param {{ proxyBase?: string, origin?: string }} [opts]
 * @returns {string}
 */
function sheetUrl(file, opts) {
  if (!file) return "";
  if (/^https?:\/\//i.test(file)) return file;
  const path = file.startsWith("/") ? file : "/" + file;
  if (opts && opts.proxyBase) {
    const base = String(opts.proxyBase).replace(/\/$/, "");
    return base + path;
  }
  const origin = (opts && opts.origin) || AL_ORIGIN;
  return origin.replace(/\/$/, "") + path;
}

/**
 * Item / inventory skins via G.positions + G.imagesets.
 * @param {{ positions?: object, imagesets?: object }} atlas
 * @param {string} skin
 * @returns {{ file: string, sx: number, sy: number, sw: number, sh: number, packSize?: number } | null}
 */
function resolveImagesetCrop(atlas, skin) {
  if (!atlas || !atlas.positions || !atlas.imagesets) return null;
  const pos = atlas.positions[skin] || atlas.positions.placeholder;
  if (!pos) return null;
  const packKey = pos[0] || "pack_20";
  const pack = atlas.imagesets[packKey];
  if (!pack || !pack.file || !pack.size) return null;
  return {
    file: pack.file,
    sx: pos[1] * pack.size,
    sy: pos[2] * pack.size,
    sw: pack.size,
    sh: pack.size,
    packSize: pack.size,
  };
}

/**
 * Resolve skin name for an item type key.
 * @param {{ items?: object }} atlas
 * @param {string} itemName
 * @param {{ active?: boolean }} [opts]
 */
function resolveItemSkin(atlas, itemName, opts) {
  const gItem = atlas && atlas.items && atlas.items[itemName];
  if (!gItem) return itemName || "placeholder";
  if (opts && opts.active && gItem.skin_a) return gItem.skin_a;
  return gItem.skin || itemName || "placeholder";
}

/**
 * Compact atlas for BWI clients (no full item stats).
 * @param {object} G adventure.land G
 * @param {{ origin?: string, includeSprites?: boolean }} [opts]
 */
function extractAtlas(G, opts) {
  opts = opts || {};
  if (!G) {
    return {
      origin: opts.origin || AL_ORIGIN,
      imagesets: {},
      positions: {},
      items: {},
      titles: {},
    };
  }

  const items = {};
  const srcItems = G.items || {};
  for (const name of Object.keys(srcItems)) {
    const it = srcItems[name];
    if (!it) continue;
    items[name] = {
      skin: it.skin,
      skin_a: it.skin_a,
      name: it.name,
      upgrade: !!it.upgrade,
      compound: !!it.compound,
    };
  }

  const titles = {};
  const srcTitles = G.titles || {};
  for (const key of Object.keys(srcTitles)) {
    const t = srcTitles[key];
    if (t && t.title) titles[key] = { title: t.title };
  }

  const conditions = {};
  const srcConditions = G.conditions || {};
  for (const key of Object.keys(srcConditions)) {
    const c = srcConditions[key];
    if (!c) continue;
    conditions[key] = {
      skin: c.skin,
      name: c.name,
      buff: !!c.buff,
      debuff: !!c.debuff,
    };
  }

  // Shallow-copy sheet tables so BWI does not retain the live game `G` graph.
  const imagesets = {};
  const srcImagesets = G.imagesets || {};
  for (const key of Object.keys(srcImagesets)) {
    const pack = srcImagesets[key];
    if (pack && typeof pack === "object") {
      imagesets[key] = Object.assign({}, pack);
    }
  }
  const positions = {};
  const srcPositions = G.positions || {};
  for (const key of Object.keys(srcPositions)) {
    positions[key] = srcPositions[key];
  }

  const atlas = {
    origin: opts.origin || AL_ORIGIN,
    imagesets,
    positions,
    items,
    titles,
    conditions,
  };

  if (opts.includeSprites && G.sprites) {
    const sprites = {};
    for (const key of Object.keys(G.sprites)) {
      sprites[key] = G.sprites[key];
    }
    atlas.sprites = sprites;
  }

  return atlas;
}

/**
 * Normalize a published item instance (game item or already-normalized).
 * @param {object | null | undefined} raw
 * @returns {object | null}
 */
function normalizeItemInstance(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    return { name: raw };
  }
  if (typeof raw !== "object") return null;
  if (!raw.name && !raw.skin) return null;
  const out = { name: raw.name };
  if (raw.skin) out.skin = raw.skin;
  if (typeof raw.level === "number") out.level = raw.level;
  if (typeof raw.q === "number") out.q = raw.q;
  if (raw.p) out.p = raw.p;
  if (raw.active) out.active = true;
  if (typeof raw.size === "number") out.size = raw.size;
  if (raw.showQuantity != null) out.showQuantity = !!raw.showQuantity;
  if (raw.showLevel != null) out.showLevel = !!raw.showLevel;
  if (raw.showTitleBorder != null) out.showTitleBorder = !!raw.showTitleBorder;
  if (raw.title) out.title = raw.title;
  if (typeof raw.price === "number") out.price = raw.price;
  if (raw.side) out.side = raw.side;
  if (raw.slot) out.slot = raw.slot;
  if (raw.giveaway) out.giveaway = raw.giveaway;
  const want = normalizeTradeWant(raw.want);
  if (want) out.want = want;
  return out;
}

/**
 * Item-for-item stand offer (`trade_offer` / `trade_swap`) — `want` may be a
 * plain item key or `{ name, level?, p?, q? }`.
 * @param {unknown} want
 * @returns {{ name: string, level?: number, q?: number, p?: string } | null}
 */
function normalizeTradeWant(want) {
  if (want == null) return null;
  if (typeof want === "string") {
    if (!want) return null;
    return { name: want };
  }
  if (typeof want !== "object" || typeof want.name !== "string" || !want.name) {
    return null;
  }
  const out = { name: want.name };
  if (typeof want.level === "number" && Number.isFinite(want.level)) {
    out.level = Math.floor(want.level);
  }
  if (typeof want.q === "number" && Number.isFinite(want.q) && want.q > 0) {
    out.q = Math.floor(want.q);
  }
  if (typeof want.p === "string" && want.p) out.p = want.p;
  return out;
}

/** Compact badge / tooltip fragment for a want SKU. */
function formatTradeWantShort(want) {
  if (!want || !want.name) return "SWAP";
  let name = String(want.name);
  if (name.indexOf("slice_") === 0) name = name.slice(6);
  let s = name;
  if (want.level != null) s += "+" + want.level;
  if (want.q != null && want.q > 1) s = want.q + "×" + s;
  return "↔" + s;
}

/**
 * Non-empty merchant trade slots as iteminstances (price/side chrome on strip/grid).
 * Includes gold listings, giveaways, and item-for-item `want` offers.
 * @param {{ slots?: object }} character
 * @param {{ includeGiveaways?: boolean }} [opts]
 * @returns {Array<object>}
 */
function slimTradeListings(character, opts) {
  opts = opts || {};
  const slots = (character && character.slots) || {};
  const keys = Object.keys(slots).filter((k) => k.indexOf("trade") === 0);
  keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const it = slots[key];
    if (!it || !it.name) continue;
    const want = !it.b && !it.giveaway ? normalizeTradeWant(it.want) : null;
    const hasGold = typeof it.price === "number" && Number.isFinite(it.price);
    if (!hasGold && !it.giveaway && !want) continue;
    if (it.giveaway && !opts.includeGiveaways) continue;
    const row = {
      slot: key,
      side: it.b ? "buy" : it.giveaway ? "giveaway" : want ? "swap" : "sell",
      name: it.name,
      showQuantity: typeof it.q === "number" && it.q > 1,
    };
    if (hasGold) row.price = it.price;
    if (typeof it.level === "number") row.level = it.level;
    if (typeof it.q === "number") row.q = it.q;
    if (it.p) row.p = it.p;
    if (it.giveaway) row.giveaway = it.giveaway;
    if (want) row.want = want;
    out.push(row);
  }
  return out;
}

/** Equipped gear as a fixed 4×4 paperdoll grid (AL `render_slots` order). */
const GEAR_SLOT_ORDER = [
  "earring1",
  "helmet",
  "earring2",
  "amulet",
  "mainhand",
  "chest",
  "offhand",
  "cape",
  "ring1",
  "pants",
  "ring2",
  "orb",
  "belt",
  "shoes",
  "gloves",
  "elixir",
];

/**
 * @param {{ slots?: object }} character
 * @returns {Array<object|null>} length 16
 */
function slimGearGrid(character) {
  const slots = (character && character.slots) || {};
  const out = [];
  for (let i = 0; i < GEAR_SLOT_ORDER.length; i++) {
    const key = GEAR_SLOT_ORDER[i];
    const it = slots[key];
    if (!it || !it.name) {
      out.push(null);
      continue;
    }
    const row = { name: it.name, slot: key };
    if (typeof it.level === "number") row.level = it.level;
    if (typeof it.q === "number") row.q = it.q;
    if (it.p) row.p = it.p;
    out.push(row);
  }
  return out;
}

const TITLE_BORDER = {
  festive: "#79ff7e",
  firehazard: "#f79b11",
  glitched: "#6b7280",
  gooped: "#64B867",
  legacy: "#ffffff",
  lucky: "#00f3ff",
  shiny: "#99b2d8",
  superfast: "#c681dc",
};

function titleBorderColor(p, show) {
  if (!show || !p) return null;
  return TITLE_BORDER[p] || null;
}

function getLevelString(gItem, level) {
  gItem = gItem || {};
  if (gItem.upgrade) {
    const capped = Math.min(level || 0, 13);
    if (capped === 12) return "Z";
    if (capped === 11) return "Y";
    if (capped === 10) return "X";
    return capped;
  }
  if (gItem.compound) {
    let capped = level || 0;
    if (capped > 7) capped = 7;
    if (capped === 7) return "R";
    if (capped === 6) return "S";
    if (capped === 5) return "V";
    return capped;
  }
  return undefined;
}

function levelTextColor(gItem, level) {
  gItem = gItem || {};
  if (gItem.compound) {
    if (level === 4) return "#FFC949";
    if (level === 5) return "#B753C7";
    return "#d1d5db";
  }
  if (gItem.upgrade) {
    if (level === 8) return "#FFC949";
    if (level === 9) return "#E64D31";
    if (level >= 10) return "#B753C7";
    return "#d1d5db";
  }
  return "#d1d5db";
}

function abbreviateNumber(number) {
  const symbols = ["", "k", "M", "G", "T", "P", "E"];
  const tier = (Math.log10(Math.abs(number)) / 3) | 0;
  if (tier === 0) return String(number);
  const suffix = symbols[tier] || "";
  const scaled = number / Math.pow(10, tier * 3);
  return scaled.toFixed(1) + suffix;
}

module.exports = {
  AL_ORIGIN,
  sheetUrl,
  resolveImagesetCrop,
  resolveItemSkin,
  extractAtlas,
  normalizeItemInstance,
  normalizeTradeWant,
  formatTradeWantShort,
  slimTradeListings,
  GEAR_SLOT_ORDER,
  slimGearGrid,
  TITLE_BORDER,
  titleBorderColor,
  getLevelString,
  levelTextColor,
  abbreviateNumber,
};
