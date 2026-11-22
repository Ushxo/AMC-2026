import { createContext, memo, startTransition, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/** Vrai quand l'onglet est celui qu'on voit. Les écrans qui travaillent en tâche de fond (minuteurs, animations) peuvent s'y suspendre. */
const OngletActifContexte = createContext(true);

/** L'onglet qui contient cet écran est-il visible ? (Vrai hors d'une coquille à onglets.) */
export function useOngletActif(): boolean {
  return useContext(OngletActifContexte);
}

export type OngletGarde = {
  id: string;
  /** Contenu de l'onglet : créé une seule fois, et seulement quand `deps` change (pas à chaque rendu de la coquille). */
  rendu: () => ReactNode;
  /** Ce dont dépend le contenu (état de la coquille qu'il lit). Vide : le contenu ne se redessine jamais à cause de la coquille. */
  deps?: readonly unknown[];
  /**
   * Garde la taille de l'onglet quand il est caché (invisible mais mesuré, sans toucher) : pour une carte native, qui ne doit pas
   * être réduite à zéro. Sinon l'onglet caché est retiré de la mise en page (`display: none`).
   */
  gardeTaille?: boolean;
};

/**
 * Coquille à onglets qui GARDE montés les onglets déjà visités : un onglet n'est monté qu'à son premier passage, puis seulement
 * caché (jamais démonté). Revenir sur la carte ne recrée plus la carte native ni ses repères, et les écrans gardent leur état.
 * Un onglet caché ne reçoit aucun toucher, est masqué au lecteur d'écran et ne se redessine pas quand la coquille change d'onglet.
 */
export function OngletsGardes({ actif, onglets, style }: { actif: string; onglets: OngletGarde[]; style?: StyleProp<ViewStyle> }) {
  const [visites, setVisites] = useState<ReadonlySet<string>>(() => new Set([actif]));
  if (!visites.has(actif)) setVisites(new Set([...visites, actif]));
  return (
    <View style={[styles.cadre, style]}>
      {onglets.map((o) => (visites.has(o.id) || o.id === actif ? <Panneau key={o.id} onglet={o} visible={o.id === actif} /> : null))}
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

function Panneau({ onglet, visible }: { onglet: OngletGarde; visible: boolean }) {
  const cache = onglet.gardeTaille ? styles.invisible : styles.retire;
  return (
    <View
      style={[StyleSheet.absoluteFill, !visible && cache]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>
      <OngletActifContexte.Provider value={visible}>
        <ContenuFige rendu={onglet.rendu} deps={onglet.deps} />
      </OngletActifContexte.Provider>
    </View>
  );
}

/**
 * Changement d'onglet en deux temps : l'état « onglet touché » (pastille, icône) change tout de suite, et le changement de
 * contenu passe en transition : le rendu lourd du nouvel écran ne bloque jamais le retour visuel du toucher.
 */
export function useChangementImmediat<Id extends string>(actif: Id, onChange: (id: Id) => void): { actifLocal: Id; changer: (id: Id) => void } {
  const [actifLocal, setActifLocal] = useState(actif);
  const [vu, setVu] = useState(actif);
  if (actif !== vu) {
    setVu(actif);
    setActifLocal(actif);
  }
  return {
    actifLocal,
    changer: (id: Id) => {
      setActifLocal(id);
      startTransition(() => onChange(id));
    },
  };
}

const styles = StyleSheet.create({
  cadre: { flex: 1 },
  retire: { display: 'none' },
  invisible: { opacity: 0 },
});
