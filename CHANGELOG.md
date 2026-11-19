# Changelog

## [0.1.0] - 2026-11-19

### Added
- Zero-dependency W3C DTCG 2025.10 token loader with group `$type` inheritance, multi-hop `{alias}` resolution, and circular-reference detection.
- Exact WCAG 2.2 contrast ratios, APCA-W3 (0.0.98G-4g) `Lc` scoring, and sRGB alpha compositing.
- Hue- and chroma-preserving OKLCH lightness auto-fixer with sRGB gamut mapping and 8-bit hex quantization verification.
- Multi-theme evaluation via `$extensions` path overrides (e.g., `vn.dark`, `mode.dark`) and overlay files.
- Four output formats (`pretty` with 24-bit ANSI swatches, `markdown`, `json`, `html` contrast matrix) and a zero-config composite GitHub Action (`action.yml`).
