declare const __dirname: string;
const fs: any = jest.requireActual('fs');
const path: any = jest.requireActual('path');

// Toute couleur d'interface passe par les jetons de la marque. Une couleur écrite en dur (#RRGGBB) n'est permise que dans les fichiers
// de jetons et de couleurs fixes (repères de carte, gravité, équipes, avis d'eau, caméra) : sinon la marque et le mode sombre ne repeindraient pas l'écran.
const RACINE = path.resolve(__dirname, '../../..');
const PERMIS = [
  'src/constants/theme.ts',
  'src/marque/',
  'src/components/ville/style.ts',
  'src/components/animated-icon.tsx',
  'src/components/carte/navigation-google.tsx',
  'src/components/citoyen-essai/style.ts',
  'src/donnees/',
];

function fichiers(dossier: string): string[] {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e: { name: string; isDirectory: () => boolean }) => {
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'donnees' ? [] : fichiers(chemin);
    return /\.(ts|tsx)$/.test(e.name) ? [chemin] : [];
  });
}

describe('aucune couleur d’interface en dur', () => {
  it('les écrans et composants ne contiennent pas de #RRGGBB hors des fichiers de jetons et de couleurs fixes', () => {
    const fautifs: string[] = [];
    for (const dossier of ['src', 'frontend']) {
      for (const f of fichiers(path.join(RACINE, dossier))) {
        const rel = path.relative(RACINE, f).split(path.sep).join('/');
        if (PERMIS.some((p) => rel === p || rel.startsWith(p))) continue;
        const lignes = fs.readFileSync(f, 'utf8').split('\n');
        lignes.forEach((l: string, i: number) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
          if (/#[0-9A-Fa-f]{6}\b/.test(l)) fautifs.push(`${rel}:${i + 1}: ${l.trim().slice(0, 80)}`);
        });
      }
    }
    expect(fautifs).toEqual([]);
  });
});
