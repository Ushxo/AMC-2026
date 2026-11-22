import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Carte, Repere, type CarteCommandes } from '@/components/carte';
import { ThemedText } from '@/components/themed-text';
import { useRegroupement } from '@/hooks/use-regroupement';
import type { Region } from '@/lib/config';
import { formaterNombre } from '@/lib/format';
import { clesDeZone, etatZone, libelleEtatZone } from '@/lib/selection';
import { zoneEn, type Zone } from '@/lib/zones';
import { LIBELLES_GRAVITE, type Endroit, type Signalement } from '@/types';

import { Bouton } from './bouton';
import { FicheZone } from './fiche-zone';
import { COULEUR_REPERE } from './style';
import { ReperesEndroits } from './reperes-endroits';
import { libelleZone, ZonesSignalements } from './zones-signalements';

type Props = {
  endroits: Endroit[];
  region: Region;
  /** Clés des endroits sélectionnés. */
  cles?: string[];
  estChoisi: (cle: string) => boolean;
  onBasculer: (cle: string) => void;
  style?: StyleProp<ViewStyle>;
  /** Zones de signalements (carte du superviseur) : les toucher sélectionne tous leurs endroits. */
  zones?: Zone[];
  signalements?: Signalement[];
  onBasculerZone?: (clesZone: string[]) => void;
  onOuvrirSignalement?: (id: string) => void;
  /** Mode « choisir l'endroit de fin » : toucher un repère le choisit au lieu de le sélectionner. */
  modeFin?: boolean;
  cleFin?: string | null;
  onChoisirFin?: (cle: string) => void;
};

const DELAI_DOUBLE_TOUCHER_MS = 400;

export function CarteSelection({
  endroits,
  region,
  cles = [],
  estChoisi,
  onBasculer,
  style,
  zones = [],
  signalements = [],
  onBasculerZone,
  onOuvrirSignalement,
  modeFin = false,
  cleFin = null,
  onChoisirFin,
}: Props) {
  const { regroupement, surRegion, surTaille } = useRegroupement(endroits, region, 340);
  const carte = useRef<CarteCommandes>(null);
  const [zoneActive, setZoneActive] = useState<Zone | null>(null);
  const [fiche, setFiche] = useState<Zone | null>(null);
  const dernierToucher = useRef({ id: '', quand: 0 });
  const clesParZone = useMemo(() => new Map(zones.map((z) => [z.id, clesDeZone(z, endroits)])), [zones, endroits]);
  const etatDe = (z: Zone) => etatZone(cles, clesParZone.get(z.id) ?? []);

  // Le toucher d'une zone arrive parfois par le polygone ET par la carte : un seul basculement par geste.
  function toucherZone(z: Zone) {
    if (modeFin) return; // en mode « endroit de fin », les zones ne changent pas la sélection
    const maintenant = Date.now();
    if (dernierToucher.current.id === z.id && maintenant - dernierToucher.current.quand < DELAI_DOUBLE_TOUCHER_MS) return;
    dernierToucher.current = { id: z.id, quand: maintenant };
    setZoneActive(z);
    onBasculerZone?.(clesParZone.get(z.id) ?? []);
  }

  const active = zoneActive ? (zones.find((z) => z.id === zoneActive.id) ?? null) : null;
  const clesActive = active ? (clesParZone.get(active.id) ?? []) : [];
  const texteActive = active ? `${libelleZone(active)}. ${libelleEtatZone(clesActive.length, etatDe(active))}.` : null;

  return (
    <View style={[styles.cadre, style]}>
      <Carte
        style={styles.carte}
        commandes={carte}
        regionInitiale={region}
        onPress={onBasculerZone ? (c) => {
          const z = zoneEn(zones, c);
          if (z) toucherZone(z);
        } : undefined}
        onTaille={surTaille}
        onRegionChangeComplete={surRegion}
        accessibilityLabel="Carte des endroits à planifier">
        {zones.length > 0 && onBasculerZone ? <ZonesSignalements zones={zones} onChoisir={toucherZone} etatDe={etatDe} /> : null}
        <ReperesEndroits
          regroupement={regroupement}
          estChoisi={estChoisi}
          onZoomer={(points) => carte.current?.zoomer(points)}
          rendreEndroit={(e) => {
            const choisi = estChoisi(e.cle);
            const nombre = formaterNombre(e.nombre, 'signalement ouvert', 'signalements ouverts');
            return (
              <Repere
                key={e.cle}
                id={`endroit-${e.cle}`}
                position={e.position}
                couleur={COULEUR_REPERE[e.gravite_affichee]}
                etat={modeFin ? (cleFin === e.cle ? 'prochain' : 'attenue') : choisi ? 'choisi' : 'attenue'}
                onPress={() => (modeFin ? onChoisirFin?.(e.cle) : onBasculer(e.cle))}
                accessibilityLabel={
                  modeFin
                    ? `${nombre}, gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}, ${cleFin === e.cle ? 'endroit de fin choisi' : 'toucher pour finir ici'}`
                    : `${nombre}, gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}, ${choisi ? 'sélectionné' : 'non sélectionné'}`
                }
              />
            );
          }}
        />
      </Carte>
      {texteActive ? (
        <View style={styles.bulle}>
          <ThemedText type="smallBold" accessibilityLiveRegion="polite" style={styles.texte}>
            {texteActive}
          </ThemedText>
          <Bouton titre="Voir la zone" variante="discret" onPress={() => setFiche(active)} />
        </View>
      ) : null}
      <FicheZone
        zone={fiche}
        signalements={signalements}
        onFermer={() => setFiche(null)}
        onOuvrir={(id) => {
          setFiche(null);
          onOuvrirSignalement?.(id);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { height: 340 },
  carte: { flex: 1 },
  bulle: { position: 'absolute', left: 8, right: 8, bottom: 8, padding: 10, borderRadius: 12, gap: 6, backgroundColor: 'rgba(255,255,255,0.94)' },
  texte: { color: '#1A1A1A' },
});
