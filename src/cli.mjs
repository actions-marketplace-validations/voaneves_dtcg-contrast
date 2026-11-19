import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { discoverPairs, evaluatePairs } from './audit.mjs';
import { formatHex, parseColor } from './color.mjs';
import {
  WCAG_THRESHOLDS,
  apcaContrast,
  classifyWcag,
  suggestAccessibleColor,
  wcagContrast,
} from './contrast.mjs';
import { applyFixes, planFixes } from './fixer.mjs';
import {
  formatHtml,
  formatJson,
  formatMarkdown,
  formatPretty,
  formatSarif,
} from './reporters.mjs';
import {
  detectExtensionPaths,
  extractColorTokens,
  loadTokenSources,
} from './tokens.mjs';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const HELP_TEXT = `dtcg-contrast v${pkg.version}
WCAG 2.2 & APCA contrast gate and OKLCH auto-fixer for W3C DTCG 2025.10 tokens.

Usage:
  dtcg-contrast [paths...] [options]
  dtcg-contrast check <fg> <bg> [options]
  dtcg-contrast init <paths...> [-o dtcg-contrast.config.json] [--force]

Options:
  -c, --config <file>     Config JSON file (auto-loads ./dtcg-contrast.config.json if present)
  -f, --format <fmt>      Output format: pretty | markdown | json | html | sarif (default: pretty)
  -o, --output <file>     Write formatted report or config to a file
      --level <level>     Default WCAG threshold: AA | AA-large | AAA | AAA-large | UI (default: AA)
      --min-apca <num>    Minimum APCA |Lc| score (e.g. 60)
      --mode <name:path>  Add theme via DTCG $extensions path (repeatable, e.g. dark:vn.dark)
      --fix               Write hue-preserving OKLCH fixes back to failing foreground tokens
      --dry-run           Preview --fix changes without modifying files
      --force             Overwrite existing file on init
      --no-fail           Exit with code 0 even when pairs fail
      --no-color          Disable ANSI terminal colors
  -h, --help              Show this help message
  -v, --version           Print version number
`;

function parseArgs(argv) {
  const VALUE_FLAGS = new Set([
    '-c',
    '--config',
    '-f',
    '--format',
    '-o',
    '--output',
    '--level',
    '--min-apca',
    '--mode',
  ]);
  const normalized = [];
  for (const rawArg of argv) {
    const eq = rawArg.indexOf('=');
    if (rawArg.startsWith('-') && eq > 0) {
      const flag = rawArg.slice(0, eq);
      if (VALUE_FLAGS.has(flag)) {
        normalized.push(flag, rawArg.slice(eq + 1));
        continue;
      }
    }
    normalized.push(rawArg);
  }

  const opts = {
    paths: [],
    config: null,
    format: 'pretty',
    output: null,
    level: undefined,
    minApca: 0,
    modes: [],
    fix: false,
    dryRun: false,
    force: false,
    noFail: false,
    color: !process.env.NO_COLOR,
    help: false,
    version: false,
  };

  for (let i = 0; i < normalized.length; i += 1) {
    const arg = normalized[i];
    const next = () => {
      if (i + 1 >= normalized.length) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return normalized[i];
    };

    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '-v' || arg === '--version') opts.version = true;
    else if (arg === '-c' || arg === '--config') opts.config = next();
    else if (arg === '-f' || arg === '--format') opts.format = next();
    else if (arg === '-o' || arg === '--output') opts.output = next();
    else if (arg === '--level') opts.level = next();
    else if (arg === '--min-apca') opts.minApca = Number(next());
    else if (arg === '--mode') opts.modes.push(next());
    else if (arg === '--fix') opts.fix = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--no-fail') opts.noFail = true;
    else if (arg === '--no-color') opts.color = false;
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else opts.paths.push(arg);
  }

  return opts;
}

function validateCommonOpts(opts) {
  if (opts.level !== undefined && !(opts.level in WCAG_THRESHOLDS)) {
    throw new Error(
      `Invalid --level "${opts.level}". Choose: ${Object.keys(WCAG_THRESHOLDS).join(', ')}.`
    );
  }
  if (!Number.isFinite(opts.minApca) || opts.minApca < 0) {
    throw new Error('Invalid --min-apca value.');
  }
}

function resolveConfig(configPath) {
  const abs = path.resolve(configPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, ''));
  const baseDir = path.dirname(abs);
  const rel = (p) => path.resolve(baseDir, p);

  const tokens = Array.isArray(raw.tokens)
    ? raw.tokens.map(rel)
    : typeof raw.tokens === 'string'
      ? [rel(raw.tokens)]
      : null;

  const themes = Array.isArray(raw.themes)
    ? raw.themes.map((t) => ({
        ...t,
        overlayPaths: Array.isArray(t.overlayPaths) ? t.overlayPaths.map(rel) : undefined,
      }))
    : undefined;

  return {
    tokens,
    themes,
    pairs: Array.isArray(raw.pairs) ? raw.pairs : undefined,
    auto: Boolean(raw.auto),
    level: raw.level,
    minApca: raw.minApca,
  };
}

function buildThemesFromModes(modes) {
  if (!modes || modes.length === 0) return [{ name: 'default' }];
  const parsed = modes.map((entry) => {
    const idx = entry.indexOf(':');
    if (idx <= 0) {
      throw new Error(`Invalid --mode "${entry}". Expected <name>:<extensionPath>, e.g. dark:vn.dark`);
    }
    return {
      name: entry.slice(0, idx),
      extensionPath: entry.slice(idx + 1) || undefined,
    };
  });
  if (!parsed.some((t) => !t.extensionPath)) {
    parsed.unshift({ name: 'light' });
  }
  return parsed;
}

function formatReport(report, format, color) {
  switch (format) {
    case 'pretty':
      return formatPretty(report, { color });
    case 'markdown':
    case 'md':
      return formatMarkdown(report);
    case 'json':
      return formatJson(report);
    case 'html':
      return formatHtml(report);
    case 'sarif':
      return formatSarif(report);
    default:
      throw new Error(
        `Unsupported format "${format}". Choose: pretty, markdown, json, html, sarif.`
      );
  }
}

function emitReport(report, opts) {
  const rendered = formatReport(
    report,
    opts.format,
    opts.color && Boolean(process.stdout.isTTY)
  );
  if (opts.output) {
    const outPath = path.resolve(opts.output);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, rendered, 'utf8');
    process.stdout.write(
      `Wrote ${opts.format} report to ${opts.output} (${report.summary.passed}/${report.summary.total} passed)\n`
    );
  } else {
    process.stdout.write(rendered);
  }
  return report.summary.failed > 0 && !opts.noFail ? 1 : 0;
}

function runCheck(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  validateCommonOpts(opts);
  if (opts.paths.length !== 2) {
    throw new Error('Expected two color arguments: dtcg-contrast check <fg> <bg>');
  }

  const [fgRaw, bgRaw] = opts.paths;
  const fgColor = parseColor(fgRaw);
  const bgColor = parseColor(bgRaw);
  const pairLevel = opts.level ?? 'AA';
  const requiredWcag = WCAG_THRESHOLDS[pairLevel];
  const requiredApca = opts.minApca ?? 0;

  const wcag = wcagContrast(fgColor, bgColor);
  const apca = apcaContrast(fgColor, bgColor);
  const passed = wcag >= requiredWcag && Math.abs(apca) >= requiredApca;
  const suggestion = passed
    ? null
    : suggestAccessibleColor(fgColor, bgColor, {
        minWcag: requiredWcag,
        minApca: requiredApca,
      });

  const report = {
    summary: {
      total: 1,
      passed: passed ? 1 : 0,
      failed: passed ? 0 : 1,
      themes: ['inline'],
    },
    results: [
      {
        theme: 'inline',
        name: `${fgRaw} on ${bgRaw}`,
        fg: fgRaw,
        bg: bgRaw,
        fgHex: formatHex(fgColor),
        bgHex: formatHex(bgColor),
        fgSource: null,
        bgSource: null,
        fgDeprecated: false,
        bgDeprecated: false,
        level: pairLevel,
        requiredWcag,
        requiredApca,
        wcag: Number(wcag.toFixed(2)),
        apca: Number(apca.toFixed(1)),
        wcagGrade: classifyWcag(wcag),
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
      },
    ],
  };

  return emitReport(report, opts);
}

export function formatConfigTokenPath(baseDir, tokenPath, pathImpl = path) {
  const absTarget = pathImpl.resolve(tokenPath);
  const rel = pathImpl.relative(baseDir, absTarget);
  if (!rel) return '.';
  if (pathImpl.isAbsolute(rel)) return absTarget.split(pathImpl.sep).join('/');
  const posixRel = rel.split(pathImpl.sep).join('/');
  return posixRel.startsWith('.') ? posixRel : `./${posixRel}`;
}

function runInit(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  validateCommonOpts(opts);
  if (opts.paths.length === 0) {
    throw new Error('Provide token path(s), e.g.: dtcg-contrast init ./tokens');
  }

  const outFile = opts.output || 'dtcg-contrast.config.json';
  const outPath = path.resolve(outFile);
  if (fs.existsSync(outPath) && !opts.force) {
    throw new Error(`Config file already exists: ${outFile}. Pass --force to overwrite.`);
  }

  const tree = loadTokenSources(opts.paths);
  const extPaths = detectExtensionPaths(tree);

  const usedNames = new Set(['light']);
  const themes =
    extPaths.length > 0
      ? [
          { name: 'light' },
          ...extPaths.map((ext) => {
            const base = ext.split('.').pop() || ext;
            let name = base;
            let n = 2;
            while (usedNames.has(name)) {
              name = `${base}-${n}`;
              n += 1;
            }
            usedNames.add(name);
            return { name, extensionPath: ext };
          }),
        ]
      : [{ name: 'default' }];

  const baseTokens = extractColorTokens(tree);
  const pairs = discoverPairs(baseTokens, {
    level: opts.level,
    minApca: opts.minApca || undefined,
  });

  const baseDir = path.dirname(outPath);
  const tokens = opts.paths.map((p) => formatConfigTokenPath(baseDir, p));

  const config = {
    $schema: 'https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/dtcg-contrast.schema.json',
    tokens,
    themes,
    ...(opts.level ? { level: opts.level } : {}),
    ...(opts.minApca > 0 ? { minApca: opts.minApca } : {}),
    pairs,
  };

  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  process.stdout.write(
    `Created ${outFile} (${themes.length} theme(s), ${pairs.length} pair(s))\n`
  );
  return 0;
}

/**
 * Execute the CLI and return exit code (0 pass, 1 contrast failure, 2 usage/runtime error).
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
export async function runCli(argv = process.argv.slice(2)) {
  try {
    if (argv[0] === 'check') return runCheck(argv.slice(1));
    if (argv[0] === 'init') return runInit(argv.slice(1));

    const opts = parseArgs(argv);
    if (opts.help) {
      process.stdout.write(HELP_TEXT);
      return 0;
    }
    if (opts.version) {
      process.stdout.write(`${pkg.version}\n`);
      return 0;
    }
    validateCommonOpts(opts);

    const defaultCfg = path.resolve('dtcg-contrast.config.json');
    const configPath =
      opts.config ?? (opts.paths.length === 0 && fs.existsSync(defaultCfg) ? defaultCfg : null);

    const cfg = configPath ? resolveConfig(configPath) : null;
    const tokenInputs = opts.paths.length > 0 ? opts.paths : cfg?.tokens;
    if (!tokenInputs || tokenInputs.length === 0) {
      process.stderr.write('Error: Provide token path(s) or --config <file>. Run with --help for usage.\n');
      return 2;
    }

    const tokenTree = loadTokenSources(tokenInputs);
    const themes =
      opts.modes.length > 0
        ? buildThemesFromModes(opts.modes)
        : cfg?.themes ?? [{ name: 'default' }];

    const evalOpts = {
      pairs: cfg?.pairs,
      auto: cfg?.auto || !cfg?.pairs,
      level: cfg?.level ?? opts.level,
      minApca: cfg?.minApca ?? opts.minApca,
    };

    let report = evaluatePairs({ tokenTree, themes, ...evalOpts });

    if (opts.fix && report.summary.failed > 0) {
      const { edits, skipped } = planFixes({ report, tokenTree, themes });
      const { applied } = applyFixes(edits, { dryRun: opts.dryRun });
      const logStream =
        opts.format === 'pretty' || Boolean(opts.output) ? process.stdout : process.stderr;
      const prefix = opts.dryRun ? '[dry-run] ' : '';

      for (const edit of applied) {
        const aliasNote = edit.unlinkedAlias ? ' [unlinked alias]' : '';
        const modeNote = edit.extensionPath ? ` ($extensions.${edit.extensionPath})` : '';
        logStream.write(
          `${prefix}Fixed ${edit.uri} -> ${edit.token}${modeNote}: ${edit.oldHex} -> ${edit.newHex} (${edit.wcagBefore.toFixed(2)}:1 -> ${edit.wcagAfter.toFixed(2)}:1)${aliasNote}\n`
        );
      }
      for (const s of skipped) {
        logStream.write(`${prefix}Skipped ${s.theme} ${s.token}: ${s.reason}\n`);
      }

      if (opts.dryRun) {
        if (opts.format !== 'pretty' || opts.output) {
          emitReport(report, opts);
        }
        return opts.noFail ? 0 : 1;
      }

      const freshTree = loadTokenSources(tokenInputs);
      report = evaluatePairs({ tokenTree: freshTree, themes, ...evalOpts });
      logStream.write(
        `Re-verified: ${report.summary.passed}/${report.summary.total} pairs passing\n`
      );
    }

    return emitReport(report, opts);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    return 2;
  }
}
