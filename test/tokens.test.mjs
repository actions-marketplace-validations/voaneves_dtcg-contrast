import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  detectExtensionPaths,
  discoverPairs,
  evaluatePairs,
  expandPairRules,
  extractColorTokens,
  loadTokenSources,
} from '../src/index.mjs';

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dtcg-contrast-test-'));
}

describe('DTCG token loader & resolver', () => {
  it('loads directories recursively, inherits group $type, resolves multi-hop aliases, and switches themes', () => {
    const dir = makeTempDir();
    try {
      fs.mkdirSync(path.join(dir, 'ref'));
      fs.mkdirSync(path.join(dir, 'sys'));

      fs.writeFileSync(
        path.join(dir, 'ref', 'palette.json'),
        JSON.stringify({
          ref: {
            color: {
              $type: 'color',
              ink: { $value: { colorSpace: 'srgb', components: [0.0392, 0.0392, 0.0392], hex: '#0a0a0a' } },
              cream: { $value: { colorSpace: 'srgb', components: [0.9569, 0.9176, 0.8314], hex: '#f4ead4' } },
              red: { $value: { colorSpace: 'srgb', components: [0.9608, 0, 0], hex: '#f50000' } },
              redDark: { $value: { colorSpace: 'srgb', components: [0.7216, 0, 0], hex: '#b80000' } },
            },
          },
        })
      );

      fs.writeFileSync(
        path.join(dir, 'sys', 'semantic.json'),
        JSON.stringify({
          color: {
            $type: 'color',
            surface: {
              $value: '{ref.color.cream}',
              $extensions: { vn: { dark: '{ref.color.ink}' } },
            },
            text: {
              $value: '{ref.color.ink}',
              $extensions: { vn: { dark: '{ref.color.cream}' } },
            },
            accent: {
              $value: '{color.accentBase}',
            },
            accentBase: {
              $value: '{ref.color.red}',
              $extensions: { vn: { dark: '{ref.color.redDark}' } },
            },
          },
        })
      );

      const tree = loadTokenSources(dir);
      const light = extractColorTokens(tree);
      assert.equal(light.get('color.surface').hex, '#f4ead4');
      assert.equal(light.get('color.text').hex, '#0a0a0a');
      assert.equal(light.get('color.accent').hex, '#f50000');
      assert.deepEqual(light.get('color.accent').resolvedFrom, [
        'color.accentBase',
        'ref.color.red',
      ]);

      const dark = extractColorTokens(tree, { extensionPath: 'vn.dark' });
      assert.equal(dark.get('color.surface').hex, '#0a0a0a');
      assert.equal(dark.get('color.text').hex, '#f4ead4');
      assert.equal(dark.get('color.accent').hex, '#b80000');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('supports overlay file theme overrides', () => {
    const dir = makeTempDir();
    try {
      const base = path.join(dir, 'base.json');
      const overlay = path.join(dir, 'dark.json');
      fs.writeFileSync(
        base,
        JSON.stringify({
          color: {
            $type: 'color',
            surface: { $value: '#ffffff' },
            text: { $value: '#111111' },
          },
        })
      );
      fs.writeFileSync(
        overlay,
        JSON.stringify({
          color: {
            surface: { $value: '#111111' },
            text: { $value: '#f5f5f5' },
          },
        })
      );

      const tree = loadTokenSources(base);
      const dark = extractColorTokens(tree, { overlayPaths: [overlay] });
      assert.equal(dark.get('color.surface').hex, '#111111');
      assert.equal(dark.get('color.text').hex, '#f5f5f5');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects circular and missing aliases clearly', () => {
    assert.throws(
      () =>
        extractColorTokens({
          a: { $type: 'color', $value: '{b}' },
          b: { $type: 'color', $value: '{a}' },
        }),
      /Circular token alias/
    );

    assert.throws(
      () =>
        extractColorTokens({
          a: { $type: 'color', $value: '{does.not.exist}' },
        }),
      /Missing alias target/
    );
  });

  it('supports DTCG $root tokens, dotted $extensions keys, $deprecated, source tracking, and detectExtensionPaths', () => {
    const dir = makeTempDir();
    try {
      const file = path.join(dir, 'design.tokens.json');
      fs.writeFileSync(
        file,
        JSON.stringify({
          color: {
            $type: 'color',
            brand: {
              $root: {
                $value: '#b80000',
                $deprecated: true,
                $extensions: { 'com.figma': { modes: { dark: '#ff5a5a' } } },
              },
              subtle: { $value: '{color.brand.$root}' },
            },
            surface: {
              $value: '#f4ead4',
              $extensions: { 'com.figma': { modes: { dark: '#0a0a0a' } } },
            },
          },
        })
      );

      const tree = loadTokenSources(file);
      assert.deepEqual(detectExtensionPaths(tree), ['com.figma.modes.dark']);

      const light = extractColorTokens(tree);
      assert.equal(light.get('color.brand').hex, '#b80000');
      assert.equal(light.get('color.brand').deprecated, true);
      assert.equal(light.get('color.brand.subtle').hex, '#b80000');
      assert.match(light.get('color.brand').sourceFile, /design\.tokens\.json$/);

      const dark = extractColorTokens(tree, { extensionPath: 'com.figma.modes.dark' });
      assert.equal(dark.get('color.brand').hex, '#ff5a5a');
      assert.equal(dark.get('color.surface').hex, '#0a0a0a');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('discoverPairs & evaluatePairs', () => {
  it('auto-discovers semantic pairs and evaluates multiple themes with OKLCH suggestions', () => {
    const tree = {
      ref: {
        $type: 'color',
        cream: { $value: '#f4ead4' },
        ink: { $value: '#0a0a0a' },
        signal: { $value: '#f50000' },
      },
      color: {
        $type: 'color',
        surface: { $value: '{ref.cream}', $extensions: { mode: { dark: '{ref.ink}' } } },
        'surface-inverse': { $value: '{ref.ink}' },
        text: { $value: '{ref.ink}', $extensions: { mode: { dark: '{ref.cream}' } } },
        'text-on-inverse': { $value: '{ref.cream}' },
        'signal-ink': { $value: '{ref.signal}' },
      },
    };

    const lightMap = extractColorTokens(tree);
    const pairs = discoverPairs(lightMap);
    assert.ok(pairs.some((p) => p.fg === 'color.text' && p.bg === 'color.surface'));
    assert.ok(pairs.some((p) => p.fg === 'color.text-on-inverse' && p.bg === 'color.surface-inverse'));
    assert.ok(!pairs.some((p) => p.fg === 'color.text-on-inverse' && p.bg === 'color.surface'));

    const report = evaluatePairs({
      tokenTree: tree,
      themes: [{ name: 'light' }, { name: 'dark', extensionPath: 'mode.dark' }],
      pairs: [
        { fg: 'color.text', bg: 'color.surface', level: 'AA' },
        { fg: 'color.signal-ink', bg: 'color.surface', level: 'AA', themes: ['light'] },
      ],
    });

    assert.equal(report.summary.total, 3);
    assert.equal(report.summary.passed, 2);
    assert.equal(report.summary.failed, 1);
    const fail = report.results.find((r) => !r.passed);
    assert.ok(fail.suggestion !== null);
    assert.ok(fail.suggestion.wcag >= 4.5);
  });

  it('records exact 1-based line/column positions and expands glob pairs with exclude', () => {
    const dir = makeTempDir();
    try {
      const file = path.join(dir, 'tokens.json');
      fs.writeFileSync(
        file,
        [
          '{',
          '  "color": {',
          '    "$type": "color",',
          '    "brand": {',
          '      "$root": { "$value": "#0a0a0a" }',
          '    },',
          '    "text": { "$value": "#0a0a0a" },',
          '    "text-muted": { "$value": "#5c5446" },',
          '    "surface": { "$value": "#f4ead4" },',
          '    "surface-soft": { "$value": "#efe4c5" },',
          '    "surface-inverse": { "$value": "#0a0a0a" }',
          '  }',
          '}',
        ].join('\n')
      );

      const tree = loadTokenSources(file);
      const map = extractColorTokens(tree);
      assert.deepEqual(
        {
          line: map.get('color.brand').sourceLocation.startLine,
          col: map.get('color.brand').sourceLocation.startColumn,
        },
        { line: 5, col: 7 }
      );
      assert.deepEqual(
        {
          line: map.get('color.text').sourceLocation.startLine,
          col: map.get('color.text').sourceLocation.startColumn,
        },
        { line: 7, col: 5 }
      );

      const expanded = expandPairRules(
        [{ fg: 'color.text*', bg: 'color.surface*', exclude: ['color.surface-inverse'], level: 'AA' }],
        map
      );
      assert.equal(expanded.length, 4);
      assert.ok(expanded.every((p) => p.bg !== 'color.surface-inverse'));

      const report = evaluatePairs({
        tokenTree: tree,
        pairs: [{ fg: 'color.text*', bg: 'color.surface*', exclude: ['color.surface-inverse'], level: 'AA' }],
      });
      assert.equal(report.summary.total, 4);
      assert.equal(report.summary.failed, 0);
      assert.equal(report.results[0].fgLocation.startLine, 7);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
