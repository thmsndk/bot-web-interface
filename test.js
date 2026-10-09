/**
 * Created by Nexus on 15.08.2017.
 * modified by thmsn
 *
 * Demo = caracAL-shaped character columns + a separate showcase column for
 * widgets/sizes that production panels don't exercise.
 */
const BotWebInterface = require("./main");
const { name1, name2 } = require("./test-names");
const mainGeo = require("./fixtures/main-geo.json");
const {
  resolveMinimapView,
  DEFAULT_VISION,
  projectMinimapLines,
  projectMinimapPoint,
  createWallProjector,
} = require("./minimapGeometry");
const { timerPresentation } = require("./countdown");
const sampleAtlas = require("./fixtures/atlas-sample.json");

const DEMO_MMAP = resolveMinimapView(DEFAULT_VISION);
const DEMO_BEAT_MS = 500; // match caracAL STAT_BEAT_INTERVAL
const projectWallsCached = createWallProjector();
const CLASS_COLOR = {
  merchant: "#7f7f7f",
  mage: "#3e6eed",
  warrior: "#f07f2f",
  priest: "#eb4d82",
  ranger: "#8a512b",
  paladin: "#a3b4b9",
  rogue: "#44b75c",
};
const CLASS_NAMES = Object.keys(CLASS_COLOR);

const MINIMAP_STYLES = {
  wall: { stroke: "rgba(226,232,240,0.92)", lineWidth: 1.35 },
  self: { shape: "cross", fill: "#32b1f5" },
  foe: { shape: "cross", fill: "#b14f1d" },
  alert: { shape: "cross", fill: "#c10037" },
  other: { shape: "cross", fill: "#284af4" },
  focus: { shape: "ring", stroke: "#c10037", lineWidth: 1 },
  range: { stroke: "rgba(148,163,184,0.4)", lineWidth: 0.75, dash: [2, 4] },
  trail: { stroke: "rgba(125,211,252,0.5)", lineWidth: 1 },
};

/** Project AL world GEO + entities into BWI minimap pixel space (same as caracAL). */
function buildMinimapPayload(cx, cy, entities, trailWorld, vision) {
  const view = resolveMinimapView(vision || DEFAULT_VISION);
  const opts = {
    width: view.width,
    height: view.height,
    scale: view.scale,
  };
  const lines = projectWallsCached(mainGeo, cx, cy, opts);

  const toPx = (x, y) => projectMinimapPoint(x, y, cx, cy, opts);

  const markers = [];
  for (let i = 0; i < entities.length; i++) {
    const ent = entities[i];
    const [px, py] = toPx(ent.x, ent.y);
    if (
      px < -2 ||
      px >= view.width + 2 ||
      py < -2 ||
      py >= view.height + 2
    ) {
      continue;
    }
    const m = [px, py, ent.style];
    if (ent.label) m.push(ent.label);
    if (typeof ent.hp === "number") {
      if (!ent.label) m.push("");
      m.push(ent.hp);
    }
    markers.push(m);
  }

  const rings = [];
  for (let i = 0; i < entities.length; i++) {
    const ent = entities[i];
    if (!ent.range) continue;
    const [px, py] = toPx(ent.x, ent.y);
    rings.push([px, py, Math.max(2, ent.range * view.scale), "range"]);
  }

  const trail = [];
  for (let i = 0; i < trailWorld.length; i++) {
    trail.push(toPx(trailWorld[i][0], trailWorld[i][1]));
  }

  return {
    lines,
    markers,
    rings,
    trail,
    origin: [cx, cy],
    scale: view.scale,
    width: view.width,
    height: view.height,
    vision: view.vision,
  };
}

function humanize_int(num, digits) {
  const n = Number(num) || 0;
  const d = digits != null ? digits : 1;
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(d) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(d) + "k";
  return String(Math.round(n));
}

function quick_bar_val(num, denom, humanize) {
  const modif = humanize ? (x) => humanize_int(x, 1) : (x) => x;
  const safeDenom = denom || 1;
  return [(100 * num) / safeDenom, `${modif(num)} / ${modif(safeDenom)}`];
}

function demoPotSummary(items, kind) {
  let best = null;
  let bestScore = -1;
  let total = 0;
  const list = items || [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    if (!it || !it.name) continue;
    const name = String(it.name);
    const match =
      kind === "hp" ? name.startsWith("hpot") : name.startsWith("mpot");
    if (!match) continue;
    const q = typeof it.q === "number" ? it.q : 1;
    total += q;
    if (q > bestScore) {
      bestScore = q;
      best = { name: it.name };
    }
  }
  return {
    name: (best && best.name) || (kind === "hp" ? "hpot0" : "mpot0"),
    q: total,
    showQuantity: true,
  };
}

let BWI = new BotWebInterface({
  title: "TEST: BWI (caracAL + showcase)",
  // Watchdog only — live publishes come from requestPublish() each beat.
  updateRate: Math.max(DEMO_BEAT_MS * 10, 5000),
  port: 2080,
});
BWI.publisher.setAtlas(sampleAtlas);

// Match caracAL's top-level panel slots for character columns.
BWI.publisher.setDefaultStructure([
  { name: "server", type: "botUI" },
  { name: "party", type: "botUI" },
  { name: "character", type: "botUI" },
  { name: "target", type: "botUI" },
  { name: "loot", type: "botUI" },
]);

const characterSchema = [
  { name: "header", type: "leftMiddleRightText" },
  { name: "header2", type: "leftMiddleRightText" },
  {
    name: "minimap",
    type: "minimap",
    label: "Map",
    options: {
      width: DEMO_MMAP.width,
      height: DEMO_MMAP.height,
      scale: DEMO_MMAP.scale,
      smoothMs: DEMO_BEAT_MS,
      styles: MINIMAP_STYLES,
    },
  },
  {
    name: "health",
    type: "labelProgressBar",
    label: "Health",
    options: {
      color: "red",
      item: { key: "hpPot", size: 28, raise: 6 },
    },
  },
  {
    name: "mana",
    type: "labelProgressBar",
    label: "Mana",
    options: {
      color: "blue",
      item: { key: "mpPot", size: 28, raise: 6 },
    },
  },
  {
    name: "xp",
    type: "labelProgressBar",
    label: "XP",
    options: { color: "green" },
  },
  { name: "xpText", type: "leftMiddleRightText" },
  {
    name: "inv",
    type: "labelProgressBar",
    label: "Inventory",
    options: {
      color: "brown",
      modal: {
        key: "bag",
        kind: "itemGrid",
        cols: 7,
        slots: 42,
        modalSize: 56,
      },
    },
  },
  {
    name: "gearBar",
    type: "labelProgressBar",
    label: "Gear",
    options: {
      color: "brown",
      modal: {
        key: "gear",
        kind: "itemGrid",
        cols: 4,
        slots: 16,
        modalSize: 60,
      },
    },
  },
  {
    name: "tradesBar",
    type: "labelProgressBar",
    label: "Trades",
    options: {
      color: "brown",
      modal: {
        key: "trades",
        kind: "itemStrip",
        wrap: true,
        modalSize: 56,
      },
    },
  },
  {
    name: "bank",
    type: "labelProgressBar",
    label: "Bank",
    options: { color: "brown" },
  },
  { name: "gold", type: "leftMiddleRightText" },
  {
    name: "favorites",
    type: "itemStrip",
    options: { size: 36 },
  },
  { name: "timers", type: "timerList" },
];

/**
 * @type {Array}
 */
var interfaces = [];

function create() {
  const charName = generateName();
  const ctype = CLASS_NAMES[getRandomInt(0, CLASS_NAMES.length)];
  const botUI = BWI.publisher.createInterface();

  const serverBotUI = botUI.createSubBotUI(
    [
      { name: "header", type: "leftMiddleRightText" },
      {
        name: "pings",
        type: "chart",
        label: "Chart",
        options: { type: "bar", height: 32 },
      },
    ],
    "server"
  );

  const partyBotUI = botUI.createSubBotUI(
    [
      { name: "header", type: "leftMiddleRightText" },
      {
        name: "health_mana",
        type: "chart",
        label: "Chart",
        options: {
          type: "bar",
          height: 32,
          scales: { y: { min: 0, max: 100 } },
        },
      },
    ],
    "party"
  );

  const characterBotUI = botUI.createSubBotUI(characterSchema, "character");

  const targetBotUI = botUI.createSubBotUI(
    [
      { name: "header", type: "leftMiddleRightText" },
      { name: "header2", type: "leftMiddleRightText" },
      { name: "header3", type: "leftMiddleRightText" },
      {
        name: "health",
        type: "labelProgressBar",
        label: "Health",
        options: { color: "red" },
      },
      {
        name: "mana",
        type: "labelProgressBar",
        label: "Mana",
        options: { color: "blue" },
      },
      { name: "timers", type: "timerList" },
    ],
    "target"
  );

  const lootBotUI = botUI.createSubBotUI(
    [
      { name: "lootHeader", type: "leftMiddleRightText" },
      {
        name: "loot",
        type: "table",
        headers: ["When", "Item", "#"],
        options: { itemSize: 32 },
      },
    ],
    "loot"
  );

  // Keep identity off botUI.cache — Publisher.fetchData() overwrites that.
  return {
    botUI,
    serverBotUI,
    partyBotUI,
    characterBotUI,
    targetBotUI,
    lootBotUI,
    name: charName,
    ctype,
    level: getRandomInt(40, 90),
  };
}

for (let l = 0; l < 2; l++) {
  interfaces[l] = create();
}

// Showcase last so character columns stay contiguous; recreate after recycle.
let showcaseRoot = null;
let showcaseNested = null;
const showcaseState = {
  plain: 55,
  rating: 0.62,
  line: [12, 19, 14, 22, 18, 25, 21, 28, 24, 30],
  multiA: [40, 55, 35, 60],
  multiB: [25, 40, 50, 30],
  clicks: 0,
  nestedPct: 40,
  featured: {
    name: "harbringer",
    level: 9,
    p: "shiny",
    q: 1,
  },
  favorites: [
    { name: "harbringer", level: 9, p: "shiny" },
    { name: "hpamulet", level: 4 },
    { name: "hpot0", q: 240 },
    { name: "mpot0", q: 120 },
  ],
  inventory: [
    { name: "harbringer", level: 8 },
    { name: "scroll1", q: 42 },
    { name: "cscroll0", q: 12 },
    { name: "offeringp", q: 3 },
    { name: "hpot0", q: 999 },
    { name: "mpot0", q: 400 },
    { name: "hpamulet", level: 3, p: "lucky" },
    null,
    null,
    { name: "cscroll1", q: 2 },
  ],
  gear: (function () {
    // AL paperdoll 4×4: earring1 helmet earring2 amulet / mh chest oh cape / …
    const cells = Array(16).fill(null);
    cells[1] = { name: "helmet", level: 7, slot: "helmet" };
    cells[4] = { name: "harbringer", level: 9, p: "shiny", slot: "mainhand" };
    cells[5] = { name: "coat", level: 6, slot: "chest" };
    cells[3] = { name: "hpamulet", level: 4, slot: "amulet" };
    cells[9] = { name: "pants", level: 6, slot: "pants" };
    cells[13] = { name: "shoes", level: 7, slot: "shoes" };
    return cells;
  })(),
  trades: [
    {
      slot: "trade1",
      side: "sell",
      name: "harbringer",
      level: 8,
      p: "shiny",
      price: 125000000,
    },
    {
      slot: "trade2",
      side: "buy",
      name: "offeringp",
      q: 1,
      price: 4500000,
      showQuantity: true,
    },
    {
      slot: "trade3",
      side: "sell",
      name: "scroll1",
      q: 20,
      price: 12000,
      showQuantity: true,
    },
    {
      slot: "trade4",
      side: "swap",
      name: "slice_blueberry",
      q: 1,
      want: { name: "slice_mint", q: 1 },
      showQuantity: true,
    },
  ],
};

function wireShowcaseSources() {
  showcaseRoot.setDataSource(function () {
    return {
      blurb: "Extras beyond the caracAL panels",
      sizes: {
        left: "LMR",
        middle: "colored",
        right: "sizes",
        options: {
          leftColor: "#38bdf8",
          middleColor: "#fbbf24",
          rightColor: "#f472b6",
          size: "lg",
        },
      },
      featured: showcaseState.featured,
      favorites: showcaseState.favorites,
      inventory: showcaseState.inventory,
      plainBar: showcaseState.plain,
      rating: [
        showcaseState.rating * 100,
        (showcaseState.rating * 10).toFixed(1) + " / 10",
      ],
      lineChart: {
        data: {
          labels: showcaseState.line.map((_, i) => i),
          datasets: [
            {
              borderColor: "rgb(56, 189, 248)",
              backgroundColor: "rgba(56, 189, 248, 0.15)",
              data: showcaseState.line.slice(),
              fill: true,
              tension: 0.25,
            },
          ],
        },
      },
      multiBar: {
        data: {
          labels: ["A", "B", "C", "D"],
          datasets: [
            {
              backgroundColor: "rgb(248, 113, 113)",
              data: showcaseState.multiA.slice(),
            },
            {
              backgroundColor: "rgb(96, 165, 250)",
              data: showcaseState.multiB.slice(),
            },
          ],
        },
      },
      action: "clicks: " + showcaseState.clicks,
    };
  });

  showcaseNested.setDataSource(function () {
    return {
      row: {
        left: "compose",
        middle: "sub-botUI",
        right: "#" + showcaseRoot.id,
      },
      note: "child of showcase.nested",
      mini: showcaseState.nestedPct,
    };
  });
}

function createShowcase() {
  if (showcaseRoot) {
    showcaseRoot.destroy();
    showcaseRoot = null;
    showcaseNested = null;
  }
  showcaseRoot = BWI.publisher.createInterface([
    { name: "blurb", type: "text", label: "Showcase" },
    {
      name: "sizes",
      type: "leftMiddleRightText",
      options: { size: "lg" },
    },
    {
      name: "featured",
      type: "item",
      options: { size: 48 },
    },
    {
      name: "favorites",
      type: "itemStrip",
      options: { size: 40 },
    },
    {
      name: "inventory",
      type: "itemGrid",
      options: { size: 32, cols: 5, slots: 10 },
    },
    {
      name: "plainBar",
      type: "progressBar",
      label: "plain %",
      options: { color: "#0ea5e9", size: "base" },
    },
    {
      name: "rating",
      type: "labelProgressBar",
      label: "Rating",
      options: { color: "#a855f7", size: "xs" },
    },
    {
      name: "lineChart",
      type: "chart",
      label: "Line",
      options: { type: "line", size: "sm" },
    },
    {
      name: "multiBar",
      type: "chart",
      label: "Multi bar",
      options: { type: "bar", height: 40 },
    },
    { name: "action", type: "button", label: "Ping action" },
    { name: "nested", type: "botUI", label: "Nested" },
  ]);

  showcaseNested = showcaseRoot.createSubBotUI(
    [
      { name: "row", type: "leftMiddleRightText", options: { size: "sm" } },
      { name: "note", type: "text", label: "nested text" },
      {
        name: "mini",
        type: "progressBar",
        options: { color: "#22c55e", size: "xs" },
      },
    ],
    "nested"
  );
  wireShowcaseSources();
}

createShowcase();

const stateByCharacter = {};
function getState(id) {
  if (!stateByCharacter[id]) {
    stateByCharacter[id] = {
      health: 0.55 + Math.random() * 0.35,
      mana: 0.35 + Math.random() * 0.5,
      xp: 0.15 + Math.random() * 0.5,
      inv: 0.3 + Math.random() * 0.4,
      bank: 0.2 + Math.random() * 0.5,
      gold: 5e5 + Math.random() * 2e6,
      goldPerHour: 8e4 + Math.random() * 2e5,
      xpPerHour: 2e6 + Math.random() * 5e6,
      maxHp: 3000,
      maxMp: 2000,
      maxXp: 1e7,
      isize: 42,
      bankSlots: 96,
      pings: [40, 42, 38, 55, 41, 39, 60, 44, 43, 41],
      party: [
        { name: "You", hp: 80, mp: 60 },
        { name: "Priest", hp: 70, mp: 85 },
        { name: "Warrior", hp: 95, mp: 40 },
      ],
      timers: {},
      loot: [],
      trail: [],
      status: "farming",
      beatAt: Date.now(),
    };
  }
  return stateByCharacter[id];
}

function stepMeter(value, min, max, maxDelta) {
  const next = value + (Math.random() * 2 - 1) * maxDelta;
  return Math.max(min, Math.min(max, next));
}

function stepPings(pings) {
  for (let i = 0; i < pings.length; i++) {
    pings[i] = Math.max(20, Math.min(120, pings[i] + (Math.random() * 2 - 1) * 6));
  }
  // scroll
  pings.shift();
  pings.push(pings[pings.length - 1] + (Math.random() * 2 - 1) * 4);
}

function stepShowcase() {
  showcaseState.plain = stepMeter(showcaseState.plain, 8, 98, 4);
  showcaseState.rating = stepMeter(showcaseState.rating, 0.1, 0.98, 0.03);
  showcaseState.nestedPct = stepMeter(showcaseState.nestedPct, 5, 95, 5);
  if (Math.random() < 0.08) showcaseState.clicks += 1;

  const line = showcaseState.line;
  const last = line[line.length - 1];
  line.shift();
  line.push(Math.max(5, Math.min(40, last + (Math.random() * 2 - 1) * 4)));

  for (let i = 0; i < showcaseState.multiA.length; i++) {
    showcaseState.multiA[i] = stepMeter(showcaseState.multiA[i], 10, 90, 6);
    showcaseState.multiB[i] = stepMeter(showcaseState.multiB[i], 10, 90, 6);
  }
}

setInterval(function () {
  // Occasionally recycle one character column (lifecycle stress).
  // Recreate showcase afterward so it stays the rightmost column.
  if (interfaces.length > 0 && Math.random() < 0.002) {
    const doomed = interfaces.shift();
    doomed.botUI.destroy();
    interfaces.push(create());
    createShowcase();
  }

  stepShowcase();

  for (let n = 0; n < interfaces.length; n++) {
    const iface = interfaces[n];
    const {
      serverBotUI,
      partyBotUI,
      characterBotUI,
      targetBotUI,
      lootBotUI,
      name: charName,
      ctype,
      level,
    } = iface;
    const state = getState(characterBotUI.id);

    state.health = stepMeter(state.health, 0.08, 0.98, 0.03);
    state.mana = stepMeter(state.mana, 0.05, 0.98, 0.04);
    state.xp = stepMeter(state.xp, 0.02, 0.98, 0.01);
    state.inv = stepMeter(state.inv, 0.05, 0.95, 0.02);
    state.bank = stepMeter(state.bank, 0.05, 0.95, 0.01);
    state.gold += (Math.random() * 2 - 0.4) * 200;
    stepPings(state.pings);

    for (let i = 0; i < state.party.length; i++) {
      // Percent of max, same shape as caracAL party chart datasets.
      state.party[i].hp = stepMeter(state.party[i].hp, 20, 100, 3);
      state.party[i].mp = stepMeter(state.party[i].mp, 10, 100, 4);
    }

    // Timers — sample remaining ms once; wall-clock helper for display
    // (never decrement by beat size or timers race ahead of real time).
    const now = Date.now();
    const timers = state.timers;
    if (Object.keys(timers).length < 4) {
      if (!timers.hunt && Math.random() < 0.15) {
        timers.hunt = {
          name: "Irradiated Goo",
          skin: "condition_bad",
          debuff: true,
          ims: 30 * 60 * 1000,
          ms: 30 * 60 * 1000,
          sampledAt: now,
        };
      }
      if (!timers.burned && Math.random() < 0.2) {
        timers.burned = {
          name: "Burned",
          skin: "fireblade",
          debuff: true,
          ims: 10000,
          ms: 10000,
          sampledAt: now,
        };
      }
      if (!timers.cursed && Math.random() < 0.15) {
        timers.cursed = {
          name: "Cursed",
          skin: "condition_bad",
          debuff: true,
          ims: 8000,
          ms: 8000,
          sampledAt: now,
        };
      }
      if (!timers.mluck && Math.random() < 0.12) {
        timers.mluck = {
          name: "Good Luck",
          skin: "buff_luck",
          buff: true,
          ims: 60 * 60 * 1000,
          ms: 60 * 60 * 1000,
          sampledAt: now,
        };
      }
      if (!timers.stack && Math.random() < 0.15) {
        timers.stack = {
          name: "Hard Shell",
          skin: "skill_hardshell",
          buff: true,
          ims: 12000,
          ms: 12000,
          sampledAt: now,
        };
      }
    }
    const timerRows = [];
    for (const key of Object.keys(timers)) {
      const t = timers[key];
      const row = timerPresentation({
        name: t.name,
        ms: t.ms,
        ims: t.ims,
        skin: t.skin,
        buff: t.buff,
        debuff: t.debuff,
        sampledAt: t.sampledAt,
        now,
      });
      if (row.ms <= 0) {
        delete timers[key];
        continue;
      }
      timerRows.push(row);
    }
    state.beatAt = Math.random() < 0.97 ? now : state.beatAt || now;

    // Minimap motion on main GEO
    if (!state.trail) state.trail = [];
    const trail = state.trail;
    const phase = characterBotUI.id * 0.7;
    const nowSec = now / 1000;
    const angleAt = (sec) => sec * 0.55 + phase;
    const posAt = (sec) => {
      const a = angleAt(sec);
      return [Math.cos(a) * 70, Math.sin(a) * 55];
    };
    const [selfX, selfY] = posAt(nowSec);
    const angle = angleAt(nowSec);
    let lastSec = trail._lastSec;
    if (typeof lastSec !== "number") lastSec = nowSec - 1.2;
    const step = 0.12;
    for (let sec = lastSec + step; sec <= nowSec + 1e-6; sec += step) {
      const [x, y] = posAt(sec);
      const prev = trail[trail.length - 1];
      if (!prev || Math.hypot(x - prev[0], y - prev[1]) >= 3) {
        trail.push([x, y]);
      }
    }
    trail._lastSec = nowSec;
    while (trail.length > 40) trail.shift();

    const foeX = selfX + Math.cos(angle * 2) * 45;
    const foeY = selfY + Math.sin(angle * 2) * 35;
    const beeX = selfX - 50;
    const beeY = selfY + 28;
    const entities = [
      {
        x: selfX,
        y: selfY,
        style: "self",
        label: charName.split(" ")[0] || "You",
        hp: state.health,
        range: 40,
      },
      { x: foeX, y: foeY, style: "foe", label: "goo", hp: 0.55 },
      { x: beeX, y: beeY, style: "alert", label: "bee", hp: 0.22 },
      {
        x: selfX + 36,
        y: selfY - 40,
        style: "other",
        label: "Ally",
        hp: 0.9,
      },
      { x: beeX, y: beeY, style: "focus" },
    ];
    const minimap = buildMinimapPayload(selfX, selfY, entities, trail);
    minimap.title = charName;
    minimap.map = "main";

    const hp = state.health * state.maxHp;
    const mp = state.mana * state.maxMp;
    const xp = state.xp * state.maxXp;
    const invUsed = Math.round(state.inv * state.isize);
    const bankUsed = Math.round(state.bank * state.bankSlots);
    const ttlMs =
      state.xpPerHour > 0
        ? ((state.maxXp - xp) * 3600000) / state.xpPerHour
        : 0;

    serverBotUI.setDataSource(function () {
      return {
        header: {
          left: `${20 + (characterBotUI.id % 40)} online`,
          middle: "EU I",
          right: Math.floor(state.pings[state.pings.length - 1]),
        },
        pings: {
          data: {
            labels: state.pings.map((_, index) => index),
            datasets: [{ data: state.pings.slice() }],
          },
        },
      };
    });

    partyBotUI.setDataSource(function () {
      return {
        header: {
          left: charName.split(" ")[0] || "party",
          middle: "",
          right: state.party.length,
        },
        health_mana: {
          data: {
            labels: state.party.map((p) => p.name),
            datasets: [
              {
                backgroundColor: "rgb(255, 99, 132)",
                data: state.party.map((p) => p.hp),
              },
              {
                backgroundColor: "rgb(54, 162, 235)",
                data: state.party.map((p) => p.mp),
              },
            ],
          },
        },
      };
    });

    characterBotUI.setDataSource(function () {
      return {
        header: {
          left: charName,
          middle: state.status,
          right: level,
          options: { leftColor: CLASS_COLOR[ctype] },
        },
        header2: {
          left: "main",
          middle: "",
          right: `${selfX.toFixed(0)}, ${selfY.toFixed(0)}`,
          options: {
            beatAt: state.beatAt,
            staleAfterSec: 2,
          },
        },
        minimap,
        health: quick_bar_val(hp, state.maxHp, true),
        mana: quick_bar_val(mp, state.maxMp, true),
        hpPot: demoPotSummary(showcaseState.inventory, "hp"),
        mpPot: demoPotSummary(showcaseState.inventory, "mp"),
        xp: quick_bar_val(xp, state.maxXp, true),
        xpText: {
          left: `XP/h ${humanize_int(state.xpPerHour, 1)}`,
          middle: "",
          right: ttlMs > 0 ? `${formatDuration(ttlMs)} TTLU` : "N/A TTLU",
          options:
            ttlMs > 0
              ? { levelUpAt: now + ttlMs, etaSuffix: " TTLU" }
              : { levelUpAt: 0, etaFallback: "N/A TTLU" },
        },
        inv: quick_bar_val(invUsed, state.isize),
        gearBar: quick_bar_val(
          showcaseState.gear.filter(function (x) {
            return x && x.name;
          }).length,
          16
        ),
        tradesBar: quick_bar_val(showcaseState.trades.length, 16),
        bank: quick_bar_val(bankUsed, state.bankSlots),
        gold: {
          left: `Gold: ${humanize_int(state.gold, 1)}`,
          middle: "",
          right: `${humanize_int(state.goldPerHour, 1)} G/h`,
        },
        favorites: showcaseState.favorites,
        gear: showcaseState.gear,
        bag: showcaseState.inventory.concat(
          Array(Math.max(0, 42 - showcaseState.inventory.length)).fill(null)
        ),
        trades: showcaseState.trades,
        timers: timerRows,
      };
    });

    const targetHp = 400 + Math.sin(nowSec) * 80;
    const targetMaxHp = 800;
    targetBotUI.setDataSource(function () {
      return {
        header: {
          left: "bee",
          middle: charName.split(" ")[0] || "",
          right: 12,
        },
        header2: {
          left: "bee",
          middle: "",
          right: `${Math.hypot(beeX - selfX, beeY - selfY).toFixed(0)} 📏`,
        },
        header3: {
          left: "main",
          middle: "",
          right: `${beeX.toFixed(0)}, ${beeY.toFixed(0)}`,
        },
        health: quick_bar_val(targetHp, targetMaxHp, true),
        mana: quick_bar_val(0, 1, true),
        timers: timerRows.slice(0, 2),
      };
    });

    if (Math.random() < 0.08) {
      const lootNames = ["hpot0", "mpot0", "scroll1", "offeringp", "cscroll0"];
      const lootName = lootNames[Math.floor(Math.random() * lootNames.length)];
      state.loot.splice(0, 0, [
        new Date(),
        { name: lootName, q: 1 + Math.floor(Math.random() * 5) },
        1 + Math.floor(Math.random() * 5),
      ]);
      state.loot = state.loot.slice(0, 12);
    }
    lootBotUI.setDataSource(function () {
      return {
        lootHeader: {
          left: `Loot ${state.loot.length}`,
          middle: "",
          right: `${state.loot.reduce((a, x) => a + x[2], 0)} pcs`,
        },
        loot: state.loot.map(function (x) {
          const item = x[1] || {};
          const q = x[2];
          const meta =
            (sampleAtlas.items && sampleAtlas.items[item.name]) || {};
          const title =
            (item.p &&
              sampleAtlas.titles &&
              sampleAtlas.titles[item.p] &&
              sampleAtlas.titles[item.p].title) ||
            "";
          const base = meta.name || item.name || "?";
          const label = title ? title + " " + base : base;
          return [
            timeAgo(x[0]),
            label,
            Object.assign({}, item, { q: q, showQuantity: true }),
          ];
        }),
      };
    });
  }

  if (typeof BWI.publisher.requestPublish === "function") {
    BWI.publisher.requestPublish();
  }
}, DEMO_BEAT_MS);

function capFirst(string) {
  if (!string) return;
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function generateName() {
  return (
    capFirst(name1[getRandomInt(0, name1.length)]) +
    " " +
    capFirst(name2[getRandomInt(0, name2.length)])
  );
}

function timeAgo(date) {
  var seconds = Math.floor(
    (new Date().getTime() - new Date(date).getTime()) / 1000
  );
  var interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes";
  return Math.floor(seconds) + " seconds";
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
