# Changelog

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
