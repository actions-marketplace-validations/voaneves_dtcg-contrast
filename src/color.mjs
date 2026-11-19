/**
 * Zero-dependency color parser, converter, and gamut mapper for W3C DTCG 2025.10 & CSS colors.
 * Internal canonical representation: `{ r, g, b, a }` in normalized sRGB [0, 1].
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Convert an sRGB channel [0, 1] to linear-light sRGB.
 * @param {number} c
 * @returns {number}
 */
export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Convert a linear-light sRGB channel to sRGB [0, 1].
 * @param {number} c
 * @returns {number}
 */
export function linearToSrgb(c) {
  if (c <= 0) return 0;
  if (c >= 1) return 1;
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function linearOklchToLinearSrgb(l, c, hDeg) {
  const rad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  return {
    r: +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  };
}

/**
 * Check whether linear sRGB channels sit inside the [0, 1] sRGB gamut.
 * @param {{ r: number, g: number, b: number }} lin
 * @returns {boolean}
 */
export function inSrgbGamut(lin) {
  const eps = 1e-6;
  return (
    lin.r >= -eps &&
    lin.r <= 1 + eps &&
    lin.g >= -eps &&
    lin.g <= 1 + eps &&
    lin.b >= -eps &&
    lin.b <= 1 + eps
  );
}

/**
 * Convert sRGB `{ r, g, b, a }` to OKLCH `{ l, c, h, a }` (Bjorn Ottosson Oklab).
 * @param {{ r: number, g: number, b: number, a?: number }} color
 * @returns {{ l: number, c: number, h: number, a: number }}
 */
export function srgbToOklch({ r, g, b, a = 1 }) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const C = Math.hypot(A, B);
  const h = C < 1e-6 ? 0 : (((Math.atan2(B, A) * 180) / Math.PI) + 360) % 360;
  return { l: clamp01(L), c: C, h, a };
}

/**
 * Convert OKLCH `{ l, c, h, a }` to sRGB `{ r, g, b, a }` (clamped; see `oklchToSrgbGamutMapped`).
 * @param {{ l: number, c: number, h: number, a?: number }} oklch
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
export function oklchToSrgb({ l, c, h, a = 1 }) {
  const lin = linearOklchToLinearSrgb(l, c, h);
  return {
    r: clamp01(linearToSrgb(lin.r)),
    g: clamp01(linearToSrgb(lin.g)),
    b: clamp01(linearToSrgb(lin.b)),
    a: clamp01(a),
  };
}

/**
 * Convert OKLCH to sRGB while preserving L and H by binary-searching chroma inside the sRGB gamut.
 * @param {{ l: number, c: number, h: number, a?: number }} oklch
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
export function oklchToSrgbGamutMapped({ l, c, h, a = 1 }) {
  const alpha = clamp01(a);
  if (l <= 0) return { r: 0, g: 0, b: 0, a: alpha };
  if (l >= 1) return { r: 1, g: 1, b: 1, a: alpha };

  const targetC = Math.max(0, c);
  const raw = linearOklchToLinearSrgb(l, targetC, h);
  if (inSrgbGamut(raw)) {
    return {
      r: clamp01(linearToSrgb(raw.r)),
      g: clamp01(linearToSrgb(raw.g)),
      b: clamp01(linearToSrgb(raw.b)),
      a: alpha,
    };
  }

  let lo = 0;
  let hi = targetC;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) * 0.5;
    if (inSrgbGamut(linearOklchToLinearSrgb(l, mid, h))) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const mapped = linearOklchToLinearSrgb(l, lo, h);
  return {
    r: clamp01(linearToSrgb(mapped.r)),
    g: clamp01(linearToSrgb(mapped.g)),
    b: clamp01(linearToSrgb(mapped.b)),
    a: alpha,
  };
}

/**
 * Convert Display P3 `[r, g, b]` in [0, 1] to gamut-clamped sRGB.
 * @param {[number, number, number]} components
 * @param {number} [a=1]
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
export function displayP3ToSrgb([r, g, b], a = 1) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const X = 0.4865709486482162 * lr + 0.26566769316909306 * lg + 0.1982172852343625 * lb;
  const Y = 0.2289745640697488 * lr + 0.6917385218365064 * lg + 0.079286914093745 * lb;
  const Z = 0.04511338185890264 * lg + 1.043944368900976 * lb;

  const sr = 3.2404541621141054 * X - 1.5371385127977166 * Y - 0.4985314095560162 * Z;
  const sg = -0.9692660305051868 * X + 1.8760108454466942 * Y + 0.0415560175303499 * Z;
  const sb = 0.05564343095911469 * X - 0.20402591351675387 * Y + 1.0572251882231791 * Z;

  return {
    r: clamp01(linearToSrgb(sr)),
    g: clamp01(linearToSrgb(sg)),
    b: clamp01(linearToSrgb(sb)),
    a: clamp01(a),
  };
}

function hslToSrgb(hDeg, s, l, a = 1) {
  const h = ((hDeg % 360) + 360) % 360;
  const sat = clamp01(s);
  const lig = clamp01(l);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return { r: clamp01(r1 + m), g: clamp01(g1 + m), b: clamp01(b1 + m), a: clamp01(a) };
}

function parseHex(str) {
  const hex = str.slice(1).trim();
  if (![3, 4, 6, 8].includes(hex.length) || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error(`Invalid hex color: "${str}"`);
  }
  const exp =
    hex.length <= 4 ? [...hex].map((ch) => ch + ch).join('') : hex;
  const n = (i) => parseInt(exp.slice(i, i + 2), 16) / 255;
  return {
    r: n(0),
    g: n(2),
    b: n(4),
    a: exp.length === 8 ? n(6) : 1,
  };
}

function parseCssNumber(tok, { percentBase = 1 } = {}) {
  const t = tok.trim().toLowerCase();
  if (t === 'none') return 0;
  if (t.endsWith('%')) {
    const v = Number(t.slice(0, -1));
    if (Number.isNaN(v)) throw new Error(`Invalid percentage: "${tok}"`);
    return (v / 100) * percentBase;
  }
  const v = Number(t);
  if (Number.isNaN(v)) throw new Error(`Invalid number: "${tok}"`);
  return v;
}

function parseAngle(tok) {
  const t = tok.trim().toLowerCase();
  if (t === 'none') return 0;
  const m = t.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/i);
  if (!m) throw new Error(`Invalid angle: "${tok}"`);
  const val = Number(m[1]);
  switch (m[2]) {
    case 'rad':
      return (val * 180) / Math.PI;
    case 'grad':
      return val * 0.9;
    case 'turn':
      return val * 360;
    default:
      return val;
  }
}

function splitCssArgs(body) {
  const [colorPart, alphaPart] = body.split('/').map((s) => s.trim());
  const parts = colorPart.includes(',')
    ? colorPart.split(',').map((s) => s.trim())
    : colorPart.trim().split(/\s+/);
  return { parts, alphaPart };
}

function parseCssFunction(str) {
  const m = str.trim().match(/^([a-z]+)\(([^)]+)\)$/i);
  if (!m) throw new Error(`Invalid CSS color: "${str}"`);
  const fn = m[1].toLowerCase();
  const { parts, alphaPart } = splitCssArgs(m[2]);

  if (fn === 'rgb' || fn === 'rgba') {
    if (parts.length < 3 || parts.length > 4) {
      throw new Error(`Invalid ${fn}() arguments: "${str}"`);
    }
    const chan = (tok) =>
      tok.trim().endsWith('%')
        ? clamp01(parseCssNumber(tok, { percentBase: 1 }))
        : clamp01(parseCssNumber(tok) / 255);
    const alphaRaw = alphaPart ?? parts[3];
    const a = alphaRaw !== undefined ? clamp01(parseCssNumber(alphaRaw, { percentBase: 1 })) : 1;
    return { r: chan(parts[0]), g: chan(parts[1]), b: chan(parts[2]), a };
  }

  if (fn === 'hsl' || fn === 'hsla') {
    if (parts.length < 3 || parts.length > 4) {
      throw new Error(`Invalid ${fn}() arguments: "${str}"`);
    }
    const h = parseAngle(parts[0]);
    const s = parseCssNumber(parts[1], { percentBase: 100 }) / 100;
    const l = parseCssNumber(parts[2], { percentBase: 100 }) / 100;
    const alphaRaw = alphaPart ?? parts[3];
    const a = alphaRaw !== undefined ? clamp01(parseCssNumber(alphaRaw, { percentBase: 1 })) : 1;
    return hslToSrgb(h, s, l, a);
  }

  if (fn === 'oklch') {
    if (parts.length !== 3) {
      throw new Error(`Invalid oklch() arguments: "${str}"`);
    }
    const l = clamp01(parseCssNumber(parts[0], { percentBase: 1 }));
    const c = Math.max(0, parseCssNumber(parts[1], { percentBase: 0.4 }));
    const h = ((parseAngle(parts[2]) % 360) + 360) % 360;
    const a = alphaPart !== undefined ? clamp01(parseCssNumber(alphaPart, { percentBase: 1 })) : 1;
    return oklchToSrgbGamutMapped({ l, c, h, a });
  }

  if (fn === 'color') {
    if (parts.length !== 4) {
      throw new Error(`Invalid color() arguments: "${str}"`);
    }
    const space = parts[0].toLowerCase();
    const nums = parts.slice(1, 4).map((tok) => clamp01(parseCssNumber(tok, { percentBase: 1 })));
    const a = alphaPart !== undefined ? clamp01(parseCssNumber(alphaPart, { percentBase: 1 })) : 1;
    if (space === 'srgb') {
      return { r: nums[0], g: nums[1], b: nums[2], a };
    }
    if (space === 'display-p3') {
      return displayP3ToSrgb(nums, a);
    }
    throw new Error(`Unsupported color() space "${space}": "${str}"`);
  }

  throw new Error(`Unsupported color function: "${str}"`);
}

function parseDtcgColorObject(obj) {
  const space = typeof obj.colorSpace === 'string' ? obj.colorSpace.toLowerCase() : null;
  const alpha = obj.alpha === undefined ? 1 : clamp01(Number(obj.alpha));
  if (Number.isNaN(alpha)) {
    throw new Error(`Invalid DTCG color alpha: ${obj.alpha}`);
  }

  if (Array.isArray(obj.components) && obj.components.length >= 3 && space) {
    const nums = obj.components.slice(0, 3).map((v) => (v === 'none' ? 0 : Number(v)));
    if (nums.every((v) => Number.isFinite(v))) {
      if (space === 'srgb') {
        return { r: clamp01(nums[0]), g: clamp01(nums[1]), b: clamp01(nums[2]), a: alpha };
      }
      if (space === 'oklch') {
        const h = ((nums[2] % 360) + 360) % 360;
        return oklchToSrgbGamutMapped({ l: clamp01(nums[0]), c: Math.max(0, nums[1]), h, a: alpha });
      }
      if (space === 'hsl') {
        return hslToSrgb(nums[0], nums[1] / 100, nums[2] / 100, alpha);
      }
      if (space === 'display-p3') {
        return displayP3ToSrgb(nums, alpha);
      }
    }
  }

  if (typeof obj.hex === 'string') {
    const parsed = parseHex(obj.hex);
    return { ...parsed, a: obj.alpha === undefined ? parsed.a : alpha };
  }

  throw new Error(
    `Unsupported DTCG color object${space ? ` (colorSpace: "${space}")` : ''}`
  );
}

/**
 * Parse a W3C DTCG 2025.10 color object, hex string, CSS color function, or normalized `{ r, g, b, a }`.
 * @param {string | Record<string, unknown>} input
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
export function parseColor(input) {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('#')) return parseHex(trimmed);
    if (trimmed.includes('(')) return parseCssFunction(trimmed);
    throw new Error(`Unsupported color string: "${input}"`);
  }

  if (input && typeof input === 'object') {
    if (
      typeof input.r === 'number' &&
      typeof input.g === 'number' &&
      typeof input.b === 'number'
    ) {
      return {
        r: clamp01(input.r),
        g: clamp01(input.g),
        b: clamp01(input.b),
        a: input.a === undefined ? 1 : clamp01(input.a),
      };
    }
    return parseDtcgColorObject(input);
  }

  throw new Error(`Invalid color input of type ${typeof input}`);
}

/**
 * Alpha-composite `fg` over `bg` using Porter-Duff source-over in sRGB.
 * @param {{ r: number, g: number, b: number, a: number }} fg
 * @param {{ r: number, g: number, b: number, a: number }} bg
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
export function alphaOver(fg, bg) {
  const fa = fg.a ?? 1;
  const ba = bg.a ?? 1;
  if (fa >= 1) return { r: fg.r, g: fg.g, b: fg.b, a: 1 };
  const outA = fa + ba * (1 - fa);
  if (outA <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (fg.r * fa + bg.r * ba * (1 - fa)) / outA,
    g: (fg.g * fa + bg.g * ba * (1 - fa)) / outA,
    b: (fg.b * fa + bg.b * ba * (1 - fa)) / outA,
    a: outA,
  };
}

/**
 * Format `{ r, g, b, a }` as lowercase `#rrggbb` (or `#rrggbbaa` when `a < 1`).
 * @param {{ r: number, g: number, b: number, a?: number }} color
 * @returns {string}
 */
export function formatHex({ r, g, b, a = 1 }) {
  const byte = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  const base = `#${byte(r)}${byte(g)}${byte(b)}`;
  return a < 0.999 ? `${base}${byte(a)}` : base;
}

/**
 * Format `{ l, c, h, a }` or `{ r, g, b, a }` as a CSS `oklch(...)` string.
 * @param {{ l?: number, c?: number, h?: number, r?: number, g?: number, b?: number, a?: number }} color
 * @returns {string}
 */
export function formatOklch(color) {
  const ok = typeof color.l === 'number' ? color : srgbToOklch(color);
  const lStr = ok.l.toFixed(3);
  const cStr = ok.c.toFixed(3);
  const hStr = ok.h.toFixed(1);
  return (ok.a ?? 1) < 0.999
    ? `oklch(${lStr} ${cStr} ${hStr} / ${Number(ok.a.toFixed(3))})`
    : `oklch(${lStr} ${cStr} ${hStr})`;
}
