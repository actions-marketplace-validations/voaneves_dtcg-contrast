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

/**
 * Load and deep-merge one or more W3C DTCG JSON token files or directories.
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
    merged = deepMerge(merged, parsed);
  }
  return merged;
}

function getAtExtensionPath(node, extensionPath) {
  if (!extensionPath || !isPlainObject(node.$extensions)) return undefined;
  let cur = node.$extensions;
  for (const seg of extensionPath.split('.')) {
    if (!isPlainObject(cur) && typeof cur !== 'object') return undefined;
    if (cur === null || !(seg in cur)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

function collectTokenNodes(obj, prefix, inheritedType, extensionPath, nodes) {
  const groupType = typeof obj.$type === 'string' ? obj.$type : inheritedType;

  for (const [key, child] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    if (!isPlainObject(child)) continue;

    const tokenPath = prefix ? `${prefix}.${key}` : key;
    const isToken = Object.prototype.hasOwnProperty.call(child, '$value');

    if (isToken) {
      const ownType = typeof child.$type === 'string' ? child.$type : groupType;
      const overrideVal = getAtExtensionPath(child, extensionPath);
      const effectiveValue = overrideVal !== undefined ? overrideVal : child.$value;
      nodes.set(tokenPath, {
        name: tokenPath,
        type: ownType,
        value: effectiveValue,
        description: typeof child.$description === 'string' ? child.$description : '',
      });
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
      const target = match[1].trim();
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

/**
 * Extract and resolve all color tokens from a merged W3C DTCG token tree.
 * Supports group `$type` inheritance, multi-hop `{alias}` references, and theme overrides
 * via `$extensions` path (e.g. `"vn.dark"`) and/or `overlayPaths` / `overlayTree`.
 *
 * @param {Record<string, any>} tree
 * @param {{ extensionPath?: string, overlayPaths?: string | string[], overlayTree?: Record<string, any> }} [options]
 * @returns {Map<string, { name: string, raw: any, hex: string, resolvedFrom: string[], color: { r: number, g: number, b: number, a: number }, description: string }>}
 */
export function extractColorTokens(tree, options = {}) {
  const { extensionPath, overlayPaths, overlayTree } = options;

  let effectiveTree = tree;
  if (overlayPaths && overlayPaths.length > 0) {
    effectiveTree = deepMerge(effectiveTree, loadTokenSources(overlayPaths));
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
    });
  }

  return colors;
}
