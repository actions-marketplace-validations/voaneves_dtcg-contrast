import { createRequire } from 'node:module';
import { alphaOver, formatHex, parseColor } from './color.mjs';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

function hexToRgbTuple(hex, fallbackBgHex) {
  let c = parseColor(hex);
  if (c.a < 1 && fallbackBgHex) {
    c = alphaOver(c, parseColor(fallbackBgHex));
  }
  return [
    Math.round(c.r * 255),
    Math.round(c.g * 255),
    Math.round(c.b * 255),
  ];
}

function ansiSwatch(fgHex, bgHex) {
  const [fr, fg, fb] = hexToRgbTuple(fgHex, bgHex);
  const [br, bg, bb] = hexToRgbTuple(bgHex);
  return `\x1b[48;2;${br};${bg};${bb}m\x1b[38;2;${fr};${fg};${fb}m Aa ${RESET}`;
}

function pad(str, len) {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

/**
 * Format an audit report for terminal display with optional 24-bit ANSI color swatches.
 * @param {import('../types/index.d.ts').AuditReport} report
 * @param {{ color?: boolean }} [options]
 * @returns {string}
 */
export function formatPretty(report, options = {}) {
  const useColor =
    options.color !== undefined
      ? Boolean(options.color)
      : Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

  const paint = (code, text) => (useColor ? `${code}${text}${RESET}` : text);
  const lines = [];
  const { summary, results } = report;

  const statusText =
    summary.failed === 0
      ? paint(`${BOLD}${GREEN}`, 'PASS')
      : paint(`${BOLD}${RED}`, 'FAIL');

  lines.push(
    `${paint(BOLD, 'dtcg-contrast')} ${statusText} — ${summary.passed}/${summary.total} pairs passed across ${summary.themes.length} theme(s)`
  );
  lines.push('');

  if (results.length === 0) {
    lines.push(paint(YELLOW, 'No foreground/background token pairs were evaluated.'));
    return lines.join('\n');
  }

  const byTheme = new Map();
  for (const r of results) {
    if (!byTheme.has(r.theme)) byTheme.set(r.theme, []);
    byTheme.get(r.theme).push(r);
  }

  for (const [theme, rows] of byTheme.entries()) {
    lines.push(paint(`${BOLD}${CYAN}`, `Theme: ${theme}`));
    const nameWidth = Math.max(24, ...rows.map((r) => `${r.fg} on ${r.bg}`.length)) + 2;

    for (const r of rows) {
      const swatch = useColor ? `${ansiSwatch(r.fgHex, r.bgHex)} ` : '';
      const pairLabel = pad(`${r.fg} on ${r.bg}`, nameWidth);
      const ratioStr = pad(`${r.wcag.toFixed(2)}:1`, 8);
      const apcaStr = pad(`Lc ${r.apca >= 0 ? '+' : ''}${r.apca.toFixed(1)}`, 10);
      const reqStr = pad(`${r.level} >=${r.requiredWcag}`, 10);
      const badge = r.passed
        ? paint(GREEN, `PASS (${r.wcagGrade})`)
        : paint(RED, `FAIL (${r.wcagGrade})`);

      lines.push(`  ${swatch}${pairLabel}${ratioStr}${apcaStr}${reqStr}${badge}`);
      if (!r.passed) {
        if (r.suggestion) {
          const fixSwatch = useColor ? `${ansiSwatch(r.suggestion.hex, r.bgHex)} ` : '';
          const delta = `${r.suggestion.deltaL >= 0 ? '+' : ''}${r.suggestion.deltaL.toFixed(3)}`;
          lines.push(
            `      ${paint(YELLOW, '↳ Suggested OKLCH fix:')} ${fixSwatch}${paint(BOLD, r.suggestion.hex)} (${r.suggestion.oklch}, ΔL ${delta}) -> ${r.suggestion.wcag.toFixed(2)}:1 / Lc ${r.suggestion.apca.toFixed(1)}`
          );
        } else {
          lines.push(
            `      ${paint(YELLOW, '↳ No sRGB lightness meets threshold (check foreground alpha or contrast target).')}`
          );
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

/**
 * Format an audit report as GitHub-flavored Markdown (ideal for `$GITHUB_STEP_SUMMARY` or PR comments).
 * @param {import('../types/index.d.ts').AuditReport} report
 * @returns {string}
 */
export function formatMarkdown(report) {
  const { summary, results } = report;
  const failures = results.filter((r) => !r.passed);
  const passes = results.filter((r) => r.passed);
  const icon = summary.failed === 0 ? '✅' : '❌';
  const lines = [
    `## ${icon} DTCG Contrast Audit — ${summary.failed === 0 ? 'Passed' : `${summary.failed} Failed`}`,
    '',
    '| Metric | Value |',
    '| :--- | :--- |',
    `| **Themes** | ${summary.themes.map((t) => `\`${t}\``).join(', ')} |`,
    `| **Passed** | ${summary.passed} / ${summary.total} |`,
    `| **Failed** | ${summary.failed} |`,
    '',
  ];

  if (failures.length > 0) {
    lines.push('### ❌ Failures & OKLCH Auto-Fix Suggestions', '');
    lines.push('| Theme | Pair | Colors | WCAG 2.2 | APCA Lc | Required | Suggested OKLCH Fix |');
    lines.push('| :--- | :--- | :--- | ---: | ---: | :--- | :--- |');
    for (const r of failures) {
      const fixCell = r.suggestion
        ? `\`${r.suggestion.hex}\` (\`${r.suggestion.oklch}\`) → **${r.suggestion.wcag.toFixed(2)}:1**`
        : '_No lightness match_';
      lines.push(
        `| \`${r.theme}\` | \`${r.fg}\` on \`${r.bg}\` | \`${r.fgHex}\` / \`${r.bgHex}\` | **${r.wcag.toFixed(2)}:1** (${r.wcagGrade}) | ${r.apca.toFixed(1)} | ${r.level} (≥${r.requiredWcag}) | ${fixCell} |`
      );
    }
    lines.push('');
  }

  if (passes.length > 0) {
    lines.push(`<details${failures.length === 0 ? ' open' : ''}>`);
    lines.push(`<summary>✅ Passing pairs (${passes.length})</summary>`, '');
    lines.push('| Theme | Pair | Colors | WCAG 2.2 | APCA Lc | Level |');
    lines.push('| :--- | :--- | :--- | ---: | ---: | :--- |');
    for (const r of passes) {
      lines.push(
        `| \`${r.theme}\` | \`${r.fg}\` on \`${r.bg}\` | \`${r.fgHex}\` / \`${r.bgHex}\` | ${r.wcag.toFixed(2)}:1 (${r.wcagGrade}) | ${r.apca.toFixed(1)} | ${r.level} (≥${r.requiredWcag}) |`
      );
    }
    lines.push('', '</details>', '');
  }

  lines.push(
    '<sub>Generated by <a href="https://github.com/voaneves/dtcg-contrast">dtcg-contrast</a> — WCAG 2.2 &amp; APCA gate for W3C DTCG tokens.</sub>',
    ''
  );
  return lines.join('\n');
}

/**
 * Format an audit report as formatted JSON.
 * @param {import('../types/index.d.ts').AuditReport} report
 * @returns {string}
 */
export function formatJson(report) {
  return JSON.stringify(report, null, 2) + '\n';
}

/**
 * Format an audit report as SARIF 2.1.0 for GitHub Code Scanning / PR annotations.
 * @param {import('../types/index.d.ts').AuditReport} report
 * @returns {string}
 */
export function formatSarif(report) {
  const sarifResults = report.results
    .filter((r) => !r.passed)
    .map((r) => {
      const ruleId =
        r.wcag < r.requiredWcag ? 'dtcg-wcag-contrast' : 'dtcg-apca-contrast';
      const fixText = r.suggestion
        ? ` Suggested OKLCH fix: ${r.suggestion.hex} (${r.suggestion.oklch}) -> ${r.suggestion.wcag.toFixed(2)}:1.`
        : '';
      const loc = r.fgLocation;
      const uri = loc?.uri || r.fgSource || r.bgSource || 'tokens.json';

      return {
        ruleId,
        level: 'error',
        message: {
          text: `[${r.theme}] ${r.fg} (${r.fgHex}) on ${r.bg} (${r.bgHex}) failed ${r.level}: WCAG ${r.wcag.toFixed(2)}:1 (requires >=${r.requiredWcag}:1), APCA Lc ${r.apca.toFixed(1)}.${fixText}`,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri },
              ...(loc?.startLine
                ? {
                    region: {
                      startLine: loc.startLine,
                      startColumn: loc.startColumn,
                    },
                  }
                : {}),
            },
          },
        ],
      };
    });

  return (
    JSON.stringify(
      {
        $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
        version: '2.1.0',
        runs: [
          {
            tool: {
              driver: {
                name: 'dtcg-contrast',
                semanticVersion: pkg.version,
                informationUri: 'https://github.com/voaneves/dtcg-contrast',
                rules: [
                  {
                    id: 'dtcg-wcag-contrast',
                    name: 'WcagContrastThreshold',
                    shortDescription: {
                      text: 'WCAG 2.2 contrast threshold violation',
                    },
                  },
                  {
                    id: 'dtcg-apca-contrast',
                    name: 'ApcaContrastThreshold',
                    shortDescription: {
                      text: 'APCA-W3 perceptual contrast threshold violation',
                    },
                  },
                ],
              },
            },
            results: sarifResults,
          },
        ],
      },
      null,
      2
    ) + '\n'
  );
}

function escapeHtml(val) {
  return String(val)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeCssColor(hex) {
  try {
    return formatHex(parseColor(hex));
  } catch {
    return '#000000';
  }
}

/**
 * Format an audit report as a self-contained single-file HTML5 Accessibility Contrast Matrix.
 * Includes interactive status/theme filters, live search, before/after chips, and click-to-copy.
 * @param {import('../types/index.d.ts').AuditReport} report
 * @returns {string}
 */
export function formatHtml(report) {
  const { summary, results } = report;
  const passPct =
    summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 100;

  const themeButtons = summary.themes
    .map(
      (t) =>
        `<button type="button" class="filter-btn" data-theme-filter="${escapeHtml(t)}">${escapeHtml(t)}</button>`
    )
    .join('');

  const rowsHtml = results
    .map((r) => {
      const fgCss = safeCssColor(r.fgHex);
      const bgCss = safeCssColor(r.bgHex);
      const statusBadge = r.passed
        ? `<span class="badge pass">PASS · ${escapeHtml(r.wcagGrade)}</span>`
        : `<span class="badge fail">FAIL · ${escapeHtml(r.wcagGrade)}</span>`;
      const depPill =
        r.fgDeprecated || r.bgDeprecated
          ? '<span class="pill-dep">deprecated</span>'
          : '';

      let fixHtml = '<span class="muted">—</span>';
      if (!r.passed && r.suggestion) {
        const sugCss = safeCssColor(r.suggestion.hex);
        fixHtml = `
          <div class="fix">
            <div class="preview-pair" aria-hidden="true">
              <span class="chip" style="background:${bgCss};color:${fgCss}">Aa</span>
              <span class="arrow">→</span>
              <span class="chip" style="background:${bgCss};color:${sugCss};border-color:${sugCss}">Aa</span>
            </div>
            <div>
              <button type="button" class="copy-btn" data-copy="${escapeHtml(r.suggestion.hex)}">${escapeHtml(r.suggestion.hex)}</button>
              <button type="button" class="copy-btn muted-btn" data-copy="${escapeHtml(r.suggestion.oklch)}">${escapeHtml(r.suggestion.oklch)}</button>
              <div class="muted">${r.suggestion.wcag.toFixed(2)}:1 · Lc ${r.suggestion.apca.toFixed(1)}</div>
            </div>
          </div>`;
      } else if (!r.passed) {
        fixHtml = '<span class="muted">No sRGB lightness match</span>';
      }

      const searchHay = `${r.theme} ${r.fg} ${r.bg} ${r.fgHex} ${r.bgHex}`.toLowerCase();

      return `
        <tr data-status="${r.passed ? 'pass' : 'fail'}" data-theme="${escapeHtml(r.theme)}" data-search="${escapeHtml(searchHay)}">
          <td><code>${escapeHtml(r.theme)}</code></td>
          <td>
            <div class="pair">
              <span class="chip" style="background:${bgCss};color:${fgCss}">Aa</span>
              <div>
                <div class="token">${escapeHtml(r.fg)} ${depPill}</div>
                <div class="muted">on ${escapeHtml(r.bg)}</div>
              </div>
            </div>
          </td>
          <td>
            <button type="button" class="copy-btn" data-copy="${escapeHtml(r.fgHex)}">${escapeHtml(r.fgHex)}</button>
            <span class="muted">/</span>
            <button type="button" class="copy-btn" data-copy="${escapeHtml(r.bgHex)}">${escapeHtml(r.bgHex)}</button>
          </td>
          <td><strong>${r.wcag.toFixed(2)}:1</strong> <span class="muted">(≥${r.requiredWcag})</span></td>
          <td><code>Lc ${r.apca >= 0 ? '+' : ''}${r.apca.toFixed(1)}</code></td>
          <td>${statusBadge}</td>
          <td>${fixHtml}</td>
        </tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>DTCG Contrast Matrix — ${summary.passed}/${summary.total} Passed</title>
<style>
  :root {
    --bg: #faf9f6; --surface: #ffffff; --text: #111111; --muted: #5a5a5a;
    --border: #e5e2dc; --pass-bg: #e7f6ec; --pass-fg: #0b5d2b;
    --fail-bg: #fdeaea; --fail-fg: #9f1212; --accent: #b80000;
  }
  [data-theme="dark"] {
    --bg: #0e0e0f; --surface: #18181b; --text: #f3f2ee; --muted: #a1a1aa;
    --border: #2c2c30; --pass-bg: #10321d; --pass-fg: #6ee79a;
    --fail-bg: #3b1414; --fail-fg: #fca5a5; --accent: #ff5a5a;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); padding: 2rem; line-height: 1.45; }
  .wrap { max-width: 1180px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
  h1 { margin: 0; font-size: 1.5rem; letter-spacing: -0.02em; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
  .kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; }
  .kpi .label { font-size: 0.75rem; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; }
  .kpi .val { font-size: 1.65rem; font-weight: 700; margin-top: 0.25rem; }
  .progress { height: 8px; background: var(--fail-bg); border-radius: 999px; overflow: hidden; margin-bottom: 1.25rem; border: 1px solid var(--border); }
  .progress > span { display: block; height: 100%; background: var(--pass-fg); }
  .toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
  .btn-group { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  button { cursor: pointer; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 0.42rem 0.8rem; font: inherit; font-size: 0.84rem; }
  button.active { border-color: var(--accent); color: var(--accent); font-weight: 700; }
  .copy-btn { padding: 0.14rem 0.38rem; border-radius: 5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8em; }
  .muted-btn { color: var(--muted); }
  input[type="search"] { background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 0.45rem 0.75rem; font: inherit; font-size: 0.86rem; min-width: 240px; }
  .table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
  th, td { padding: 0.75rem 0.9rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
  th { font-size: 0.75rem; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; }
  tr:last-child td { border-bottom: 0; }
  tr.hidden { display: none; }
  .pair, .fix, .preview-pair { display: flex; align-items: center; gap: 0.55rem; }
  .arrow { color: var(--muted); font-weight: 700; }
  .chip { display: inline-flex; align-items: center; justify-content: center; width: 2.15rem; height: 2.15rem; border-radius: 6px; font-weight: 700; border: 1px solid rgba(128,128,128,0.28); flex-shrink: 0; }
  .token { font-weight: 600; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  .muted { color: var(--muted); font-size: 0.8rem; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.84em; }
  .badge { display: inline-block; padding: 0.2rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
  .badge.pass { background: var(--pass-bg); color: var(--pass-fg); }
  .badge.fail { background: var(--fail-bg); color: var(--fail-fg); }
  .pill-dep { font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); font-weight: 500; }
  footer { margin-top: 1.5rem; font-size: 0.82rem; color: var(--muted); text-align: center; }
  footer a { color: inherit; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>DTCG Contrast Matrix</h1>
      <div class="muted">WCAG 2.2 &amp; APCA-W3 report for W3C Design Tokens (${passPct}% pass rate)</div>
    </div>
    <button id="themeToggle" type="button">Toggle dark UI</button>
  </header>
  <section class="kpis">
    <div class="kpi"><div class="label">Total Pairs</div><div class="val">${summary.total}</div></div>
    <div class="kpi"><div class="label">Passed</div><div class="val">${summary.passed}</div></div>
    <div class="kpi"><div class="label">Failed</div><div class="val">${summary.failed}</div></div>
    <div class="kpi"><div class="label">Themes</div><div class="val">${escapeHtml(summary.themes.join(', '))}</div></div>
  </section>
  <div class="progress" aria-label="Pass rate ${passPct}%"><span style="width:${passPct}%"></span></div>
  <div class="toolbar">
    <div class="btn-group" role="group" aria-label="Filter by status">
      <button type="button" class="filter-btn active" data-status-filter="all">All (${summary.total})</button>
      <button type="button" class="filter-btn" data-status-filter="fail">Failed (${summary.failed})</button>
      <button type="button" class="filter-btn" data-status-filter="pass">Passed (${summary.passed})</button>
    </div>
    <div class="btn-group" role="group" aria-label="Filter by theme">
      <button type="button" class="filter-btn active" data-theme-filter="all">All themes</button>
      ${themeButtons}
    </div>
    <input id="searchInput" type="search" placeholder="Search token, hex, or theme..." aria-label="Search tokens" />
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Theme</th><th>Token Pair</th><th>Hex</th><th>WCAG 2.2</th><th>APCA</th><th>Status</th><th>OKLCH Fix</th></tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>
  <footer>Generated by <a href="https://github.com/voaneves/dtcg-contrast">dtcg-contrast</a></footer>
</div>
<script>
  let statusFilter = 'all';
  let themeFilter = 'all';
  let query = '';
  const rows = [...document.querySelectorAll('tbody tr')];

  function applyFilters() {
    for (const row of rows) {
      const okStatus = statusFilter === 'all' || row.dataset.status === statusFilter;
      const okTheme = themeFilter === 'all' || row.dataset.theme === themeFilter;
      const okSearch = !query || row.dataset.search.includes(query);
      row.classList.toggle('hidden', !(okStatus && okTheme && okSearch));
    }
  }

  document.querySelectorAll('[data-status-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-status-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      statusFilter = btn.dataset.statusFilter;
      applyFilters();
    });
  });

  document.querySelectorAll('[data-theme-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-theme-filter]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      themeFilter = btn.dataset.themeFilter;
      applyFilters();
    });
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    query = e.target.value.trim().toLowerCase();
    applyFilters();
  });

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      const orig = btn.textContent;
      try {
        if (navigator.clipboard) await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = orig; }, 1200);
      } catch {}
    });
  });

  document.getElementById('themeToggle').addEventListener('click', () => {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  });
</script>
</body>
</html>
`;
}
