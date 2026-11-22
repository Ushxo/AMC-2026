import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Texte as Text } from '@/components/texte';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IllustrationProbleme } from '@/components/illustration-probleme';
import { Palette } from '@/constants/theme';
import { useMesSignalements } from '@/hooks/use-mes-signalements';
import { formaterDate } from '@/lib/format';
import { chargerAdresses } from '@/lib/officiel';
import { adressePlusProche } from '@/lib/recherche';
import { LIBELLES_CATEGORIE, LIBELLES_ETAT, type Categorie, type Etat, type Signalement } from '@/types';
import { BOTTOM_NAV_HEIGHT } from '../components/BottomNav';

// Couleurs : jetons du thème. « greenDone », « card » et « track » sont des teintes de la même palette.
const C = {
  green: Palette.header,
  greenDone: Palette.success,
  cream: Palette.background,
  card: Palette.surface,
  orange: Palette.accent,
  orangeSoft: '#FBDCC4',
  sage: Palette.backgroundSelected,
  track: Palette.border,
  text: Palette.text,
};

const STEPS = ['Soumis', 'Pris en\ncharge', 'Terminé'];

// Position du remplissage de la ligne de progression selon l'étape.
const FILL = ['22%', '58%', '100%'] as const;

// Teinte de la pastille de chaque catégorie (l'illustration vient des images fournies).
const TEINTE_PASTILLE: Record<Categorie, string> = {
  grille_bouchee: C.orangeSoft,
  eau_accumulee: C.sage,
  affaissement: '#FCE6C9',
  grille_endommagee: '#FCE6C9',
  eau_douteuse: '#FCE6C9',
  absence_eau: '#FCE6C9',
  autre: '#FCE6C9',
};

/** Étape de la ligne de progression : 0 = soumis, 1 = pris en charge, 2 = terminé (réglé ou rejeté). */
export function etapeDeLEtat(etat: Etat): 0 | 1 | 2 {
  if (etat === 'regle' || etat === 'rejete') return 2;
  if (etat === 'pris_en_charge') return 1;
  return 0;
}

function badgeDe(etat: Etat, step: number) {
  if (etat === 'rejete') return { label: 'Rejeté', color: Palette.danger, bg: C.orangeSoft };
  return BADGES[step];
}

// Texte des étiquettes : vert forêt (contraste élevé) ; l'orange seul sur fond orange pâle n'atteint pas 4,5 pour 1.
const BADGES = [
  { label: 'En cours', color: C.green, bg: C.orangeSoft },
  { label: 'Pris en charge', color: C.green, bg: C.orangeSoft },
  { label: 'Terminé', color: C.greenDone, bg: C.sage },
];

function Progress({ step }: { step: number }) {
  const done = step === 2;
  const active = done ? C.greenDone : C.orange;

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
                  : { backgroundColor: C.card, borderColor: C.track },
              ]}
            >
              {reached && <Ionicons name="checkmark" size={16} color="white" />}
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mes, chargement, erreur, rafraichir } = useMesSignalements();
  const adresses = useMemo(() => chargerAdresses(), []);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: BOTTOM_NAV_HEIGHT + insets.bottom + 24 }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <View style={styles.headerWave} />
        <Text style={styles.title}>Mes alertes</Text>
        <Text style={styles.subtitle}>Suivez l’évolution de vos signalements.</Text>
      </View>

      <View style={styles.list}>
        {chargement ? (
          <View style={styles.card} accessibilityRole="progressbar" accessibilityLabel="Chargement de vos alertes">
            <Text style={styles.cardTitle}>Chargement de vos alertes…</Text>
          </View>
        ) : erreur ? (
          <View style={styles.card} accessibilityRole="alert">
            <Text style={styles.cardTitle}>{erreur}</Text>
            <Pressable onPress={() => void rafraichir()} accessibilityRole="button" style={{ marginTop: 10 }}>
              <Text style={[styles.detail, { fontWeight: '800', color: C.green, textDecorationLine: 'underline' }]}>Réessayer</Text>
            </Pressable>
          </View>
        ) : null}
        {mes.map(a => {
          const step = etapeDeLEtat(a.etat);
          const titre = LIBELLES_CATEGORIE[a.categorie];
          const badge = badgeDe(a.etat, step);

          return (
            <Pressable
              key={a.id}
              onPress={() => router.push({ pathname: '/suivi/[id]', params: { id: a.id } })}
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`${titre}, ${badge.label}. Ouvrir le suivi et l’heure de passage.`}
            >
              <View style={styles.cardTop}>
                <View style={[styles.iconBox, { backgroundColor: TEINTE_PASTILLE[a.categorie] }]}>
                  <IllustrationProbleme categorie={a.categorie} taille={46} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{titre}</Text>
                    <View style={styles.side}>
                      <Text style={[styles.badge, { color: badge.color, backgroundColor: badge.bg }]}>
                        {badge.label}
                      </Text>
                      <Ionicons name="chevron-forward" size={22} color={C.text} />
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color={C.text} />
                    <Text style={styles.detail}>{lieuDe(a, adresses)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={15} color={C.text} />
                    <Text style={styles.detail}>Envoyé le {formaterDate(a.cree_le)}</Text>
                  </View>
                </View>
              </View>

              <Progress step={step} />

              {a.en_attente ? <Text style={[styles.detail, { marginTop: 10 }]}>En attente d’envoi : le réseau reviendra.</Text> : null}
            </Pressable>
          );
        })}

        {!chargement && !erreur && !mes.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Aucune alerte pour le moment</Text>
            <Text style={[styles.detail, { marginTop: 6 }]}>
              Touchez « Signaler un problème » sur la carte pour envoyer un signalement.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.cream,
  },

  header: {
    backgroundColor: C.green,
    paddingHorizontal: 26,
    paddingBottom: 72,
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
    color: 'white',
    fontSize: 34,
    fontWeight: '800',
  },

  subtitle: {
    color: '#EDEBDF',
    fontSize: 16,
    marginTop: 8,
  },

  list: {
    marginTop: -48,
    paddingHorizontal: 14,
    gap: 16,
  },

  card: {
    backgroundColor: C.card,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    borderRadius: 28,
    shadowColor: '#1A261A',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },

  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
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
    gap: 3,
  },

  grateBar: {
    height: 3,
    borderRadius: 2,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },

  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: C.green,
    marginTop: 4,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 3,
  },

  detail: {
    flexShrink: 1,
    fontSize: 13,
    color: C.text,
  },

  side: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  badge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },

  progress: {
    flexDirection: 'row',
    marginTop: 22,
  },

  // Ligne qui relie le centre du premier point au centre du dernier.
  track: {
    position: 'absolute',
    top: 12,
    left: '16.66%',
    right: '16.66%',
    height: 3,
    borderRadius: 2,
    backgroundColor: C.track,
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
    color: C.text,
    marginTop: 6,
    textAlign: 'center',
  },

});
