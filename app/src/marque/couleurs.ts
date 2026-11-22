// Calculs de couleur de la marque : mélange, luminance, contraste (WCAG), correction des couples illisibles.

export type Rgb = { r: number; g: number; b: number };

export function estCouleurHex(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);
}

export function versRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function versHex({ r, g, b }: Rgb): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/** t = 0 donne a, t = 1 donne b. */
export function melanger(a: string, b: string, t: number): string {
  const x = versRgb(a);
  const y = versRgb(b);
  return versHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

export function eclaircir(hex: string, t: number): string {
  return melanger(hex, '#FFFFFF', t);
}

export function assombrir(hex: string, t: number): string {
  return melanger(hex, '#000000', t);
}

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const { r, g, b } = versRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contraste(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [haut, bas] = la > lb ? [la, lb] : [lb, la];
  return (haut + 0.05) / (bas + 0.05);
}

/** Texte noir ou blanc, selon ce qui se lit le mieux sur ce fond. */
export function texteSur(fond: string): string {
  return contraste(fond, '#FFFFFF') >= contraste(fond, '#000000') ? '#FFFFFF' : '#000000';
}

/** Éclaircit ou assombrit `couleur` (selon le fond) par petits pas jusqu'à atteindre `min` de contraste sur `fond`. */
export function ajusterContraste(couleur: string, fond: string, min: number): string {
  if (contraste(couleur, fond) >= min) return couleur;
  const versNoir = luminance(fond) > 0.4;
  let c = couleur;
  for (let i = 0; i < 40 && contraste(c, fond) < min; i++) c = melanger(c, versNoir ? '#000000' : '#FFFFFF', 0.08);
  return c;
}
