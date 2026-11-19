<div align="center">

<p>🇺🇸 <strong>English</strong> · <a href="./README.pt-br.md">🇧🇷 Versão em Português (PT-BR)</a></p>

# dtcg-contrast

**Zero-dependency WCAG 2.2 &amp; APCA contrast gate and OKLCH auto-fixer for W3C DTCG 2025.10 design tokens.**

<p>
  <a href="https://github.com/voaneves/dtcg-contrast/actions/workflows/ci.yml"><img src="https://github.com/voaneves/dtcg-contrast/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <a href="https://www.npmjs.com/package/dtcg-contrast"><img src="https://img.shields.io/npm/v/dtcg-contrast?style=flat-square&color=b80000&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/dtcg-contrast"><img src="https://img.shields.io/npm/dm/dtcg-contrast?style=flat-square&color=0A0A0A" alt="npm downloads per month" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-0A0A0A?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22-0A0A0A?style=flat-square&logo=node.js&logoColor=white" alt="Node >=22" />
  <img src="https://img.shields.io/badge/dependencies-0-3fb950?style=flat-square" alt="Zero Dependencies" />
  <img src="https://img.shields.io/badge/spec-W3C%20DTCG%202025.10-b80000?style=flat-square" alt="W3C DTCG 2025.10" />
  <img src="https://img.shields.io/badge/standards-WCAG%202.2%20%2B%20APCA-0A0A0A?style=flat-square" alt="WCAG 2.2 and APCA" />
</p>

<img src="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/demo.svg" alt="dtcg-contrast terminal output showing WCAG 2.2, APCA, and OKLCH auto-fix suggestions" width="820" />

</div>

## Why `dtcg-contrast`?

| Capability | `dtcg-contrast` | Browser audits (`axe` / Lighthouse) | Manual Figma plugins |
| :--- | :--- | :--- | :--- |
| Runs at token source (~15ms, zero deps) | ✅ Pre-CSS & pre-build | ❌ Needs built app + headless browser | ❌ Manual click per frame |
| W3C DTCG 2025.10 (`$root`, `{alias}`, `$extensions`) | ✅ Native | ❌ Sees only compiled CSS | ⚠️ Varies by plugin |
| Dual WCAG 2.2 + APCA-W3 + alpha compositing | ✅ Built-in | ⚠️ WCAG only (no APCA) | ⚠️ Often partial |
| Hue-preserving OKLCH auto-fix (`--fix` / `--dry-run`) | ✅ Binary-searched + write-back | ❌ Reports failures only | ❌ Manual tweaking |
| CI outputs (SARIF 2.1.0 spans, PR comment, HTML Matrix) | ✅ Built-in | ⚠️ Custom wiring | ❌ No CI gate |

---

## Quick Start

### 1. Instant one-off color check (`check`)

```bash
npx dtcg-contrast check "#f50000" "#f4ead4" --level=AA
```

### 2. Scaffold config with `$schema` autocomplete (`init`)

```bash
npx dtcg-contrast init ./tokens
# Auto-detects $extensions theme modes (e.g. vn.dark, com.figma.modes.dark)
# and writes dtcg-contrast.config.json with $schema and discovered pairs
```

### 3. Auto-fix failing tokens in OKLCH (`--fix` / `--dry-run`)

```bash
# Preview changes without modifying disk:
npx dtcg-contrast --config=dtcg-contrast.config.json --fix --dry-run

# Write hue-preserving OKLCH fixes directly to failing foreground tokens (or $extensions mode):
npx dtcg-contrast --config=dtcg-contrast.config.json --fix
```

### 4. Config with `$schema`, Globs & Exclusions (`dtcg-contrast.config.json`)

```json
{
  "$schema": "https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/dtcg-contrast.schema.json",
  "tokens": ["./tokens.json"],
  "themes": [
    { "name": "light" },
    { "name": "dark", "extensionPath": "vn.dark" }
  ],
  "pairs": [
    { "fg": "color.text*", "bg": "color.surface*", "exclude": ["*-inverse", "*-signal"], "level": "AA" },
    { "fg": "color.signal-ink", "bg": "color.surface", "level": "AA" },
    { "fg": "color.line-strong", "bg": "color.surface", "level": "UI" }
  ]
}
```

Run the included production showcase (built from [`@voaneves/brand`](https://github.com/voaneves/brand)):

```bash
npx dtcg-contrast --config examples/voaneves-brand/dtcg-contrast.config.json
# Or inspect a failing pair + live OKLCH dry-run fix:
npx dtcg-contrast --config examples/voaneves-brand/demo-fail.config.json --fix --dry-run
```

---

## CLI Options

Supports both `--flag value` and `--flag=value` forms.

| Flag / Subcommand | Description | Default |
| :--- | :--- | :--- |
| `[paths...]` | DTCG token `.json` files or directories | — |
| `check <fg> <bg>` | Check two CSS/hex/OKLCH colors directly | — |
| `init <paths...>` | Scaffold `dtcg-contrast.config.json` from tokens | — |
| `-c, --config <file>` | Config JSON path (auto-detects `./dtcg-contrast.config.json`) | — |
| `-f, --format <fmt>` | Output: `pretty`, `markdown`, `json`, `html`, `sarif` | `pretty` |
| `-o, --output <file>` | Write formatted report or `init` config to file | stdout |
| `--level <level>` | Threshold: `AA`, `AA-large`, `UI`, `AAA`, `AAA-large` | smart (`AA`/`UI`) |
| `--min-apca <num>` | Require minimum APCA `\|Lc\|` across evaluated pairs | `0` |
| `--mode <name:path>` | Add theme from `$extensions.<path>` (supports dotted keys) | `default` |
| `--fix` | Write OKLCH fixes back to failing foreground tokens | `false` |
| `--dry-run` | Preview `--fix` edits without modifying token files | `false` |
| `--force` | Overwrite existing config file when running `init` | `false` |
| `--no-fail` | Exit `0` even when pairs fail (advisory reports) | `false` |
| `--no-color` | Disable 24-bit ANSI swatch output | `false` |

Exit codes: `0` all pass, `1` one or more contrast failures, `2` invalid config/tokens/CLI usage.

---

## GitHub Action, Sticky PR Comments & SARIF

Gate pull requests with a sticky PR comment, Markdown Job Summary, interactive HTML Contrast Matrix, and exact line/column PR diff annotations via SARIF 2.1.0:

```yaml
- name: Design Token Contrast Gate
  uses: voaneves/dtcg-contrast@v1
  with:
    config: dtcg-contrast.config.json
    comment-pr: 'true'
    html-report: contrast-matrix.html
    sarif-report: contrast.sarif
    fail-on-error: 'false'

- name: Upload SARIF to GitHub Code Scanning
  if: always()
  uses: github/codeql-action/upload-sarif@v4
  with:
    sarif_file: contrast.sarif
```

<details>
<summary>All Action inputs & outputs</summary>

| Input | Default | Description |
| :--- | :--- | :--- |
| `config` | `''` | Path to `dtcg-contrast.config.json` |
| `tokens` | `''` | Space-separated paths for zero-config mode |
| `modes` | `''` | Space-separated `name:extensionPath` themes (e.g. `dark:vn.dark`) |
| `level` | `''` | Override default WCAG threshold |
| `min-apca` | `''` | Minimum APCA `\|Lc\|` score |
| `fail-on-error` | `'true'` | Fail workflow step when pairs fail |
| `html-report` | `''` | Optional output path for standalone interactive HTML matrix |
| `sarif-report` | `''` | Optional output path for SARIF 2.1.0 report |
| `summary` | `'true'` | Append Markdown table to `$GITHUB_STEP_SUMMARY` |
| `comment-pr` | `'false'` | Post or update a sticky contrast comment on pull requests |
| `token` | `${{ github.token }}` | Token used when `comment-pr` is `'true'` |

Outputs: `total`, `passed`, `failed`.

</details>

---

## Programmatic JS / TS API

Zero runtime dependencies — works directly in Node `>=22` ESM and TypeScript projects (ships complete [`types/index.d.ts`](./types/index.d.ts)):

```js
import {
  loadTokenSources,
  detectExtensionPaths,
  evaluatePairs,
  planFixes,
  applyFixes,
} from 'dtcg-contrast';

const tokenTree = loadTokenSources('./tokens');
const themes = [
  { name: 'light' },
  ...detectExtensionPaths(tokenTree).map((m) => ({ name: m, extensionPath: m })),
];

const report = evaluatePairs({ tokenTree, themes });
if (report.summary.failed > 0) {
  const { edits } = planFixes({ report, tokenTree, themes });
  applyFixes(edits, { dryRun: true });
}
```

---

## Live Production Case Study

Built alongside [`@voaneves/brand`](https://github.com/voaneves/brand) — Victor Neves' production W3C DTCG 2025.10 design system powering [`voaneves.com`](https://voaneves.com/en/) with zero runtime dependencies and automated WCAG 2.2 AA gates.

---

## Commercial Support, Audits & Consulting

Need a W3C DTCG design system, **WCAG 2.2 AA / EAA accessibility audit**, or automated CI/GitOps quality gates (Lighthouse CI, Playwright, axe-core, token governance) for your team?

- 🌐 **Portfolio & Consulting:** [voaneves.com/en/](https://voaneves.com/en/)
- 💼 **LinkedIn:** [linkedin.com/in/voaneves](https://www.linkedin.com/in/voaneves/)
- 💖 **Sponsor ongoing OSS work:** [github.com/sponsors/voaneves](https://github.com/sponsors/voaneves)

---

## License

[MIT](./LICENSE) © 2026 [Victor Neves](https://github.com/voaneves)
