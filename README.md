<a id="top"></a>

<div align="center">

<p>🇺🇸 <strong>English</strong> · <a href="./README.pt-br.md">🇧🇷 Versão em Português (PT-BR)</a></p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/mark-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/mark-light.svg" />
  <img alt="dtcg-contrast — VOANEVES. Concept B mark" src="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/mark-light.svg" width="84" height="84" />
</picture>

<h1>dtcg-contrast</h1>

<p>
  <strong>Zero-dependency WCAG 2.2 &amp; APCA contrast gate and OKLCH auto-fixer for W3C DTCG 2025.10 design tokens.</strong><br />
  <sub>Shift contrast compliance left onto your token JSON in ~15ms — CLI, JS/TS library &amp; GitHub Action.</sub>
</p>

<p>
  <a href="https://github.com/voaneves/dtcg-contrast/actions/workflows/ci.yml"><img src="https://github.com/voaneves/dtcg-contrast/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <a href="https://www.npmjs.com/package/dtcg-contrast"><img src="https://img.shields.io/npm/v/dtcg-contrast?style=flat-square&color=b80000&logo=npm&logoColor=white" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/dtcg-contrast"><img src="https://img.shields.io/npm/dm/dtcg-contrast?style=flat-square&color=0A0A0A" alt="npm downloads per month" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-0A0A0A?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22-0A0A0A?style=flat-square&logo=node.js&logoColor=white" alt="Node >=22" />
  <img src="https://img.shields.io/badge/dependencies-0-5C5446?style=flat-square" alt="Zero Dependencies" />
  <img src="https://img.shields.io/badge/spec-W3C%20DTCG%202025.10-b80000?style=flat-square" alt="W3C DTCG 2025.10" />
</p>

<p>
  <a href="#quick-start">Quick Start</a> ·
  <a href="#live-fix">Live OKLCH Fix</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#cli-options">CLI</a> ·
  <a href="#github-action">GitHub Action</a> ·
  <a href="#api">JS / TS API</a> ·
  <a href="https://github.com/voaneves/dtcg-contrast/issues/new">Report Bug</a>
</p>

</div>

<details>
  <summary><strong>Table of Contents</strong> — full guide</summary>
  <ol>
    <li><a href="#why-dtcg-contrast">Why <code>dtcg-contrast</code>? (Bento Highlights)</a></li>
    <li><a href="#live-fix">Live OKLCH Auto-Fix Showcase (Before → After)</a></li>
    <li><a href="#architecture">Architecture &amp; Standards Compliance</a></li>
    <li><a href="#quick-start">Quick Start (<code>check</code>, <code>init</code>, <code>--fix</code>, Globs)</a></li>
    <li><a href="#cli-options">CLI Options &amp; Exit Codes</a></li>
    <li><a href="#github-action">GitHub Action, Sticky PR Comments &amp; SARIF</a></li>
    <li><a href="#api">Programmatic JS / TS API &amp; Contrast Math</a></li>
    <li><a href="#consulting">Commercial Support, Audits &amp; License</a></li>
  </ol>
</details>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-light.svg" />
  <img alt="" src="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-light.svg" width="100%" />
</picture>

<a id="why-dtcg-contrast"></a>
## ⚡ Why `dtcg-contrast`?

> [!IMPORTANT]
> **Browser audits catch contrast bugs too late.** By the time Playwright, Lighthouse, or `axe-core` sees rendered DOM, broken tokens have already leaked into Figma libraries, component packages, and production CSS. `dtcg-contrast` validates the **W3C DTCG 2025.10 JSON source** directly in ~15ms with zero third-party packages.

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>🧩 Native W3C DTCG 2025.10</h3>
      <p>Parses <code>srgb</code>, <code>oklch</code>, <code>hsl</code>, <code>display-p3</code>, CSS <code>color(...)</code>, and <code>hex</code> fallbacks. Supports <code>$root</code> tokens, <code>$deprecated</code>, group <code>$type</code> inheritance, recursive directories, and multi-hop <code>{alias}</code> resolution with cycle detection.</p>
    </td>
    <td width="50%" valign="top">
      <h3>🌓 Multi-Theme &amp; Dual Standards</h3>
      <p>Evaluates <code>light</code>, <code>dark</code>, and high-contrast modes via nested or dotted <code>$extensions</code> (e.g., <code>vn.dark</code>, <code>com.figma.modes.dark</code>) or overlay files — computing exact <strong>WCAG 2.2</strong> ratios, <strong>APCA-W3</strong> <code>Lc</code>, and sRGB alpha compositing.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🎯 Safe OKLCH Auto-Fixer</h3>
      <p>Binary-searches OKLCH lightness <code>L</code> while preserving hue <code>H</code> and gamut-mapped chroma <code>C</code>, then verifies the quantized 8-bit hex passes without rounding dips — writing safely to foreground tokens or <code>$extensions</code> without mutating shared primitives.</p>
    </td>
    <td width="50%" valign="top">
      <h3>📊 Five Enterprise Reporters</h3>
      <p>Outputs 24-bit ANSI swatches (<code>pretty</code>), PR/Job Summaries (<code>markdown</code> + <code>comment-pr</code>), automation payloads (<code>json</code>), interactive filterable Contrast Matrix (<code>html</code>), and <strong>SARIF 2.1.0</strong> with exact line/column PR diff spans.</p>
    </td>
  </tr>
</table>

<a id="live-fix"></a>
## 🎨 Live OKLCH Auto-Fix Showcase

Tested on [`examples/voaneves-brand/demo-fail.config.json`](./examples/voaneves-brand/demo-fail.config.json) (rendered natively — crisp on desktop and mobile):

| Theme | Token Pair | Foreground | Background | WCAG 2.2 | APCA `Lc` | Status &amp; OKLCH Fix |
| :--- | :--- | :--- | :--- | ---: | ---: | :--- |
| `light` | `color.text` on `color.surface` | `#0a0a0a` | `#f4ead4` | **16.56:1** | `+93.8` | ✅ `PASS (AAA)` |
| `light` | `color.signal` on `color.surface` | `#f50000` | `#f4ead4` | **3.60:1** | `+54.6` | ❌ `FAIL` → **`#d70000`** (`ΔL -0.057`, **4.52:1**) |
| `light` | `color.signal-ink` on `color.surface` | `#b80000` | `#f4ead4` | **5.78:1** | `+69.1` | ✅ `PASS (AA)` |
| `light` | `color.text-on-signal` on `color.surface-signal` | `#0a0a0a` | `#f50000` | **4.60:1** | `+37.2` | ✅ `PASS (AA)` |
| `dark` | `color.text` on `color.surface` | `#e8dec5` | `#0a0a0a` | **14.79:1** | `-86.8` | ✅ `PASS (AAA)` |
| `dark` | `color.signal-ink` on `color.surface` | `#ff5a5a` | `#0a0a0a` | **6.47:1** | `-45.2` | ✅ `PASS (AA)` |
| `dark` | `color.text-on-signal` on `color.surface-signal` | `#0a0a0a` | `#ff3838` | **5.54:1** | `+42.3` | ✅ `PASS (AA)` |

Running `npx dtcg-contrast --config=examples/voaneves-brand/demo-fail.config.json --fix` updates only the offending semantic token while keeping `ref.color.red.600` (`#f50000` shared by `color.surface-signal`) untouched:

```diff
     "signal": {
-      "$value": "{ref.color.red.600}",
+      "$value": {
+        "colorSpace": "srgb",
+        "components": [0.8431, 0, 0],
+        "hex": "#d70000"
+      },
       "$extensions": { "vn": { "dark": "{ref.color.red.450}" } }
     },
```

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-light.svg" />
  <img alt="" src="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-light.svg" width="100%" />
</picture>

<a id="architecture"></a>
## 🧭 Architecture &amp; Standards Matrix

```mermaid
flowchart LR
  S["W3C DTCG JSON<br/>$root · aliases · $extensions"] --> P["Tokenizer & Resolver<br/>line/col spans · cycle checks"]
  P --> C["Contrast Engine<br/>WCAG 2.2 · APCA-W3 · alphaOver"]
  C -->|Pass| R["5 Reporters<br/>pretty · md · json · html · SARIF"]
  C -->|Fail| F["OKLCH Binary Search<br/>sRGB gamut map · 8-bit verify"]
  F -->|--fix / --dry-run| W["Safe Token Write-Back"]
  F --> R
```

<details>
  <summary><strong>Comparison &amp; Specification Checklist</strong> — how it stacks up</summary>

  | Capability | `dtcg-contrast` | Browser audits (`axe` / Lighthouse) | Manual Figma plugins |
  | :--- | :--- | :--- | :--- |
  | Runs at token source (~15ms, 0 deps) | ✅ Pre-CSS &amp; pre-build | ❌ Needs built app + browser | ❌ Manual per frame |
  | W3C DTCG 2025.10 (`$root`, `{alias}`, `$extensions`) | ✅ Native | ❌ Sees only compiled CSS | ⚠️ Varies by plugin |
  | Dual WCAG 2.2 + APCA-W3 + alpha compositing | ✅ Built-in | ⚠️ WCAG only | ⚠️ Often partial |
  | Hue-preserving OKLCH `--fix` write-back | ✅ Hex-verified | ❌ Reports failures only | ❌ Manual tweaking |
  | CI outputs (SARIF 2.1.0 spans, PR comments, HTML) | ✅ Built-in | ⚠️ Custom wiring | ❌ No CI gate |

  - [x] **W3C DTCG 2025.10** color module (`srgb`, `oklch`, `hsl`, `display-p3`, `$root`, `$deprecated`, `{alias}`, `$extensions`)
  - [x] **WCAG 2.2** relative luminance &amp; thresholds (`AA` 4.5:1, `AA-large` / `UI` 3.0:1, `AAA` 7.0:1)
  - [x] **APCA-W3** (`0.0.98G-4g`) perceptual `Lc` polarity &amp; soft clamp
  - [x] **SARIF 2.1.0** `physicalLocation.region` (`startLine`, `startColumn`) for GitHub Code Scanning

</details>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-light.svg" />
  <img alt="" src="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-light.svg" width="100%" />
</picture>

<a id="quick-start"></a>
## 🚀 Quick Start

```bash
# 1. Instant one-off color check (hex, rgb, hsl, oklch, or CSS color())
npx dtcg-contrast check "#f50000" "#f4ead4" --level=AA

# 2. Scaffold dtcg-contrast.config.json with $schema, detected themes & pairs
npx dtcg-contrast init ./tokens

# 3. Preview and write OKLCH fixes safely back to failing tokens
npx dtcg-contrast --config=dtcg-contrast.config.json --fix --dry-run
npx dtcg-contrast --config=dtcg-contrast.config.json --fix

# 4. Run the included production showcase (@voaneves/brand tokens)
npx dtcg-contrast --config examples/voaneves-brand/dtcg-contrast.config.json
```

### Explicit Config with `$schema`, Globs &amp; Exclusions

> [!TIP]
> Point `"$schema"` to `dtcg-contrast.schema.json` (shipped in npm and on GitHub) for instant VS Code / JetBrains autocomplete and validation.

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

<a id="cli-options"></a>
## ⌨️ CLI Options

Supports both `--flag value` and `--flag=value`. Exit codes: `0` pass, `1` contrast failure, `2` usage/config/token error.

| Flag / Subcommand | Description | Default |
| :--- | :--- | :--- |
| `[paths...]` | DTCG `.json` token files or directories (zero-config mode) | — |
| `check <fg> <bg>` | Check two CSS/hex/OKLCH colors directly | — |
| `init <paths...>` | Scaffold `dtcg-contrast.config.json` from tokens | — |
| `-c, --config <file>` | Config JSON path (auto-detects `./dtcg-contrast.config.json`) | — |
| `-f, --format <fmt>` | Output: `pretty`, `markdown`, `json`, `html`, `sarif` | `pretty` |
| `-o, --output <file>` | Write formatted report or `init` config to file | stdout |
| `--level <level>` | Threshold: `AA`, `AA-large`, `UI`, `AAA`, `AAA-large` | smart (`AA`/`UI`) |
| `--min-apca <num>` | Minimum APCA `\|Lc\|` threshold across evaluated pairs | `0` |
| `--mode <name:path>` | Add theme from `$extensions.<path>` (supports dotted keys) | `default` |
| `--fix` | Write OKLCH fixes back to failing foreground tokens | `false` |
| `--dry-run` | Preview `--fix` edits without modifying files | `false` |
| `--force` | Overwrite existing config file during `init` | `false` |
| `--no-fail` | Exit `0` even when pairs fail (advisory reports) | `false` |
| `--no-color` | Disable 24-bit ANSI swatches | `false` |

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-light.svg" />
  <img alt="" src="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-light.svg" width="100%" />
</picture>

<a id="github-action"></a>
## 🤖 GitHub Action, Sticky PR Comments &amp; SARIF

Gate pull requests with a sticky PR comment (`<!-- dtcg-contrast -->`), Markdown Job Summary, interactive HTML Contrast Matrix, and exact line/column PR diff annotations via SARIF 2.1.0:

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
  <summary><strong>All Action Inputs &amp; Outputs</strong></summary>

  | Input | Default | Description |
  | :--- | :--- | :--- |
  | `config` | `''` | Path to `dtcg-contrast.config.json` |
  | `tokens` | `''` | Space-separated paths for zero-config mode |
  | `modes` | `''` | Space-separated `name:extensionPath` themes (e.g., `dark:vn.dark`) |
  | `level` | `''` | Override default WCAG threshold |
  | `min-apca` | `''` | Minimum APCA `\|Lc\|` score |
  | `fail-on-error` | `'true'` | Fail workflow step when pairs fail |
  | `html-report` | `''` | Output path for standalone interactive HTML matrix |
  | `sarif-report` | `''` | Output path for SARIF 2.1.0 report |
  | `summary` | `'true'` | Append Markdown table to `$GITHUB_STEP_SUMMARY` |
  | `comment-pr` | `'false'` | Post or update a sticky contrast comment on pull requests |
  | `token` | `${{ github.token }}` | Token used when `comment-pr` is `'true'` |

  **Outputs:** `total`, `passed`, `failed`.

</details>

<a id="api"></a>
## 📦 Programmatic JS / TS API

Zero runtime dependencies — works directly in Node `>=22` ESM and TypeScript projects (ships full [`types/index.d.ts`](./types/index.d.ts)):

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

<details>
  <summary><strong>🔬 Under the Hood: WCAG 2.2 &amp; OKLCH Math</strong></summary>

  `dtcg-contrast` composites semi-transparent foregrounds via Porter-Duff `source-over` in sRGB, computes WCAG 2.x relative luminance and contrast ratio, and binary-searches OKLCH lightness `L` at fixed hue `H` with sRGB chroma gamut mapping:

  $$L_{\text{rel}} = 0.2126 \cdot R_{\text{lin}} + 0.7152 \cdot G_{\text{lin}} + 0.0722 \cdot B_{\text{lin}}$$

  $$\text{CR} = \frac{\max(L_1, L_2) + 0.05}{\min(L_1, L_2) + 0.05} \in [1, 21]$$

  After quantization to 8-bit hex, the candidate is re-parsed and checked against both the requested WCAG ratio and APCA-W3 `Lc` threshold before being emitted.

</details>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-light.svg" />
  <img alt="" src="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/rule-light.svg" width="100%" />
</picture>

<a id="consulting"></a>
## 🤝 Production Case Study &amp; Consulting

Built alongside [`@voaneves/brand`](https://github.com/voaneves/brand) — Victor Neves' production W3C DTCG 2025.10 design system powering [`voaneves.com`](https://voaneves.com/en/) with zero runtime dependencies and automated WCAG 2.2 AA gates.

<table>
  <tr>
    <td width="60%" valign="top">
      <h3>Need Design System Governance or a WCAG 2.2 / EAA Audit?</h3>
      <ul>
        <li><strong>W3C DTCG Architecture:</strong> Multi-brand &amp; light/dark token pipelines synced from Figma to CSS/iOS/Android</li>
        <li><strong>Accessibility Compliance:</strong> WCAG 2.2 AA, European Accessibility Act (EAA) &amp; APCA audits</li>
        <li><strong>Automated Quality Gates:</strong> Lighthouse CI, Playwright, axe-core &amp; GitOps rollouts</li>
      </ul>
    </td>
    <td width="40%" valign="middle" align="center">
      <p><strong>Serving Brazil &amp; Worldwide</strong></p>
      <p>
        <a href="https://voaneves.com/en/"><strong>🌐 voaneves.com/en/</strong></a><br />
        <a href="https://www.linkedin.com/in/voaneves/"><strong>💼 LinkedIn</strong></a> ·
        <a href="mailto:victorneves478@gmail.com"><strong>✉️ E-mail</strong></a><br />
        <a href="https://github.com/sponsors/voaneves"><strong>💖 GitHub Sponsors</strong></a>
      </p>
    </td>
  </tr>
</table>

<div align="center">
  <a href="https://voaneves.com/en/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/mark-dark.svg" />
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/mark-light.svg" />
      <img alt="VOANEVES." src="https://raw.githubusercontent.com/voaneves/dtcg-contrast/main/assets/brand/mark-light.svg" width="32" height="32" />
    </picture>
  </a>
  <br />
  <sub><a href="./LICENSE">MIT License</a> © 2026 <a href="https://github.com/voaneves">Victor Neves</a> · <strong>VOANEVES.</strong> Signal, not noise.</sub>
</div>

<p align="right"><a href="#top">↑ Back to top</a></p>
