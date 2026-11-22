import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Texte as Text } from "@/components/texte";

import { Chargement, Erreur, Vide } from "@/components/ville/etat-ecran";
import { Palette } from "@/constants/theme";
import { libelleRoleCompte, listerComptes, type ListeComptes } from "@/lib/comptes-admin";
import { definirOrganisationCompte, lireOrganisations, type Organisation } from "@/lib/organisations";
import { AuthButton, AuthField, AuthMessage } from "../auth/AuthShell";

// Comptes du personnel : la liste (rôle, organisation et équipe quand la base les donne), la création, et le changement d'organisation.
export default function ComptesPersonnel({ onCreer }: { onCreer: () => void }) {
  const [liste, setListe] = useState<ListeComptes | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [courriel, setCourriel] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ texte: string; ok: boolean } | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    const l = await listerComptes();
    if (!l) setErreur("Les comptes ne peuvent pas être lus pour l'instant.");
    setListe(l);
    setChargement(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void charger(), 0);
    void lireOrganisations().then((r) => setOrganisations(r.organisations));
    return () => clearTimeout(t);
  }, [charger]);

  async function changer() {
    if (!code) {
      setMessage({ texte: "Choisissez une organisation.", ok: false });
      return;
    }
    setBusy(true);
    setMessage(null);
    const r = await definirOrganisationCompte(courriel, code);
    setBusy(false);
    if (r) setMessage({ texte: r, ok: false });
    else {
      setMessage({ texte: `Organisation changée : ${courriel.trim()} est maintenant dans « ${organisations.find((o) => o.code === code)?.nom ?? code} ».`, ok: true });
      setCourriel("");
      void charger();
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <AuthButton label="Créer un compte du personnel" onPress={onCreer} />

      <Text style={styles.titre} accessibilityRole="header">
        Comptes du personnel
      </Text>
      {chargement ? (
        <Chargement texte="Chargement des comptes…" />
      ) : erreur ? (
        <Erreur message={erreur} onReessayer={() => void charger()} />
      ) : !liste || liste.comptes.length === 0 ? (
        <Vide texte="Aucun compte du personnel pour le moment." />
      ) : (
        <>
          {!liste.complete ? (
            <Text style={styles.note}>
              Courriel, organisation et équipe ne sont pas encore lisibles ici : la liste vient des profils (rôle et nom). Ils s&apos;afficheront quand la fonction liste_comptes_personnel sera en place sur le serveur.
            </Text>
          ) : null}
          {liste.comptes.map((c) => (
            <View key={c.id} style={styles.carte} accessible accessibilityLabel={`${c.nom}, ${libelleRoleCompte(c)}${c.organisation ? `, organisation ${c.organisation}` : ""}${c.equipe ? `, équipe ${c.equipe}` : ""}`}>
              <View style={styles.rond}>
                <Ionicons name={c.role === "admin" ? "shield-checkmark-outline" : c.poste === "superviseur" ? "clipboard-outline" : "people-outline"} size={22} color={Palette.header} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.nom}>{c.nom}</Text>
                {c.courriel ? <Text style={styles.detail}>{c.courriel}</Text> : null}
                <Text style={styles.detail}>
                  {libelleRoleCompte(c)}
                  {c.organisation ? ` · ${c.organisation}` : ""}
                  {c.equipe ? ` · ${c.equipe}` : ""}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      <Text style={styles.titre} accessibilityRole="header">
        Changer l&apos;organisation d&apos;un compte
      </Text>
      <AuthField icon="mail-outline" label="Courriel du compte" value={courriel} onChangeText={setCourriel} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <View style={styles.rangee}>
        {organisations.map((o) => (
          <Pressable key={o.code} accessibilityRole="radio" accessibilityState={{ selected: code === o.code }} onPress={() => setCode(o.code)} style={[styles.chip, code === o.code && styles.chipActif]}>
            <Text style={styles.chipTexte}>{o.nom}</Text>
          </Pressable>
        ))}
      </View>
      {message ? <AuthMessage ok={message.ok}>{message.texte}</AuthMessage> : null}
      <AuthButton label="Changer l'organisation" onPress={() => void changer()} busy={busy} outline />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 12, maxWidth: 800, width: "100%", alignSelf: "center" },
  titre: { fontSize: 18, fontWeight: "700", color: Palette.text, marginTop: 8 },
  note: { fontSize: 13, color: Palette.textSecondary, lineHeight: 19 },
  carte: { backgroundColor: Palette.surface, borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  rond: { width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.backgroundSelected, alignItems: "center", justifyContent: "center" },
  nom: { fontSize: 16, fontWeight: "700", color: Palette.text },
  detail: { fontSize: 13, fontWeight: "500", color: Palette.textSecondary },
  rangee: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1, borderColor: Palette.borderForte, backgroundColor: Palette.surface, justifyContent: "center" },
  chipActif: { backgroundColor: Palette.backgroundSelected, borderWidth: 2, borderColor: Palette.primary },
  chipTexte: { fontSize: 15, fontWeight: "700", color: Palette.text },
});
