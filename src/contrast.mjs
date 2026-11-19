import {
  alphaOver,
  formatHex,
  formatOklch,
  oklchToSrgbGamutMapped,
  parseColor,
  srgbToLinear,
  srgbToOklch,
} from './color.mjs';

/** WCAG 2.2 minimum contrast ratio thresholds by conformance level. */
export const WCAG_THRESHOLDS = Object.freeze({
  AA: 4.5,
  'AA-large': 3.0,
  UI: 3.0,
  AAA: 7.0,
  'AAA-large': 4.5,
});

/**
 * Compute WCAG 2.x relative luminance for an sRGB color in [0, 1].
 * @param {{ r: number, g: number, b: number }} color
 * @returns {number}
 */
export function relativeLuminance({ r, g, b }) {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

/**
 * Compute WCAG 2.2 contrast ratio between foreground and background (1..21).
 * Composites semi-transparent foreground over background automatically.
 * @param {string | Record<string, unknown>} fgInput
 * @param {string | Record<string, unknown>} bgInput
 * @returns {number}
 */
export function wcagContrast(fgInput, bgInput) {
  const bg = parseColor(bgInput);
  const fg = alphaOver(parseColor(fgInput), bg);
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function apcaLuminance({ r, g, b }) {
  const y = 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
  return y < 0.022 ? y + (0.022 - y) ** 1.414 : y;
}

/**
 * Compute APCA-W3 (0.0.98G-4g) lightness contrast Lc (-108..+106).
 * Positive Lc = dark text on light background; negative Lc = light text on dark background.
 * @param {string | Record<string, unknown>} fgInput
 * @param {string | Record<string, unknown>} bgInput
 * @returns {number}
 */
export function apcaContrast(fgInput, bgInput) {
  const bg = parseColor(bgInput);
  const fg = alphaOver(parseColor(fgInput), bg);
  const yTxt = apcaLuminance(fg);
  const yBg = apcaLuminance(bg);

  if (Math.abs(yBg - yTxt) < 0.0005) return 0;

  if (yBg > yTxt) {
    const sapc = (yBg ** 0.56 - yTxt ** 0.57) * 1.14;
    return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
  }

  const sapc = (yBg ** 0.65 - yTxt ** 0.62) * 1.14;
  return sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
}

/**
 * Return the highest WCAG 2.2 grade satisfied by a contrast ratio.
 * @param {number} ratio
 * @returns {'AAA' | 'AA' | 'AA-large' | 'FAIL'}
 */
export function classifyWcag(ratio) {
  if (ratio >= 7.0) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3.0) return 'AA-large';
  return 'FAIL';
}

function passes(fg, bg, minWcag, minApca) {
  const wcag = wcagContrast(fg, bg);
  const apca = apcaContrast(fg, bg);
  return {
    ok: wcag >= minWcag && Math.abs(apca) >= minApca,
    wcag,
    apca,
  };
}

/**
 * Suggest the closest accessible color by shifting only OKLCH lightness L
 * (preserving hue H and chroma C, gamut-mapped into sRGB and quantized to 8-bit hex).
 * Returns `null` if no lightness in [0, 1] can satisfy the requested thresholds.
 *
 * @param {string | Record<string, unknown>} fgInput
 * @param {string | Record<string, unknown>} bgInput
 * @param {{ minWcag?: number, minApca?: number }} [options]
 * @returns {{ color: { r: number, g: number, b: number, a: number }, hex: string, oklch: string, wcag: number, apca: number, deltaL: number } | null}
 */
export function suggestAccessibleColor(fgInput, bgInput, options = {}) {
  const { minWcag = WCAG_THRESHOLDS.AA, minApca = 0 } = options;
  const fg = parseColor(fgInput);
  const bg = parseColor(bgInput);
  const orig = srgbToOklch(fg);

  const buildQuantized = (lVal) => {
    const mapped = oklchToSrgbGamutMapped({ l: lVal, c: orig.c, h: orig.h, a: fg.a });
    const hex = formatHex(mapped);
    const quantized = parseColor(hex);
    const check = passes(quantized, bg, minWcag, minApca);
    return { mapped, quantized, hex, ...check };
  };

  const initial = passes(parseColor(formatHex(fg)), bg, minWcag, minApca);
  if (initial.ok) {
    const hex = formatHex(fg);
    return {
      color: fg,
      hex,
      oklch: formatOklch(orig),
      wcag: initial.wcag,
      apca: initial.apca,
      deltaL: 0,
    };
  }

  const candidates = [];

  for (const dir of [-1, 1]) {
    const limitL = dir < 0 ? 0 : 1;
    if (!buildQuantized(limitL).ok) continue;

    // Binary search between orig.l (fail) and limitL (pass)
    let failL = orig.l;
    let passL = limitL;
    for (let i = 0; i < 24; i += 1) {
      const mid = (failL + passL) * 0.5;
      const srgb = oklchToSrgbGamutMapped({ l: mid, c: orig.c, h: orig.h, a: fg.a });
      if (passes(srgb, bg, minWcag, minApca).ok) {
        passL = mid;
      } else {
        failL = mid;
      }
    }

    // Step away from orig.l in fine increments if 8-bit hex quantization dipped just below threshold
    let best = buildQuantized(passL);
    let stepL = passL;
    for (let step = 0; step < 60 && !best.ok; step += 1) {
      stepL = Math.max(0, Math.min(1, stepL + dir * 0.002));
      best = buildQuantized(stepL);
    }

    if (best.ok) {
      const qOklch = srgbToOklch(best.quantized);
      candidates.push({
        color: best.quantized,
        hex: best.hex,
        oklch: formatOklch(qOklch),
        wcag: best.wcag,
        apca: best.apca,
        deltaL: qOklch.l - orig.l,
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => Math.abs(a.deltaL) - Math.abs(b.deltaL));
  return candidates[0];
}
