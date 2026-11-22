declare const __dirname: string;
const fs: any = jest.requireActual('fs');
const path: any = jest.requireActual('path');

// L'app ne suit QUE son propre thème : aucun fichier ne lit le mode clair ou sombre du téléphone.
// Fichiers autorisés : aucun (le thème de navigation et la carte passent par les jetons de la marque).
const RACINE = path.resolve(__dirname, '../../..');
const AUTORISES: string[] = [];

function fichiers(dossier: string): string[] {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e: { name: string; isDirectory: () => boolean }) => {
    const chemin = path.join(dossier, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'donnees' || e.name === 'aide-tests' ? [] : fichiers(chemin);
    return /\.(ts|tsx)$/.test(e.name) ? [chemin] : [];
  });
}

describe('aucune dépendance au mode du système', () => {
  it('useColorScheme et Appearance ne sont importés nulle part', () => {
    const fautifs: string[] = [];
    for (const dossier of ['src', 'frontend']) {
      for (const f of fichiers(path.join(RACINE, dossier))) {
        const rel = path.relative(RACINE, f).split(path.sep).join('/');
        if (AUTORISES.includes(rel)) continue;
        const texte: string = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        if (/\buseColorScheme\b|\bAppearance\b(?!\s*[:=]|\w)|use-color-scheme/.test(texte.replace(/keyboardAppearance/g, ''))) fautifs.push(rel);
      }
    }
    expect(fautifs).toEqual([]);
  });
});

describe('plus de sélecteur de style de carte', () => {
  it('aucun fichier ne parle d’« Automatique » ni de préférence de thème de carte', () => {
    const fautifs: string[] = [];
    for (const dossier of ['src', 'frontend']) {
      for (const f of fichiers(path.join(RACINE, dossier))) {
        const texte: string = fs.readFileSync(f, 'utf8');
        if (/>\s*Automatique\s*</.test(texte) || /label:\s*['"]Automatique['"]|Automatique:|'Automatique'|"Automatique"/.test(texte) || /theme-pref|PreferenceTheme|selecteur-carte/.test(texte)) fautifs.push(path.relative(RACINE, f));
      }
    }
    expect(fautifs).toEqual([]);
  });
});
