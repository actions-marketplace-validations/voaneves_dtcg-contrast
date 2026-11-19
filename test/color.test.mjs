import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  alphaOver,
  formatHex,
  formatOklch,
  oklchToSrgbGamutMapped,
  parseColor,
  srgbToOklch,
} from '../src/color.mjs';

describe('parseColor', () => {
  it('parses W3C DTCG 2025.10 srgb object', () => {
    const c = parseColor({
      colorSpace: 'srgb',
      components: [0.9569, 0.9176, 0.8314],
      hex: '#f4ead4',
    });
    assert.equal(formatHex(c), '#f4ead4');
    assert.equal(c.a, 1);
  });

  it('parses W3C DTCG 2025.10 oklch, hsl, display-p3, and none components', () => {
    const ok = parseColor({ colorSpace: 'oklch', components: [0.65, 0.2, 29] });
    assert.ok(ok.r > 0.7 && ok.g < 0.5 && ok.b < 0.5);

    const achromatic = parseColor({ colorSpace: 'oklch', components: [0.5, 0, 'none'] });
    assert.ok(Math.abs(achromatic.r - achromatic.g) < 1e-4);

    const hsl = parseColor({ colorSpace: 'hsl', components: [120, 100, 50] });
    assert.equal(formatHex(hsl), '#00ff00');

    const p3 = parseColor({ colorSpace: 'display-p3', components: [1, 0, 0] });
    assert.equal(p3.r, 1);
  });

  it('parses CSS hex, rgb(), hsl(), and oklch() strings', () => {
    assert.equal(formatHex(parseColor('#0a0a0a')), '#0a0a0a');
    assert.equal(formatHex(parseColor('#fff')), '#ffffff');
    assert.equal(formatHex(parseColor('#f5000080')), '#f5000080');
    assert.equal(formatHex(parseColor('rgb(245, 0, 0)')), '#f50000');
    assert.equal(formatHex(parseColor('rgba(10 10 10 / 50%)')), '#0a0a0a80');
    assert.equal(formatHex(parseColor('hsl(0, 100%, 50%)')), '#ff0000');

    const ok = parseColor('oklch(62.8% 0.2577 29.2deg)');
    assert.ok(ok.r > 0.9 && ok.g < 0.2);

    const csrgb = parseColor('color(srgb 0.9608 0 none / 50%)');
    assert.equal(formatHex(csrgb), '#f5000080');

    const cp3 = parseColor('color(display-p3 1 0 0)');
    assert.equal(cp3.r, 1);
  });

  it('falls back to hex when DTCG components are missing and throws on invalid input', () => {
    const c = parseColor({ hex: '#b80000' });
    assert.equal(formatHex(c), '#b80000');

    assert.throws(() => parseColor('not-a-color'), /Unsupported color string/);
    assert.throws(() => parseColor('#12345'), /Invalid hex color/);
    assert.throws(() => parseColor({ colorSpace: 'lab', components: [50, 0, 0] }), /Unsupported DTCG color/);
  });
});

describe('OKLCH conversion & alphaOver', () => {
  it('round-trips sRGB -> OKLCH -> sRGB accurately', () => {
    for (const hex of ['#0a0a0a', '#f4ead4', '#b80000', '#3366cc', '#ffffff']) {
      const orig = parseColor(hex);
      const back = oklchToSrgbGamutMapped(srgbToOklch(orig));
      assert.equal(formatHex(back), hex);
    }
  });

  it('formats OKLCH cleanly and composites alpha', () => {
    const okStr = formatOklch(parseColor('#b80000'));
    assert.match(okStr, /^oklch\(\d\.\d{3} \d\.\d{3} \d+\.\d\)$/);

    const comp = alphaOver(parseColor('#00000080'), parseColor('#ffffff'));
    assert.ok(Math.abs(comp.r - 0.5) < 0.01);
    assert.equal(comp.a, 1);
  });
});
