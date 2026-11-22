import React, { useMemo } from 'react';
import { texteSur } from '@/marque/couleurs';
import { FlatList, StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import { Texte as Text } from '@/components/texte';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IllustrationProbleme } from '@/components/illustration-probleme';
import { useMesSignalements } from '@/hooks/use-mes-signalements';
import { useSignalements } from '@/hooks/use-signalements';
import { formaterDate } from '@/lib/format';
import { confirmationDuSignalement, indexerEndroits } from '@/lib/gravite';
import { ETIQUETTE_EN_ATTENTE_CONFIRMATION, phraseManque } from '@/lib/messages-seuil';
import { chargerAdresses } from '@/lib/officiel';
import { adressePlusProche } from '@/lib/recherche';
import { LIBELLES_CATEGORIE, LIBELLES_ETAT, type Categorie, type Etat, type Signalement } from '@/types';
import { BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { useStyles } from '@/marque/utiliser';
import { useTheme } from '@/hooks/use-theme';
import type { Jetons } from '@/marque/jetons';
import { COULEUR_OMBRE } from '@/components/ville/style';


const STEPS = ['Soumis', 'Pris en\ncharge', 'Terminé'];

// Position du remplissage de la ligne de progression selon l'étape.
const FILL = ['22%', '58%', '100%'] as const;

// Teinte de la pastille de chaque catégorie (l'illustration vient des images fournies).
function teintePastille(c: Categorie, P: Jetons): string {
  return c === 'eau_accumulee' ? P.backgroundSelected : P.actionDoux;
}

/** Étape de la ligne de progression : 0 = soumis, 1 = pris en charge, 2 = terminé (réglé ou rejeté). */
export function etapeDeLEtat(etat: Etat): 0 | 1 | 2 {
  if (etat === 'regle' || etat === 'rejete') return 2;
  if (etat === 'pris_en_charge') return 1;
  return 0;
}

// Étiquettes d'état : texte de la couleur de l'en-tête (contraste élevé sur le fond doux).
function badgeDe(etat: Etat, step: number, P: Jetons) {
  if (etat === 'rejete') return { label: 'Rejeté', color: P.danger, bg: P.actionDoux };
  return [
    { label: 'En cours', color: P.onActionDoux, bg: P.actionDoux },
    { label: 'Pris en charge', color: P.onActionDoux, bg: P.actionDoux },
    { label: 'Terminé', color: P.onBandeau, bg: P.bandeau },
  ][step];
}

function Progress({ step }: { step: number }) {
  const P = useTheme();
  const styles = useStyles(creerStyles);
  const done = step === 2;
  const active = done ? P.success : P.accent;

  return (
    <View style={styles.progress}>
      <View style={styles.track}>
        <View style={[styles.trackFill, { width: FILL[step], backgroundColor: active }]} />
      </View>

      {STEPS.map((label, i) => {
        const reached = i <= step;
        return (
          <View key={label} style={styles.stepCol}>
            <View
              style={[
                styles.dot,
                reached
                  ? { backgroundColor: active, borderColor: active }
                  : { backgroundColor: P.surface, borderColor: P.border },
              ]}
            >
              {reached && <Ionicons name="checkmark" size={16} color={texteSur(active)} />}
            </View>
            <Text style={styles.stepText}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// « Près de 100 rue X » grâce à l'index d'adresses local (marche hors ligne), sinon les coordonnées.
function lieuDe(s: Signalement, adresses: ReturnType<typeof chargerAdresses>): string {
  const proche = adressePlusProche({ latitude: s.latitude, longitude: s.longitude }, adresses);
  return proche ? `Près de ${proche.libelle}` : `${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}, Montréal`;
}

export default function MyAlerts() {
  const P = useTheme();
  const styles = useStyles(creerStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mes, chargement, erreur, rafraichir } = useMesSignalements();
  const adresses = useMemo(() => chargerAdresses(), []);
  const { signalements: tous } = useSignalements();
  const index = useMemo(() => indexerEndroits(tous), [tous]);

  const vide = !chargement && !erreur && !mes.length;
  return (
    <FlatList
      style={styles.root}
      data={chargement || erreur ? [] : mes}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{ paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + 24 }}
      initialNumToRender={8}
      windowSize={7}
      ListHeaderComponent={
        <View style={[styles.header, { paddingTop: insets.top + 24, marginBottom: -48 }]}>
        <View style={styles.headerWave} />
        <Text style={styles.title}>Mes alertes</Text>
        <Text style={styles.subtitle}>Suivez l’évolution de vos signalements.</Text>
      </View>
      }
      renderItem={({ item: a }) => {
        const step = etapeDeLEtat(a.etat);
          const titre = LIBELLES_CATEGORIE[a.categorie];
          const badge = badgeDe(a.etat, step, P);
          const confirmation = confirmationDuSignalement(a, index);

          return (
            <Pressable
              key={a.id}
              onPress={() => router.push({ pathname: '/suivi/[id]', params: { id: a.id } })}
              style={[styles.card, { marginHorizontal: 16, marginBottom: 16 }]}
              accessibilityRole="button"
              accessibilityLabel={`${titre}, ${badge.label}.${confirmation.enAttente ? ` ${ETIQUETTE_EN_ATTENTE_CONFIRMATION}. ${phraseManque(confirmation.manque)}` : ''} Ouvrir le suivi et l’heure de passage.`}
            >
              <View style={styles.cardTop}>
                <View style={[styles.iconBox, { backgroundColor: teintePastille(a.categorie, P) }]}>
                  <IllustrationProbleme categorie={a.categorie} taille={46} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{titre}</Text>
                    <View style={styles.side}>
                      <Text style={[styles.badge, { color: badge.color, backgroundColor: badge.bg }]}>
                        {badge.label}
                      </Text>
                      <Ionicons name="chevron-forward" size={22} color={P.text} />
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color={P.text} />
                    <Text style={styles.detail}>{lieuDe(a, adresses)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={15} color={P.text} />
                    <Text style={styles.detail}>Envoyé le {formaterDate(a.cree_le)}</Text>
                  </View>
                  {confirmation.enAttente ? (
                    <View style={styles.attente}>
                      <Text style={[styles.badge, { color: P.onActionDoux, backgroundColor: P.actionDoux }]}>{ETIQUETTE_EN_ATTENTE_CONFIRMATION}</Text>
                      <Text style={styles.detail}>{phraseManque(confirmation.manque)}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <Progress step={step} />

              {a.en_attente ? <Text style={[styles.detail, { marginTop: 12 }]}>En attente d’envoi : le réseau reviendra.</Text> : null}
            </Pressable>
          );
      }}
      ListEmptyComponent={
        <View style={styles.list}>
          {chargement ? (
            <View style={styles.card} accessibilityRole="progressbar" accessibilityLabel="Chargement de vos alertes">
              <Text style={styles.cardTitle}>Chargement de vos alertes…</Text>
            </View>
          ) : erreur ? (
            <View style={styles.card} accessibilityRole="alert">
              <Text style={styles.cardTitle}>{erreur}</Text>
              <Pressable onPress={() => void rafraichir()} accessibilityRole="button" style={{ marginTop: 12, minHeight: 48, justifyContent: 'center' }}>
                <Text style={[styles.detail, { fontWeight: '800', color: P.primary, textDecorationLine: 'underline' }]}>Réessayer</Text>
              </Pressable>
            </View>
          ) : vide ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Aucune alerte pour le moment</Text>
              <Text style={[styles.detail, { marginTop: 8 }]}>Touchez « Signaler un problème » sur la carte pour envoyer un signalement.</Text>
            </View>
          ) : null}
        </View>
      }
    />
  );
}

const creerStyles = (P: Jetons) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: P.background,
  },

  header: {
    backgroundColor: P.header,
    paddingHorizontal: 24,
    paddingBottom: 64,
    overflow: 'hidden',
  },

  headerWave: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    right: -230,
    top: -40,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  title: {
    color: P.onHeader,
    fontSize: 34,
    fontWeight: '800',
  },

  subtitle: {
    color: P.onHeader,
    fontSize: 16,
    marginTop: 8,
  },

  list: {
    paddingHorizontal: 16,
    gap: 16,
  },

  card: {
    backgroundColor: P.surface,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderRadius: 30,
    shadowColor: COULEUR_OMBRE,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },

  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  grate: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  grateBar: {
    height: 3,
    borderRadius: 2,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },

  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: P.primary,
    marginTop: 4,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },

  detail: {
    flexShrink: 1,
    fontSize: 13,
    color: P.text,
  },

  attente: {
    gap: 4,
    marginTop: 8,
    alignItems: 'flex-start',
  },

  side: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  badge: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },

  progress: {
    flexDirection: 'row',
    marginTop: 24,
  },

  // Ligne qui relie le centre du premier point au centre du dernier.
  track: {
    position: 'absolute',
    top: 12,
    left: '16.66%',
    right: '16.66%',
    height: 3,
    borderRadius: 2,
    backgroundColor: P.border,
  },

  trackFill: {
    height: 3,
    borderRadius: 2,
  },

  stepCol: {
    flex: 1,
    alignItems: 'center',
  },

  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepText: {
    fontSize: 13,
    color: P.text,
    marginTop: 8,
    textAlign: 'center',
  },

});
