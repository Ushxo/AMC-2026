import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Carte, Repere, Trace } from "@/components/carte";
import { Texte as Text } from "@/components/texte";
import { COULEUR_ACCENT, COULEUR_ARRET_FAIT, couleurEquipe } from "@/components/ville/style";
import { useTroncon } from "@/hooks/use-troncon";
import { distanceCourte, dureeCourte } from "@/lib/navigation";
import { chargerRegion } from "@/lib/officiel";
import { formaterHeure } from "@/lib/temps";
import { pointsTournee } from "@/lib/tournees";
import { idArret, regionAutour } from "@/lib/trajet";
import type { Arret, Coordonnees, Tournee } from "@/types";
import { BOTTOM_NAV_HEIGHT } from "../components/BottomNav";
import { E, type InfoArret } from "./shared";

const BLEU_TRACE = COULEUR_ACCENT;

type Props = {
  tournee: Tournee | null;
  arrets: Arret[];
  estEvalue: (a: Arret) => boolean;
  /** Arrêt affiché (le prochain, ou celui choisi avec Précédent / Suivant). */
  affiche: InfoArret | null;
  evalues: number;
  position: Coordonnees | null;
  emptyMessage: string;
  onPrecedent: () => void;
  onSuivant: () => void;
  onRecalculer: () => void;
  onSuivre: () => void;
  onEvaluate: () => void;
  onLogout: () => void;
};

// Ma tournée : bandeau du trajet (arrêt, distance, durée, progression), la carte, puis le prochain arrêt et son évaluation.
export default function RouteStopScreen(p: Props) {
  const { tournee, arrets, estEvalue, affiche, evalues, position } = p;
  const insets = useSafeAreaInsets();
  const bottom = BOTTOM_NAV_HEIGHT + insets.bottom;
  const trace = useMemo<Coordonnees[]>(() => (tournee ? pointsTournee(tournee) : []), [tournee]);
  const region = useMemo(() => regionAutour(arrets.map((a) => a.position), chargerRegion()), [arrets]);

  // Distance et durée jusqu'à l'arrêt affiché, depuis la position du téléphone (sinon depuis l'arrêt précédent).
  const index = affiche ? arrets.findIndex((a) => idArret(a) === idArret(affiche.arret)) : -1;
  const depart = position ?? (index > 0 ? arrets[index - 1].position : null);
  const troncon = useTroncon(depart, affiche?.arret.position ?? null, affiche ? idArret(affiche.arret) : null);
  const total = arrets.length;
  const progression = total ? evalues / total : 0;
  const resume = troncon ? `${distanceCourte(troncon.distance_m)} · ${dureeCourte(troncon.duree_s)}` : "";

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: bottom + 12 }]}>
      <View style={styles.bandeau}>
        <View style={styles.bandeauHaut}>
          <View style={{ width: 28 }} />
          <Text style={styles.bandeauTitre} numberOfLines={1}>
            Trajet · {tournee?.equipe_nom ?? "Mon équipe"}
          </Text>
          <Pressable onPress={p.onLogout} hitSlop={10} accessibilityRole="button" accessibilityLabel="Se déconnecter">
            <Ionicons name="log-out-outline" size={22} color={E.onHeader} />
          </Pressable>
        </View>
        {affiche ? (
          <View style={styles.bandeauLigne}>
            <Text style={styles.arret}>
              Arrêt {index + 1}/{total}
            </Text>
            <Text style={styles.resume}>{resume}</Text>
          </View>
        ) : null}
        <View style={styles.barre} accessibilityLabel={`${evalues} arrêts évalués sur ${total}`}>
          <View style={[styles.barrePleine, { width: `${Math.round(progression * 100)}%` }]} />
        </View>
      </View>

      <View style={styles.carte}>
        {tournee ? (
          <Carte style={StyleSheet.absoluteFill} regionInitiale={region} positionUtilisateur accessibilityLabel="Carte du trajet">
            {trace.length > 1 ? <Trace id="trace" points={trace} couleur={BLEU_TRACE} epaisseur={4} /> : null}
            {arrets.map((a) => {
              const fait = estEvalue(a);
              const choisi = affiche && idArret(affiche.arret) === idArret(a);
              return (
                <Repere
                  key={idArret(a)}
                  id={idArret(a)}
                  position={a.position}
                  numero={a.rang}
                  couleur={fait ? COULEUR_ARRET_FAIT : choisi ? E.orange : couleurEquipe(0)}
                  etat={fait ? "fait" : choisi ? "prochain" : "normal"}
                  zIndex={choisi ? 10 : 1}
                  accessibilityLabel={`Arrêt ${a.rang}${fait ? ", évalué" : ""}`}
                />
              );
            })}
          </Carte>
        ) : null}
      </View>

      {affiche ? (
        <View style={styles.bas}>
          <View style={styles.prochainLigne}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prochain} numberOfLines={2}>
                {estEvalue(affiche.arret) ? "Arrêt évalué" : "Prochain arrêt"} · {affiche.titre}
              </Text>
              <Text style={styles.arrivee}>
                {affiche.arret.arrivee_prevue ? `Arrivée estimée à ${formaterHeure(affiche.arret.arrivee_prevue)}` : affiche.lieu}
              </Text>
            </View>
          </View>

          <Pressable style={styles.demarrer} onPress={p.onSuivre} accessibilityRole="button" accessibilityHint="Ouvre la navigation jusqu’au prochain arrêt">
            <Ionicons name="navigate" size={22} color={E.white} />
            <Text style={styles.evaluerTexte}>Démarrer le trajet</Text>
          </Pressable>

          <Pressable
            style={[styles.evaluer, estEvalue(affiche.arret) && { opacity: 0.5 }]}
            disabled={estEvalue(affiche.arret)}
            onPress={p.onEvaluate}
            accessibilityRole="button"
          >
            <Ionicons name="clipboard-outline" size={22} color={E.white} />
            <Text style={styles.evaluerTexte}>Évaluer l&apos;intervention</Text>
          </Pressable>

          <View style={styles.actions}>
            <Pressable style={styles.action} onPress={p.onPrecedent} disabled={index <= 0} accessibilityRole="button" accessibilityLabel="Arrêt précédent">
              <Ionicons name="chevron-back" size={22} color={index <= 0 ? E.muted : E.textStrong} />
              <Text style={[styles.actionTexte, index <= 0 && { color: E.muted }]}>Précédent</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={p.onRecalculer} accessibilityRole="button" accessibilityLabel="Recalculer l’ordre des arrêts depuis ma position">
              <Ionicons name="locate-outline" size={22} color={E.textStrong} />
              <Text style={styles.actionTexte}>Recalculer</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={p.onSuivant} disabled={index >= total - 1} accessibilityRole="button" accessibilityLabel="Arrêt suivant">
              <Ionicons name="chevron-forward" size={22} color={index >= total - 1 ? E.muted : E.textStrong} />
              <Text style={[styles.actionTexte, index >= total - 1 && { color: E.muted }]}>Suivant</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.vide}>
          <Ionicons name="checkmark-done-circle-outline" size={44} color={E.green} />
          <Text style={styles.videTexte}>{p.emptyMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: E.white,
    paddingHorizontal: 16,
    gap: 14,
  },
  bandeau: {
    backgroundColor: E.green,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  bandeauHaut: {
    flexDirection: "row",
    alignItems: "center",
  },
  bandeauTitre: {
    flex: 1,
    textAlign: "center",
    color: E.onHeader,
    fontSize: 18,
  },
  bandeauLigne: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  arret: {
    color: E.white,
    fontSize: 24,
    fontWeight: "800",
  },
  resume: {
    color: E.onHeader,
    fontSize: 18,
  },
  barre: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  barrePleine: {
    height: 6,
    borderRadius: 3,
    backgroundColor: E.orange,
  },
  carte: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: E.surfaceAlt,
  },
  bas: {
    gap: 12,
  },
  prochainLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  prochain: {
    fontSize: 20,
    fontWeight: "700",
    color: E.textStrong,
  },
  arrivee: {
    color: E.muted,
    fontSize: 15,
    marginTop: 4,
  },
  demarrer: {
    height: 54,
    borderRadius: 18,
    backgroundColor: E.green,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  evaluer: {
    height: 58,
    borderRadius: 18,
    backgroundColor: E.orange,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  evaluerTexte: {
    color: E.white,
    fontSize: 20,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  action: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    minWidth: 90,
  },
  actionTexte: {
    fontSize: 15,
    fontWeight: "600",
    color: E.textStrong,
  },
  vide: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
  },
  videTexte: {
    color: E.text,
    fontSize: 16,
    textAlign: "center",
  },
});
