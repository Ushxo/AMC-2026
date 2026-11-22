import { createContext, memo, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Store d'un onglet : objet STABLE (créé une fois par panneau). Sa valeur change quand l'onglet est montré ou caché, mais le contexte
 * qui le porte ne change jamais : une bascule ne redessine aucun écran, sauf ceux qui s'abonnent explicitement (`useOngletActif`).
 */
type StoreOnglet = { lire: () => boolean; definir: (v: boolean) => void; abonner: (f: () => void) => () => void };

function creerStore(initial: boolean): StoreOnglet {
  let actif = initial;
  const ecouteurs = new Set<() => void>();
  return {
    lire: () => actif,
    definir: (v) => {
      if (v === actif) return;
      actif = v;
      ecouteurs.forEach((f) => f());
    },
    abonner: (f) => {
      ecouteurs.add(f);
      return () => {
        ecouteurs.delete(f);
      };
    },
  };
}

const OngletActifContexte = createContext<StoreOnglet>(creerStore(true));

/** L'onglet qui contient cet écran est-il visible ? Redessine l'écran à chaque bascule : réservé aux petits composants. (Vrai hors coquille.) */
export function useOngletActif(): boolean {
  const store = useContext(OngletActifContexte);
  return useSyncExternalStore(store.abonner, store.lire, store.lire);
}

/**
 * Lecture SANS rendu de la visibilité de l'onglet : à lire dans un minuteur ou un rappel (`ref.current()`). Une bascule
 * ne redessine pas le composant et ne relance aucun effet.
 */
export function useOngletActifRef(): { current: () => boolean } {
  const store = useContext(OngletActifContexte);
  const [lecteur] = useState(() => ({ current: store.lire }));
  return lecteur;
}

export type OngletGarde = {
  id: string;
  /** Contenu de l'onglet : créé une seule fois, et seulement quand `deps` change (pas à chaque rendu de la coquille). */
  rendu: () => ReactNode;
  /** Ce dont dépend le contenu (état de la coquille qu'il lit). Vide : le contenu ne se redessine jamais à cause de la coquille. */
  deps?: readonly unknown[];
  /**
   * Garde l'onglet visible SOUS les autres quand il est caché (sans toucher) : pour une carte native, dont on ne change jamais
   * l'opacité ni la taille (un changement d'alpha d'une carte force un nouveau rendu des tuiles). Les autres onglets doivent alors
   * être opaques : voir `fond`.
   */
  gardeTaille?: boolean;
};

/**
 * Coquille à onglets qui GARDE montés les onglets déjà visités : un onglet n'est monté qu'à son premier passage, puis seulement
 * caché (jamais démonté). Revenir sur la carte ne recrée plus la carte native ni ses repères, et les écrans gardent leur état.
 * Un onglet caché ne reçoit aucun toucher, est masqué au lecteur d'écran et ne se redessine pas quand la coquille change d'onglet.
 * `fond` : couleur opaque des onglets ordinaires (ils recouvrent l'onglet « gardeTaille » resté dessous).
 */
export function OngletsGardes({ actif, onglets, fond, style }: { actif: string; onglets: OngletGarde[]; fond?: string; style?: StyleProp<ViewStyle> }) {
  const [visites, setVisites] = useState<ReadonlySet<string>>(() => new Set([actif]));
  if (!visites.has(actif)) setVisites(new Set([...visites, actif]));
  return (
    <View style={[styles.cadre, style]}>
      {onglets.map((o) => (visites.has(o.id) || o.id === actif ? <Panneau key={o.id} onglet={o} visible={o.id === actif} fond={fond} /> : null))}
    </View>
  );
}

const memesDeps = (a: readonly unknown[] = [], b: readonly unknown[] = []) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/** Contenu d'un onglet : figé tant que ses dépendances ne changent pas (la fonction n'est rappelée qu'alors). */
const ContenuFige = memo(
  function ContenuFige({ rendu }: { rendu: () => ReactNode; deps?: readonly unknown[] }) {
    return <>{rendu()}</>;
  },
  (avant, apres) => memesDeps(avant.deps, apres.deps),
);

function Panneau({ onglet, visible, fond }: { onglet: OngletGarde; visible: boolean; fond?: string }) {
  // Le store est créé une fois ; seule sa valeur change (jamais l'objet donné au contexte).
  const [store] = useState<StoreOnglet>(() => creerStore(visible));
  useEffect(() => {
    store.definir(visible);
  }, [visible, store]);
  const cache = onglet.gardeTaille ? null : styles.retire;
  return (
    <View
      style={[StyleSheet.absoluteFill, !onglet.gardeTaille && fond ? { backgroundColor: fond } : null, !visible && cache]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>
      <OngletActifContexte.Provider value={store}>
        <ContenuFige rendu={onglet.rendu} deps={onglet.deps} />
      </OngletActifContexte.Provider>
    </View>
  );
}

/**
 * Onglet actif d'une barre : la coque en est l'unique source de vérité. Pas d'état local ni de transition : le dernier toucher
 * gagne toujours, et toucher l'onglet déjà actif ne fait rien. (Les onglets étant gardés montés, le changement de contenu est léger.)
 */
export function useOngletUnique<Id extends string>(actif: Id, onChange: (id: Id) => void): { actifLocal: Id; changer: (id: Id) => void } {
  return {
    actifLocal: actif,
    changer: (id: Id) => {
      if (id !== actif) onChange(id);
    },
  };
}

const styles = StyleSheet.create({
  cadre: { flex: 1 },
  retire: { display: 'none' },
});
