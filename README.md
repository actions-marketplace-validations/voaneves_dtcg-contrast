<div align="center">

<p>🇺🇸 <strong>English</strong> · <a href="./README.pt-br.md">🇧🇷 Versão em Português (PT-BR)</a></p>

# dtcg-contrast

**Zero-dependency WCAG 2.2 &amp; APCA contrast gate and OKLCH auto-fixer for W3C DTCG 2025.10 design tokens.**

<p>
  <a href="./CHANGELOG.md"><img src="https://img.shields.io/badge/release-v0.1.0-b80000?style=flat-square" alt="v0.1.0 pre-release" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-0A0A0A?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-0A0A0A?style=flat-square&logo=node.js&logoColor=white" alt="Node >=20" />
  <img src="https://img.shields.io/badge/dependencies-0-3fb950?style=flat-square" alt="Zero Dependencies" />
  <img src="https://img.shields.io/badge/spec-W3C%20DTCG%202025.10-b80000?style=flat-square" alt="W3C DTCG 2025.10" />
  <img src="https://img.shields.io/badge/standards-WCAG%202.2%20%2B%20APCA-0A0A0A?style=flat-square" alt="WCAG 2.2 and APCA" />
</p>

> **Pre-1.0 Preview (`v0.1.0`):** Core math, W3C DTCG 2025.10 resolver, CLI, SARIF 2.1.0, and GitHub Action are live and tested. [Feedback & feature requests](https://github.com/voaneves/dtcg-contrast/issues) shape the road to `v1.0.0`.

<img src="./assets/demo.svg" alt="dtcg-contrast terminal output showing WCAG 2.2, APCA, and OKLCH auto-fix suggestions" width="820" />

</div>

## Why `dtcg-contrast`?

| Capability | `dtcg-contrast` | Browser audits (`axe` / Lighthouse) | Manual Figma plugins |
| :--- | :--- | :--- | :--- |
| Runs at token source (~15ms, zero deps) | ✅ Pre-CSS & pre-build | ❌ Needs built app + headless browser | ❌ Manual click per frame |
| W3C DTCG 2025.10 (`$root`, `{alias}`, `$extensions`) | ✅ Native | ❌ Sees only compiled CSS | ⚠️ Varies by plugin |
| Dual WCAG 2.2 + APCA-W3 + alpha compositing | ✅ Built-in | ⚠️ WCAG only (no APCA) | ⚠️ Often partial |
| Hue-preserving OKLCH auto-fix (hex-verified) | ✅ Binary-searched | ❌ Reports failures only | ❌ Manual tweaking |
| CI outputs (SARIF 2.1.0, Job Summary, HTML Matrix) | ✅ Built-in | ⚠️ Custom wiring | ❌ No CI gate |

---

## Quick Start

### 1. Instant one-off color check (`check`)

```bash
npx dtcg-contrast check "#f50000" "#f4ead4" --level AA
```

### 2. Scaffold config from your existing DTCG tokens (`init`)

```bash
npx dtcg-contrast init ./tokens
# Auto-detects $extensions theme modes (e.g. vn.dark, com.figma.modes.dark)
# and writes dtcg-contrast.config.json with discovered semantic & component pairs
```

### 3. Zero-config directory audit

```bash
npx dtcg-contrast ./tokens --mode dark:vn.dark
```

### 4. Explicit CI gate (`dtcg-contrast.config.json`)

```json
{
  "tokens": ["./tokens.json"],
  "themes": [
    { "name": "light" },
    { "name": "dark", "extensionPath": "vn.dark" }
  ],
  "pairs": [
    { "fg": "color.text", "bg": "color.surface", "level": "AA" },
    { "fg": "color.signal-ink", "bg": "color.surface", "level": "AA" },
    { "fg": "color.line-strong", "bg": "color.surface", "level": "UI" }
  ]
}
```

Run the included production showcase (built from [`@voaneves/brand`](https://github.com/voaneves/brand)):

```bash
npx dtcg-contrast --config examples/voaneves-brand/dtcg-contrast.config.json
# Or see the OKLCH auto-fixer catch a failing pair:
npx dtcg-contrast --config examples/voaneves-brand/demo-fail.config.json
```

---

## CLI Options

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
| `--force` | Overwrite existing config file when running `init` | `false` |
| `--no-fail` | Exit `0` even when pairs fail (advisory reports) | `false` |
| `--no-color` | Disable 24-bit ANSI swatch output | `false` |

Exit codes: `0` all pass, `1` one or more contrast failures, `2` invalid config/tokens/CLI usage.

---

## GitHub Action + SARIF Code Scanning

Gate pull requests with a Markdown Job Summary, downloadable interactive HTML Contrast Matrix, and native PR Code Scanning annotations via SARIF 2.1.0:

```yaml
- name: Design Token Contrast Gate
  uses: voaneves/dtcg-contrast@v0.1.0
  with:
    config: dtcg-contrast.config.json
    html-report: contrast-matrix.html
    sarif-report: contrast.sarif
    fail-on-error: 'false'

- name: Upload SARIF to GitHub Code Scanning
  if: always()
  uses: github/codeql-action/upload-sarif@v3
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

Outputs: `total`, `passed`, `failed`.

</details>

---

## Programmatic JS / TS API

Zero runtime dependencies — works directly in Node `>=20` ESM and TypeScript projects (ships full [`types/index.d.ts`](./types/index.d.ts)):

```js
import {
  loadTokenSources,
  detectExtensionPaths,
  evaluatePairs,
  suggestAccessibleColor,
  formatSarif,
} from 'dtcg-contrast';

const tree = loadTokenSources('./tokens');
const modes = detectExtensionPaths(tree); // e.g. ['vn.dark']
const report = evaluatePairs({
  tokenTree: tree,
  themes: [{ name: 'light' }, ...modes.map((m) => ({ name: m, extensionPath: m }))],
});

if (report.summary.failed > 0) {
  console.log(suggestAccessibleColor('#f50000', '#f4ead4', { minWcag: 4.5 }));
  // -> { hex: '#d70000', oklch: 'oklch(0.552 0.227 29.2)', wcag: 4.52, apca: 61.9, deltaL: -0.057 }
}
```

---

## Roadmap (`v0.1.0` → `v1.0.0`)

- **`v0.1.0`** *(current)*: W3C DTCG 2025.10 (`$root`, `{alias}`, dotted `$extensions`), WCAG 2.2 + APCA-W3, OKLCH auto-fixer, `check` & `init`, 5 reporters (`pretty`, `markdown`, `json`, `html`, `sarif`), composite GitHub Action.
- **`v0.2.0`**: `--fix` mode to write OKLCH adjustments cleanly back to DTCG JSON token files (preserving formatting/comments) + automated GitHub PR comment action mode.
- **`v0.3.0`**: Style Dictionary / Tokens Studio config bridge, glob pair wildcards (`color.text* on color.surface*`), and exact line/column source spans in SARIF.
- **`v1.0.0`**: Frozen public API + npm & GitHub Actions Marketplace general availability.

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
