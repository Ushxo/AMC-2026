import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Carte, Repere } from '@/components/carte';
import { IllustrationProbleme } from '@/components/illustration-probleme';
import { Texte as Text } from '@/components/texte';
import { Bouton } from '@/components/ville/bouton';
import { Chargement, Erreur, Vide } from '@/components/ville/etat-ecran';
import { COULEUR_REPERE } from '@/components/ville/style';
import { useSignalements } from '@/hooks/use-signalements';
import { formaterDate } from '@/lib/format';
import { interventionDe, lieuDeEndroit } from '@/lib/interventions';
import { regrouper } from '@/lib/gravite';
import { chargerAdresses } from '@/lib/officiel';
import { LIBELLES_CATEGORIE, LIBELLES_ETAT, LIBELLES_GRAVITE, type Gravite } from '@/types';
import { IMPORTANCE } from '../../../frontend/supervisor/InterventionsAPlanifier';
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';

/** Fiche d'un endroit : carte centrée, problème et importance, liste de ses signalements (chacun ouvre sa fiche, où l'on change l'état). */
export default function Endroit() {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const { bottom, top } = useSafeAreaInsets();
  const { cle } = useLocalSearchParams<{ cle: string }>();
  const router = useRouter();
  const { signalements, chargement, erreur, rafraichir } = useSignalements();
  const endroit = useMemo(() => regrouper(signalements).find((e) => e.cle === cle), [signalements, cle]);
  const liste = useMemo(() => [...(endroit?.signalements ?? [])].sort((a, b) => b.cree_le.localeCompare(a.cree_le)), [endroit]);
  const adresses = useMemo(() => chargerAdresses(), []);
  const lieu = endroit ? lieuDeEndroit(endroit.position, adresses) : '';
  const principal = endroit ? interventionDe(endroit) : null;
  const gravite: Gravite = endroit?.gravite_affichee ?? 'moyenne';
  const c = IMPORTANCE[gravite];
  const ouverts = endroit ? endroit.signalements.filter((s) => s.etat === 'nouveau' || s.etat === 'pris_en_charge').length : 0;

  return (
    <View style={styles.fond}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.entete, { paddingTop: top + 14 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour aux interventions" hitSlop={8} style={styles.retour}>
          <Ionicons name="arrow-back" size={28} color={P.onHeader} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.titre} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            Intervention
          </Text>
          {endroit ? (
            <Text style={styles.sousTitre} maxFontSizeMultiplier={1.3}>
              {lieu}
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 24 }]}>
        {chargement ? (
          <Chargement />
        ) : erreur ? (
          <Erreur message={erreur} onReessayer={() => void rafraichir()} />
        ) : !endroit ? (
          <Vide texte="Cet endroit n'a plus de signalement." />
        ) : (
          <>
            <View style={styles.carteCadre}>
              <Carte
                style={styles.carte}
                regionInitiale={{ latitude: endroit.position.latitude, longitude: endroit.position.longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
                accessibilityLabel={`Carte centrée sur l'endroit, ${lieu}`}>
                <Repere id="endroit" position={endroit.position} couleur={COULEUR_REPERE[gravite]} titre={`Importance ${LIBELLES_GRAVITE[gravite]}`} />
              </Carte>
            </View>

            <View style={styles.resume}>
              <View style={styles.vignette}>
                <IllustrationProbleme categorie={principal?.categorie ?? 'autre'} taille={52} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.resumeTitre} maxFontSizeMultiplier={1.3}>
                  {principal ? LIBELLES_CATEGORIE[principal.categorie] : 'Intervention'}
                </Text>
                <Text style={styles.resumeSous}>
                  {endroit.nombre} signalement{endroit.nombre > 1 ? 's' : ''} au même endroit{ouverts !== endroit.nombre ? `, ${ouverts} ouvert${ouverts > 1 ? 's' : ''}` : ''}
                </Text>
              </View>
              <Text style={[styles.etiquette, { backgroundColor: c.fond, color: c.plein }]} accessibilityLabel={`Importance ${LIBELLES_GRAVITE[gravite]}`} maxFontSizeMultiplier={1.2}>
                {LIBELLES_GRAVITE[gravite]}
              </Text>
            </View>

            <Text style={styles.section} accessibilityRole="header">
              Signalements
            </Text>
            {liste.map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={`${LIBELLES_CATEGORIE[s.categorie]}, ${LIBELLES_ETAT[s.etat]}, signalé le ${formaterDate(s.cree_le)}. Ouvrir la fiche pour changer l'état.`}
                onPress={() => router.push({ pathname: '/ville/signalement/[id]', params: { id: s.id } })}
                style={styles.ligne}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.ligneDate}>Signalé le {formaterDate(s.cree_le)}</Text>
                  <Text style={styles.ligneDetail}>
                    {s.commentaire ? `« ${s.commentaire} »` : 'Sans commentaire'}
                    {s.photo_url ? ' · avec photo' : ''}
                  </Text>
                  <Text style={styles.ligneEtat}>
                    {LIBELLES_ETAT[s.etat]}
                    {s.exemple_demo ? ' · exemple de démo' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={P.text} />
              </Pressable>
            ))}
            <Bouton titre="Retour" variante="discret" pleineLargeur onPress={() => router.back()} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  fond: { flex: 1, backgroundColor: P.background },
  entete: { backgroundColor: P.header, paddingHorizontal: 18, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  retour: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  titre: { color: P.onHeader, fontSize: 26, fontWeight: '700' },
  sousTitre: { color: P.bandeau, fontSize: 15, fontWeight: '500' },
  contenu: { padding: 20, gap: 16, maxWidth: 800, width: '100%', alignSelf: 'center' },
  carteCadre: { height: 150, borderRadius: 22, overflow: 'hidden', backgroundColor: P.bandeau },
  carte: { flex: 1 },
  resume: { backgroundColor: P.surface, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  vignette: { width: 60, height: 60, borderRadius: 16, backgroundColor: P.background, alignItems: 'center', justifyContent: 'center' },
  resumeTitre: { fontSize: 18, fontWeight: '700', color: P.text },
  resumeSous: { fontSize: 14, fontWeight: '500', color: P.textSecondary },
  etiquette: { fontSize: 14, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, overflow: 'hidden' },
  section: { fontSize: 16, fontWeight: '700', color: P.text },
  ligne: { backgroundColor: P.surface, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 64 },
  ligneDate: { fontSize: 15, fontWeight: '600', color: P.text },
  ligneDetail: { fontSize: 14, fontWeight: '500', color: P.textSecondary, lineHeight: 20 },
  ligneEtat: { fontSize: 13, fontWeight: '700', color: P.primary },
});
