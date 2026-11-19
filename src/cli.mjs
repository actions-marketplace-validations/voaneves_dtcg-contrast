import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { evaluatePairs } from './audit.mjs';
import { WCAG_THRESHOLDS } from './contrast.mjs';
import { formatHtml, formatJson, formatMarkdown, formatPretty } from './reporters.mjs';
import { loadTokenSources } from './tokens.mjs';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const HELP_TEXT = `dtcg-contrast v${pkg.version}
WCAG 2.2 & APCA contrast gate and OKLCH auto-fixer for W3C DTCG 2025.10 tokens.

Usage:
  dtcg-contrast [paths...] [options]

Options:
  -c, --config <file>     Config JSON file (auto-loads ./dtcg-contrast.config.json if present)
  -f, --format <fmt>      Output format: pretty | markdown | json | html (default: pretty)
  -o, --output <file>     Write formatted report to a file
      --level <level>     Default WCAG threshold: AA | AA-large | AAA | AAA-large | UI (default: AA)
      --min-apca <num>    Minimum APCA |Lc| score (e.g. 60)
      --mode <name:path>  Add theme via DTCG $extensions path (repeatable, e.g. dark:vn.dark)
      --no-fail           Exit with code 0 even when pairs fail
      --no-color          Disable ANSI terminal colors
  -h, --help              Show this help message
  -v, --version           Print version number
`;

function parseArgs(argv) {
  const opts = {
    paths: [],
    config: null,
    format: 'pretty',
    output: null,
    level: undefined,
    minApca: 0,
    modes: [],
    noFail: false,
    color: !process.env.NO_COLOR,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return argv[i];
    };

    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '-v' || arg === '--version') opts.version = true;
    else if (arg === '-c' || arg === '--config') opts.config = next();
    else if (arg === '-f' || arg === '--format') opts.format = next();
    else if (arg === '-o' || arg === '--output') opts.output = next();
    else if (arg === '--level') opts.level = next();
    else if (arg === '--min-apca') opts.minApca = Number(next());
    else if (arg === '--mode') opts.modes.push(next());
    else if (arg === '--no-fail') opts.noFail = true;
    else if (arg === '--no-color') opts.color = false;
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else opts.paths.push(arg);
  }

  return opts;
}

function resolveConfig(configPath) {
  const abs = path.resolve(configPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
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
    default:
      throw new Error(`Unsupported format "${format}". Choose: pretty, markdown, json, html.`);
  }
}

/**
 * Execute the CLI and return exit code (0 pass, 1 contrast failure, 2 usage/runtime error).
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
export async function runCli(argv = process.argv.slice(2)) {
  try {
    const opts = parseArgs(argv);
    if (opts.help) {
      process.stdout.write(HELP_TEXT);
      return 0;
    }
    if (opts.version) {
      process.stdout.write(`${pkg.version}\n`);
      return 0;
    }
    if (opts.level !== undefined && !(opts.level in WCAG_THRESHOLDS)) {
      throw new Error(
        `Invalid --level "${opts.level}". Choose: ${Object.keys(WCAG_THRESHOLDS).join(', ')}.`
      );
    }
    if (!Number.isFinite(opts.minApca) || opts.minApca < 0) {
      throw new Error(`Invalid --min-apca value.`);
    }

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

    const report = evaluatePairs({
      tokenTree,
      themes,
      pairs: cfg?.pairs,
      auto: cfg?.auto || !cfg?.pairs,
      level: cfg?.level ?? opts.level,
      minApca: cfg?.minApca ?? opts.minApca,
    });

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

    if (report.summary.failed > 0 && !opts.noFail) return 1;
    return 0;
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    return 2;
  }
}
