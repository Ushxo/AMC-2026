import * as Location from 'expo-location';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';

import { Carte, Repere } from '@/components/carte';
import { ThemedText } from '@/components/themed-text';
import { MESSAGE_RECHERCHE_INDISPONIBLE, useRechercheAdresse } from '@/hooks/use-recherche-adresse';
import { useTheme } from '@/hooks/use-theme';
import { adressePlusProche } from '@/lib/recherche';
import { chargerAdresses, chargerRegion } from '@/lib/officiel';
import type { Coordonnees, ResultatRecherche } from '@/types';

import { Bouton } from './bouton';
import { Champ } from './champ';
import { COULEUR_ACCENT } from './style';
import { useStyles } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';

export type AdresseChoisie = { position: Coordonnees; adresse: string | null };

type Props = {
  titre: string;
  point: Coordonnees | null;
  adresse: string | null;
  onChoisir: (a: AdresseChoisie) => void;
  /** Message à côté du champ quand l'adresse manque ou est invalide. */
  erreur?: string | null;
};

/** Choisir une adresse : la chercher en texte, toucher la carte, ou utiliser sa position. L'adresse retenue s'affiche en clair. */
export function ChoixAdresse({ titre, point, adresse, onChoisir, erreur }: Props) {
  const styles = useStyles(creerStyles);
  const theme = useTheme();
  const region = useMemo(() => chargerRegion(), []);
  const adresses = useMemo(() => chargerAdresses(), []);
  const { chercher, indisponible } = useRechercheAdresse();
  const [texte, setTexte] = useState('');
  const [resultats, setResultats] = useState<ResultatRecherche[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function surPoint(p: Coordonnees) {
    const proche = adressePlusProche(p, adresses);
    onChoisir({ position: p, adresse: proche ? proche.libelle : null });
    setResultats(null);
  }

  async function lancerRecherche() {
    setMessage(null);
    setResultats(await chercher(texte));
  }

  async function maPosition() {
    setMessage(null);
    try {
      const droit = await Location.requestForegroundPermissionsAsync();
      if (!droit.granted) {
        setMessage('Position refusée : cherchez une adresse ou touchez la carte.');
        return;
      }
      const p = await Location.getCurrentPositionAsync({});
      surPoint({ latitude: p.coords.latitude, longitude: p.coords.longitude });
    } catch {
      setMessage('Position introuvable : cherchez une adresse ou touchez la carte.');
    }
  }

  return (
    <View style={styles.bloc}>
      <ThemedText type="smallBold" accessibilityRole="header">
        {titre}
      </ThemedText>
      <Champ
        etiquette="Chercher une adresse"
        value={texte}
        onChangeText={setTexte}
        onSubmitEditing={() => void lancerRecherche()}
        returnKeyType="search"
        autoCorrect={false}
      />
      <Bouton titre="Chercher" variante="discret" onPress={() => void lancerRecherche()} />
      {resultats && resultats.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="alert">
          {indisponible ? MESSAGE_RECHERCHE_INDISPONIBLE : 'Aucune adresse trouvée.'}
        </ThemedText>
      ) : null}
      {(resultats ?? []).map((r) => (
        <Pressable
          key={`${r.libelle}-${r.position.latitude}`}
          accessibilityRole="button"
          accessibilityLabel={`Choisir ${r.libelle}`}
          onPress={() => {
            onChoisir({ position: r.position, adresse: r.libelle });
            setResultats(null);
            setTexte('');
          }}
          style={[styles.resultat, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small">{r.libelle}</ThemedText>
        </Pressable>
      ))}
      <ThemedText type="small" themeColor="textSecondary">
        Ou touchez la carte à l&apos;endroit voulu.
      </ThemedText>
      <Carte style={styles.carte} regionInitiale={region} onPress={surPoint} accessibilityLabel={`Carte : ${titre}`}>
        {point ? <Repere id="adresse-choisie" position={point} couleur={COULEUR_ACCENT} etat="prochain" titre={titre} /> : null}
      </Carte>
      <Bouton titre="Utiliser ma position" variante="discret" onPress={() => void maPosition()} />
      {point ? (
        <ThemedText type="small" accessibilityLiveRegion="polite">
          {adresse ? `Adresse retenue : ${adresse}.` : 'Point choisi sur la carte (aucune adresse connue à moins de 200 m).'}
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Aucune adresse choisie pour le moment.
        </ThemedText>
      )}
      {message ? (
        <ThemedText type="small" accessibilityRole="alert">
          {message}
        </ThemedText>
      ) : null}
      {erreur ? (
        <ThemedText type="small" accessibilityRole="alert" style={styles.erreur}>
          {erreur}
        </ThemedText>
      ) : null}
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  bloc: { gap: 8 },
  carte: { height: 200 },
  resultat: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center' },
  erreur: { color: P.danger },
});
