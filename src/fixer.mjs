import fs from 'node:fs';
import { parseColor, srgbToOklch } from './color.mjs';
import { apcaContrast, wcagContrast } from './contrast.mjs';
import { extractColorTokens } from './tokens.mjs';

const round4 = (n) => Number(n.toFixed(4));

function formatReplacementValue(raw, hex, oklchStr) {
  const color = parseColor(hex);
  const alphaProps = color.a < 0.999 ? { alpha: round4(color.a) } : {};

  if (raw && typeof raw === 'object') {
    if (String(raw.colorSpace).toLowerCase() === 'oklch') {
      const ok = srgbToOklch(color);
      return {
        colorSpace: 'oklch',
        components: [round4(ok.l), round4(ok.c), Number(ok.h.toFixed(1))],
        ...alphaProps,
        hex,
      };
    }
    return {
      colorSpace: 'srgb',
      components: [round4(color.r), round4(color.g), round4(color.b)],
      ...alphaProps,
      hex,
    };
  }

  if (typeof raw === 'string' && raw.trim().toLowerCase().startsWith('oklch(')) {
    return oklchStr;
  }

  return hex;
}

function chooseGroupCandidate(rows) {
  const candidates = rows
    .filter((r) => r.suggestion !== null)
    .sort((a, b) => Math.abs(b.suggestion.deltaL) - Math.abs(a.suggestion.deltaL));

  for (const cand of candidates) {
    const fgColor = parseColor(cand.suggestion.hex);
    const passesAll = rows.every(
      (row) =>
        wcagContrast(fgColor, row.bgHex) >= row.requiredWcag &&
        Math.abs(apcaContrast(fgColor, row.bgHex)) >= row.requiredApca
    );
    if (passesAll) return cand;
  }
  return null;
}

/**
 * Plan safe, deterministic OKLCH lightness fixes for failing foreground tokens without
 * mutating shared reference/primitive tokens.
 *
 * @param {{
 *   report: import('../types/index.d.ts').AuditReport,
 *   tokenTree: Record<string, any>,
 *   themes?: import('../types/index.d.ts').ThemeConfig[]
 * }} params
 * @returns {{ edits: Array<any>, skipped: Array<{ theme: string, token: string, reason: string }> }}
 */
export function planFixes({ report, tokenTree, themes }) {
  const resolvedThemes =
    Array.isArray(themes) && themes.length > 0 ? themes : [{ name: 'default' }];
  const themeByName = new Map(resolvedThemes.map((t) => [t.name, t]));

  const tokenMaps = new Map();
  for (const theme of resolvedThemes) {
    tokenMaps.set(
      theme.name,
      extractColorTokens(tokenTree, {
        extensionPath: theme.extensionPath,
        overlayPaths: theme.overlayPaths,
        overlayTree: theme.overlayTree,
      })
    );
  }

  const groupedFailures = new Map();
  for (const r of report.results) {
    if (r.passed) continue;
    const key = `${r.theme}\u0000${r.fg}`;
    if (!groupedFailures.has(key)) groupedFailures.set(key, []);
    groupedFailures.get(key).push(r);
  }

  const edits = [];
  const skipped = [];

  for (const rows of groupedFailures.values()) {
    const first = rows[0];
    const themeObj = themeByName.get(first.theme);
    const fgToken = tokenMaps.get(first.theme)?.get(first.fg);
    const absPath = fgToken?.sourceLocation?.absPath;

    if (!absPath) {
      skipped.push({
        theme: first.theme,
        token: first.fg,
        reason: 'No writable source file path',
      });
      continue;
    }

    const chosen = chooseGroupCandidate(rows);
    if (!chosen) {
      skipped.push({
        theme: first.theme,
        token: first.fg,
        reason: 'No single OKLCH lightness satisfies all failing backgrounds',
      });
      continue;
    }

    edits.push({
      file: absPath,
      uri: fgToken.sourceLocation.uri,
      theme: first.theme,
      token: first.fg,
      extensionPath: themeObj?.extensionPath ?? null,
      oldHex: first.fgHex,
      newHex: chosen.suggestion.hex,
      newOklch: chosen.suggestion.oklch,
      replacementValue: formatReplacementValue(
        fgToken.raw,
        chosen.suggestion.hex,
        chosen.suggestion.oklch
      ),
      unlinkedAlias: Boolean(fgToken.resolvedFrom?.length),
      wcagBefore: first.wcag,
      wcagAfter: chosen.suggestion.wcag,
    });
  }

  return { edits, skipped };
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function findTokenTarget(doc, tokenPath) {
  let cur = doc;
  for (const seg of tokenPath.split('.')) {
    if (UNSAFE_KEYS.has(seg)) return null;
    if (!cur || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, seg)) {
      return null;
    }
    cur = cur[seg];
  }
  if (!cur || typeof cur !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(cur, '$root') && !Object.prototype.hasOwnProperty.call(cur, '$value')) {
    return cur.$root && typeof cur.$root === 'object' ? cur.$root : null;
  }
  return cur;
}

function setAtExtensionPath(node, extPath, value) {
  if (!node.$extensions || typeof node.$extensions !== 'object') {
    node.$extensions = {};
  }
  const segments = extPath.split('.');
  let cur = node.$extensions;
  let idx = 0;

  while (idx < segments.length) {
    let matchedKey = null;
    let matchedEnd = idx;
    for (let end = segments.length; end > idx; end -= 1) {
      const candidate = segments.slice(idx, end).join('.');
      if (!UNSAFE_KEYS.has(candidate) && Object.prototype.hasOwnProperty.call(cur, candidate)) {
        matchedKey = candidate;
        matchedEnd = end;
        break;
      }
    }

    const key = matchedKey ?? segments[idx];
    if (UNSAFE_KEYS.has(key)) {
      throw new Error(`Unsafe extension key "${key}" in extensionPath "${extPath}".`);
    }
    const nextIdx = matchedKey ? matchedEnd : idx + 1;

    if (nextIdx === segments.length) {
      cur[key] = value;
      return;
    }

    if (!cur[key] || typeof cur[key] !== 'object') {
      cur[key] = {};
    }
    cur = cur[key];
    idx = nextIdx;
  }
}

/**
 * Apply planned OKLCH edits to DTCG JSON token files (or simulate with `dryRun: true`).
 * @param {Array<any>} edits
 * @param {{ dryRun?: boolean }} [options]
 * @returns {{ applied: Array<any>, filesModified: string[], dryRun: boolean }}
 */
export function applyFixes(edits, options = {}) {
  const { dryRun = false } = options;
  const byFile = new Map();

  for (const edit of edits) {
    if (!byFile.has(edit.file)) byFile.set(edit.file, []);
    byFile.get(edit.file).push(edit);
  }

  const filesModified = [];

  for (const [file, fileEdits] of byFile.entries()) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

    for (const edit of fileEdits) {
      const target = findTokenTarget(doc, edit.token);
      if (!target) {
        throw new Error(`Could not locate token "${edit.token}" in "${file}".`);
      }
      if (edit.extensionPath) {
        setAtExtensionPath(target, edit.extensionPath, edit.replacementValue);
      } else {
        target.$value = edit.replacementValue;
      }
    }

    if (!dryRun) {
      fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n', 'utf8');
      filesModified.push(file);
    }
  }

  return { applied: edits, filesModified, dryRun };
}
