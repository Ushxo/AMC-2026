import React, { useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EcranTrajet } from "@/app/ville/trajet/[equipe]";
import { Texte as Text } from "@/components/texte";
import { Chargement } from "@/components/ville/etat-ecran";
import { useMonEquipe } from "@/hooks/use-mon-equipe";
import { useSuiviTrajet } from "@/hooks/use-suivi-trajet";
import { ecrireEvaluation, envoyerRapport, evaluationDe, rapportEnvoyeLe, useEtatRapport } from "@/lib/rapport";
import { idArret, noterFaitLocal } from "@/lib/trajet";
import { TabBar, type TabDef } from "../components/BottomNav";
import EvaluateScreen from "./EvaluateScreen";
import ReportScreen from "./ReportScreen";
import RouteStopScreen from "./RouteStopScreen";
import { E, Header, useInfosArrets } from "./shared";

type Tab = "tournee" | "rapport";
type Ecran = { nom: "onglets" } | { nom: "trajet" } | { nom: "evaluer"; arretId: string };

const TABS: TabDef<Tab>[] = [
  {
    id: "tournee",
    label: "Ma tournée",
    icon: (sel) => <MaterialCommunityIcons name={sel ? "truck" : "truck-outline"} size={30} color={E.green} />,
  },
  {
    id: "rapport",
    label: "Rapport",
    icon: (sel) => <Ionicons name={sel ? "document-text" : "document-text-outline"} size={28} color={E.green} />,
  },
];

const MESSAGE_ECHEC_EVALUATION = "L’évaluation n’a pas pu être enregistrée. Vérifiez la connexion et réessayez.";
const MESSAGE_ECHEC_RAPPORT = "Le rapport n’a pas pu être envoyé. Réessayez depuis l’onglet Rapport.";

function confirmLogout(onLogout: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm("Se déconnecter ?")) onLogout();
    return;
  }
  Alert.alert("Se déconnecter ?", undefined, [
    { text: "Annuler", style: "cancel" },
    { text: "Se déconnecter", style: "destructive", onPress: onLogout },
  ]);
}

/**
 * Espace employé : le responsable d'équipe suit le trajet reçu, évalue chaque intervention une fois sur place
 * (réparé, ou pas réglé avec un commentaire), et le rapport part au superviseur après le dernier arrêt.
 */
export default function EmployeeApp({ onLogout }: { onLogout: () => void }) {
  const insets = useSafeAreaInsets();
  const { equipeId, chargement } = useMonEquipe();
  const suivi = useSuiviTrajet(equipeId ?? "");
  const { evaluations, envoyes } = useEtatRapport();
  const [tab, setTab] = useState<Tab>("tournee");
  const [ecran, setEcran] = useState<Ecran>({ nom: "onglets" });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Arrêt choisi avec Précédent / Suivant ; null = le prochain arrêt à évaluer.
  const [choisi, setChoisi] = useState<string | null>(null);
  const logout = () => confirmLogout(onLogout);

  const { tournee, arrets } = suivi;
  const infos = useInfosArrets(arrets);
  const evaluation = (a: (typeof arrets)[number]) => evaluationDe(a, evaluations);
  const estEvalue = (a: (typeof arrets)[number]) => evaluation(a) !== null;
  const prochain = arrets.find((a) => !estEvalue(a)) ?? null;
  const envoyeLe = tournee ? rapportEnvoyeLe(tournee, envoyes) : null;
  const affiche = (choisi ? arrets.find((a) => idArret(a) === choisi) : null) ?? prochain;
  const indexAffiche = affiche ? arrets.indexOf(affiche) : -1;

  if (chargement) return <Chargement texte="Recherche de votre équipe…" />;

  if (!equipeId) {
    return (
      <View style={styles.root}>
        <Header title="Ma tournée" right={{ icon: "log-out-outline", label: "Se déconnecter", onPress: logout }} />
        <View style={styles.noTeam} accessibilityRole="alert">
          <Text style={styles.noTeamTitle}>Aucune équipe associée à ce compte</Text>
          <Text style={styles.noTeamText}>
            Demandez au superviseur d’associer votre compte à votre équipe (fiche de l’équipe, « Compte de l’équipe »).
          </Text>
        </View>
      </View>
    );
  }

  async function envoyer() {
    if (!tournee) return;
    setEnvoi(true);
    const ok = await envoyerRapport(tournee);
    setEnvoi(false);
    setErreur(ok ? null : MESSAGE_ECHEC_RAPPORT);
  }

  async function evaluer(arretId: string, regle: boolean, commentaire: string) {
    const a = arrets.find((x) => idArret(x) === arretId);
    if (!a) return;
    setEnvoi(true);
    setErreur(null);
    // Réparé : l'arrêt est fait et ses signalements passent à « réglé ». Pas réglé : les signalements restent ouverts.
    const echecFait = regle ? await suivi.marquerFait(arretId) : null;
    const ok = await ecrireEvaluation(a, regle, commentaire);
    // La navigation passe à l'arrêt suivant sur ce téléphone, même si celui-ci n'est pas réglé.
    if (!regle) noterFaitLocal(arretId);
    setEnvoi(false);
    if (echecFait || !ok) {
      setErreur(echecFait ?? MESSAGE_ECHEC_EVALUATION);
      return;
    }
    const restants = arrets.filter((x) => idArret(x) !== arretId && !estEvalue(x));
    setChoisi(null);
    setEcran({ nom: "onglets" });
    // Dernier arrêt évalué : le rapport part au superviseur.
    if (restants.length === 0 && tournee) {
      setTab("rapport");
      await envoyer();
    }
  }

  if (ecran.nom === "evaluer") {
    const info = infos.get(ecran.arretId);
    if (info) {
      const restants = arrets.filter((x) => !estEvalue(x)).length;
      return (
        <EvaluateScreen
          info={info}
          dernier={restants <= 1}
          envoi={envoi}
          erreur={erreur}
          onBack={() => {
            setErreur(null);
            setEcran({ nom: "onglets" });
          }}
          onSend={(regle, commentaire) => void evaluer(ecran.arretId, regle, commentaire)}
        />
      );
    }
  }

  if (ecran.nom === "trajet") {
    // Navigation plein écran, lancée tout de suite ; « Arrêter » ramène à Ma tournée.
    return (
      <View style={[styles.root, { backgroundColor: E.green, paddingTop: insets.top }]}>
        <EcranTrajet
          equipe={equipeId}
          demarrer
          onFin={() => setEcran({ nom: "onglets" })}
          onEvaluer={(arretId) => setEcran({ nom: "evaluer", arretId })}
        />
      </View>
    );
  }

  function deplacer(delta: number) {
    const cible = arrets[indexAffiche + delta];
    if (cible) setChoisi(idArret(cible));
  }

  function recalculer() {
    if (!suivi.position) {
      const message = "Position non disponible : activez la localisation pour recalculer l’ordre des arrêts.";
      if (Platform.OS === "web") window.alert(message);
      else Alert.alert("Recalculer", message);
      return;
    }
    // Les arrêts restants sont remis dans l'ordre le plus court depuis la position actuelle (estimation sur ce téléphone).
    suivi.reordonnerDepuis(suivi.position);
    setChoisi(null);
  }

  const emptyMessage = !tournee
    ? "Aucune tournée assignée à votre équipe pour le moment."
    : envoyeLe
      ? "Tournée terminée : le rapport a été envoyé au superviseur."
      : "Tous les arrêts sont évalués : envoyez le rapport depuis l’onglet Rapport.";

  return (
    <View style={styles.root}>
      {tab === "tournee" ? (
        <RouteStopScreen
          tournee={tournee}
          arrets={arrets}
          estEvalue={estEvalue}
          affiche={affiche ? (infos.get(idArret(affiche)) ?? null) : null}
          evalues={arrets.filter(estEvalue).length}
          position={suivi.position}
          emptyMessage={emptyMessage}
          onPrecedent={() => deplacer(-1)}
          onSuivant={() => deplacer(1)}
          onRecalculer={recalculer}
          onSuivre={() => setEcran({ nom: "trajet" })}
          onEvaluate={() => affiche && setEcran({ nom: "evaluer", arretId: idArret(affiche) })}
          onLogout={logout}
        />
      ) : (
        <ReportScreen
          arrets={arrets}
          infos={infos}
          evaluation={evaluation}
          envoyeLe={envoyeLe}
          envoi={envoi}
          erreur={erreur}
          onEnvoyer={() => void envoyer()}
        />
      )}
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: E.cream,
  },
  noTeam: {
    padding: 24,
    gap: 10,
  },
  noTeamTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: E.text,
  },
  noTeamText: {
    fontSize: 15,
    color: E.muted,
    lineHeight: 21,
  },
});
