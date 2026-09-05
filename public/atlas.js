/**
 * Client-side Adventure Land atlas: sheet URLs + item chrome helpers.
 * Loaded before BotUI.js; Publisher sends atlas on setup / setAtlas.
 */
(function (global) {
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

  const BwiAtlas = {
    data: null,
    proxyBase: "/al-assets",

    set(atlas) {
      this.data = atlas && typeof atlas === "object" ? atlas : null;
      // Warm common pack so first inventory paint isn't blank.
      if (this.data && this.data.imagesets) {
        const packs = Object.keys(this.data.imagesets);
        for (let i = 0; i < packs.length; i++) {
          const file = this.data.imagesets[packs[i]] && this.data.imagesets[packs[i]].file;
          if (file) this.preload(file);
        }
      }
    },

    preload(file) {
      const url = this.sheetUrl(file);
      if (!url || typeof Image === "undefined") return;
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    },

    sheetUrl(file) {
      if (!file) return "";
      if (/^https?:\/\//i.test(file)) return file;
      const path = file.startsWith("/") ? file : "/" + file;
      if (this.proxyBase) return this.proxyBase.replace(/\/$/, "") + path;
      const origin =
        (this.data && this.data.origin) || "https://adventure.land";
      return String(origin).replace(/\/$/, "") + path;
    },

    resolveItemSkin(itemName, opts) {
      const items = this.data && this.data.items;
      const gItem = items && items[itemName];
      if (!gItem) return itemName || "placeholder";
      if (opts && opts.active && gItem.skin_a) return gItem.skin_a;
      return gItem.skin || itemName || "placeholder";
    },

    resolveCrop(skin) {
      const atlas = this.data;
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
    },

    cropForInstance(inst) {
      if (!inst) return null;
      const skin =
        inst.skin ||
        this.resolveItemSkin(inst.name, { active: !!inst.active });
      return this.resolveCrop(skin);
    },

    titleBorderColor(p, show) {
      if (!show || !p) return null;
      return TITLE_BORDER[p] || null;
    },

    getLevelString(gItem, level) {
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
    },

    levelTextColor(gItem, level) {
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
    },

    abbreviateNumber(number) {
      const symbols = ["", "k", "M", "G", "T", "P", "E"];
      const tier = (Math.log10(Math.abs(number)) / 3) | 0;
      if (tier === 0) return String(number);
      const suffix = symbols[tier] || "";
      return number / Math.pow(10, tier * 3).toFixed
        ? (number / Math.pow(10, tier * 3)).toFixed(1) + suffix
        : String(number);
    },

    itemMeta(name) {
      return (this.data && this.data.items && this.data.items[name]) || {};
    },

    displayTitle(inst) {
      if (!inst) return "";
      const meta = this.itemMeta(inst.name);
      const base = meta.name || inst.name || inst.skin || "";
      const p = inst.p;
      const title =
        (p && this.data && this.data.titles && this.data.titles[p] && this.data.titles[p].title) ||
        p ||
        "";
      return title ? title + " " + base : base;
    },
  };

  // Fix abbreviateNumber (accidental ternary mess)
  BwiAtlas.abbreviateNumber = function (number) {
    const symbols = ["", "k", "M", "G", "T", "P", "E"];
    const tier = (Math.log10(Math.abs(number)) / 3) | 0;
    if (tier === 0) return String(number);
    const suffix = symbols[tier] || "";
    const scaled = number / Math.pow(10, tier * 3);
    return scaled.toFixed(1) + suffix;
  };

  global.BwiAtlas = BwiAtlas;
})(typeof window !== "undefined" ? window : globalThis);
