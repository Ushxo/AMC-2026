import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMarque } from '@/components/logo-marque';
import { ThemedText } from '@/components/themed-text';
import { Bouton } from '@/components/ville/bouton';
import { Chip } from '@/components/ville/chip';
import { useTheme } from '@/hooks/use-theme';
import { lireOrganisations } from '@/lib/organisations';
import { APPARENCES, LIBELLES_APPARENCE } from '@/marque/jetons';
import { appliquerMarquePersonnel, choisirMarqueCitoyen, definirApparence } from '@/marque/magasin';
import { ORGANISATIONS_EMBARQUEES, type Organisation } from '@/marque/organisations-embarquees';
import { useMarque } from '@/marque/utiliser';

type Props = {
  visible: boolean;
  onFermer: () => void;
  /** Nom de la personne connectée, et son rôle en toutes lettres (absents pour un citoyen sans compte). */
  nom?: string | null;
  role?: string | null;
  /** Le citoyen (ou la démonstration hors ligne) peut choisir la marque (« Changer de ville »). */
  marqueChoisie?: 'citoyen' | 'demo' | null;
  /** Actions : une seule des deux dernières selon la personne. */
  onAdministration?: () => void;
  onConnexionPersonnel?: () => void;
  onDeconnexion?: () => void;
};

/** Feuille du profil : apparence (Standard, Contraste élevé, Sombre), changement de ville (marque) et compte. Appliquée tout de suite. */
export function FeuilleProfil({ visible, onFermer, nom, role, marqueChoisie = null, onAdministration, onConnexionPersonnel, onDeconnexion }: Props) {
  const { bottom } = useSafeAreaInsets();
  const theme = useTheme();
  const { organisation, apparence } = useMarque();
  const [organisations, setOrganisations] = useState<Organisation[]>(ORGANISATIONS_EMBARQUEES);

  useEffect(() => {
    if (!visible || !marqueChoisie) return;
    let actif = true;
    void lireOrganisations().then((r) => actif && setOrganisations(r.organisations));
    return () => {
      actif = false;
    };
  }, [visible, marqueChoisie]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <Pressable retour={false} style={styles.voile} onPress={onFermer} accessibilityRole="button" accessibilityLabel="Fermer le profil" />
      <View style={[styles.feuille, { backgroundColor: theme.background, paddingBottom: bottom + 16 }]}>
        <ScrollView contentContainerStyle={styles.contenu}>
          <View style={styles.entete}>
            <LogoMarque taille={48} />
            <View style={{ flex: 1 }}>
              <ThemedText type="smallBold" accessibilityRole="header">
                {nom ?? 'Visiteur'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {role ?? 'Sans compte'} · {organisation.nom_app}
              </ThemedText>
            </View>
          </View>

          <ThemedText type="smallBold" accessibilityRole="header">
            Apparence
          </ThemedText>
          <View style={styles.rangee}>
            {APPARENCES.map((a) => (
              <Chip key={a} titre={LIBELLES_APPARENCE[a]} selectionne={apparence === a} onPress={() => definirApparence(a)} />
            ))}
          </View>

          {marqueChoisie ? (
            <>
              <ThemedText type="smallBold" accessibilityRole="header">
                Changer de ville
              </ThemedText>
              <View style={styles.rangee}>
                {organisations.map((o) => (
                  <Chip
                    key={o.code}
                    titre={o.nom_app}
                    selectionne={organisation.code === o.code}
                    libelleAccessible={`${o.nom} : ${o.nom_app}${organisation.code === o.code ? ', sélectionnée' : ''}`}
                    onPress={() => (marqueChoisie === 'demo' ? appliquerMarquePersonnel(o) : choisirMarqueCitoyen(o))}
                  />
                ))}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {marqueChoisie === 'demo' ? 'Démonstration : la marque change sur ce téléphone seulement.' : 'Votre choix est gardé sur ce téléphone.'}
              </ThemedText>
            </>
          ) : null}

          {onAdministration ? <Bouton titre="Espace d'administration" pleineLargeur onPress={() => { onFermer(); onAdministration(); }} /> : null}
          {onConnexionPersonnel ? <Bouton titre="Connexion du personnel" pleineLargeur variante="discret" onPress={() => { onFermer(); onConnexionPersonnel(); }} /> : null}
          {onDeconnexion ? <Bouton titre="Se déconnecter" pleineLargeur variante="discret" onPress={() => { onFermer(); onDeconnexion(); }} /> : null}
          <Bouton titre="Fermer" variante="discret" pleineLargeur onPress={onFermer} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  voile: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  feuille: { maxHeight: '85%', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  contenu: { padding: 20, gap: 12 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
