# Frontend AMC 2026 — Expo / React Native / TypeScript

Ce dossier est à copier dans **`AMC-2026/app/frontend/`**, sans remplacer `app/package.json`, `app/src/` ou d'autres fichiers de l'équipe.

## Contenu
- **Citoyen** : deux onglets, `Carte` et `Mes alertes` ; signalement sur un puisard par catégorie.
- **Superviseur** : tableau de bord, alertes et filtres, sélection d'égouts, optimisation *de démonstration*, affectation à une équipe, consultation et approbation des rapports.
- **Employé** : **une seule page**, `Ma carte`, pour le compte responsable de l'équipe. Marque `Fait` ou `À suivre` (avec justification), puis transmet le rapport.
- **Règle** : seule l'approbation du superviseur passe les alertes liées aux égouts `Fait` à `Résolue`.

## Branchement rapide sans écraser l'app
Dans le projet Expo existant, créer **un seul fichier de route** `app/src/app/frontend-demo.tsx` (si les routes sont effectivement sous `src/app/`; sinon dans le dossier des routes existant). Contenu :

```tsx
export { default } from '../../frontend/FrontendDemo';
```

Cette ligne est correcte seulement pour `app/src/app/frontend-demo.tsx` (elle remonte deux dossiers). Adapter le chemin si la route est ailleurs.

Puis, depuis `AMC-2026/app/` :

```bash
npm install
npm run web
```

Visiter `/frontend-demo` sur l'application web Expo. Pour téléphone : `npm start` et ouvrir l'app avec l'environnement Expo compatible.

## Limites explicites du prototype
1. **Carte schématique**, avec 6 égouts fictifs; aucune donnée cartographique ou position réelle.
2. **Connexion simulée** : commutateur de rôle pour le jury, pas d'authentification ni de contrôle d'accès serveur.
3. **Données en mémoire** : tout se réinitialise au rechargement, pas de synchronisation entre deux appareils.
4. **Optimisation illustrative** : heuristique de priorité/proximité, pas de distances routières ni de garantie de route optimale.
5. **Pas de photos/GPS opérationnels** : intégrations futures à construire.
6. Les dates des alertes de démonstration sont des données fictives.

## Pour la vraie version
- Connecter Supabase ou votre backend à la place de `DemoContext.tsx`.
- Introduire une bibliothèque cartographique compatible avec les plateformes visées, et les données officielles des puisards.
- Ajouter l'authentification avec rôles `citoyen`, `superviseur`, `responsable_equipe` et les permissions validées côté serveur.
- Rendre le compte d'équipe accessible à **un seul responsable par équipe**, et mettre en place l'envoi et la validation des rapports.
- Brancher un moteur d'itinéraires/réseau routier et GPS après avoir validé la disponibilité sur Expo SDK 58.

**Ne pas copier les fichiers React/Vite `.jsx` précédemment fournis** dans cette application Expo.
