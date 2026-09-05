/**
 * Wall-clock-safe countdown helpers shared by BWI demo + caracAL.
 *
 * Game/stat beats sample a remaining `ms`. Between samples (or when a demo
 * loop fires faster than 1:1), subtract elapsed wall time from that sample
 * instead of inventing a per-tick decrement — otherwise timers can run
 * faster than real time.
 */

/**
 * Remaining ms after wall time since the sample.
 * @param {number} msAtSample remaining duration recorded at sample time
 * @param {number} [sampledAt] Date.now() (or equivalent) when msAtSample was taken
 * @param {number} [now]
 * @returns {number}
 */
function remainingMs(msAtSample, sampledAt, now) {
  const ms = Number(msAtSample);
  if (!Number.isFinite(ms)) return 0;
  if (typeof sampledAt !== "number" || !Number.isFinite(sampledAt)) {
    return Math.max(0, ms);
  }
  const t = typeof now === "number" && Number.isFinite(now) ? now : Date.now();
  return Math.max(0, ms - (t - sampledAt));
}

/**
 * @param {number} duration ms
 * @returns {string} compact countdown; drops leading zero hours/minutes
 */
function msToTime(duration) {
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

/**
 * Age label for a last beat / sample timestamp.
 * Fresh beats stay blank (the common case); only call out staleness.
 * @param {number} sampledAt
 * @param {number} [now]
 * @param {{ staleAfterSec?: number }} [opts]
 * @returns {string} e.g. "", "stale 3s"
 */
function formatBeatAge(sampledAt, now, opts) {
  if (typeof sampledAt !== "number" || !Number.isFinite(sampledAt)) {
    return "stale ?";
  }
  const t = typeof now === "number" && Number.isFinite(now) ? now : Date.now();
  const ageSec = Math.max(0, Math.floor((t - sampledAt) / 1000));
  const staleAfter =
    opts && typeof opts.staleAfterSec === "number" ? opts.staleAfterSec : 2;
  if (ageSec < staleAfter) return "";
  return "stale " + ageSec + "s";
}

/**
 * Build a BWI timerList row from a sampled remaining duration.
 * `endsAt` lets the browser tick between beats without waiting for the next publish.
 * Optional `skin` / `icon` shows an atlas crop on the timer bar (buffs/debuffs).
 * @param {{ name: string, ms: number, ims: number, rightText?: string, sampledAt?: number, now?: number, skin?: string, icon?: object, buff?: boolean, debuff?: boolean }} opts
 */
function timerPresentation(opts) {
  const now =
    typeof opts.now === "number" && Number.isFinite(opts.now)
      ? opts.now
      : Date.now();
  const left = remainingMs(opts.ms, opts.sampledAt, now);
  const ims = Number(opts.ims) > 0 ? Number(opts.ims) : 1;
  const row = {
    leftText: opts.name,
    middleText: msToTime(left),
    rightText: opts.rightText != null ? opts.rightText : "",
    percentage: (left / ims) * 100,
    ms: left,
    ims,
    endsAt: now + left,
  };
  if (opts.skin) row.skin = opts.skin;
  if (opts.icon) row.icon = opts.icon;
  if (opts.buff) row.buff = true;
  if (opts.debuff) row.debuff = true;
  return row;
}

module.exports = {
  remainingMs,
  msToTime,
  formatBeatAge,
  timerPresentation,
};
