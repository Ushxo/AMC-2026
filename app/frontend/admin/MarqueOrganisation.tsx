import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Texte as Text, ChampTexte as TextInput } from "@/components/texte";

import { Chargement } from "@/components/ville/etat-ecran";
import { contraste, estCouleurHex } from "@/marque/couleurs";
import {
  completerCouleurs,
  corrigerContraste,
  jetonsDepuis,
  paletteDepuisGraines,
  PREREGLAGES,
  problemesContraste,
  type Couleurs,
  type Graines,
} from "@/marque/jetons";
import { NUANCES } from "@/marque/nuances";
import { garderMarqueLocale, mettreAJourOrganisation, oublierMarqueLocale, organisationAvecLocale } from "@/marque/magasin";
import { imageLogo, LIBELLES_LOGO } from "@/marque/logos";
import { formaterNombre } from "@/lib/format";
import { listerComptes } from "@/lib/comptes-admin";
import { CLES_LOGO, codeDepuisNom, creerOrganisation, enregistrerOrganisation, EXEMPLES_SERVICE, lireOrganisations, organisationEmbarquee, type Organisation } from "@/lib/organisations";
import { useStyles } from "@/marque/utiliser";
import { useTheme } from "@/hooks/use-theme";
import type { Jetons } from "@/marque/jetons";
import { AuthButton, AuthField, AuthMessage } from "../auth/AuthShell";
import { ApercuMarque } from "./ApercuMarque";

const JETONS_PRINCIPAUX: { cle: keyof Graines; libelle: string }[] = [
  { cle: "primary", libelle: "Couleur principale" },
  { cle: "action", libelle: "Boutons d'action" },
  { cle: "header", libelle: "En-têtes" },
  { cle: "background", libelle: "Fond des écrans" },
];


const LIBELLES_COUPLES: Record<string, string> = {
  "onPrimary/primary": "Texte sur la couleur principale",
  "onAction/action": "Texte sur les boutons d'action",
  "onHeader/header": "Texte sur les en-têtes",
  "text/background": "Texte sur le fond",
  "text/surface": "Texte sur les cartes",
  "textSecondary/background": "Texte secondaire sur le fond",
  "textSecondary/surface": "Texte secondaire sur les cartes",
};

// Marque de l'organisation (administrateur) : nom de l'app, slogan, logo, couleurs par préréglage ou par couleur principale,
// aperçu en direct, contrôle du contraste, enregistrement dans la base et application en direct chez les autres téléphones.
export default function MarqueOrganisation() {
  const styles = useStyles(creerStyles);
  const P = useTheme();
  const [organisations, setOrganisations] = useState<Organisation[] | null>(null);
  const [enBase, setEnBase] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);
  const [nombreComptes, setNombreComptes] = useState<Record<string, number> | null>(null);
  const [nomOrg, setNomOrg] = useState("");
  const [service, setService] = useState("");
  const [nomApp, setNomApp] = useState("");
  const [slogan, setSlogan] = useState("");
  const [logo, setLogo] = useState("priorix");
  const [couleurs, setCouleurs] = useState<Couleurs | null>(null);
  const [saisies, setSaisies] = useState<Partial<Record<keyof Graines, string>>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ texte: string; ok: boolean } | null>(null);

  const existante = organisations?.find((o) => o.code === code) ?? null;
  // En création : une organisation provisoire, sans identifiant, avec un code tiré du nom.
  const org: Organisation | null = creation
    ? { code: codeDepuisNom(nomOrg, (organisations ?? []).map((o) => o.code)), nom: nomOrg.trim(), nom_app: nomApp, slogan: null, logo, couleurs: couleurs ?? {}, service: service.trim() || null, textes: {} }
    : existante;

  function charger(o: Organisation) {
    setCreation(false);
    setCode(o.code);
    setNomOrg(o.nom);
    setService(o.service ?? "");
    setNomApp(o.nom_app);
    setSlogan(o.slogan ?? "");
    setLogo(o.logo);
    setCouleurs(completerCouleurs(o.couleurs, (organisationEmbarquee("priorix")?.couleurs ?? {}) as Couleurs));
    setSaisies({});
    setMessage(null);
  }

  useEffect(() => {
    let actif = true;
    void lireOrganisations().then((r) => {
      if (!actif) return;
      const liste = r.organisations.map(organisationAvecLocale);
      setOrganisations(liste);
      setEnBase(r.enBase);
      if (liste[0]) charger(liste[0]);
    });
    // Nombre de comptes par organisation : seulement si la fonction complète répond (sinon on ne l'affiche pas).
    void listerComptes().then((l) => {
      if (!actif || !l?.complete) return;
      const n: Record<string, number> = {};
      for (const c of l.comptes) if (c.organisation) n[c.organisation] = (n[c.organisation] ?? 0) + 1;
      setNombreComptes(n);
    });
    return () => {
      actif = false;
    };
  }, []);

  const problemes = useMemo(() => (couleurs ? problemesContraste(couleurs) : []), [couleurs]);
  const apercu = useMemo(() => (couleurs ? jetonsDepuis(couleurs) : null), [couleurs]);

  function changerGraine(cle: keyof Graines, valeur: string) {
    if (!couleurs || !estCouleurHex(valeur)) return;
    const graines: Graines = { primary: couleurs.primary, action: couleurs.action, header: couleurs.header, background: couleurs.background, [cle]: valeur.toUpperCase() };
    setCouleurs(paletteDepuisGraines(graines, couleurs));
    setMessage(null);
  }

  function commencerCreation() {
    setCreation(true);
    setCode(null);
    setNomOrg("");
    setService("");
    setNomApp("");
    setSlogan("");
    setLogo("priorix");
    setCouleurs(completerCouleurs(PREREGLAGES[0] ? paletteDepuisGraines(PREREGLAGES[0].graines, (organisationEmbarquee("priorix")?.couleurs ?? {}) as Couleurs) : {}, (organisationEmbarquee("priorix")?.couleurs ?? {}) as Couleurs));
    setSaisies({});
    setMessage(null);
  }

  function appliquerPrereglage(graines: Graines) {
    if (!couleurs) return;
    setCouleurs(paletteDepuisGraines(graines, couleurs));
    setSaisies({});
    setMessage(null);
  }

  async function enregistrer() {
    if (!org || !couleurs) return;
    if (creation && (nomOrg.trim().length < 2 || nomOrg.trim().length > 60)) {
      setMessage({ texte: "Entrez le nom de l'organisation (2 à 60 caractères).", ok: false });
      return;
    }
    const nomAffiche = nomApp.trim() || (creation ? nomOrg.trim() : "");
    if (nomAffiche.length < 2) {
      setMessage({ texte: "Entrez le nom de l'app (2 caractères au moins).", ok: false });
      return;
    }
    // Un couple illisible est corrigé avant l'enregistrement, et on le dit.
    const corrigees = problemes.length > 0 ? corrigerContraste(couleurs) : couleurs;
    const note = problemes.length > 0 ? " Des couleurs ont été corrigées pour rester lisibles." : "";
    const maj: Organisation = { ...org, nom: nomOrg.trim() || org.nom, nom_app: nomAffiche, slogan: slogan.trim() || null, logo, couleurs: corrigees, service: service.trim() || null };
    setBusy(true);
    if (creation) {
      const echec = await creerOrganisation(maj);
      setBusy(false);
      if (echec) {
        setMessage({ texte: echec, ok: false });
        return;
      }
      const lue = await lireOrganisations();
      setOrganisations(lue.organisations.map(organisationAvecLocale));
      setEnBase(lue.enBase);
      setCreation(false);
      setCode(maj.code);
      setMessage({ texte: `Organisation « ${maj.nom} » créée. Rattachez-lui des comptes dans l'onglet Comptes.`, ok: true });
      return;
    }
    const refus = org.id ? await enregistrerOrganisation(maj) : "local";
    setBusy(false);
    if (refus && refus !== "local") {
      setMessage({ texte: refus, ok: false });
      return;
    }
    setCouleurs(corrigees);
    if (refus === "local") garderMarqueLocale(maj); // appliquée tout de suite ET gardée au redémarrage sur ce téléphone
    else {
      oublierMarqueLocale(maj.code);
      mettreAJourOrganisation(maj); // visible tout de suite ici
    }
    setOrganisations((l) => (l ?? []).map((o) => (o.code === maj.code ? maj : o)));
    setMessage({
      texte: refus === "local" ? `Marque appliquée et gardée sur ce téléphone seulement (même après redémarrage) : la base n'est pas encore prête (migration 0009), les autres téléphones ne la voient pas.${note}` : `Marque enregistrée : elle s'applique en direct sur les autres téléphones.${note}`,
      ok: true,
    });
  }

  function retablir() {
    const d = org ? organisationEmbarquee(org.code) : undefined;
    if (!org || !d) {
      setMessage({ texte: "Pas de valeurs d'origine pour cette organisation.", ok: false });
      return;
    }
    charger({ ...org, nom_app: d.nom_app, slogan: d.slogan, logo: d.logo, couleurs: d.couleurs });
    setMessage({ texte: "Valeurs d'origine remises : enregistrez pour les appliquer.", ok: true });
  }

  if (!organisations || !couleurs || !apercu || !org) return <Chargement texte="Chargement des organisations…" />;

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.titre} accessibilityRole="header">
        Organisations
      </Text>
      <View style={styles.liste}>
        {organisations.map((o) => (
          <Pressable key={o.code} accessibilityRole="radio" accessibilityState={{ selected: !creation && code === o.code }} accessibilityLabel={`${o.nom}${o.service ? `, ${o.service}` : ""}`} onPress={() => charger(o)} style={[styles.ligneOrg, !creation && code === o.code && styles.chipActif]}>
            <Image source={imageLogo(o.logo)} style={styles.logoPetit} contentFit="cover" accessible={false} />
            <View style={{ flex: 1 }}>
              <Text style={styles.chipTexte}>{o.nom}</Text>
              <Text style={styles.note}>
                {o.service ?? "Service non précisé"}
                {nombreComptes ? ` · ${formaterNombre(nombreComptes[o.nom] ?? 0, "compte", "comptes")}` : ""}
              </Text>
            </View>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Créer une organisation" onPress={commencerCreation} style={[styles.ligneOrg, creation && styles.chipActif]}>
          <Ionicons name="add-circle-outline" size={28} color={P.primary} />
          <Text style={styles.chipTexte}>Créer une organisation</Text>
        </Pressable>
      </View>
      {!enBase ? <Text style={styles.note}>Les organisations viennent de l&apos;app (migrations 0009 et 0010 pas encore lancées) : l&apos;enregistrement vaut pour ce téléphone, la création est impossible.</Text> : null}

      <Text style={styles.titre} accessibilityRole="header">
        Aperçu en direct
      </Text>
      <ApercuMarque jetons={apercu} nomApp={nomApp} slogan={slogan.trim() || null} logo={logo} />

      <Text style={styles.titre} accessibilityRole="header">
        {creation ? "Nouvelle organisation" : "Organisation et service"}
      </Text>
      <AuthField icon="business-outline" label="Nom de l'organisation" value={nomOrg} onChangeText={(v) => { setNomOrg(v); setMessage(null); }} maxLength={60} />
      <AuthField icon="construct-outline" label="Service : ce que ses équipes traitent" value={service} onChangeText={(v) => { setService(v); setMessage(null); }} maxLength={60} />
      <View style={styles.rangee}>
        {EXEMPLES_SERVICE.map((e) => (
          <Pressable key={e} accessibilityRole="button" accessibilityLabel={`Service : ${e}`} onPress={() => { setService(e); setMessage(null); }} style={[styles.chip, service === e && styles.chipActif]}>
            <Text style={styles.chipTexte}>{e}</Text>
          </Pressable>
        ))}
      </View>
      {creation ? <Text style={styles.note}>Code de l&apos;organisation : {org?.code}</Text> : null}

      <Text style={styles.titre} accessibilityRole="header">
        Nom de l&apos;app, slogan et logo
      </Text>
      <AuthField icon="pricetag-outline" label="Nom de l'app" value={nomApp} onChangeText={(v) => { setNomApp(v); setMessage(null); }} maxLength={40} />
      <AuthField icon="chatbubble-outline" label="Slogan (80 caractères au plus)" value={slogan} onChangeText={(v) => { setSlogan(v); setMessage(null); }} maxLength={80} />
      <View style={styles.rangee}>
        {CLES_LOGO.map((l) => (
          <Pressable key={l} accessibilityRole="radio" accessibilityState={{ selected: logo === l }} accessibilityLabel={`Logo : ${LIBELLES_LOGO[l]}`} onPress={() => { setLogo(l); setMessage(null); }} style={[styles.logoChoix, logo === l && styles.chipActif]}>
            <Image source={imageLogo(l)} style={styles.logoImage} contentFit="cover" accessible={false} />
            <Text style={styles.chipTexte}>{LIBELLES_LOGO[l]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.titre} accessibilityRole="header">
        Préréglages de couleurs
      </Text>
      <View style={styles.rangee}>
        {PREREGLAGES.map((p) => (
          <Pressable key={p.nom} accessibilityRole="button" accessibilityLabel={`Préréglage ${p.nom}`} onPress={() => appliquerPrereglage(p.graines)} style={styles.chip}>
            <View style={styles.points}>
              <View style={[styles.point, { backgroundColor: p.graines.primary }]} />
              <View style={[styles.point, { backgroundColor: p.graines.action }]} />
              <View style={[styles.point, { backgroundColor: p.graines.background, borderWidth: 1, borderColor: P.borderForte }]} />
            </View>
            <Text style={styles.chipTexte}>{p.nom}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.titre} accessibilityRole="header">
        Couleurs principales
      </Text>
      <Text style={styles.note}>Les autres couleurs (textes, fonds des cartes, bordures, accent) sont recalculées à partir de ces quatre couleurs pour rester cohérentes et lisibles.</Text>
      {JETONS_PRINCIPAUX.map(({ cle, libelle }) => (
        <View key={cle} style={styles.groupe}>
          <View style={styles.ligneCouleur}>
            <View style={[styles.echantillon, { backgroundColor: couleurs[cle], borderColor: P.borderForte }]} />
            <Text style={styles.libelle}>{libelle}</Text>
            <TextInput
              style={styles.champHex}
              value={saisies[cle] ?? couleurs[cle]}
              onChangeText={(v) => {
                setSaisies((s) => ({ ...s, [cle]: v }));
                changerGraine(cle, v.startsWith("#") ? v : `#${v}`);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              accessibilityLabel={`${libelle}, code couleur`}
            />
          </View>
          <View style={styles.rangee}>
            {NUANCES[cle].map((n) => (
              <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${libelle} ${n}`} onPress={() => { changerGraine(cle, n); setSaisies((s) => ({ ...s, [cle]: n })); }} style={[styles.nuance, { backgroundColor: n, borderColor: couleurs[cle] === n ? P.text : P.borderForte, borderWidth: couleurs[cle] === n ? 3 : 1 }]} />
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.titre} accessibilityRole="header">
        Contraste (lisibilité)
      </Text>
      {(["onPrimary/primary", "onAction/action", "onHeader/header", "text/background", "textSecondary/background"] as const).map((k) => {
        const [a, b] = k.split("/") as [keyof Couleurs, keyof Couleurs];
        const rapport = contraste(couleurs[a], couleurs[b]);
        const min = 4.5;
        const ok = rapport >= min;
        return (
          <Text key={k} style={[styles.contraste, { color: ok ? P.text : P.danger }]} accessibilityLabel={`${LIBELLES_COUPLES[k]} : contraste ${rapport.toFixed(1)}, ${ok ? "lisible" : "illisible"}`}>
            {ok ? "Lisible" : "Illisible"} : {LIBELLES_COUPLES[k]}, contraste {rapport.toFixed(1)} (minimum {min})
          </Text>
        );
      })}
      {problemes.length > 0 ? <AuthMessage>Un couple de couleurs est illisible : il sera corrigé à l&apos;enregistrement.</AuthMessage> : null}

      {message ? <AuthMessage ok={message.ok}>{message.texte}</AuthMessage> : null}
      <AuthButton label={creation ? "Créer l'organisation" : "Enregistrer l'organisation"} onPress={() => void enregistrer()} busy={busy} />
      {creation ? <AuthButton label="Annuler" onPress={() => existante ? charger(existante) : organisations[0] && charger(organisations[0])} outline /> : <AuthButton label="Rétablir les valeurs d'origine" onPress={retablir} outline />}
    </ScrollView>
  );
}

const creerStyles = (P: Jetons) =>
  StyleSheet.create({
    page: { padding: 20, gap: 12, maxWidth: 800, width: "100%", alignSelf: "center" },
    titre: { fontSize: 18, fontWeight: "700", color: P.text, marginTop: 8 },
    note: { fontSize: 13, color: P.textSecondary, lineHeight: 19 },
    rangee: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    liste: { gap: 8 },
    ligneOrg: { minHeight: 64, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: P.borderForte, backgroundColor: P.surface, flexDirection: "row", alignItems: "center", gap: 12 },
    logoPetit: { width: 40, height: 40, borderRadius: 12 },
    chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, borderColor: P.borderForte, backgroundColor: P.surface, flexDirection: "row", alignItems: "center", gap: 8 },
    chipActif: { backgroundColor: P.backgroundSelected, borderWidth: 2, borderColor: P.primary },
    chipTexte: { fontSize: 14, fontWeight: "700", color: P.text },
    points: { flexDirection: "row", gap: 2 },
    point: { width: 14, height: 14, borderRadius: 7 },
    logoChoix: { minHeight: 64, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: P.borderForte, backgroundColor: P.surface, flexDirection: "row", alignItems: "center", gap: 12 },
    logoImage: { width: 44, height: 44, borderRadius: 12 },
    groupe: { gap: 8 },
    ligneCouleur: { flexDirection: "row", alignItems: "center", gap: 12 },
    echantillon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 },
    libelle: { flex: 1, fontSize: 15, fontWeight: "600", color: P.text },
    champHex: { minWidth: 104, minHeight: 48, borderRadius: 16, borderWidth: 2, borderColor: P.borderForte, backgroundColor: P.surface, color: P.text, paddingHorizontal: 12, fontSize: 15 },
    nuance: { width: 40, height: 40, borderRadius: 20 },
    contraste: { fontSize: 14, fontWeight: "600" },
  });
