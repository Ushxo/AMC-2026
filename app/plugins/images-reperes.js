// Les repères de la carte Google sont des images cherchées par leur nom dans l'app :
// on les copie telles quelles (avec leur suffixe @3x) dans le projet iOS.
const { IOSConfig, withXcodeProject } = require('expo/config-plugins');
const { copyFileSync, readdirSync } = require('fs');
const { join } = require('path');

module.exports = function avecImagesReperes(config) {
  return withXcodeProject(config, (mod) => {
    const nomProjet = mod.modRequest.projectName ?? 'SignalementMTL';
    const source = join(mod.modRequest.projectRoot, 'assets', 'reperes');
    const cible = join(mod.modRequest.platformProjectRoot, nomProjet);
    for (const fichier of readdirSync(source).filter((f) => f.endsWith('.png'))) {
      copyFileSync(join(source, fichier), join(cible, fichier));
      mod.modResults = IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: `${nomProjet}/${fichier}`,
        groupName: nomProjet,
        project: mod.modResults,
        isBuildFile: true,
        verbose: false,
      });
    }
    return mod;
  });
};
