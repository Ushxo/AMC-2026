import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { VOILE_FEUILLE, FEUILLE_BASE } from '@/components/ville/style';
import { Appuyable as Pressable } from '@/components/appuyable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMarque } from '@/components/logo-marque';
import { ThemedText } from '@/components/themed-text';
import { Bouton } from '@/components/ville/bouton';
import { Chip } from '@/components/ville/chip';
import { Coche } from '@/components/ville/coche';
import { useTheme } from '@/hooks/use-theme';
import { lireOrganisations } from '@/lib/organisations';
import { APPARENCES, LIBELLES_APPARENCE } from '@/marque/jetons';
import { apercuApparence, appliquerMarquePersonnel, definirApparence, organisationAvecLocale } from '@/marque/magasin';
import { ORGANISATIONS_EMBARQUEES, type Organisation } from '@/marque/organisations-embarquees';
import { useMarque } from '@/marque/utiliser';

type Props = {
  visible: boolean;
  onFermer: () => void;
  /** Nom de la personne connectée, et son rôle en toutes lettres (absents pour un citoyen sans compte). */
  nom?: string | null;
  role?: string | null;
  /** Seulement la démonstration hors ligne du personnel peut essayer une autre marque (annoncé simulé). Le citoyen ne choisit jamais la marque. */
  marqueChoisie?: 'demo' | null;
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
    void lireOrganisations().then((r) => actif && setOrganisations(r.organisations.map(organisationAvecLocale)));
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
              {role && role !== 'Citoyen' ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Tournées optimisées par Priorix
                </ThemedText>
              ) : null}
            </View>
          </View>

          <ThemedText type="smallBold" accessibilityRole="header">
            Apparence
          </ThemedText>
          <View style={styles.liste}>
            {APPARENCES.map((a) => {
              const actif = apparence === a;
              return (
                <Pressable
                  key={a}
                  accessibilityRole="radio"
                  accessibilityLabel={LIBELLES_APPARENCE[a]}
                  accessibilityState={{ checked: actif, selected: actif }}
                  onPress={() => definirApparence(a)}
                  style={[styles.option, { backgroundColor: actif ? theme.backgroundSelected : theme.backgroundElement, borderColor: actif ? theme.primary : theme.border }]}>
                  <View style={styles.pastille} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    {apercuApparence(organisation, a).map((c, n) => (
                      <View key={n} style={[styles.point, { backgroundColor: c, borderColor: theme.borderForte }]} />
                    ))}
                  </View>
                  <ThemedText type={actif ? 'smallBold' : 'small'} style={{ flex: 1 }}>
                    {LIBELLES_APPARENCE[a]}
                  </ThemedText>
                  {actif ? <Coche /> : null}
                </Pressable>
              );
            })}
          </View>

          {marqueChoisie === 'demo' ? (
            <>
              <ThemedText type="smallBold" accessibilityRole="header">
                Marque de démonstration
              </ThemedText>
              <View style={styles.rangee}>
                {organisations.map((o) => (
                  <Chip
                    key={o.code}
                    titre={o.nom_app}
                    selectionne={organisation.code === o.code}
                    libelleAccessible={`${o.nom} : ${o.nom_app}${organisation.code === o.code ? ', sélectionnée' : ''}`}
                    onPress={() => appliquerMarquePersonnel(o)}
                  />
                ))}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Simulé pour la démonstration hors ligne : la marque change sur ce téléphone seulement.
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
  voile: { flex: 1, backgroundColor: VOILE_FEUILLE },
  feuille: { maxHeight: '85%', ...FEUILLE_BASE },
  contenu: { padding: 20, gap: 12 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rangee: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  liste: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1 },
  pastille: { flexDirection: 'row' },
  point: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, marginRight: -8 },
});
