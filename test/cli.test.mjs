import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatHtml } from '../src/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'dtcg-contrast.mjs');
const PASS_CFG = path.join(ROOT, 'examples', 'voaneves-brand', 'dtcg-contrast.config.json');
const FAIL_CFG = path.join(ROOT, 'examples', 'voaneves-brand', 'demo-fail.config.json');
const TOKENS_FILE = path.join(ROOT, 'examples', 'voaneves-brand', 'tokens.json');

function runBin(args) {
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      code: err.status ?? 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
    };
  }
}

describe('dtcg-contrast CLI', () => {
  it('exits 0 on --help, --version, and passing config', () => {
    const help = runBin(['--help']);
    assert.equal(help.code, 0);
    assert.match(help.stdout, /Usage:/);

    const ver = runBin(['--version']);
    assert.equal(ver.code, 0);
    assert.match(ver.stdout.trim(), /^\d+\.\d+\.\d+$/);

    const ok = runBin(['--config', PASS_CFG, '--no-color']);
    assert.equal(ok.code, 0);
    assert.match(ok.stdout, /PASS — 16\/16 pairs passed/);
  });

  it('exits 1 on failing config and outputs OKLCH fix suggestion', () => {
    const fail = runBin(['--config', FAIL_CFG, '--no-color']);
    assert.equal(fail.code, 1);
    assert.match(fail.stdout, /FAIL \(AA-large\)/);
    assert.match(fail.stdout, /Suggested OKLCH fix:/);

    const advisory = runBin(['--config', FAIL_CFG, '--no-fail', '--no-color']);
    assert.equal(advisory.code, 0);
  });

  it('supports json, markdown, and html --output formats + zero-config --mode', () => {
    const jsonRes = runBin(['--config', PASS_CFG, '--format', 'json']);
    assert.equal(jsonRes.code, 0);
    const parsed = JSON.parse(jsonRes.stdout);
    assert.equal(parsed.summary.total, 16);
    assert.equal(parsed.summary.failed, 0);

    const mdRes = runBin(['--config', FAIL_CFG, '--format', 'markdown', '--no-fail']);
    assert.equal(mdRes.code, 0);
    assert.match(mdRes.stdout, /## ❌ DTCG Contrast Audit/);
    assert.match(mdRes.stdout, /OKLCH Auto-Fix Suggestions/);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dtcg-html-'));
    try {
      const htmlPath = path.join(tmpDir, 'matrix.html');
      const htmlRes = runBin([
        '--config',
        FAIL_CFG,
        '--format',
        'html',
        '--output',
        htmlPath,
        '--no-fail',
      ]);
      assert.equal(htmlRes.code, 0);
      const html = fs.readFileSync(htmlPath, 'utf8');
      assert.match(html, /<!doctype html>/i);
      assert.match(html, /DTCG Contrast Matrix/);
      assert.match(html, /data-status-filter/);
      assert.match(html, /data-theme-filter/);
      assert.match(html, /searchInput/);
      assert.match(html, /data-copy/);
      assert.match(html, /FAIL/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    const sarifRes = runBin(['--config', FAIL_CFG, '--format', 'sarif', '--no-fail']);
    assert.equal(sarifRes.code, 0);
    const sarif = JSON.parse(sarifRes.stdout);
    assert.equal(sarif.version, '2.1.0');
    assert.equal(sarif.runs[0].results.length, 1);
    assert.equal(sarif.runs[0].results[0].ruleId, 'dtcg-wcag-contrast');
    assert.match(sarif.runs[0].results[0].message.text, /#d70000/);
    assert.match(
      sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri,
      /examples\/voaneves-brand\/tokens\.json$/
    );

    const zeroCfg = runBin([TOKENS_FILE, '--mode', 'dark:vn.dark', '--no-color']);
    assert.equal(zeroCfg.code, 0);
    assert.match(zeroCfg.stdout, /Theme: light/);
    assert.match(zeroCfg.stdout, /Theme: dark/);
  });

  it('supports check and init subcommands and escapes HTML output safely', () => {
    const passCheck = runBin(['check', '#0a0a0a', '#f4ead4', '--no-color']);
    assert.equal(passCheck.code, 0);
    assert.match(passCheck.stdout, /PASS/);

    const failCheck = runBin(['check', '#f50000', '#f4ead4', '--format', 'json']);
    assert.equal(failCheck.code, 1);
    const failJson = JSON.parse(failCheck.stdout);
    assert.equal(failJson.summary.failed, 1);
    assert.equal(failJson.results[0].suggestion.hex, '#d70000');

    const badCheck = runBin(['check', 'not-a-color', '#ffffff']);
    assert.equal(badCheck.code, 2);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dtcg-init-'));
    try {
      const cfgPath = path.join(tmpDir, 'dtcg-contrast.config.json');
      const initRes = runBin(['init', TOKENS_FILE, '--output', cfgPath]);
      assert.equal(initRes.code, 0);
      assert.match(initRes.stdout, /2 theme\(s\)/);

      const generated = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      assert.equal(generated.themes[1].extensionPath, 'vn.dark');
      assert.ok(generated.pairs.length > 0);

      const overwriteErr = runBin(['init', TOKENS_FILE, '--output', cfgPath]);
      assert.equal(overwriteErr.code, 2);

      const forceRes = runBin(['init', TOKENS_FILE, '--output', cfgPath, '--force']);
      assert.equal(forceRes.code, 0);

      const auditGenerated = runBin(['--config', cfgPath, '--no-color']);
      assert.equal(auditGenerated.code, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    const html = formatHtml({
      summary: { total: 1, passed: 1, failed: 0, themes: ['<script>alert(1)</script>'] },
      results: [
        {
          theme: '<script>alert(1)</script>',
          name: 'xss',
          fg: '<img onerror=alert(1)>',
          bg: 'surface',
          fgHex: '#000000',
          bgHex: '#ffffff',
          fgSource: null,
          bgSource: null,
          fgDeprecated: true,
          bgDeprecated: false,
          level: 'AA',
          requiredWcag: 4.5,
          requiredApca: 0,
          wcag: 21,
          apca: 106,
          wcagGrade: 'AAA',
          passed: true,
          suggestion: null,
        },
      ],
    });
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(!html.includes('<img onerror=alert(1)>'));
    assert.match(html, /pill-dep/);
  });

  it('exits 2 on invalid path or option', () => {
    const missing = runBin(['./does-not-exist.json']);
    assert.equal(missing.code, 2);
    assert.match(missing.stderr, /Error:/);

    const badLevel = runBin([TOKENS_FILE, '--level', 'ZZZ']);
    assert.equal(badLevel.code, 2);
  });
});
