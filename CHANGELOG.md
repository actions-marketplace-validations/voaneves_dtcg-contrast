# Changelog

## [1.0.0] - 2026-11-19

First stable production release (`v1.0.0`) with a frozen v1 public ESM/TypeScript API and zero npm dependencies.

### Added
- `--flag=value` CLI argument parsing (`--config=...`, `--format=...`, `--level=...`, etc.) and `$schema` autocomplete via [dtcg-contrast.schema.json](./dtcg-contrast.schema.json) (JSON Schema Draft 2020-12).
- Optional sticky pull-request comment mode (`comment-pr: 'true'` / `token`) in the composite GitHub Action using built-in `fetch`.
- `.github/dependabot.yml` weekly updates for GitHub Actions.
- Runtime ESM export <-> `types/index.d.ts` parity test, UTF-8 BOM stripping across config/tokens/fixer, prototype-key guards, and executable (`100755`) `bin/dtcg-contrast.mjs`.

### Changed
- Raised baseline runtime engine to active Node.js LTS `>=22.0.0` and updated CI matrix to Node `22`, `24`, `26` on Ubuntu and Node `24` on Windows.

## [0.2.0] - 2026-11-19

### Added
- Safe `--fix` and `--dry-run` OKLCH write-back mode (`planFixes` / `applyFixes`), modifying failing foreground tokens or theme `$extensions` without mutating shared primitive/reference tokens.
- Glob pair wildcards (`*`, `**`) and `exclude` pattern support in config `pairs` (`expandPairRules`, `globToRegExp`).
- Exact 1-based `startLine` / `startColumn` JSON source tracking (`indexTokenLocations`) emitted as SARIF 2.1.0 `region` spans for inline PR diff annotations.

### Fixed
- Fixed cross-drive Windows path formatting in `dtcg-contrast init` (caught on GitHub Actions `windows-latest` runners).
- Upgraded CI workflows to `actions/checkout@v7` and `actions/setup-node@v7` and expanded `action-dogfood` to both `ubuntu-latest` and `windows-latest`.

## [0.1.0] - 2026-11-19

Initial pre-1.0 release (`v0.1.0`) — ready for real-world feedback on the path to `v1.0.0`.

### Added
- Zero-dependency W3C DTCG 2025.10 token loader with group `$type` inheritance, `$root` group tokens, `$deprecated` propagation, multi-hop `{alias}` resolution, source-file tracking, and circular-reference detection.
- CSS Color 4 (`color(srgb ...)`, `color(display-p3 ...)`, `oklch()`, `hsl()`, `rgb()`, `#hex`) and DTCG object parsing (`srgb`, `oklch`, `hsl`, `display-p3`).
- Exact WCAG 2.2 contrast ratios, APCA-W3 (0.0.98G-4g) `Lc` scoring, and sRGB alpha compositing.
- Hue- and chroma-preserving OKLCH lightness auto-fixer with sRGB gamut mapping and 8-bit hex quantization verification.
- Multi-theme evaluation via nested or dotted `$extensions` paths (e.g., `vn.dark`, `com.figma.modes.dark`) and overlay files, plus `detectExtensionPaths(tree)`.
- `check <fg> <bg>` one-liner and `init <paths...>` config scaffolder CLI subcommands.
- Five output formats (`pretty` with 24-bit ANSI swatches, `markdown`, `json`, interactive `html` Contrast Matrix, and `sarif` 2.1.0) plus a composite GitHub Action (`action.yml`).
