declare const __dirname: string;
const fs: any = jest.requireActual('fs');
const path: any = jest.requireActual('path');

// Les marges, écarts, remplissages et rayons suivent l'échelle de l'interface (constants/theme.ts : ESPACES et RAYONS).
// Une valeur isolée (13, 14, 18, 22 au hasard) rend les écrans incohérents : ce test la signale.
const RACINE = path.resolve(__dirname, '../../..');
const ESPACES = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64];
const RAYONS_PETITS_OK = 8;
const RAYONS = [12, 16, 22, 30];
const IGNORES = ['src/constants/theme.ts', 'src/components/ville/style.ts', 'src/marque/'];

function fichiers(dossier: string): string[] {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e: { name: string; isDirectory: () => boolean }) => {
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'donnees' ? [] : fichiers(chemin);
    return /\.(ts|tsx)$/.test(e.name) ? [chemin] : [];
  });
}

const CLE_ESPACE = /\b((?:padding|margin)(?:Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?|gap|rowGap|columnGap)\s*:\s*(\d+(?:\.\d+)?)\b(?!\s*[%*/+-])/g;
const CLE_RAYON = /\bborderRadius\s*:\s*(\d+(?:\.\d+)?)\b(?!\s*[%*/+-])/;

describe('échelle d’espacement et de rayons', () => {
  it('aucune valeur isolée dans les styles des écrans', () => {
    const fautifs: string[] = [];
    for (const dossier of ['src', 'frontend']) {
      for (const f of fichiers(path.join(RACINE, dossier))) {
        const rel = path.relative(RACINE, f).split(path.sep).join('/');
        if (IGNORES.some((p) => rel === p || rel.startsWith(p))) continue;
        const lignes: string[] = fs.readFileSync(f, 'utf8').split('\n');
        lignes.forEach((l, i) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
          for (const m of l.matchAll(CLE_ESPACE)) {
            if (!ESPACES.includes(Number(m[2]))) fautifs.push(`${rel}:${i + 1}: ${m[1]}: ${m[2]}`);
          }
          const r = l.match(CLE_RAYON);
          if (r) {
            const v = Number(r[1]);
            if (v > RAYONS_PETITS_OK && v < 999 && !RAYONS.includes(v)) {
              // un rond : largeur et hauteur égales au double du rayon, dans le voisinage
              const voisinage = lignes.slice(Math.max(0, i - 6), i + 7).join('\n');
              const rond = new RegExp(`width:\\s*${v * 2}\\b`).test(voisinage) || new RegExp(`height:\\s*${v * 2}\\b`).test(voisinage);
              if (!rond) fautifs.push(`${rel}:${i + 1}: borderRadius: ${v}`);
            }
          }
        });
      }
    }
    expect(fautifs).toEqual([]);
  });
});
