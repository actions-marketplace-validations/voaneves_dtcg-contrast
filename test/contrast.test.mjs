import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatHex, parseColor, srgbToOklch } from '../src/color.mjs';
import {
  apcaContrast,
  classifyWcag,
  relativeLuminance,
  suggestAccessibleColor,
  wcagContrast,
} from '../src/contrast.mjs';

describe('WCAG 2.2 contrast', () => {
  it('matches standard WCAG reference vectors', () => {
    assert.equal(relativeLuminance(parseColor('#000000')), 0);
    assert.equal(relativeLuminance(parseColor('#ffffff')), 1);
    assert.equal(wcagContrast('#000000', '#ffffff'), 21);
    assert.equal(wcagContrast('#ffffff', '#000000'), 21);

    // VOANEVES brand palette vectors
    assert.ok(Math.abs(wcagContrast('#f50000', '#f4ead4') - 3.60) < 0.05);
    assert.ok(Math.abs(wcagContrast('#b80000', '#f4ead4') - 5.78) < 0.02);
    assert.ok(Math.abs(wcagContrast('#0a0a0a', '#f50000') - 4.60) < 0.05);
    assert.ok(Math.abs(wcagContrast('#ff3838', '#0a0a0a') - 5.54) < 0.05);
  });

  it('handles semi-transparent foregrounds via alpha compositing', () => {
    const lowContrast = wcagContrast('rgba(10 10 10 / 12%)', '#f4ead4');
    assert.ok(lowContrast < 1.5);
    assert.equal(classifyWcag(7.1), 'AAA');
    assert.equal(classifyWcag(4.6), 'AA');
    assert.equal(classifyWcag(3.2), 'AA-large');
    assert.equal(classifyWcag(2.1), 'FAIL');
  });
});

describe('APCA-W3 contrast', () => {
  it('matches standard APCA-W3 polarity and magnitude vectors', () => {
    const blackOnWhite = apcaContrast('#000000', '#ffffff');
    const whiteOnBlack = apcaContrast('#ffffff', '#000000');
    assert.ok(Math.abs(blackOnWhite - 106.04) < 0.2);
    assert.ok(Math.abs(whiteOnBlack - -107.88) < 0.2);
    assert.equal(apcaContrast('#777777', '#777777'), 0);
  });
});

describe('suggestAccessibleColor', () => {
  it('auto-fixes failing #f50000 on #f4ead4 while preserving hue and passing 4.5:1 after quantization', () => {
    const orig = parseColor('#f50000');
    const bg = parseColor('#f4ead4');
    const fix = suggestAccessibleColor(orig, bg, { minWcag: 4.5 });

    assert.ok(fix !== null);
    assert.ok(fix.wcag >= 4.5, `Expected >= 4.5, got ${fix.wcag}`);
    assert.equal(wcagContrast(parseColor(fix.hex), bg) >= 4.5, true);
    assert.ok(fix.deltaL < 0, 'Should darken red on light cream');

    const origOklch = srgbToOklch(orig);
    const fixOklch = srgbToOklch(fix.color);
    const hueDiff = Math.min(
      Math.abs(origOklch.h - fixOklch.h),
      360 - Math.abs(origOklch.h - fixOklch.h)
    );
    assert.ok(hueDiff < 2.0, `Expected hue preserved within 2 deg, got ${hueDiff}`);
  });

  it('lightens dark failing foreground on dark background and returns null when impossible', () => {
    const fix = suggestAccessibleColor('#666666', '#141414', { minWcag: 4.5, minApca: 60 });
    assert.ok(fix !== null);
    assert.ok(fix.wcag >= 4.5);
    assert.ok(Math.abs(fix.apca) >= 60);
    assert.ok(fix.deltaL > 0);
    assert.equal(formatHex(parseColor(fix.hex)), fix.hex);

    const impossible = suggestAccessibleColor('rgba(0 0 0 / 10%)', '#808080', { minWcag: 7.0 });
    assert.equal(impossible, null);
  });
});
