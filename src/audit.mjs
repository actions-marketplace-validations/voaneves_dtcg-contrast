import {
  WCAG_THRESHOLDS,
  apcaContrast,
  classifyWcag,
  suggestAccessibleColor,
  wcagContrast,
} from './contrast.mjs';
import { extractColorTokens } from './tokens.mjs';

const REF_PREFIX_RE = /^(ref|primitive|primitives|palette|base)\./i;
const BG_NAME_RE = /(^|[.-])(surface|bg|background|canvas|paper)([.-]|$)/i;
const FG_NAME_RE = /(^|[.-])(text|fg|foreground|label|icon|link|border|line-strong|focus|signal-ink)([.-]|$)/i;
const FALLBACK_FG_RE = /(^|[.-])ink([.-]|$)/i;
const UI_LEVEL_RE = /(^|[.-])(border|line|focus|icon|stroke|ring|outline)([.-]|$)/i;
const ON_TAG_RE = /-on-([a-z0-9-]+)$/i;
const SPECIAL_BG_RE = /(^|[.-])(inverse|signal|brand|accent|danger|success|warning)([.-]|$)/i;

/**
 * Heuristically discover sensible foreground/background token pairs for zero-config audits.
 * Semantic tokens are prioritized over primitive/reference tokens when present.
 *
 * @param {Map<string, any>} tokenMap
 * @param {{ level?: string, minApca?: number }} [options]
 * @returns {Array<{ fg: string, bg: string, level: string, minApca?: number }>}
 */
export function discoverPairs(tokenMap, options = {}) {
  const { level: defaultLevel, minApca } = options;
  const allNames = [...tokenMap.keys()];
  const semanticNames = allNames.filter((n) => !REF_PREFIX_RE.test(n));
  const pool = semanticNames.length > 0 ? semanticNames : allNames;

  const bgs = pool.filter((n) => BG_NAME_RE.test(n) && !ON_TAG_RE.test(n));
  let fgs = pool.filter((n) => FG_NAME_RE.test(n) && !BG_NAME_RE.test(n));
  if (fgs.length === 0) {
    fgs = pool.filter((n) => FALLBACK_FG_RE.test(n) && !BG_NAME_RE.test(n));
  }

  const hasOnScopedFgs = fgs.some((n) => ON_TAG_RE.test(n));
  const pairs = [];

  for (const fg of fgs) {
    const onMatch = fg.match(ON_TAG_RE);
    const fgTargetTag = onMatch ? onMatch[1].toLowerCase() : null;

    for (const bg of bgs) {
      if (fgTargetTag) {
        if (!bg.toLowerCase().includes(fgTargetTag)) continue;
      } else if (hasOnScopedFgs && SPECIAL_BG_RE.test(bg)) {
        continue;
      }

      const level = defaultLevel ?? (UI_LEVEL_RE.test(fg) ? 'UI' : 'AA');
      const pair = { fg, bg, level };
      if (minApca !== undefined) pair.minApca = minApca;
      pairs.push(pair);
    }
  }

  return pairs;
}

/**
 * Evaluate foreground/background pairs across one or more themes.
 * Computes WCAG 2.2 ratio, APCA Lc, pass/fail status, and OKLCH auto-fix suggestions.
 *
 * @param {{
 *   tokenTree?: Record<string, any>,
 *   tokenTrees?: Record<string, any> | Record<string, Record<string, any>>,
 *   themes?: Array<{ name: string, extensionPath?: string, overlayPaths?: string[], overlayTree?: Record<string, any> }>,
 *   pairs?: Array<{ fg: string, bg: string, level?: string, minWcag?: number, minApca?: number, themes?: string[], name?: string, ignore?: boolean }>,
 *   auto?: boolean,
 *   level?: string,
 *   minApca?: number
 * }} params
 */
export function evaluatePairs({
  tokenTree,
  tokenTrees,
  themes,
  pairs,
  auto = false,
  level = 'AA',
  minApca: globalMinApca = 0,
}) {
  const resolvedThemes =
    Array.isArray(themes) && themes.length > 0 ? themes : [{ name: 'default' }];

  const getTreeForTheme = (themeName) => {
    if (tokenTree) return tokenTree;
    if (tokenTrees && themeName in tokenTrees && !('$value' in tokenTrees)) {
      const candidate = tokenTrees[themeName];
      if (candidate && typeof candidate === 'object') return candidate;
    }
    if (tokenTrees) return tokenTrees;
    throw new Error('Either tokenTree or tokenTrees must be provided.');
  };

  const themeMaps = new Map();
  for (const theme of resolvedThemes) {
    const baseTree = getTreeForTheme(theme.name);
    themeMaps.set(
      theme.name,
      extractColorTokens(baseTree, {
        extensionPath: theme.extensionPath,
        overlayPaths: theme.overlayPaths,
        overlayTree: theme.overlayTree,
      })
    );
  }

  const activePairs =
    !pairs || pairs.length === 0 || auto
      ? discoverPairs(themeMaps.get(resolvedThemes[0].name), {
          level: auto && level ? level : undefined,
          minApca: globalMinApca || undefined,
        })
      : pairs;

  const results = [];

  for (const theme of resolvedThemes) {
    const tokenMap = themeMaps.get(theme.name);

    for (const pair of activePairs) {
      if (pair.ignore) continue;
      if (Array.isArray(pair.themes) && !pair.themes.includes(theme.name)) continue;

      const fgToken = tokenMap.get(pair.fg);
      if (!fgToken) {
        throw new Error(
          `Foreground token "${pair.fg}" not found in theme "${theme.name}".`
        );
      }
      const bgToken = tokenMap.get(pair.bg);
      if (!bgToken) {
        throw new Error(
          `Background token "${pair.bg}" not found in theme "${theme.name}".`
        );
      }

      const pairLevel = pair.level ?? level ?? 'AA';
      const requiredWcag =
        pair.minWcag ?? WCAG_THRESHOLDS[pairLevel] ?? WCAG_THRESHOLDS.AA;
      const requiredApca = pair.minApca ?? globalMinApca ?? 0;

      const wcag = wcagContrast(fgToken.color, bgToken.color);
      const apca = apcaContrast(fgToken.color, bgToken.color);
      const wcagGrade = classifyWcag(wcag);
      const passed = wcag >= requiredWcag && Math.abs(apca) >= requiredApca;

      const suggestion = passed
        ? null
        : suggestAccessibleColor(fgToken.color, bgToken.color, {
            minWcag: requiredWcag,
            minApca: requiredApca,
          });

      results.push({
        theme: theme.name,
        name: pair.name ?? `${pair.fg} on ${pair.bg}`,
        fg: pair.fg,
        bg: pair.bg,
        fgHex: fgToken.hex,
        bgHex: bgToken.hex,
        level: pairLevel,
        requiredWcag,
        requiredApca,
        wcag: Number(wcag.toFixed(2)),
        apca: Number(apca.toFixed(1)),
        wcagGrade,
        passed,
        suggestion: suggestion
          ? {
              hex: suggestion.hex,
              oklch: suggestion.oklch,
              wcag: Number(suggestion.wcag.toFixed(2)),
              apca: Number(suggestion.apca.toFixed(1)),
              deltaL: Number(suggestion.deltaL.toFixed(3)),
            }
          : null,
      });
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  return {
    summary: {
      total: results.length,
      passed: passedCount,
      failed: results.length - passedCount,
      themes: resolvedThemes.map((t) => t.name),
    },
    results,
  };
}
