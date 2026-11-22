import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOTTOM_NAV_HEIGHT } from '../components/BottomNav';
import { useDemo } from '../context/DemoContext';
import { SEWERS } from '../data/mockData';
import { AlertKind, CitizenAlert } from '../types/models';

const C = {
  green: '#1D341B',
  greenDone: '#2F5A2A',
  cream: '#F5F1E6',
  card: '#FBF7EE',
  orange: '#EE6A1F',
  orangeSoft: '#FBDCC4',
  sage: '#DCE5CC',
  track: '#B8C2AE',
  text: '#2B3328',
};

const STEPS = ['Soumis', 'Pris en\ncharge', 'Terminé'];

// Position du remplissage de la ligne de progression selon l'étape.
const FILL = ['22%', '58%', '100%'] as const;

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// Titre et icône de chaque catégorie (mêmes libellés que sur l'écran Carte).
const KINDS: Record<AlertKind, { title: string; tile: string; color: string; icon?: keyof typeof Ionicons.glyphMap }> = {
  'Égout bouché': { title: 'Égout bouché', tile: C.orangeSoft, color: C.orange },
  'Eau accumulée': { title: 'Accumulation d’eau', tile: C.sage, color: C.green, icon: 'water-outline' },
  Feuilles: { title: 'Affaissement', tile: '#FCE6C9', color: C.orange, icon: 'trending-down-outline' },
  Autre: { title: 'Grille endommagée', tile: '#FCE6C9', color: C.orange, icon: 'warning-outline' },
};

function getStep(status: CitizenAlert['status']) {
  if (status === 'Résolue') return 2;
  if (status === 'Envoyée' || status === 'En évaluation') return 0;
  return 1;
}

const BADGES = [
  { label: 'En cours', color: C.orange, bg: C.orangeSoft },
  { label: 'Pris en charge', color: C.orange, bg: C.orangeSoft },
  { label: 'Terminé', color: C.greenDone, bg: C.sage },
];

// "2026-11-18" → "18 nov. 2026" ; ajoute l'heure si la date en contient une.
function formatDate(value: string) {
  const [day, time] = value.split('T');
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return value;
  let text = `${d} ${MONTHS[m - 1]} ${y}`;
  if (time) {
    const [h, min] = time.split(':');
    text += ` à ${Number(h)} h ${min}`;
  }
  return text;
}

// Grille d'égout dessinée (cercle avec barreaux).
function GrateIcon({ color }: { color: string }) {
  return (
    <View style={[styles.grate, { borderColor: color }]}>
      {[18, 24, 24, 18].map((w, i) => (
        <View key={i} style={[styles.grateBar, { width: w, backgroundColor: color }]} />
      ))}
    </View>
  );
}

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

export default function MyAlerts() {
  const insets = useSafeAreaInsets();
  const { alerts } = useDemo();
  const [expanded, setExpanded] = useState<string | null>(null);

  const own = alerts.filter(a => a.citizenId === 'citoyen-demo').slice().reverse();

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
        {own.map(a => {
          const step = getStep(a.status);
          const kind = KINDS[a.kind];
          const badge = BADGES[step];
          const sewer = SEWERS.find(s => s.id === a.sewerId);
          const open = expanded === a.id;

          return (
            <Pressable
              key={a.id}
              onPress={() => setExpanded(open ? null : a.id)}
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`${kind.title}, ${badge.label}`}
            >
              <View style={styles.cardTop}>
                <View style={[styles.iconBox, { backgroundColor: kind.tile }]}>
                  {kind.icon ? (
                    <Ionicons name={kind.icon} size={34} color={kind.color} />
                  ) : (
                    <GrateIcon color={kind.color} />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{kind.title}</Text>
                    <View style={styles.side}>
                      <Text style={[styles.badge, { color: badge.color, backgroundColor: badge.bg }]}>
                        {badge.label}
                      </Text>
                      <Ionicons
                        name={open ? 'chevron-down' : 'chevron-forward'}
                        size={20}
                        color={C.text}
                      />
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color={C.text} />
                    <Text style={styles.detail}>{sewer?.label ?? a.sewerId}, Montréal</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={15} color={C.text} />
                    <Text style={styles.detail}>Envoyé le {formatDate(a.date)}</Text>
                  </View>
                </View>
              </View>

              <Progress step={step} />

              {open && (
                <View style={styles.expanded}>
                  <Text style={styles.detail}>Référence : {a.id}</Text>
                  <Text style={styles.detail}>État actuel : {a.status}</Text>
                  {a.photoUri && <Image source={{ uri: a.photoUri }} style={styles.photo} />}
                </View>
              )}
            </Pressable>
          );
        })}

        {!own.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Aucune alerte pour le moment</Text>
            <Text style={[styles.detail, { marginTop: 6 }]}>
              Sélectionnez un égout sur la carte pour envoyer un signalement.
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

  expanded: {
    borderTopWidth: 1,
    borderColor: '#E3E5DC',
    marginTop: 14,
    paddingTop: 12,
    gap: 4,
  },

  photo: {
    height: 150,
    borderRadius: 14,
    marginTop: 8,
  },
});
