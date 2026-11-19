import fs from 'node:fs';
import path from 'node:path';
import { formatHex, parseColor } from './color.mjs';

const IGNORED_FILES = new Set([
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'dtcg-contrast.config.json',
]);

const ALIAS_RE = /^\{([^{}]+)\}$/;
const COLOR_FN_RE = /^(rgb|rgba|hsl|hsla|oklch|color)\(/i;
const SOURCE_MAP = Symbol.for('dtcg-contrast.sourceMap');

function isPlainObject(val) {
  return Boolean(val) && typeof val === 'object' && !Array.isArray(val);
}

/**
 * Deep-merge `source` onto `target` without mutating inputs.
 * Arrays and `$value` payloads replace rather than merge recursively.
 * @param {Record<string, any>} target
 * @param {Record<string, any>} source
 * @returns {Record<string, any>}
 */
export function deepMerge(target, source) {
  const out = { ...target };
  for (const [key, val] of Object.entries(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    if (key !== '$value' && isPlainObject(val) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function collectJsonFiles(entryPath, out = []) {
  const resolved = path.resolve(entryPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Token path does not exist: ${entryPath}`);
  }
  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    if (resolved.toLowerCase().endsWith('.json')) {
      out.push(resolved);
    }
    return out;
  }
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(resolved, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const child = path.join(resolved, entry.name);
      if (entry.isDirectory()) {
        collectJsonFiles(child, out);
      } else if (
        entry.isFile() &&
        entry.name.toLowerCase().endsWith('.json') &&
        !IGNORED_FILES.has(entry.name) &&
        !entry.name.endsWith('.config.json')
      ) {
        out.push(child);
      }
    }
  }
  return out;
}

function recordFileSources(obj, prefix, relPath, sourceMap) {
  if (
    prefix &&
    isPlainObject(obj.$root) &&
    Object.prototype.hasOwnProperty.call(obj.$root, '$value')
  ) {
    sourceMap.set(prefix, relPath);
  }
  for (const [key, child] of Object.entries(obj)) {
    if (key.startsWith('$') || !isPlainObject(child)) continue;
    const tokenPath = prefix ? `${prefix}.${key}` : key;
    if (Object.prototype.hasOwnProperty.call(child, '$value')) {
      sourceMap.set(tokenPath, relPath);
    } else {
      recordFileSources(child, tokenPath, relPath, sourceMap);
    }
  }
}

function toPosixRelative(file) {
  const rel = path.relative(process.cwd(), file);
  const chosen = rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : file;
  return chosen.split(path.sep).join('/');
}

/**
 * Load and deep-merge one or more W3C DTCG JSON token files or directories.
 * Attaches a non-enumerable source-file map for SARIF / diagnostic reporting.
 * @param {string | string[]} paths
 * @returns {Record<string, any>}
 */
export function loadTokenSources(paths) {
  const list = Array.isArray(paths) ? paths : [paths];
  if (list.length === 0) {
    throw new Error('At least one token file or directory path is required.');
  }

  const files = [];
  for (const p of list) {
    collectJsonFiles(p, files);
  }
  if (files.length === 0) {
    throw new Error(`No DTCG .json token files found in: ${list.join(', ')}`);
  }

  let merged = {};
  const sourceMap = new Map();
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Invalid JSON in token file "${file}": ${err.message}`);
    }
    if (!isPlainObject(parsed)) {
      throw new Error(`Token file "${file}" must export a JSON object.`);
    }
    recordFileSources(parsed, '', toPosixRelative(file), sourceMap);
    merged = deepMerge(merged, parsed);
  }

  Object.defineProperty(merged, SOURCE_MAP, {
    value: sourceMap,
    enumerable: false,
    configurable: true,
  });
  return merged;
}

function lookupExtensionSegments(obj, segments, idx) {
  if (!isPlainObject(obj)) return undefined;
  for (let end = segments.length; end > idx; end -= 1) {
    const key = segments.slice(idx, end).join('.');
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (end === segments.length) return obj[key];
      const deeper = lookupExtensionSegments(obj[key], segments, end);
      if (deeper !== undefined) return deeper;
    }
  }
  return undefined;
}

function getAtExtensionPath(node, extensionPath) {
  if (!extensionPath || !isPlainObject(node.$extensions)) return undefined;
  return lookupExtensionSegments(node.$extensions, extensionPath.split('.'), 0);
}

function makeNode(name, rawNode, type, extensionPath) {
  const overrideVal = getAtExtensionPath(rawNode, extensionPath);
  const effectiveValue = overrideVal !== undefined ? overrideVal : rawNode.$value;
  return {
    name,
    type,
    value: effectiveValue,
    deprecated: Boolean(rawNode.$deprecated),
    description: typeof rawNode.$description === 'string' ? rawNode.$description : '',
  };
}

function collectTokenNodes(obj, prefix, inheritedType, extensionPath, nodes) {
  const groupType = typeof obj.$type === 'string' ? obj.$type : inheritedType;

  if (
    prefix &&
    isPlainObject(obj.$root) &&
    Object.prototype.hasOwnProperty.call(obj.$root, '$value')
  ) {
    const rootType = typeof obj.$root.$type === 'string' ? obj.$root.$type : groupType;
    nodes.set(prefix, makeNode(prefix, obj.$root, rootType, extensionPath));
  }

  for (const [key, child] of Object.entries(obj)) {
    if (key.startsWith('$') || !isPlainObject(child)) continue;

    const tokenPath = prefix ? `${prefix}.${key}` : key;
    if (Object.prototype.hasOwnProperty.call(child, '$value')) {
      const ownType = typeof child.$type === 'string' ? child.$type : groupType;
      nodes.set(tokenPath, makeNode(tokenPath, child, ownType, extensionPath));
      continue;
    }

    collectTokenNodes(child, tokenPath, groupType, extensionPath, nodes);
  }
}

function resolveNodeValue(name, nodes, stack) {
  const node = nodes.get(name);
  if (!node) {
    throw new Error(`Token "${name}" was not found.`);
  }

  if (typeof node.value === 'string') {
    const match = node.value.trim().match(ALIAS_RE);
    if (match) {
      let target = match[1].trim();
      if (!nodes.has(target) && target.endsWith('.$root')) {
        const stripped = target.slice(0, -6);
        if (nodes.has(stripped)) target = stripped;
      }
      if (stack.includes(target)) {
        throw new Error(`Circular token alias detected: ${[...stack, target].join(' -> ')}`);
      }
      if (!nodes.has(target)) {
        throw new Error(`Missing alias target "{${target}}" referenced by "${name}".`);
      }
      const resolved = resolveNodeValue(target, nodes, [...stack, target]);
      return {
        raw: resolved.raw,
        resolvedFrom: [target, ...resolved.resolvedFrom],
        targetType: resolved.targetType ?? nodes.get(target).type,
      };
    }
  }

  return { raw: node.value, resolvedFrom: [], targetType: node.type };
}

function isColorOverrideValue(val) {
  if (typeof val === 'string') {
    const t = val.trim();
    return ALIAS_RE.test(t) || t.startsWith('#') || COLOR_FN_RE.test(t);
  }
  return isPlainObject(val) && (typeof val.colorSpace === 'string' || typeof val.hex === 'string');
}

function walkExtensions(extObj, prefix, found) {
  if (!isPlainObject(extObj)) return;
  for (const [key, val] of Object.entries(extObj)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (isColorOverrideValue(val)) {
      found.add(nextPath);
    } else if (isPlainObject(val)) {
      walkExtensions(val, nextPath, found);
    }
  }
}

/**
 * Scan a DTCG token tree and return unique `$extensions` paths containing color/alias overrides.
 * Useful for auto-detecting themes (e.g. `['vn.dark']` or `['com.figma.modes.dark']`).
 * @param {Record<string, any>} tree
 * @returns {string[]}
 */
export function detectExtensionPaths(tree) {
  const found = new Set();

  function walkTree(obj) {
    if (!isPlainObject(obj)) return;
    if (isPlainObject(obj.$root) && isPlainObject(obj.$root.$extensions)) {
      walkExtensions(obj.$root.$extensions, '', found);
    }
    for (const [key, child] of Object.entries(obj)) {
      if (key.startsWith('$') || !isPlainObject(child)) continue;
      if (Object.prototype.hasOwnProperty.call(child, '$value')) {
        if (isPlainObject(child.$extensions)) {
          walkExtensions(child.$extensions, '', found);
        }
      } else {
        walkTree(child);
      }
    }
  }

  walkTree(tree);
  return [...found].sort();
}

/**
 * Extract and resolve all color tokens from a merged W3C DTCG token tree.
 * Supports group `$type` inheritance, `$root` group tokens, multi-hop `{alias}` references,
 * `$deprecated`, source tracking, and `$extensions` / overlay theme overrides.
 *
 * @param {Record<string, any>} tree
 * @param {{ extensionPath?: string, overlayPaths?: string | string[], overlayTree?: Record<string, any> }} [options]
 * @returns {Map<string, { name: string, raw: any, hex: string, resolvedFrom: string[], color: { r: number, g: number, b: number, a: number }, description: string, deprecated: boolean, sourceFile: string | null }>}
 */
export function extractColorTokens(tree, options = {}) {
  const { extensionPath, overlayPaths, overlayTree } = options;

  let effectiveTree = tree;
  const sourceMap = new Map(tree?.[SOURCE_MAP] ?? []);

  if (overlayPaths && overlayPaths.length > 0) {
    const overlay = loadTokenSources(overlayPaths);
    for (const [k, v] of overlay[SOURCE_MAP] ?? []) {
      sourceMap.set(k, v);
    }
    effectiveTree = deepMerge(effectiveTree, overlay);
  }
  if (overlayTree) {
    effectiveTree = deepMerge(effectiveTree, overlayTree);
  }

  const nodes = new Map();
  collectTokenNodes(effectiveTree, '', undefined, extensionPath, nodes);

  const colors = new Map();
  for (const [name, node] of nodes.entries()) {
    if (node.type && node.type !== 'color') continue;

    const { raw, resolvedFrom, targetType } = resolveNodeValue(name, nodes, [name]);
    const isColor =
      node.type === 'color' ||
      targetType === 'color' ||
      (isPlainObject(raw) && (typeof raw.colorSpace === 'string' || typeof raw.hex === 'string'));

    if (!isColor) continue;

    let color;
    try {
      color = parseColor(raw);
    } catch (err) {
      throw new Error(`Failed to parse color token "${name}": ${err.message}`);
    }

    colors.set(name, {
      name,
      raw,
      hex: formatHex(color),
      resolvedFrom,
      color,
      description: node.description,
      deprecated: node.deprecated,
      sourceFile: sourceMap.get(name) ?? null,
    });
  }

  return colors;
}
