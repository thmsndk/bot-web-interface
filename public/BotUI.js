/**
 * Created by Nexus on 30.07.2017.
 */
const padding = "p-1";

/** Client-side wall-clock ticks so countdowns don't freeze between publishes. */
const BwiClock = {
  timers: new Set(),
  ages: new Set(),
  etas: new Set(),
  rafId: null,
  ensure() {
    if (this.rafId != null) return;
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      // Skip while backgrounded — timers catch up on the next visible frame.
      if (!document.hidden) this.tick();
    };
    this.rafId = requestAnimationFrame(loop);
  },
  stopIfIdle() {
    if (
      this.timers.size === 0 &&
      this.ages.size === 0 &&
      this.etas.size === 0 &&
      this.rafId != null
    ) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  },
  tick() {
    const now = Date.now();
    for (const el of this.timers) {
      if (!el.isConnected) {
        this.timers.delete(el);
        continue;
      }
      paintTimerBar(el, now);
    }
    for (const entry of this.ages) {
      if (!entry.row || !entry.row.isConnected) {
        this.ages.delete(entry);
        continue;
      }
      paintBeatAge(entry, now);
    }
    for (const entry of this.etas) {
      if (!entry.el || !entry.el.isConnected) {
        this.etas.delete(entry);
        continue;
      }
      paintEta(entry, now);
    }
    this.stopIfIdle();
  },
};

function bwiMsToTime(duration) {
  const d = Math.max(0, Number(duration) || 0);
  const tenths = Math.floor((d % 1000) / 100);
  const totalSec = Math.floor(d / 1000);
  const seconds = totalSec % 60;
  const minutes = Math.floor(totalSec / 60) % 60;
  const hours = Math.floor(totalSec / 3600);
  const pad = (n) => (n < 10 ? "0" + n : String(n));
  if (hours > 0) {
    return hours + ":" + pad(minutes) + ":" + pad(seconds) + "." + tenths;
  }
  if (minutes > 0) {
    return minutes + ":" + pad(seconds) + "." + tenths;
  }
  return seconds + "." + tenths + "s";
}

function bwiFormatBeatAge(sampledAt, now, staleAfterSec) {
  if (typeof sampledAt !== "number" || !Number.isFinite(sampledAt)) {
    return "stale ?";
  }
  const ageSec = Math.max(0, Math.floor((now - sampledAt) / 1000));
  const after = staleAfterSec != null ? staleAfterSec : 2;
  if (ageSec < after) return "";
  return "stale " + ageSec + "s";
}

function bwiFormatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return h + "h " + m + "m";
  if (m >= 10) return m + "m";
  if (m > 0) return m + "m " + s + "s";
  return s + "s";
}

function paintTimerBar(el, now) {
  const endsAt = Number(el.dataset.endsAt);
  const ims = Number(el.dataset.ims);
  if (!Number.isFinite(endsAt)) return;
  const left = Math.max(0, endsAt - now);
  const denom = Number.isFinite(ims) && ims > 0 ? ims : 1;
  const midNext = bwiMsToTime(left);
  const urgent = left > 0 && left < 10000;
  const prev = el._bwiPaint;
  // Drive bar + label off the same tenths boundary so we never rewrite
  // style.width every rAF (that was thrashing layout / INP).
  if (prev && prev.mid === midNext && prev.urgent === urgent) return;
  if (!el._bwiBar) el._bwiBar = el.getElementsByClassName("bar")[0];
  if (!el._bwiMid) el._bwiMid = el.getElementsByClassName("textValueMiddle")[0];
  const barEl = el._bwiBar;
  const midEl = el._bwiMid;
  const widthStr = Math.round((left / denom) * 1000) / 10 + "%";
  if (!prev) el._bwiPaint = { mid: "", width: "", urgent: null };
  const paint = el._bwiPaint;
  if (barEl && paint.width !== widthStr) barEl.style.width = widthStr;
  if (midEl && paint.mid !== midNext) midEl.textContent = midNext;
  if (paint.urgent !== urgent) el.classList.toggle("timer-urgent", urgent);
  paint.mid = midNext;
  paint.width = widthStr;
  paint.urgent = urgent;
}

function paintBeatAge(entry, now) {
  const age = bwiFormatBeatAge(entry.beatAt, now, entry.staleAfterSec);
  const mid = entry.row.getElementsByClassName("textValueMiddle")[0];
  if (mid && mid.textContent !== age) mid.textContent = age;
  if (mid) {
    mid.style.color = age.indexOf("stale") === 0 ? "#f97316" : "";
  }
}

function paintEta(entry, now) {
  const left = Math.max(0, entry.endsAt - now);
  const text =
    entry.endsAt > 0 ? bwiFormatDuration(left) + (entry.suffix || "") : entry.fallback || "";
  if (entry.el.textContent !== text) entry.el.textContent = text;
}

function bwiNormalizeItem(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") return { name: raw };
  if (typeof raw !== "object") return null;
  if (!raw.name && !raw.skin) return null;
  return raw;
}

/**
 * Paint an Adventure Land iteminstance into a .bwi-item host element.
 * @param {HTMLElement} host
 * @param {object | null} inst
 * @param {{ size?: number }} [opts]
 */
function bwiPaintItemEl(host, inst, opts) {
  opts = opts || {};
  const size = opts.size || (inst && inst.size) || 40;
  if (opts.fillCell) {
    host.style.width = "100%";
    host.style.height = "auto";
    host.style.aspectRatio = "1";
  } else {
    host.style.width = size + "px";
    host.style.height = size + "px";
    host.style.aspectRatio = "";
  }
  host.classList.add("bwi-item");

  const normalized = bwiNormalizeItem(inst);
  if (!normalized) {
    host.classList.add("is-empty");
    host.classList.remove("is-buy", "is-sell", "is-give");
    host.innerHTML = "";
    host.title = "";
    host.removeAttribute("data-item");
    return;
  }
  host.classList.remove("is-empty");
  host.setAttribute("data-item", normalized.name || normalized.skin || "");

  const atlas = typeof BwiAtlas !== "undefined" ? BwiAtlas : null;
  const crop = atlas ? atlas.cropForInstance(normalized) : null;
  const meta = atlas ? atlas.itemMeta(normalized.name) : {};
  let title = atlas ? atlas.displayTitle(normalized) : normalized.name || "";
  if (normalized.slot) title = title + " (" + normalized.slot + ")";
  if (typeof normalized.price === "number") {
    const px =
      atlas && atlas.abbreviateNumber
        ? atlas.abbreviateNumber(normalized.price)
        : String(normalized.price);
    const side = normalized.side || "sell";
    title = title + " · " + side + " " + px + " G";
  }
  host.title = title;

  const showTitle =
    normalized.showTitleBorder != null
      ? !!normalized.showTitleBorder
      : !!normalized.p;
  const border =
    atlas && atlas.titleBorderColor
      ? atlas.titleBorderColor(normalized.p, showTitle)
      : null;
  host.style.borderColor = border || "rgba(71, 85, 105, 0.85)";

  host.classList.remove("is-buy", "is-sell", "is-give");
  if (normalized.side === "buy") host.classList.add("is-buy");
  else if (normalized.side === "giveaway") host.classList.add("is-give");
  else if (typeof normalized.price === "number" || normalized.side === "sell") {
    host.classList.add("is-sell");
  }

  let sprite = host.getElementsByClassName("bwi-item-sprite")[0];
  let levelEl = host.getElementsByClassName("bwi-item-level")[0];
  let qtyEl = host.getElementsByClassName("bwi-item-qty")[0];
  let priceEl = host.getElementsByClassName("bwi-item-price")[0];
  if (!sprite) {
    host.innerHTML =
      '<div class="bwi-item-sprite"></div>' +
      '<span class="bwi-item-badge bwi-item-level"></span>' +
      '<span class="bwi-item-badge bwi-item-qty"></span>' +
      '<span class="bwi-item-badge bwi-item-price"></span>';
    sprite = host.getElementsByClassName("bwi-item-sprite")[0];
    levelEl = host.getElementsByClassName("bwi-item-level")[0];
    qtyEl = host.getElementsByClassName("bwi-item-qty")[0];
    priceEl = host.getElementsByClassName("bwi-item-price")[0];
  } else if (!priceEl) {
    priceEl = document.createElement("span");
    priceEl.className = "bwi-item-badge bwi-item-price";
    host.appendChild(priceEl);
  }

  // Prefer measured cell width when filling a grid track.
  const paintSize =
    opts.fillCell && host.clientWidth > 0 ? host.clientWidth : size;

  if (crop && sprite) {
    const url = atlas.sheetUrl(crop.file);
    const scale = paintSize / crop.sw;
    sprite.style.backgroundImage = 'url("' + url + '")';
    sprite.style.backgroundPosition = "-" + crop.sx + "px -" + crop.sy + "px";
    sprite.style.width = crop.sw + "px";
    sprite.style.height = crop.sh + "px";
    sprite.style.transform = "scale(" + scale + ")";
    sprite.style.display = "";
  } else if (sprite) {
    sprite.style.display = "none";
  }

  const level = typeof normalized.level === "number" ? normalized.level : 0;
  const levelString = atlas
    ? atlas.getLevelString(meta, level)
    : level > 0
      ? level
      : undefined;
  const showLevel =
    normalized.showLevel != null
      ? !!normalized.showLevel
      : level > 0 && (!!meta.upgrade || !!meta.compound || levelString !== undefined);
  if (levelEl) {
    if (showLevel && levelString !== undefined) {
      levelEl.textContent = String(levelString);
      levelEl.style.color = atlas
        ? atlas.levelTextColor(meta, level)
        : "#d1d5db";
      levelEl.style.fontSize = Math.max(9, Math.round(paintSize * 0.28)) + "px";
      levelEl.style.display = "";
    } else {
      levelEl.textContent = "";
      levelEl.style.display = "none";
    }
  }

  const q = typeof normalized.q === "number" ? normalized.q : undefined;
  const showQty =
    normalized.showQuantity != null
      ? !!normalized.showQuantity
      : q !== undefined && q > 1;
  if (qtyEl) {
    if (showQty && q !== undefined && q > 0) {
      qtyEl.textContent = atlas ? atlas.abbreviateNumber(q) : String(q);
      qtyEl.style.fontSize = Math.max(8, Math.round(paintSize * 0.22)) + "px";
      qtyEl.style.display = "";
    } else {
      qtyEl.textContent = "";
      qtyEl.style.display = "none";
    }
  }

  if (priceEl) {
    if (typeof normalized.price === "number" && paintSize >= 28) {
      const px =
        atlas && atlas.abbreviateNumber
          ? atlas.abbreviateNumber(normalized.price)
          : String(normalized.price);
      priceEl.textContent = px;
      priceEl.style.fontSize = Math.max(7, Math.round(paintSize * 0.2)) + "px";
      priceEl.style.display = "";
    } else {
      priceEl.textContent = "";
      priceEl.style.display = "none";
    }
  }
}

/** CSS column/row gap in px (flex/grid). */
function bwiContainerGapPx(el) {
  if (!el || typeof window === "undefined" || !window.getComputedStyle) return 4;
  const cs = window.getComputedStyle(el);
  const gap = parseFloat(cs.columnGap || cs.gap);
  return Number.isFinite(gap) ? gap : 4;
}

/**
 * Square cell size so `columns` cells fill the container width.
 * @param {HTMLElement} container
 * @param {number} columns
 * @param {number} fallback
 */
function bwiFitCellSize(container, columns, fallback) {
  const cols = Math.max(1, columns | 0);
  const w = container && container.clientWidth;
  if (!(w > 0)) return fallback;
  const gap = bwiContainerGapPx(container);
  return Math.max(14, Math.floor((w - gap * (cols - 1)) / cols));
}

/**
 * Keep strip/grid sized to container width across resizes.
 * @param {HTMLElement} container
 * @param {function(): void} paint
 */
function bwiWatchItemLayout(container, paint) {
  if (!container || container._bwiLayoutWatch) return;
  container._bwiLayoutWatch = true;
  let lastW = container.clientWidth;
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(function () {
      const w = container.clientWidth;
      if (w === lastW) return;
      lastW = w;
      if (typeof container._bwiRelayout === "function") container._bwiRelayout();
    });
    ro.observe(container);
    container._bwiResizeObs = ro;
  }
  container._bwiRelayout = paint;
}

function bwiFoldStorageKey(name) {
  return "bwi-fold:" + name;
}

function bwiFoldShouldOpen(name, options) {
  try {
    const stored = localStorage.getItem(bwiFoldStorageKey(name));
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch (e) {
    /* ignore */
  }
  return !!(options && options.defaultOpen);
}

/**
 * Optional chrome: modal launcher icon, or collapsible fold, or bare widget.
 * @returns {string} html
 */
function bwiWrapItemChrome(name, label, options, widgetHtml) {
  return bwiWrapFold(name, label, options, widgetHtml);
}

function bwiUiGlyph(icon, size) {
  const s = size || 22;
  const common =
    'xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" ' +
    'width="' +
    s +
    '" height="' +
    s +
    '" aria-hidden="true" stroke="currentColor" stroke-width="1.75" ' +
    'stroke-linecap="round" stroke-linejoin="round"';
  if (icon === "bag") {
    return (
      "<svg " +
      common +
      '><path d="M6.5 8.5h11l.9 12H5.6l.9-12z"/><path d="M9 8.5V6.4A3 3 0 0 1 12 3.8 3 3 0 0 1 15 6.4v2.1"/><path d="M9.5 13h5"/></svg>'
    );
  }
  if (icon === "trade") {
    return (
      "<svg " +
      common +
      '><path d="M4 8h13"/><path d="M14 4.5 17.5 8 14 11.5"/><path d="M20 16H7"/><path d="M10 19.5 6.5 16 10 12.5"/></svg>'
    );
  }
  // cog — teeth + hub (distinct from a sun)
  return (
    "<svg " +
    common +
    '><path d="M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z"/><path d="M19.4 13.1a7.4 7.4 0 0 0 0-2.2l1.7-1.3-1.7-3-2.1.8a7.5 7.5 0 0 0-1.9-1.1l-.3-2.2h-3.4l-.3 2.2a7.5 7.5 0 0 0-1.9 1.1l-2.1-.8-1.7 3 1.7 1.3a7.4 7.4 0 0 0 0 2.2l-1.7 1.3 1.7 3 2.1-.8a7.5 7.5 0 0 0 1.9 1.1l.3 2.2h3.4l.3-2.2a7.5 7.5 0 0 0 1.9-1.1l2.1.8 1.7-3z"/></svg>'
  );
}

function bwiEnsureItemModal() {
  let overlay = document.getElementById("bwi-item-modal");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "bwi-item-modal";
  overlay.className = "bwi-item-modal hidden";
  overlay.innerHTML =
    '<div class="bwi-item-modal-panel" role="dialog" aria-modal="true">' +
    '<div class="bwi-item-modal-head">' +
    '<span class="bwi-item-modal-title"></span>' +
    '<button type="button" class="bwi-item-modal-close" aria-label="Close">✕</button>' +
    "</div>" +
    '<div class="bwi-item-modal-body"></div>' +
    "</div>";
  document.body.appendChild(overlay);
  function close() {
    overlay.classList.add("hidden");
  }
  overlay.addEventListener("click", function (ev) {
    if (ev.target === overlay) close();
  });
  overlay
    .getElementsByClassName("bwi-item-modal-close")[0]
    .addEventListener("click", close);
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !overlay.classList.contains("hidden")) close();
  });
  return overlay;
}

function bwiOpenItemModal(title, kind, list, opts) {
  const overlay = bwiEnsureItemModal();
  const titleEl = overlay.getElementsByClassName("bwi-item-modal-title")[0];
  const body = overlay.getElementsByClassName("bwi-item-modal-body")[0];
  titleEl.textContent = title || "";
  body.innerHTML = "";
  const host = document.createElement("div");
  if (kind === "itemGrid") {
    host.className = "bwi-item-grid";
    body.appendChild(host);
    bwiPaintItemGrid(host, list, opts);
  } else {
    host.className = "bwi-item-strip";
    body.appendChild(host);
    bwiPaintItemList(host, list, opts);
  }
  overlay.classList.remove("hidden");
}

/**
 * Resolve optional side-item config for labelProgressBar.
 * Prefer nested `options.item`; flat itemKey/itemSize/itemRaise still work.
 * @param {object | null | undefined} options
 * @returns {{ key: string, size: number, raise: number } | null}
 */
function bwiBarItemOpts(options) {
  if (!options) return null;
  const nested = options.item;
  if (nested && typeof nested === "object" && nested.key) {
    return {
      key: String(nested.key),
      size: typeof nested.size === "number" ? nested.size : 28,
      raise: typeof nested.raise === "number" ? nested.raise : 6,
    };
  }
  if (options.itemKey) {
    return {
      key: String(options.itemKey),
      size: typeof options.itemSize === "number" ? options.itemSize : 28,
      raise: typeof options.itemRaise === "number" ? options.itemRaise : 6,
    };
  }
  return null;
}

/**
 * Optional iteminstance to the right of a labelProgressBar (e.g. HP/MP pots).
 * Enabled only when options.item / itemKey is set — caracAL opts in via schema.
 * @param {HTMLElement} row
 * @param {object} data
 * @param {object | null | undefined} options
 */
function bwiPaintBarItem(row, data, options) {
  if (!row) return;
  const host = row.getElementsByClassName("bwi-bar-item")[0];
  if (!host) return;
  const cfg = bwiBarItemOpts(options);
  if (!cfg) {
    row.classList.remove("has-bar-item");
    host.classList.add("hidden");
    host.innerHTML = "";
    host.style.transform = "";
    return;
  }
  const inst = data && data[cfg.key];
  if (!inst || typeof inst !== "object" || !(inst.name || inst.skin)) {
    row.classList.remove("has-bar-item");
    host.classList.add("hidden");
    host.innerHTML = "";
    host.style.transform = "";
    return;
  }
  row.classList.add("has-bar-item");
  host.classList.remove("hidden");
  host.style.transform = "translateY(-" + cfg.raise + "px)";
  let itemEl = host.getElementsByClassName("bwi-item")[0];
  if (!itemEl) {
    host.innerHTML = "";
    itemEl = document.createElement("div");
    itemEl.className = "bwi-item";
    host.appendChild(itemEl);
  }
  const paintInst = Object.assign({}, inst);
  if (paintInst.q != null && paintInst.showQuantity == null) {
    paintInst.showQuantity = true;
  }
  bwiPaintItemEl(itemEl, paintInst, { size: cfg.size });
}

/**
 * Wire a labelProgressBar to open an item modal from a sibling data key.
 * @param {HTMLElement} row
 * @param {object} data
 * @param {string} [label]
 * @param {{ key?: string, kind?: string, title?: string, cols?: number, slots?: number, modalSize?: number, wrap?: boolean } | null} modal
 */
function bwiBindProgressModal(row, data, label, modal) {
  if (!row) return;
  if (!modal || !modal.key) {
    row.classList.remove("bwi-modal-bar");
    row.removeAttribute("tabindex");
    row.removeAttribute("title");
    row._bwiModal = null;
    return;
  }
  row.classList.add("bwi-modal-bar");
  const title = modal.title || label || modal.key;
  row.setAttribute("tabindex", "0");
  row.setAttribute("title", "Open " + title);
  row.setAttribute("aria-label", title + ", open details");
  const list =
    data && Array.isArray(data[modal.key]) ? data[modal.key] : [];
  row._bwiModal = {
    title: title,
    kind: modal.kind || "itemStrip",
    list: list,
    opts: {
      size: modal.modalSize || 56,
      fill: false,
      wrap: !!modal.wrap,
      cols: modal.cols,
      slots: modal.slots,
    },
  };
  if (row._bwiModalBound) return;
  row._bwiModalBound = true;
  function open() {
    const m = row._bwiModal;
    if (!m) return;
    bwiOpenItemModal(m.title, m.kind, m.list, m.opts);
  }
  row.addEventListener("click", open);
  row.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      open();
    }
  });
}

function bwiPaintModalStrip(container, data, options) {
  options = options || {};
  const entries = options.entries || [];
  const size = options.size || 28;
  const kids = container.children;
  while (kids.length > entries.length) {
    container.removeChild(container.lastChild);
  }
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] || {};
    const key = entry.key || entry.name || "panel" + i;
    let btn = kids[i];
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bwi-modal-strip-btn";
      btn.innerHTML =
        '<span class="bwi-modal-strip-icon"></span>' +
        '<span class="bwi-modal-strip-text">' +
        '<span class="bwi-modal-strip-label"></span>' +
        '<span class="bwi-modal-strip-meta"></span>' +
        "</span>";
      container.appendChild(btn);
      btn.addEventListener("click", function () {
        const list = btn._bwiList || [];
        const kind = btn._bwiKind || "itemStrip";
        const modalOpts = btn._bwiModalOpts || { size: 56, fill: false };
        bwiOpenItemModal(btn._bwiLabel || key, kind, list, modalOpts);
      });
    }
    const list =
      data && Array.isArray(data[key])
        ? data[key]
        : Array.isArray(entry.list)
          ? entry.list
          : [];
    const kind = entry.kind || entry.type || "itemStrip";
    const used = bwiCountOccupied(list);
    let meta = String(used);
    if (kind === "itemGrid" && typeof entry.slots === "number") {
      meta = used + "/" + entry.slots;
    }
    const label = entry.label || key;
    btn._bwiList = list;
    btn._bwiKind = kind;
    btn._bwiLabel = label;
    btn._bwiModalOpts = {
      size: entry.modalSize || options.modalSize || 56,
      fill: false,
      wrap: kind !== "itemGrid",
      cols: entry.cols,
      slots: entry.slots,
    };
    btn.title = label + " · " + meta;
    btn.setAttribute("aria-label", btn.title);
    const iconHost = btn.getElementsByClassName("bwi-modal-strip-icon")[0];
    const labelEl = btn.getElementsByClassName("bwi-modal-strip-label")[0];
    const metaEl = btn.getElementsByClassName("bwi-modal-strip-meta")[0];
    if (iconHost && iconHost.getAttribute("data-icon") !== (entry.icon || "gear")) {
      iconHost.setAttribute("data-icon", entry.icon || "gear");
      iconHost.innerHTML = bwiUiGlyph(entry.icon || "gear", size);
    } else if (iconHost) {
      const svg = iconHost.getElementsByTagName("svg")[0];
      if (svg) {
        svg.setAttribute("width", String(size));
        svg.setAttribute("height", String(size));
      }
    }
    if (labelEl && labelEl.textContent !== label) labelEl.textContent = label;
    if (metaEl && metaEl.textContent !== meta) metaEl.textContent = meta;
  }
}

/**
 * Optional <details> chrome around a widget (inventory, trades, gear, …).
 * @returns {string} html
 */
function bwiWrapFold(name, label, options, widgetHtml) {
  if (!options || !options.collapsible) return widgetHtml;
  const openAttr = bwiFoldShouldOpen(name, options) ? " open" : "";
  const summary = label || name;
  return (
    '<details class="bwi-fold" data-fold="' +
    name +
    '"' +
    openAttr +
    ">" +
    '<summary class="bwi-fold-summary">' +
    '<span class="bwi-fold-label">' +
    summary +
    "</span>" +
    '<span class="bwi-fold-meta"></span>' +
    "</summary>" +
    '<div class="bwi-fold-body">' +
    widgetHtml +
    "</div>" +
    "</details>"
  );
}

function bwiBindFolds(root) {
  if (!root || root._bwiFoldsBound) return;
  root._bwiFoldsBound = true;
  const folds = root.getElementsByClassName("bwi-fold");
  for (let i = 0; i < folds.length; i++) {
    const fold = folds[i];
    const key = fold.getAttribute("data-fold");
    if (!key || fold._bwiFoldBound) continue;
    fold._bwiFoldBound = true;
    fold.addEventListener("toggle", function () {
      try {
        localStorage.setItem(bwiFoldStorageKey(key), fold.open ? "1" : "0");
      } catch (e) {
        /* ignore */
      }
    });
  }
}

function bwiUpdateFoldMeta(row, text) {
  if (!row || typeof row.closest !== "function") return;
  const fold = row.closest(".bwi-fold");
  if (!fold) return;
  const meta = fold.getElementsByClassName("bwi-fold-meta")[0];
  if (meta && meta.textContent !== text) meta.textContent = text || "";
}

function bwiPaintItemList(container, list, opts) {
  opts = opts || {};
  const fill = opts.fill === true;
  const wrap = !!opts.wrap;
  const preferred = opts.size || 40;
  const items = Array.isArray(list) ? list : [];
  container._bwiList = items;
  container._bwiOpts = opts;
  container.style.flexWrap = wrap ? "wrap" : "nowrap";

  function paint() {
    const n = Math.max(1, items.length);
    let size = preferred;
    if (fill) {
      if (wrap) {
        const w = container.clientWidth;
        const gap = bwiContainerGapPx(container);
        const cols = Math.max(
          1,
          w > 0 ? Math.floor((w + gap) / (preferred + gap)) : n,
        );
        size = bwiFitCellSize(container, Math.min(cols, n), preferred);
      } else {
        size = bwiFitCellSize(container, n, preferred);
      }
    }
    const kids = container.children;
    while (kids.length > items.length) {
      container.removeChild(container.lastChild);
    }
    for (let i = 0; i < items.length; i++) {
      let el = kids[i];
      if (!el) {
        el = document.createElement("div");
        container.appendChild(el);
      }
      bwiPaintItemEl(el, items[i], { size });
    }
  }

  bwiWatchItemLayout(container, function () {
    bwiPaintItemList(container, container._bwiList, container._bwiOpts);
  });
  paint();
}

function bwiPaintItemGrid(container, list, opts) {
  opts = opts || {};
  const fill = opts.fill === true;
  const preferred = opts.size || 36;
  const cols = opts.cols || 7;
  const slots =
    typeof opts.slots === "number" && opts.slots > 0
      ? opts.slots
      : Array.isArray(list)
        ? list.length
        : 42;
  const items = Array.isArray(list) ? list : [];
  container._bwiList = items;
  container._bwiOpts = opts;

  function paint() {
    const size = fill ? bwiFitCellSize(container, cols, preferred) : preferred;
    if (fill) {
      container.style.gridTemplateColumns =
        "repeat(" + cols + ", minmax(0, 1fr))";
    } else {
      container.style.gridTemplateColumns =
        "repeat(" + cols + ", " + size + "px)";
    }
    const kids = container.children;
    while (kids.length > slots) {
      container.removeChild(container.lastChild);
    }
    for (let i = 0; i < slots; i++) {
      let el = kids[i];
      if (!el) {
        el = document.createElement("div");
        container.appendChild(el);
      }
      bwiPaintItemEl(el, items[i] != null ? items[i] : null, {
        size,
        fillCell: fill,
      });
    }
  }

  bwiWatchItemLayout(container, function () {
    bwiPaintItemGrid(container, container._bwiList, container._bwiOpts);
  });
  paint();
}

function bwiCountOccupied(list) {
  if (!Array.isArray(list)) return 0;
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i]) n++;
  }
  return n;
}

var BotUi = function (id, structure, parent, attachTarget) {
  this.id = id;
  this.structure = structure;
  this.parent = parent ? parent : null;
  this.children = [];
  this.attachTarget = attachTarget ? attachTarget : null;
  this.element = null;
};

BotUi.prototype.destroy = function () {
  if (this.element.parentNode)
    this.element.parentNode.removeChild(this.element);
};

BotUi.prototype.create = function () {
  var element = document.createElement("div");
  if (!this.parent) {
    // Keep columns narrow enough that 2 chars + showcase fit a typical pane.
    element.className =
      "botUI-root text-base flex flex-col mx-1 min-w-[17rem] max-w-[22rem]";
  } else {
    element.className = "text-base ";
  }

  var html = "";
  for (var i in this.structure) {
    var name = this.structure[i].name;
    var label = this.structure[i].label;
    var type = this.structure[i].type;
    var options = this.structure[i].options;
    switch (type) {
      case "text": {
        if (!options)
          options = {
            value_foreground: "white",
            // TODO: handle overriding styles in a better way so we can support dark/light mode
          };
        // const border = "border-b border-slate-100 dark:border-slate-700";
        const border = ""; // no border,perhaps an option?

        html += `<div class='${name} ${border} ${padding} flex flex-row justify-between'>
                  <div class='justify-self-start textDisplayLabel' >${label}: </div>
                  <div class='justify-self-end textDisplayValue' ></div>
                </div>`;
        break;
      }

      case "leftMiddleRightText": {
        options = {
          ...{
            size: "sm",
          },
          ...options,
        };

        // const border = "border-b border-slate-100 dark:border-slate-700";
        const border = ""; // no border,perhaps an option?

        let textSize = "";
        let height = "";
        switch (options.size) {
          case "xs":
            textSize = "text-sm";
            height = "h-5";
            break;
          case "sm":
            textSize = "text-base";
            height = "h-7";
            break;
          case "base":
            textSize = "text-lg";
            height = "h-9";
            break;
          case "lg":
            textSize = "text-xl";
            height = "h-11";
            break;
          case "xl":
            textSize = "text-2xl";
            height = "h-14";
            break;
        }

        const leftColor = options?.leftColor
          ? `color:${options.leftColor}`
          : "";

        const middleColor = options?.middleColor
          ? `color:${options.middleColor}`
          : "";

        const rightColor = options?.rightColor
          ? `color:${options.rightColor}`
          : "";

        const roundedBg = options?.bgColor
          ? `first:rounded-t last:rounded-b`
          : "";
        const bgColor = options?.bgColor
          ? `background-color:${options.bgColor}`
          : "";

        const text = `text-slate-700 dark:text-slate-200 ${textSize}`;

        //class="${name} relative my-1 h-6 flex w-full ${background} ${text} overflow-hidden" role="progressbar" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100">
        html += `<div class='${name} relative ${height} flex justify-between w-full ${border} ${text} overflow-hidden ${roundedBg}' style="${bgColor}">
                   <div class="absolute w-full flex justify-items-stretch">
                     <div class='w-full p-1 justify-self-start text-left textValueLeft' style="${leftColor}" ></div>
                   </div>
                   <div class="absolute w-full flex justify-items-stretch">
                     <div class='w-full p-1 justify-self-center text-center textValueMiddle' style="${middleColor}"></div>
                   </div>
                   <div class="absolute w-full flex justify-items-stretch">
                     <div class='w-full p-1 justify-self-end text-right textValueRight' style="${rightColor}"></div>
                   </div>
                </div>`;
        break;
      }
      case "progressBar": {
        options = {
          ...{
            size: "sm",
          },
          ...options,
        };

        // TODO: perhaps more options for different progress bar, rounded, not rounded?
        // https://preline.co/docs/progress.html
        // Heights hug text (leading-none); avoid tall empty chrome around the label.
        let textSize = "";
        let height = "";
        let barPadding = "px-1";
        switch (options.size) {
          case "xs":
            textSize = "text-xs leading-none";
            height = "h-4";
            break;
          case "sm":
            textSize = "text-sm leading-none";
            height = "h-5";
            break;
          case "base":
            textSize = "text-base leading-none";
            height = "h-6";
            barPadding = "px-1.5";
            break;
        }
        const background = "bg-slate-200 dark:bg-slate-950";
        const text = `text-slate-700 dark:text-slate-200 ${textSize}`;
        const barBackgroundColor = options?.color
          ? `background-color:${options.color}`
          : "";

        html += `<div class="${name} relative my-0.5 flex w-full ${height} ${background} ${text} overflow-hidden" role="progressbar" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100">
                    <div class="bar h-full flex flex-col justify-center overflow-hidden bg-blue-600 text-white text-center whitespace-nowrap dark:bg-blue-500 transition duration-500" style="width: 25%;${barBackgroundColor}"></div>
                    <div class="absolute inset-y-0 left-0 flex items-center ${barPadding} value">0%</div>
                  </div>`;
        break;
      }
      case "labelProgressBar": {
        options = {
          ...{
            size: "sm",
          },
          ...options,
        };

        // TODO: perhaps more options for different progress bar, rounded, not rounded?
        // https://preline.co/docs/progress.html
        let textSize = "";
        let height = "";
        let barPadding = "px-1";
        switch (options.size) {
          case "xs":
            textSize = "text-xs leading-none";
            height = "h-4";
            break;
          case "sm":
            textSize = "text-sm leading-none";
            height = "h-5";
            break;
          case "base":
            textSize = "text-base leading-none";
            height = "h-6";
            barPadding = "px-1.5";
            break;
        }

        // TODO: the label can overflow when we use position absolute, how do we handle longer values?
        const background = "bg-slate-200 dark:bg-slate-950";
        const text = `text-slate-700 dark:text-slate-200 ${textSize}`;
        const barBackgroundColor = options?.color
          ? `background-color:${options.color}`
          : "";
        const itemCfg = bwiBarItemOpts(options);
        const hasItem = !!itemCfg;
        const modalTitle = options?.modal
          ? options.modal.title || label || name
          : "";
        const rowClass =
          name +
          " bwi-bar-row" +
          (hasItem ? " has-bar-item" : "") +
          (options?.modal ? " bwi-modal-bar" : "");
        const modalAttrs = options?.modal
          ? ` tabindex="0" title="Open ${modalTitle}" aria-label="${modalTitle}, open details"`
          : "";

        // Optional side item (options.item / itemKey) sits right of the track,
        // raised slightly — caracAL opts in via schema; bars without it stay flat.
        html += `<div class="${rowClass}"${modalAttrs}>
                    <div class="bwi-bar-track relative flex w-full ${height} ${background} ${text} overflow-hidden" role="progressbar" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100">
                      <div class="bar h-full flex flex-col justify-center overflow-hidden bg-blue-600 text-white text-center whitespace-nowrap dark:bg-blue-500 transition duration-500" style="width: 25%;${barBackgroundColor}"></div>
                      <div class="absolute inset-y-0 left-0 right-0 flex items-center ${barPadding}">
                        <div class="flex w-full flex-row items-center justify-between gap-1">
                          <div class="justify-self-start shrink-0">${label}&nbsp;</div>
                          <div class="justify-self-end value">0%</div>
                        </div>
                      </div>
                    </div>
                    <div class="bwi-bar-item${hasItem ? "" : " hidden"}"></div>
                  </div>`;
        // TODO: text left side, percent right side
        break;
      }
      case "timerList": {
        // A container for timers, the render method is responsible for adding / removing timers
        html += `
          <div class="${name} flex flex-col">
          </div>
        `;
        break;
      }
      case "icon":
      case "item": {
        const size = (options && options.size) || 40;
        html += `<div class="${name} bwi-item-host"><div class="bwi-item" style="width:${size}px;height:${size}px"></div></div>`;
        break;
      }
      case "itemStrip": {
        html += bwiWrapItemChrome(
          name,
          label,
          options,
          `<div class="${name} bwi-item-strip"></div>`,
        );
        break;
      }
      case "itemGrid": {
        html += bwiWrapItemChrome(
          name,
          label,
          options,
          `<div class="${name} bwi-item-grid"></div>`,
        );
        break;
      }
      case "modalStrip": {
        html += `<div class="${name} bwi-modal-strip"></div>`;
        break;
      }
      case "image":
        if (!options) {
          options = {
            width: 200,
            height: 200,
          };
        }
        html += `<div class='${name} imageDisplay boxRow'> <img src='' style='width:${options.width}px;height:${options.height}px;'/> </div>`;
        break;
      case "minimap": {
        if (!options) {
          options = {
            width: 200,
            height: 150,
          };
        }
        const w = options.width || 200;
        const h = options.height || 150;
        const btn =
          "minimapTbBtn rounded px-1.5 py-0.5 text-xs leading-none text-slate-300 hover:bg-slate-700/80 hover:text-white";
        html += `<div class='${name} minimapDisplay relative my-1 w-full overflow-hidden' style="aspect-ratio:${w}/${h};position:relative;overflow:hidden;background:#0b1220;border:1px solid rgba(148,163,184,0.28);border-radius:6px;">
          <canvas class="minimapCanvas block h-full w-full cursor-crosshair" style="display:block;width:100%;height:100%;background:transparent;"></canvas>
          <div class="minimapFsTitle" style="display:none;position:absolute;left:12px;top:12px;z-index:15;max-width:min(70%,28rem);padding:8px 12px;border-radius:8px;background:rgba(2,6,23,0.82);backdrop-filter:blur(6px);border:1px solid rgba(148,163,184,0.25);font-family:inherit;pointer-events:none;">
            <div class="minimapFsName" style="color:#f8fafc;font-size:1.25rem;font-weight:600;line-height:1.2;"></div>
            <div class="minimapFsMeta" style="color:#94a3b8;font-size:0.875rem;line-height:1.35;margin-top:2px;"></div>
          </div>
          <div class="minimapTooltip pointer-events-none absolute z-20 hidden rounded bg-slate-950/95 px-2 py-1 text-sm text-slate-100 shadow" style="pointer-events:none;position:absolute;z-index:20;font-family:inherit;font-size:0.875rem;"></div>
          <div class="minimapToast pointer-events-none absolute bottom-8 left-1/2 z-20 hidden -translate-x-1/2 rounded px-2 py-1 text-sm text-white" style="pointer-events:none;position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:20;font-family:inherit;font-size:0.8125rem;background:rgba(6,95,70,0.92);box-shadow:0 2px 8px rgba(0,0,0,0.35);white-space:nowrap;"></div>
          <div class="minimapLegend absolute bottom-1 left-1 z-10 hidden max-w-[55%] rounded bg-slate-950/85 p-1.5 text-xs text-slate-200" style="position:absolute;bottom:4px;left:4px;z-index:10;font-family:inherit;font-size:0.75rem;line-height:1.25;"></div>
          <div class="minimapToolbar absolute right-1 top-1 z-10 flex flex-wrap justify-end gap-0.5" style="position:absolute;right:4px;top:4px;z-index:10;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:2px;padding:3px;border-radius:6px;background:rgba(2,6,23,0.55);backdrop-filter:blur(4px);font-family:inherit;opacity:0.72;transition:opacity 120ms ease, background 120ms ease;">
            <button type="button" class="minimapLabelsBtn ${btn}" aria-label="Toggle labels" title="Names" aria-pressed="false">Aa</button>
            <button type="button" class="minimapLayerLinesBtn ${btn}" title="Walls" aria-pressed="true">L</button>
            <button type="button" class="minimapLayerMarkersBtn ${btn}" title="Markers" aria-pressed="true">M</button>
            <button type="button" class="minimapLayerRingsBtn ${btn}" title="Range rings" aria-pressed="false">R</button>
            <button type="button" class="minimapLayerTrailBtn ${btn}" title="Trail" aria-pressed="false">T</button>
            <button type="button" class="minimapLegendBtn ${btn}" title="Legend" aria-pressed="false">?</button>
            <span style="width:1px;align-self:stretch;background:rgba(148,163,184,0.35);margin:1px 2px;"></span>
            <button type="button" class="minimapZoomOutBtn ${btn}" title="Zoom out">−</button>
            <span class="minimapZoomLabel" style="min-width:2.4em;text-align:center;color:#94a3b8;font-size:0.75rem;line-height:1.6;padding:0 2px;" title="Zoom">2×</span>
            <button type="button" class="minimapZoomInBtn ${btn}" title="Zoom in">+</button>
            <button type="button" class="minimapFullscreenBtn ${btn}" aria-label="Toggle fullscreen" title="Fullscreen">⛶</button>
          </div>
        </div>`;
        break;
      }
      case "table":
        // TODO: render tables with column headers and rows
        // TODO: captions? https://tailwindcss.com/docs/caption-side
        const headers = this.structure[i].headers;
        let headersHtml = "";
        if (headers) {
          // TODO: ability to define alignment on headers
          // TODO: show date as X time ago with a tooltip of the date
          headersHtml = `<thead>
          <tr>
            ${headers
              .map(
                (x) =>
                  `<th class="border-b dark:border-slate-600 font-medium ${padding} pt-0 pb-3 text-slate-400 dark:text-slate-200 text-left">${x}</th>`
              )
              .join("")}
          </tr>
        </thead>`;
        }

        // <div class="max-h-[50vh] overflow-y-auto overflow-x-hidden">
        // TODO: hide label if there is none
        const htmlLabel = label
          ? `<div class='${padding} text-center'>${label}</div>`
          : "";
        html += `
          ${htmlLabel}
          <table class="${name} border-collapse table-auto w-full text-base">
          ${headersHtml}
          <tbody>
          </tbody>
          </table>
        `;
        // </div>
        break;
      // TODO: a left / middle / right text option
      // could display name | status | level for example
      case "button":
        html += `<div class='${name} buttonDisplay boxRow my-1'>
          <button type="button" class="rounded bg-slate-700 px-3 py-1 text-base text-slate-100 hover:bg-slate-600">${label || name}</button>
        </div>`;
        break;
      case "botUI":
        if (!options) {
          options = {
            flexDirection: "row",
          };
        }

        const flexDirection =
          options.flexDirection == "column" ? "flex-col" : "flex-row";
        html += `<div class='${name} ${flexDirection} rounded-lg my-2 px-1.5 py-1 bg-slate-200 dark:bg-slate-800/90 shadow-sm ring-1 ring-slate-300/40 dark:ring-slate-700/60 subBotUI'></div>`;
        break;
      case "chart": {
        // html += `<div class='${name}'> <canvas id="${this.id}-${name}-chart"></canvas> </div>`;
        options = {
          size: "sm",
          type: "bar",
          ...options,
        };
        // Pixel height: options.height, or size presets (xs/sm/base/lg).
        // Default sm≈old h-8; lg matches the previous fixed h-24.
        const chartHeightBySize = { xs: 24, sm: 32, base: 48, lg: 96 };
        const chartPx =
          typeof options.height === "number" && options.height > 0
            ? options.height
            : chartHeightBySize[options.size] || chartHeightBySize.sm;
        const background = "bg-slate-200 dark:bg-slate-800";
        const text = "text-slate-700 dark:text-slate-200";
        html += `<div class="${name} my-1 flex w-full ${background} ${text}" style="height:${chartPx}px">
                  <canvas class="h-full w-full" id="${this.id}-${name}-chart"></canvas> 
                </div>`;
        // TODO: How do we initialize the chart ? e.g. new Chart when it's not part of the dom yet?
        // Chart is initialized in render, as we can't use javascript to acquire the canvas element here.

        break;
      }
    }
  }
  element.innerHTML = html;
  bwiBindFolds(element);
  this.element = element;
  if (this.parent) {
    this.parent.children.push(this);
    let container = this.parent.element.getElementsByClassName(
      "subBotUI " + this.attachTarget
    )[0];
    container.appendChild(element);
  } else {
    let container = document.getElementsByClassName("botUIContainer")[0];
    container.appendChild(element);
  }
};

/**
 * Updates html object with data object
 */
BotUi.prototype.render = function (onlyNames) {
  if (!this.data) return;
  const onlySet = onlyNames
    ? onlyNames instanceof Set
      ? onlyNames
      : new Set(onlyNames)
    : null;

  for (let i in this.structure) {
    const name = this.structure[i].name;
    if (onlySet && !onlySet.has(name)) continue;
    const type = this.structure[i].type;
    const value = this.data[name]; // TODO: sharing of the same data source across components? so we don't send it excessively? modals, chars, e.g. pie chart over loot table
    let options = this.structure[i].options;

    if (value === undefined && type !== "modalStrip") continue;

    // TODO: is there an issue with the name? e.g. we have two "timers" and it's not properly found in the subUI?

    const row = this.element.getElementsByClassName(name)[0];

    switch (type) {
      case "text":
        row.getElementsByClassName("textDisplayValue")[0].innerHTML = value;
        break;
      case "leftMiddleRightText": {
        const { left, middle, right } = value;
        // override with update options
        options = { ...options, ...value.options };

        // background
        const bgClasses = ["first:rounded-t", "last:rounded-b"];
        if (options?.bgColor) {
          for (const roundedBg of bgClasses) {
            if (!row.classList.contains(roundedBg)) {
              row.classList.add(roundedBg);
            }
          }
        } else {
          for (const roundedBg of bgClasses) {
            if (row.classList.contains(roundedBg)) {
              row.classList.remove(roundedBg);
            }
          }
        }

        row.style.backgroundColor = options?.bgColor ? options.bgColor : "";

        // font color
        const leftColor = options?.leftColor ?? "";
        const middleColor = options?.middleColor ?? "";
        const rightColor = options?.rightColor ?? "";

        for (const [className, textVal, color] of [
          ["textValueLeft", left, leftColor],
          ["textValueMiddle", middle, middleColor],
          ["textValueRight", right, rightColor],
        ]) {
          const element = row.getElementsByClassName(className)[0];

          if (element.innerHTML !== (textVal ?? "")) {
            element.innerHTML = textVal ?? "";
          }

          if (color) {
            element.style.color = color;
          } else {
            element.style.color = "";
          }
        }

        // Live beat-age in the middle slot (stale Ns).
        if (typeof options?.beatAt === "number" && Number.isFinite(options.beatAt)) {
          if (!row._bwiAgeEntry) {
            row._bwiAgeEntry = {
              row,
              beatAt: options.beatAt,
              staleAfterSec:
                typeof options.staleAfterSec === "number"
                  ? options.staleAfterSec
                  : 2,
            };
            BwiClock.ages.add(row._bwiAgeEntry);
            BwiClock.ensure();
          } else {
            row._bwiAgeEntry.beatAt = options.beatAt;
            if (typeof options.staleAfterSec === "number") {
              row._bwiAgeEntry.staleAfterSec = options.staleAfterSec;
            }
          }
          paintBeatAge(row._bwiAgeEntry, Date.now());
        } else if (row._bwiAgeEntry) {
          BwiClock.ages.delete(row._bwiAgeEntry);
          row._bwiAgeEntry = null;
        }

        // Live ETA on the right slot (e.g. TTLU).
        if (typeof options?.levelUpAt === "number" && options.levelUpAt > 0) {
          const rightEl = row.getElementsByClassName("textValueRight")[0];
          if (!row._bwiEtaEntry) {
            row._bwiEtaEntry = {
              el: rightEl,
              endsAt: options.levelUpAt,
              suffix: options.etaSuffix != null ? options.etaSuffix : " TTLU",
              fallback: options.etaFallback || "N/A TTLU",
            };
            BwiClock.etas.add(row._bwiEtaEntry);
            BwiClock.ensure();
          } else {
            row._bwiEtaEntry.el = rightEl;
            row._bwiEtaEntry.endsAt = options.levelUpAt;
          }
          paintEta(row._bwiEtaEntry, Date.now());
        } else if (row._bwiEtaEntry) {
          BwiClock.etas.delete(row._bwiEtaEntry);
          row._bwiEtaEntry = null;
        }
        break;
      }

      case "progressBar": {
        const pct =
          typeof value === "number" && Number.isFinite(value)
            ? Math.max(0, Math.min(100, value))
            : 0;
        const shown = Math.round(pct);
        const widthStr = shown + "%";
        if (row._pbWidth !== widthStr) {
          row.getElementsByClassName("bar")[0].style.width = widthStr;
          row._pbWidth = widthStr;
        }
        this._setProgressValueText(row, widthStr);
        break;
      }
      case "labelProgressBar": {
        const pct =
          typeof value[0] === "number" && Number.isFinite(value[0])
            ? Math.max(0, Math.min(100, value[0]))
            : 0;
        // One decimal keeps the fill smooth without thrashing subpixels every beat.
        const widthStr = Math.round(pct * 10) / 10 + "%";
        if (row._pbWidth !== widthStr) {
          row.getElementsByClassName("bar")[0].style.width = widthStr;
          row._pbWidth = widthStr;
        }
        this._setProgressValueText(row, value[1]);
        bwiPaintBarItem(row, this.data, options);
        bwiBindProgressModal(
          row,
          this.data,
          this.structure[i].label,
          options && options.modal,
        );
        break;
      }
      case "image":
        row.getElementsByTagName("img")[0].src = value;
        break;
      case "icon":
      case "item": {
        const size = (options && options.size) || (value && value.size) || 40;
        let host = row.getElementsByClassName("bwi-item")[0];
        if (!host) {
          host = document.createElement("div");
          row.appendChild(host);
        }
        bwiPaintItemEl(host, value, { size });
        break;
      }
      case "itemStrip": {
        const size = (options && options.size) || 40;
        const fill = options && options.fill;
        const wrap = options && options.wrap;
        bwiPaintItemList(row, value, {
          size,
          fill: fill === true,
          wrap: !!wrap,
        });
        break;
      }
      case "itemGrid": {
        const size = (options && options.size) || 36;
        const cols = (options && options.cols) || 7;
        const slots = (options && options.slots) || undefined;
        const fill = options && options.fill;
        bwiPaintItemGrid(row, value, {
          size,
          cols,
          slots,
          fill: fill === true,
        });
        break;
      }
      case "modalStrip": {
        // Lists live on sibling data keys (gear/bag/trades); value may be unused.
        bwiPaintModalStrip(row, this.data, options || {});
        break;
      }
      case "button": {
        const btnEl = row.getElementsByTagName("button")[0];
        if (btnEl && value != null && value !== "") {
          btnEl.textContent = String(value);
        }
        break;
      }
      case "minimap":
        this.renderMinimap(row, value, options);
        break;
      case "graph":
        //TODO implement later
        break;
      case "botUI":
        break;
      case "table":
        const newTbody = document.createElement("tbody");
        for (let index = 0; index < value.length; index++) {
          const element = value[index];
          const newRow = newTbody.insertRow(index);
          let htmlCells = "";
          for (let c = 0; c < element.length; c++) {
            const cell = element[c];
            if (cell && typeof cell === "object" && (cell.name || cell.skin)) {
              htmlCells +=
                `<td class="border-b border-slate-100 dark:border-slate-700 ${padding} text-slate-700 dark:text-slate-200 align-middle"><div class="bwi-item bwi-table-item" data-table-item="${c}"></div></td>`;
            } else {
              htmlCells +=
                `<td class="border-b border-slate-100 dark:border-slate-700 ${padding} text-slate-700 dark:text-slate-200 align-middle">${cell}</td>`;
            }
          }
          newRow.innerHTML = htmlCells;
          for (let c = 0; c < element.length; c++) {
            const cell = element[c];
            if (cell && typeof cell === "object" && (cell.name || cell.skin)) {
              const host = newRow.querySelector('[data-table-item="' + c + '"]');
              if (host) {
                const paintInst = Object.assign({}, cell);
                if (paintInst.q != null && paintInst.showQuantity == null) {
                  paintInst.showQuantity = true;
                }
                bwiPaintItemEl(host, paintInst, {
                  size: (options && options.itemSize) || 32,
                });
              }
            }
          }
        }

        row.replaceChild(newTbody, row.getElementsByTagName("tbody")[0]);
        break;
      case "timerList": {
        for (let index = 0; index < value.length; index++) {
          const {
            leftText,
            middleText,
            rightText,
            percentage,
            ms,
            ims,
            endsAt,
            skin,
            icon,
            buff,
            debuff,
          } = value[index];

          let timerElement = row.querySelector(`#${name}${index}`);
          if (!timerElement) {
            this.addTimerElement(row, name, {}, index);
            timerElement = row.querySelector(`#${name}${index}`);
            if (!timerElement) continue;
          }

          if (timerElement.style.display === "none") {
            timerElement.style.display = "";
          }

          const leftEl = timerElement.getElementsByClassName("textValueLeft")[0];
          const rightEl = timerElement.getElementsByClassName("textValueRight")[0];
          const leftNext = leftText ?? "";
          const rightNext = rightText ?? "";
          if (leftEl.textContent !== leftNext) leftEl.textContent = leftNext;
          if (rightEl.textContent !== rightNext) rightEl.textContent = rightNext;

          const iconEl = timerElement.getElementsByClassName("timer-icon")[0];
          if (iconEl) {
            const iconInst =
              icon ||
              (skin ? { skin: skin, showLevel: false, showQuantity: false } : null);
            bwiPaintItemEl(iconEl, iconInst, { size: 24 });
            iconEl.style.display = iconInst ? "" : "none";
          }
          timerElement.classList.toggle("timer-buff", !!buff);
          timerElement.classList.toggle("timer-debuff", !!debuff);

          const now = Date.now();
          let end =
            typeof endsAt === "number" && Number.isFinite(endsAt)
              ? endsAt
              : typeof ms === "number" && Number.isFinite(ms)
                ? now + ms
                : NaN;
          const initial =
            typeof ims === "number" && ims > 0
              ? ims
              : typeof percentage === "number" &&
                  percentage > 0 &&
                  typeof ms === "number" &&
                  ms > 0
                ? (ms / percentage) * 100
                : typeof ms === "number" && ms > 0
                  ? ms
                  : 1;

          if (Number.isFinite(end)) {
            timerElement.dataset.endsAt = String(end);
            timerElement.dataset.ims = String(initial);
            // Force a paint after publisher refresh even if tenths label matches.
            if (timerElement._bwiPaint) timerElement._bwiPaint.mid = null;
            BwiClock.timers.add(timerElement);
            BwiClock.ensure();
            paintTimerBar(timerElement, now);
          } else {
            const widthStr = percentage + "%";
            const barEl = timerElement.getElementsByClassName("bar")[0];
            const midEl = timerElement.getElementsByClassName("textValueMiddle")[0];
            if (barEl.style.width !== widthStr) barEl.style.width = widthStr;
            const midNext = middleText ?? "";
            if (midEl.textContent !== midNext) midEl.textContent = midNext;
          }
        }

        const timersToHide = Array.from(row.children).slice(value.length);

        for (const timerElement of timersToHide) {
          if (timerElement.style.display !== "none") {
            timerElement.style.display = "none";
          }
          timerElement.classList.remove("timer-urgent");
          timerElement.classList.remove("timer-buff");
          timerElement.classList.remove("timer-debuff");
          BwiClock.timers.delete(timerElement);
          delete timerElement.dataset.endsAt;
        }

        break;
      }

      case "chart":
        const defaults = {
          type: "line",
          scales: {
            x: {
              display: false,
            },
            y: {
              display: false,
            },
          },
        };

        options = {
          ...defaults,
          ...options,
          scales: {
            ...defaults.scales,
            ...(options && options.scales),
            x: {
              ...defaults.scales.x,
              ...(options && options.scales && options.scales.x),
            },
            y: {
              ...defaults.scales.y,
              ...(options && options.scales && options.scales.y),
            },
          },
        };
        // TODO: handle pie charts https://www.chartjs.org/docs/latest/charts/doughnut.html

        const data = value.data;

        const canvas = document.getElementById(`${this.id}-${name}-chart`);
        if (!canvas.dataset.chartInitialized) {
          console.log(`initializing chart! ${this.id}-${name}-chart`);
          canvas.dataset.chartInitialized = true;

          // const barChart =
          new Chart(canvas, {
            type: options.type,
            options: {
              responsive: true,
              maintainAspectRatio: false,
              animation: false,
              animations: false,
              transitions: {
                active: { animation: { duration: 0 } },
              },
              scales: options.scales,
              plugins: {
                legend: {
                  display: false,
                },
                tooltip: {
                  enabled: false,
                },
                labels: {
                  enabled: false,
                },
              },
            },
            data: data,
          });
        } else {
          const chart = Chart.getChart(canvas);
          const nextSets = (data && data.datasets) || [];
          let changed = false;

          if (data && Array.isArray(data.labels)) {
            const labels = chart.data.labels || [];
            if (labels.length !== data.labels.length) {
              chart.data.labels = data.labels;
              changed = true;
            } else {
              for (let li = 0; li < data.labels.length; li++) {
                if (labels[li] !== data.labels[li]) {
                  chart.data.labels = data.labels;
                  changed = true;
                  break;
                }
              }
            }
          }

          if (chart.data.datasets.length !== nextSets.length) {
            chart.data.datasets = nextSets;
            changed = true;
          } else {
            for (let i = 0; i < nextSets.length; i++) {
              const src = nextSets[i] || {};
              const dst = chart.data.datasets[i];
              for (const key of Object.keys(src)) {
                if (
                  key === "data" &&
                  Array.isArray(src.data) &&
                  Array.isArray(dst.data)
                ) {
                  let seriesChanged = dst.data.length !== src.data.length;
                  if (!seriesChanged) {
                    for (let j = 0; j < src.data.length; j++) {
                      if (dst.data[j] !== src.data[j]) {
                        seriesChanged = true;
                        break;
                      }
                    }
                  }
                  if (seriesChanged) {
                    dst.data.length = src.data.length;
                    for (let j = 0; j < src.data.length; j++) {
                      dst.data[j] = src.data[j];
                    }
                    changed = true;
                  }
                } else if (dst[key] !== src[key]) {
                  dst[key] = src[key];
                  changed = true;
                }
              }
            }
          }

          if (changed) chart.update("none");
        }
        break;
    }
  }
};

/** Update progress label slower than the fill so digits don't flicker every beat. */
BotUi.prototype._setProgressValueText = function (row, text) {
  const TEXT_CADENCE_MS = 200;
  const next = text == null ? "" : String(text);
  const valueEl = row.getElementsByClassName("value")[0];
  if (!valueEl) return;
  if (!row._pbText) {
    row._pbText = { lastAt: 0, lastText: "" };
  }
  const now = performance.now();
  if (valueEl.innerHTML === next) {
    row._pbText.lastText = next;
    return;
  }
  if (row._pbText.lastText !== "" && now - row._pbText.lastAt < TEXT_CADENCE_MS) {
    return;
  }
  valueEl.innerHTML = next;
  row._pbText.lastAt = now;
  row._pbText.lastText = next;
};

BotUi.prototype.addTimerElement = function (row, name, options, index) {
  if (!options) {
    options = {};
  }

  const background = "bg-slate-200 dark:bg-slate-800";
  // Single flex row (not 3 absolute layers): time sits on a dark chip so it
  // stays readable whether the fill is wide, narrow, or mid-glyph.
  html = `<div id="${name}${index}" class="${name} timer-bar relative my-0.5 flex h-7 w-full overflow-hidden ${background} text-sm leading-tight" role="progressbar" aria-valuenow="25" aria-valuemin="0" aria-valuemax="100">
                <div class="bar h-full flex flex-col justify-center overflow-hidden bg-sky-900 text-white text-center whitespace-nowrap dark:bg-sky-800" style="width: 25%;${
                  options?.color ? `background-color:${options.color}` : ""
                }"></div>
                <div class="absolute inset-y-0 left-0 right-0 flex items-center gap-1.5 px-1 pointer-events-none">
                  <div class="timer-icon bwi-item shrink-0 is-empty" style="width:24px;height:24px;border-width:1px"></div>
                  <div class="textValueLeft timer-name min-w-0 flex-1 truncate"></div>
                  <div class="textValueMiddle timer-time shrink-0"></div>
                  <div class="textValueRight timer-right shrink-0"></div>
                </div>
              </div>`;

  const temp = document.createElement("div");
  temp.innerHTML = html;
  row.appendChild(temp.firstChild);
};

/**
 * Draw a generic minimap from pixel-space geometry.
 *
 * value:
 *   lines?:   [[x1,y1,x2,y2,style], ...]
 *   markers?: [[x,y,style,label?,hp?], ...]  hp in 0..1
 *   rings?:   [[x,y,radius,style], ...]
 *   trail?:   [[x,y], ...]  // pixel-space path; drawn as fading breadcrumbs
 *   title?:   string         // owner / character name (shown in fullscreen)
 *   map?:     string         // map id (shown under title in fullscreen)
 *   origin?:  [worldX, worldY] // camera center; enables smooth scrolling between updates
 *   scale?:   number         // world→pixel scale used with origin (default options.scale or 1/3)
 *
 * options.styles / width / height / showLabels / showLegend / showRings / title
 * options.smooth !== false, options.smoothMs (default 280) — camera chase time-constant (ms)
 * options.zoom (default 2) — starting zoom; payload still covers full vision at 1×
 * options.showFog !== false — soft fade past vision (padding reads as fog of war)
 * shapes: cross | dot | ring
 *
 * UI: Aa labels, L/M/R/T layers, ? legend, -/+ zoom, fullscreen
 * Rings (R) and trail (T) off by default. Hover tooltip; click copies
 * character name + map + world coords (marker label when hovering one).
 * Zoom/layers persist per character title in localStorage.
 * Fullscreen shows title (value.title / options.title / self marker label).
 * Fog is a soft depth cue at 1×; at higher zoom rely on walls/markers instead.
 */

function bwiAdvanceMinimapCamera(ui) {
  if (
    !ui ||
    !ui.camSmooth ||
    !ui.camSmooth.enabled ||
    !ui.camSmooth.cam ||
    !ui.camSmooth.target ||
    ui.camSmooth.settled
  ) {
    return false;
  }
  const now = performance.now();
  const sm = ui.camSmooth;
  const dt = sm.lastTs ? Math.min(48, Math.max(0, now - sm.lastTs)) : 16;
  sm.lastTs = now;
  const tau = Math.max(40, sm.tau || 280);
  const a = 1 - Math.exp(-dt / tau);
  const cam = sm.cam;
  const tgt = sm.target;
  cam[0] += (tgt[0] - cam[0]) * a;
  cam[1] += (tgt[1] - cam[1]) * a;
  const lag2 =
    (tgt[0] - cam[0]) * (tgt[0] - cam[0]) +
    (tgt[1] - cam[1]) * (tgt[1] - cam[1]);
  if (lag2 < 0.0025) {
    cam[0] = tgt[0];
    cam[1] = tgt[1];
    sm.settled = true;
    sm.lastTs = 0;
    return false;
  }
  return true;
}

BotUi.prototype.renderMinimap = function (row, value, options) {
  const canvas = row.getElementsByTagName("canvas")[0];
  if (!canvas) return;
  options = options || {};
  const logicalW =
    (value && value.width) || options.width || 200;
  const logicalH =
    (value && value.height) || options.height || 150;
  // Keep CSS box aspect in sync when payload carries vision-sized bounds.
  const aspect = logicalW + "/" + logicalH;
  if (row.style.aspectRatio !== aspect) {
    row.style.aspectRatio = aspect;
  }
  const persistKeyFor = (v, opts) => {
    const title =
      (v && (v.title || v.owner)) ||
      (opts && (opts.persistKey || opts.title)) ||
      "";
    return title ? "bwi-minimap:" + title : "bwi-minimap:default";
  };
  const readMinimapPrefs = (key) => {
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) {
      return null;
    }
  };
  const writeMinimapPrefs = (key, ui) => {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(
        key,
        JSON.stringify({
          zoom: ui.zoom,
          showLabels: !!ui.showLabels,
          showLegend: !!ui.showLegend,
          layers: {
            lines: !!ui.layers.lines,
            markers: !!ui.layers.markers,
            rings: !!ui.layers.rings,
            trail: !!ui.layers.trail,
          },
        })
      );
    } catch (e) {
      /* ignore quota / private mode */
    }
  };
  if (!row._minimapUi) {
    const defaultZoom =
      options.zoom != null && options.zoom > 0 ? Number(options.zoom) : 2;
    const persistKey = persistKeyFor(value, options);
    const prefs = readMinimapPrefs(persistKey);
    row._minimapUi = {
      showLabels: prefs && typeof prefs.showLabels === "boolean"
        ? prefs.showLabels
        : !!options.showLabels,
      showLegend: prefs && typeof prefs.showLegend === "boolean"
        ? prefs.showLegend
        : !!options.showLegend,
      defaultZoom,
      zoom:
        prefs && typeof prefs.zoom === "number" && prefs.zoom > 0
          ? prefs.zoom
          : defaultZoom,
      persistKey,
      layers: {
        lines:
          prefs && prefs.layers && typeof prefs.layers.lines === "boolean"
            ? prefs.layers.lines
            : true,
        markers:
          prefs && prefs.layers && typeof prefs.layers.markers === "boolean"
            ? prefs.layers.markers
            : true,
        rings:
          prefs && prefs.layers && typeof prefs.layers.rings === "boolean"
            ? prefs.layers.rings
            : options.showRings === true,
        trail:
          prefs && prefs.layers && typeof prefs.layers.trail === "boolean"
            ? prefs.layers.trail
            : options.showTrail === true,
      },
      hover: null,
    };
  }
  const ui = row._minimapUi;
  // Character rename / swap: reload prefs for the new title.
  const nextPersistKey = persistKeyFor(value, options);
  if (ui.persistKey !== nextPersistKey) {
    ui.persistKey = nextPersistKey;
    const prefs = readMinimapPrefs(nextPersistKey);
    if (prefs) {
      if (typeof prefs.zoom === "number" && prefs.zoom > 0) ui.zoom = prefs.zoom;
      if (typeof prefs.showLabels === "boolean") ui.showLabels = prefs.showLabels;
      if (typeof prefs.showLegend === "boolean") ui.showLegend = prefs.showLegend;
      if (prefs.layers) {
        if (typeof prefs.layers.lines === "boolean") ui.layers.lines = prefs.layers.lines;
        if (typeof prefs.layers.markers === "boolean")
          ui.layers.markers = prefs.layers.markers;
        if (typeof prefs.layers.rings === "boolean") ui.layers.rings = prefs.layers.rings;
        if (typeof prefs.layers.trail === "boolean") ui.layers.trail = prefs.layers.trail;
      }
    }
  }
  row._minimapState = { value, options };
  const persistUi = () => writeMinimapPrefs(ui.persistKey || nextPersistKey, ui);
  row._persistMinimapUi = persistUi;

  // Smooth follow-cam: exponentially chase world origin so walls scroll
  // continuously instead of restarting a short ease every beat.
  const origin =
    value && Array.isArray(value.origin) && value.origin.length >= 2
      ? [Number(value.origin[0]), Number(value.origin[1])]
      : null;
  const scale =
    value && typeof value.scale === "number"
      ? value.scale
      : options.scale != null
        ? options.scale
        : 1 / 3;
  const smoothOn = options.smooth !== false;
  // Time constant (ms): ~63% of remaining camera lag closes per smoothMs.
  const smoothMs = options.smoothMs != null ? options.smoothMs : 280;
  if (!ui.camSmooth) {
    ui.camSmooth = {
      enabled: smoothOn,
      scale: scale,
      cam: null,
      target: null,
      payloadOrigin: null,
      tau: smoothMs,
      lastTs: 0,
      settled: true,
    };
  }
  ui.camSmooth.enabled = smoothOn;
  ui.camSmooth.tau = smoothMs;
  ui.camSmooth.scale = scale;
  const isNewPayload = value !== ui._valueRef;
  ui._valueRef = value;
  if (isNewPayload && origin) {
    ui.camSmooth.target = [origin[0], origin[1]];
    ui.camSmooth.payloadOrigin = [origin[0], origin[1]];
    if (!ui.camSmooth.cam) {
      ui.camSmooth.cam = [origin[0], origin[1]];
      ui.camSmooth.settled = true;
      ui.camSmooth.lastTs = 0;
    } else if (smoothOn) {
      const c = ui.camSmooth.cam;
      const ddx = origin[0] - c[0];
      const ddy = origin[1] - c[1];
      // Sub-pixel / tiny beats: snap — keeps motion feature for real walks
      // without a perpetual 60fps redraw loop.
      if (ddx * ddx + ddy * ddy < 0.36) {
        c[0] = origin[0];
        c[1] = origin[1];
        ui.camSmooth.settled = true;
        ui.camSmooth.lastTs = 0;
      } else {
        ui.camSmooth.settled = false;
      }
    } else {
      ui.camSmooth.cam = [origin[0], origin[1]];
      ui.camSmooth.settled = true;
    }
  }

  // Advance camera chase (also driven by rAF kicks).
  bwiAdvanceMinimapCamera(ui);

  const tooltip = row.getElementsByClassName("minimapTooltip")[0];
  const toast = row.getElementsByClassName("minimapToast")[0];
  const legendEl = row.getElementsByClassName("minimapLegend")[0];
  const syncToggleBtn = (el, on) => {
    if (!el) return;
    const pressed = on ? "true" : "false";
    if (el.getAttribute("aria-pressed") === pressed) return;
    el.setAttribute("aria-pressed", pressed);
    el.style.background = on ? "rgba(14,116,144,0.85)" : "transparent";
    el.style.color = on ? "#f8fafc" : "#cbd5e1";
    el.style.boxShadow = on ? "inset 0 0 0 1px rgba(56,189,248,0.7)" : "none";
  };
  const redraw = () => {
    const state = row._minimapState;
    if (state) this.renderMinimap(row, state.value, state.options);
  };
  const kickSmooth = () => {
    if (row._minimapRaf) return;
    const self = this;
    const step = () => {
      row._minimapRaf = null;
      const state = row._minimapState;
      const mui = row._minimapUi;
      if (!state || !mui) return;
      const moving = bwiAdvanceMinimapCamera(mui);
      self._paintMinimapCanvas(row, state.value, state.options || {});
      if (moving || (mui.camSmooth && mui.camSmooth.enabled && !mui.camSmooth.settled)) {
        row._minimapRaf = requestAnimationFrame(step);
      }
    };
    row._minimapRaf = requestAnimationFrame(step);
  };
  if (!row.dataset.minimapInteractive) {
    row.dataset.minimapInteractive = "1";
    const toolbar = row.getElementsByClassName("minimapToolbar")[0];
    const setToolbarHot = (on) => {
      if (!toolbar) return;
      toolbar.style.opacity = on ? "1" : "0.72";
      toolbar.style.background = on
        ? "rgba(2,6,23,0.82)"
        : "rgba(2,6,23,0.55)";
    };
    row.addEventListener("mouseenter", () => setToolbarHot(true));
    row.addEventListener("mouseleave", () => {
      if (document.fullscreenElement !== row) setToolbarHot(false);
    });
    row.dataset.minimapToolbarHover = "1";
    const bindToggle = (cls, get, set) => {
      const el = row.getElementsByClassName(cls)[0];
      if (!el) return;
      syncToggleBtn(el, get());
      el.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        set(!get());
        syncToggleBtn(el, get());
        if (row._persistMinimapUi) row._persistMinimapUi();
        redraw();
      });
    };
    bindToggle("minimapLabelsBtn", () => ui.showLabels, (v) => { ui.showLabels = v; });
    bindToggle("minimapLayerLinesBtn", () => ui.layers.lines, (v) => { ui.layers.lines = v; });
    bindToggle("minimapLayerMarkersBtn", () => ui.layers.markers, (v) => { ui.layers.markers = v; });
    bindToggle("minimapLayerRingsBtn", () => ui.layers.rings, (v) => { ui.layers.rings = v; });
    bindToggle("minimapLayerTrailBtn", () => ui.layers.trail, (v) => { ui.layers.trail = v; });
    bindToggle("minimapLegendBtn", () => ui.showLegend, (v) => { ui.showLegend = v; });
    const MIN_ZOOM = 0.25;
    const MAX_ZOOM = 4;
    const clampZoom = (z) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));
    const zoomOut = row.getElementsByClassName("minimapZoomOutBtn")[0];
    const zoomIn = row.getElementsByClassName("minimapZoomInBtn")[0];
    if (zoomOut) {
      zoomOut.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        ui.zoom = clampZoom(ui.zoom - 0.25);
        if (row._persistMinimapUi) row._persistMinimapUi();
        redraw();
      });
    }
    if (zoomIn) {
      zoomIn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        ui.zoom = clampZoom(ui.zoom + 0.25);
        if (row._persistMinimapUi) row._persistMinimapUi();
        redraw();
      });
    }
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        ui.zoom = clampZoom(ui.zoom + (e.deltaY > 0 ? -0.15 : 0.15));
        if (row._persistMinimapUi) row._persistMinimapUi();
        redraw();
      },
      { passive: false }
    );
    const toggleFullscreen = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!document.fullscreenElement) {
        if (row.requestFullscreen) row.requestFullscreen();
      } else if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    };
    const fsBtn = row.getElementsByClassName("minimapFullscreenBtn")[0];
    if (fsBtn) fsBtn.addEventListener("click", toggleFullscreen);
    const eventToLogical = (event) => {
      const rect = canvas.getBoundingClientRect();
      const sx = (event.clientX - rect.left) / rect.width;
      const sy = (event.clientY - rect.top) / rect.height;
      const z = ui.zoom || 1;
      return {
        x: (sx - 0.5) * (logicalW / z) + logicalW / 2,
        y: (sy - 0.5) * (logicalH / z) + logicalH / 2,
        sx,
        sy,
        rect,
      };
    };
    const findHover = (lx, ly) => {
      const markers = (row._minimapState && row._minimapState.value && row._minimapState.value.markers) || [];
      let best = null;
      let bestDist = 10 / (ui.zoom || 1);
      for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        const d = Math.hypot(m[0] - lx, m[1] - ly);
        if (d < bestDist) {
          bestDist = d;
          best = { index: i, marker: m };
        }
      }
      return best;
    };
    canvas.addEventListener("mousemove", (event) => {
      const p = eventToLogical(event);
      const next = findHover(p.x, p.y);
      const prevIdx = ui.hover ? ui.hover.index : -1;
      const nextIdx = next ? next.index : -1;
      ui.hover = next;
      if (tooltip) {
        if (ui.hover) {
          const m = ui.hover.marker;
          let label = m[3] || m[2] || "marker";
          if (label.length > 18) label = label.slice(0, 16) + "…";
          const hp = typeof m[4] === "number" ? " · " + Math.round(m[4] * 100) + "%" : "";
          tooltip.textContent = label + hp + "  (" + Math.round(m[0]) + ", " + Math.round(m[1]) + ")";
          tooltip.classList.remove("hidden");
          tooltip.style.left = Math.min(p.rect.width - 8, p.sx * p.rect.width + 12) + "px";
          tooltip.style.top = Math.max(8, p.sy * p.rect.height - 8) + "px";
        } else {
          tooltip.classList.add("hidden");
        }
      }
      if (prevIdx !== nextIdx) redraw();
    });
    canvas.addEventListener("mouseleave", () => {
      ui.hover = null;
      if (tooltip) tooltip.classList.add("hidden");
      redraw();
    });
    canvas.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      ui.zoom = ui.defaultZoom || 2;
      if (row._persistMinimapUi) row._persistMinimapUi();
      redraw();
    });
    canvas.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const state = row._minimapState || {};
      const v = state.value || value || {};
      const opts = state.options || options || {};
      const lw = (v && v.width) || logicalW;
      const lh = (v && v.height) || logicalH;
      const p = eventToLogical(event);
      const hover = findHover(p.x, p.y);
      const cam =
        (ui.camSmooth && ui.camSmooth.cam) ||
        (Array.isArray(v.origin) ? v.origin : null);
      const sc =
        typeof v.scale === "number"
          ? v.scale
          : opts.scale != null
            ? opts.scale
            : 1 / 3;
      const toWorld = (px, py) => {
        if (!cam || !(sc > 0)) return null;
        return [
          (px - lw / 2) / sc + cam[0],
          (py - lh / 2) / sc + cam[1],
        ];
      };
      const parts = [];
      if (v.title || v.owner) parts.push(String(v.title || v.owner));
      if (v.map) parts.push(String(v.map));
      let world = null;
      if (hover) {
        const label = hover.marker[3] || hover.marker[2] || "marker";
        if (label && parts.indexOf(String(label)) < 0) parts.push(String(label));
        world = toWorld(hover.marker[0], hover.marker[1]);
      } else if (cam) {
        world = [cam[0], cam[1]];
      } else {
        world = toWorld(p.x, p.y);
      }
      if (world) {
        parts.push(Math.round(world[0]) + ", " + Math.round(world[1]));
      }
      const text = parts.length ? parts.join(" · ") : Math.round(p.x) + ", " + Math.round(p.y);
      const showToast = (msg) => {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.remove("hidden");
        clearTimeout(row._minimapToastTimer);
        row._minimapToastTimer = setTimeout(() => toast.classList.add("hidden"), 1200);
      };
      showToast("Copied: " + text);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
    });
    if (typeof ResizeObserver !== "undefined") {
      row._minimapResizeObs = new ResizeObserver(() => {
        clearTimeout(row._minimapResizeTimer);
        row._minimapResizeTimer = setTimeout(() => redraw(), 80);
      });
      row._minimapResizeObs.observe(row);
    }
    document.addEventListener("fullscreenchange", () => {
      const state = row._minimapState;
      if (!state) return;
      const inFs = document.fullscreenElement === row;
      const fsTitle = row.getElementsByClassName("minimapFsTitle")[0];
      if (inFs) {
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.justifyContent = "center";
        row.style.background = "#0f172a";
        canvas.style.width =
          "min(100vw, calc(100vh * " + logicalW + " / " + logicalH + "))";
        canvas.style.height =
          "min(100vh, calc(100vw * " + logicalH + " / " + logicalW + "))";
        if (fsTitle) fsTitle.style.display = "block";
        setToolbarHot(true);
      } else {
        row.style.display = "";
        row.style.alignItems = "";
        row.style.justifyContent = "";
        row.style.background = "";
        canvas.style.width = "";
        canvas.style.height = "";
        if (fsTitle) fsTitle.style.display = "none";
        setToolbarHot(false);
      }
      redraw();
    });
  }
  const zoomLabel = row.getElementsByClassName("minimapZoomLabel")[0];
  if (zoomLabel) {
    const z = ui.zoom || 1;
    zoomLabel.textContent = (Math.round(z * 100) / 100) + "×";
  }
  const fsTitle = row.getElementsByClassName("minimapFsTitle")[0];
  if (fsTitle) {
    let owner =
      (value && (value.title || value.owner)) ||
      (options && options.title) ||
      "";
    if (!owner && value && value.markers) {
      for (let i = 0; i < value.markers.length; i++) {
        const m = value.markers[i];
        if (m && m[2] === "self" && m[3]) {
          owner = String(m[3]);
          break;
        }
      }
    }
    const mapName = (value && value.map) || (options && options.map) || "";
    const nameEl = fsTitle.getElementsByClassName("minimapFsName")[0];
    const metaEl = fsTitle.getElementsByClassName("minimapFsMeta")[0];
    if (nameEl) nameEl.textContent = owner || "Minimap";
    if (metaEl) {
      metaEl.textContent = mapName;
      metaEl.style.display = mapName ? "" : "none";
    }
  }
  syncToggleBtn(row.getElementsByClassName("minimapLabelsBtn")[0], ui.showLabels);
  syncToggleBtn(row.getElementsByClassName("minimapLayerLinesBtn")[0], ui.layers.lines);
  syncToggleBtn(row.getElementsByClassName("minimapLayerMarkersBtn")[0], ui.layers.markers);
  syncToggleBtn(row.getElementsByClassName("minimapLayerRingsBtn")[0], ui.layers.rings);
  syncToggleBtn(row.getElementsByClassName("minimapLayerTrailBtn")[0], ui.layers.trail);
  syncToggleBtn(row.getElementsByClassName("minimapLegendBtn")[0], ui.showLegend);
  this._paintMinimapCanvas(row, value, options, {
    canvas,
    logicalW,
    logicalH,
    ui,
    legendEl,
  });
  const styles = (options && options.styles) || {};
  const lines = (value && value.lines) || [];
  const markers = (value && value.markers) || [];
  const rings = (value && value.rings) || [];
  const trail = (value && value.trail) || [];
  if (legendEl) {
    if (ui.showLegend) {
      const used = new Set();
      for (let i = 0; i < lines.length; i++) used.add(lines[i][4]);
      for (let i = 0; i < markers.length; i++) used.add(markers[i][2]);
      for (let i = 0; i < rings.length; i++) used.add(rings[i][3]);
      if (trail.length) used.add("trail");
      let htmlLegend = "";
      for (const key of used) {
        if (!key) continue;
        const style = styles[key] || {};
        const color = style.fill || style.stroke || "#aaa";
        htmlLegend +=
          '<div class="flex items-center gap-1"><span style="display:inline-block;width:8px;height:8px;background:' +
          color +
          '"></span>' +
          key +
          "</div>";
      }
      const nextLegend = htmlLegend || "<div>no styles</div>";
      if (ui._legendHtml !== nextLegend) {
        legendEl.innerHTML = nextLegend;
        ui._legendHtml = nextLegend;
      }
      legendEl.classList.remove("hidden");
    } else {
      legendEl.classList.add("hidden");
    }
  }
  if (ui.camSmooth && ui.camSmooth.enabled && !ui.camSmooth.settled) {
    kickSmooth();
  }
};
/**
 * Updates bot data
 */
BotUi.prototype._paintMinimapCanvas = function (row, value, options, bound) {
  options = options || {};
  const ui = (bound && bound.ui) || row._minimapUi;
  const canvas = (bound && bound.canvas) || row.getElementsByTagName("canvas")[0];
  if (!ui || !canvas) return;
  const logicalW =
    (bound && bound.logicalW) ||
    (value && value.width) ||
    options.width ||
    200;
  const logicalH =
    (bound && bound.logicalH) ||
    (value && value.height) ||
    options.height ||
    150;

  const cssW = Math.max(1, canvas.clientWidth || row.clientWidth || logicalW);
  const cssH = Math.max(
    1,
    canvas.clientHeight || Math.round((cssW * logicalH) / logicalW)
  );
  const dpr = window.devicePixelRatio || 1;
  const bufW = Math.round(cssW * dpr);
  const bufH = Math.round(cssH * dpr);
  if (canvas.width !== bufW || canvas.height !== bufH) {
    canvas.width = bufW;
    canvas.height = bufH;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, bufW, bufH);
  const zoom = ui.zoom || 1;
  const uniform = Math.min(bufW / logicalW, bufH / logicalH) * zoom;
  ctx.setTransform(
    uniform,
    0,
    0,
    uniform,
    bufW / 2 - (logicalW / 2) * uniform,
    bufH / 2 - (logicalH / 2) * uniform
  );
  const sm = ui.camSmooth;
  if (
    sm &&
    sm.enabled &&
    sm.cam &&
    sm.payloadOrigin &&
    value &&
    Array.isArray(value.origin)
  ) {
    const sc = sm.scale || 1 / 3;
    ctx.translate(
      (sm.payloadOrigin[0] - sm.cam[0]) * sc,
      (sm.payloadOrigin[1] - sm.cam[1]) * sc
    );
  }
  if (!value) return;
  const styles = options.styles || {};
  const lines = value.lines || [];
  const markers = value.markers || [];
  const rings = value.rings || [];
  const trail = value.trail || [];

  const scFog =
    value.scale != null
      ? value.scale
      : options.scale != null
        ? options.scale
        : 1 / 3;
  let halfW;
  let halfH;
  if (Array.isArray(value.vision) && value.vision.length >= 2) {
    halfW = Number(value.vision[0]) * scFog;
    halfH = Number(value.vision[1]) * scFog;
  } else {
    halfW = logicalW / 2 / 1.12;
    halfH = logicalH / 2 / 1.12;
  }
  const showFog = options.showFog !== false && halfW > 0 && halfH > 0;
  const fogKey = showFog
    ? logicalW +
      "x" +
      logicalH +
      ":" +
      halfW +
      ":" +
      halfH +
      ":" +
      Math.round(zoom * 100)
    : "nofog";

  // Walls + fog are payload-static; blit while the camera eases.
  // (Do not key on `styles` identity — structure options are stable, but
  // defensive copies would otherwise rebuild every beat.)
  const staticOk =
    ui._staticLayer &&
    ui._staticLayer.lines === lines &&
    ui._staticLayer.zoom === zoom &&
    ui._staticLayer.lw === logicalW &&
    ui._staticLayer.lh === logicalH &&
    ui._staticLayer.showLines === !!ui.layers.lines &&
    ui._staticLayer.fogKey === fogKey;

  if (!staticOk) {
    const off =
      (ui._staticLayer && ui._staticLayer.canvas) ||
      document.createElement("canvas");
    const ow = Math.max(1, Math.ceil(logicalW));
    const oh = Math.max(1, Math.ceil(logicalH));
    if (off.width !== ow || off.height !== oh) {
      off.width = ow;
      off.height = oh;
    }
    const sctx = off.getContext("2d");
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, ow, oh);
    sctx.fillStyle = "#0b1220";
    sctx.fillRect(0, 0, ow, oh);

    if (ui.layers.lines && lines.length) {
      const byStyle = new Map();
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const key = line[4] || "wall";
        let bucket = byStyle.get(key);
        if (!bucket) {
          bucket = [];
          byStyle.set(key, bucket);
        }
        bucket.push(line);
      }
      for (const [styleKey, bucket] of byStyle) {
        const style = styles[styleKey] || {};
        sctx.beginPath();
        sctx.strokeStyle = style.stroke || "rgba(203,213,225,0.9)";
        sctx.lineWidth = (style.lineWidth || 1.25) / zoom;
        sctx.lineCap = "square";
        for (let i = 0; i < bucket.length; i++) {
          const line = bucket[i];
          sctx.moveTo(line[0], line[1]);
          sctx.lineTo(line[2], line[3]);
        }
        sctx.stroke();
      }
    }

    if (showFog) {
      if (!ui._fogCache || ui._fogCache.key !== fogKey) {
        const fog = document.createElement("canvas");
        fog.width = ow;
        fog.height = oh;
        const fctx = fog.getContext("2d");
        const fogCx = logicalW / 2;
        const fogCy = logicalH / 2;
        const clearW = halfW * 0.88;
        const clearH = halfH * 0.88;
        const clearL = fogCx - clearW;
        const clearR = fogCx + clearW;
        const clearT = fogCy - clearH;
        const clearB = fogCy + clearH;
        const visL = fogCx - halfW;
        const visR = fogCx + halfW;
        const visT = fogCy - halfH;
        const visB = fogCy + halfH;
        const x0 = Math.min(0, visL) - 48;
        const y0 = Math.min(0, visT) - 48;
        const x1 = Math.max(logicalW, visR) + 48;
        const y1 = Math.max(logicalH, visB) + 48;
        const fogRgb = "11,18,32";
        const fillBand = (gradient, x, y, w, h) => {
          if (w <= 0 || h <= 0) return;
          fctx.fillStyle = gradient;
          fctx.fillRect(x, y, w, h);
        };
        if (clearL > x0) {
          const g = fctx.createLinearGradient(x0, 0, clearL, 0);
          g.addColorStop(0, "rgba(" + fogRgb + ",1)");
          const tVis = Math.max(
            0.02,
            Math.min(0.98, (visL - x0) / (clearL - x0))
          );
          g.addColorStop(tVis, "rgba(" + fogRgb + ",0.75)");
          g.addColorStop(1, "rgba(" + fogRgb + ",0)");
          fillBand(g, x0, y0, clearL - x0, y1 - y0);
        }
        if (x1 > clearR) {
          const g = fctx.createLinearGradient(clearR, 0, x1, 0);
          g.addColorStop(0, "rgba(" + fogRgb + ",0)");
          const tVis = Math.max(
            0.02,
            Math.min(0.98, (visR - clearR) / (x1 - clearR))
          );
          g.addColorStop(tVis, "rgba(" + fogRgb + ",0.75)");
          g.addColorStop(1, "rgba(" + fogRgb + ",1)");
          fillBand(g, clearR, y0, x1 - clearR, y1 - y0);
        }
        if (clearT > y0) {
          const g = fctx.createLinearGradient(0, y0, 0, clearT);
          g.addColorStop(0, "rgba(" + fogRgb + ",1)");
          const tVis = Math.max(
            0.02,
            Math.min(0.98, (visT - y0) / (clearT - y0))
          );
          g.addColorStop(tVis, "rgba(" + fogRgb + ",0.65)");
          g.addColorStop(1, "rgba(" + fogRgb + ",0)");
          fillBand(g, x0, y0, x1 - x0, clearT - y0);
        }
        if (y1 > clearB) {
          const g = fctx.createLinearGradient(0, clearB, 0, y1);
          g.addColorStop(0, "rgba(" + fogRgb + ",0)");
          const tVis = Math.max(
            0.02,
            Math.min(0.98, (visB - clearB) / (y1 - clearB))
          );
          g.addColorStop(tVis, "rgba(" + fogRgb + ",0.65)");
          g.addColorStop(1, "rgba(" + fogRgb + ",1)");
          fillBand(g, x0, clearB, x1 - x0, y1 - clearB);
        }
        ui._fogCache = { key: fogKey, canvas: fog };
      }
      sctx.drawImage(ui._fogCache.canvas, 0, 0);
    }

    ui._staticLayer = {
      canvas: off,
      lines,
      zoom,
      lw: logicalW,
      lh: logicalH,
      showLines: !!ui.layers.lines,
      fogKey,
    };
  }

  ctx.drawImage(ui._staticLayer.canvas, 0, 0);

  if (ui.layers.trail && trail.length > 0) {
    const trailStyle = styles.trail || {
      stroke: "rgba(125,211,252,0.55)",
      lineWidth: 1,
    };
    const color = trailStyle.stroke || "rgba(125,211,252,0.55)";
    const baseW = (trailStyle.lineWidth || 1) / zoom;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = baseW;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      if (!started) {
        ctx.moveTo(p[0], p[1]);
        started = true;
      } else {
        ctx.lineTo(p[0], p[1]);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (ui.layers.rings) {
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      const style = styles[ring[3]] || {};
      ctx.beginPath();
      ctx.strokeStyle = style.stroke || "rgba(148,163,184,0.35)";
      ctx.lineWidth = (style.lineWidth || 0.75) / zoom;
      ctx.globalAlpha = style.alpha != null ? style.alpha : 0.55;
      ctx.setLineDash(style.dash || [2, 4]);
      ctx.arc(ring[0], ring[1], ring[2], 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }
  if (ui.layers.markers) {
    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i];
      const styleKey = marker[2];
      const label = marker[3];
      const x = marker[0];
      const y = marker[1];
      const hp = marker[4];
      const style = styles[styleKey] || {};
      const shape = style.shape || "cross";
      const fill = style.fill || style.stroke || "#ffffff";
      const stroke = style.stroke || fill;
      const hovered = ui.hover && ui.hover.index === i;
      const sc = hovered ? 1.75 : 1.25;
      if (shape === "dot") {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(x + 0.5, y + 0.5, 1.6 * sc, 0, Math.PI * 2);
        ctx.fill();
      } else if (shape === "ring") {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = (style.lineWidth || 1.25) / zoom;
        ctx.beginPath();
        ctx.arc(x + 0.5, y + 0.5, 4 * sc, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = fill;
        ctx.fillRect(x - 1.5 * sc, y, 4 * sc, sc);
        ctx.fillRect(x, y - 1.5 * sc, sc, 4 * sc);
        ctx.beginPath();
        ctx.arc(x + sc * 0.5, y + sc * 0.5, 1.1 * sc, 0, Math.PI * 2);
        ctx.fill();
      }
      if (typeof hp === "number") {
        const bw = 10;
        const bh = 2;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(x - bw / 2, y - 6, bw, bh);
        ctx.fillStyle = hp > 0.4 ? "#22c55e" : hp > 0.15 ? "#eab308" : "#ef4444";
        ctx.fillRect(x - bw / 2, y - 6, bw * Math.max(0, Math.min(1, hp)), bh);
      }
      if ((ui.showLabels || hovered) && label) {
        let text = String(label);
        if (text.length > 12) text = text.slice(0, 11) + "…";
        const fontSize = Math.max(7, Math.min(10, logicalW / 24)) / zoom;
        ctx.font =
          fontSize +
          'px "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.lineWidth = 2.5 / zoom;
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.strokeText(text, x + 4, y - 3);
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText(text, x + 4, y - 3);
      }
    }
  }
};

BotUi.prototype.update = function (data) {
  this.data = data;
  this.render();
};

BotUi.prototype.updateProperty = function (name, value) {
  if (!this.data) this.data = {};
  if (value === undefined) {
    delete this.data[name];
  } else {
    this.data[name] = value;
  }
  this.render([name]);
};

/**
 * Apply multiple field patches and render once.
 * @param {Object<string, *>} changes
 */
BotUi.prototype.updateProperties = function (changes) {
  if (!this.data) this.data = {};
  const names = Object.keys(changes);
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const value = changes[name];
    if (value === undefined) {
      delete this.data[name];
    } else {
      this.data[name] = value;
    }
  }
  this.render(names);
};

// https://stackoverflow.com/a/74456486
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
