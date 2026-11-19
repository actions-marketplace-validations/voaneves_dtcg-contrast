export interface SrgbColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface OklchColor {
  l: number;
  c: number;
  h: number;
  a: number;
}

export type WcagLevel = 'AA' | 'AA-large' | 'UI' | 'AAA' | 'AAA-large';

export interface DtcgColorObject {
  colorSpace?: 'srgb' | 'oklch' | 'hsl' | 'display-p3' | string;
  components?: Array<number | 'none'>;
  alpha?: number;
  hex?: string;
}

export type ColorInput = string | DtcgColorObject | SrgbColor;

export interface ResolvedToken {
  name: string;
  raw: unknown;
  hex: string;
  resolvedFrom: string[];
  color: SrgbColor;
  description: string;
  deprecated: boolean;
  sourceFile: string | null;
}

export interface ThemeConfig {
  name: string;
  extensionPath?: string;
  overlayPaths?: string[];
  overlayTree?: Record<string, unknown>;
}

export interface PairConfig {
  fg: string;
  bg: string;
  level?: WcagLevel;
  minWcag?: number;
  minApca?: number;
  themes?: string[];
  name?: string;
  ignore?: boolean;
}

export interface AccessibleSuggestion {
  color?: SrgbColor;
  hex: string;
  oklch: string;
  wcag: number;
  apca: number;
  deltaL: number;
}

export interface PairResult {
  theme: string;
  name: string;
  fg: string;
  bg: string;
  fgHex: string;
  bgHex: string;
  fgSource: string | null;
  bgSource: string | null;
  fgDeprecated: boolean;
  bgDeprecated: boolean;
  level: string;
  requiredWcag: number;
  requiredApca: number;
  wcag: number;
  apca: number;
  wcagGrade: 'AAA' | 'AA' | 'AA-large' | 'FAIL';
  passed: boolean;
  suggestion: AccessibleSuggestion | null;
}

export interface AuditReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    themes: string[];
  };
  results: PairResult[];
}

export const WCAG_THRESHOLDS: Readonly<Record<WcagLevel, number>>;

export function srgbToLinear(c: number): number;
export function linearToSrgb(c: number): number;
export function inSrgbGamut(lin: { r: number; g: number; b: number }): boolean;
export function srgbToOklch(color: SrgbColor): OklchColor;
export function oklchToSrgb(oklch: OklchColor): SrgbColor;
export function oklchToSrgbGamutMapped(oklch: OklchColor): SrgbColor;
export function displayP3ToSrgb(components: [number, number, number], a?: number): SrgbColor;
export function parseColor(input: ColorInput): SrgbColor;
export function alphaOver(fg: SrgbColor, bg: SrgbColor): SrgbColor;
export function formatHex(color: SrgbColor): string;
export function formatOklch(color: SrgbColor | OklchColor): string;

export function relativeLuminance(color: { r: number; g: number; b: number }): number;
export function wcagContrast(fg: ColorInput, bg: ColorInput): number;
export function apcaContrast(fg: ColorInput, bg: ColorInput): number;
export function classifyWcag(ratio: number): 'AAA' | 'AA' | 'AA-large' | 'FAIL';
export function suggestAccessibleColor(
  fg: ColorInput,
  bg: ColorInput,
  options?: { minWcag?: number; minApca?: number }
): AccessibleSuggestion | null;

export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown>;
export function loadTokenSources(paths: string | string[]): Record<string, unknown>;
export function detectExtensionPaths(tree: Record<string, unknown>): string[];
export function extractColorTokens(
  tree: Record<string, unknown>,
  options?: {
    extensionPath?: string;
    overlayPaths?: string | string[];
    overlayTree?: Record<string, unknown>;
  }
): Map<string, ResolvedToken>;

export function discoverPairs(
  tokenMap: Map<string, ResolvedToken>,
  options?: { level?: string; minApca?: number }
): PairConfig[];

export function evaluatePairs(params: {
  tokenTree?: Record<string, unknown>;
  tokenTrees?: Record<string, unknown>;
  themes?: ThemeConfig[];
  pairs?: PairConfig[];
  auto?: boolean;
  level?: WcagLevel | string;
  minApca?: number;
}): AuditReport;

export function formatPretty(report: AuditReport, options?: { color?: boolean }): string;
export function formatMarkdown(report: AuditReport): string;
export function formatJson(report: AuditReport): string;
export function formatHtml(report: AuditReport): string;
export function formatSarif(report: AuditReport): string;
