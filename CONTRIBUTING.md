# Contributing to dtcg-contrast

Thank you for helping improve **dtcg-contrast**!

## Philosophy

- **Zero runtime and dev dependencies** — keep everything strictly on standard Node.js `>=22` built-in APIs (`node:fs`, `node:path`, `node:test`, `node:assert/strict`).
- **Verify color math** against W3C WCAG 2.2, APCA-W3 0.0.98G-4g, and W3C DTCG 2025.10 specifications.

## Local Workflow

```bash
git clone https://github.com/voaneves/dtcg-contrast.git
cd dtcg-contrast
npm test
npm run example
```

Please add unit or CLI tests under `test/` for every fix or feature and run `npm test` before opening a pull request.
