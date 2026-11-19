import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
      assert.match(html, /FAIL/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    const zeroCfg = runBin([TOKENS_FILE, '--mode', 'dark:vn.dark', '--no-color']);
    assert.equal(zeroCfg.code, 0);
    assert.match(zeroCfg.stdout, /Theme: light/);
    assert.match(zeroCfg.stdout, /Theme: dark/);
  });

  it('exits 2 on invalid path or option', () => {
    const missing = runBin(['./does-not-exist.json']);
    assert.equal(missing.code, 2);
    assert.match(missing.stderr, /Error:/);

    const badLevel = runBin([TOKENS_FILE, '--level', 'ZZZ']);
    assert.equal(badLevel.code, 2);
  });
});
