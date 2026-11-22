import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, StyleSheet, View, Switch } from 'react-native';
import { ChampTexte as TextInput } from '@/components/texte';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { MESSAGE_RECHERCHE_INDISPONIBLE, useRechercheAdresse } from '@/hooks/use-recherche-adresse';
import { Carte, Cercle, Repere, Zone, type CarteCommandes } from '@/components/carte';
import { AvisEau } from '@/components/ville/avis-eau';
import { ReperesEndroits } from '@/components/ville/reperes-endroits';
import { Chargement, Erreur } from '@/components/ville/etat-ecran';
import { ListeEndroits } from '@/components/ville/liste-endroits';
import { BandesInondation } from '@/components/ville/bandes-inondation';
import { SelecteurCarte } from '@/components/ville/selecteur-carte';
import { COULEUR_REPERE, STYLE_CHANTIER, STYLE_ZONE_INONDABLE } from '@/components/ville/style';
import { useCouches } from '@/hooks/use-couches';
import { useBandesInondation } from '@/hooks/use-bandes-inondation';
import { useBouchesExistantes } from '@/hooks/use-bouches-existantes';
import { useRegroupement } from '@/hooks/use-regroupement';
import type { Regroupement } from '@/lib/regroupement';
import { useEndroits } from '@/hooks/use-endroits';
import { usePositionCarte } from '@/hooks/use-position-carte';
import { useSource } from '@/hooks/use-source';
import { useTheme } from '@/hooks/use-theme';
import { formaterNombre } from '@/lib/format';
import { chargerRegion } from '@/lib/officiel';
import { libelleBande } from '@/lib/inondation';
import {
  avisVisibles,
  basculerCouche,
  chantierEn,
  COUCHES_CARTE,
  COUCHES_PAR_DEFAUT,
  ficheAvis,
  ficheChantier,
  ficheZoneInondable,
  LIBELLES_COUCHE,
  verifierAvis,
  zoneInondableEn,
  type ElementCarte,
  type EtatCouches,
  type VerificationAvis,
} from '@/lib/couches-carte';
import { pointDansGeometrie } from '@/lib/geo';
import { dansQuartier, messagePositionCarte, RAYON_CITOYEN_M } from '@/lib/position-citoyen';
import { LIBELLES_GRAVITE, type Categorie, type Endroit, type ResultatRecherche } from '@/types';
import { FeuilleProbleme } from './feuille-probleme';

function premierSignalement(e: Endroit): string {
  const ouvert = e.signalements.find((s) => s.etat === 'nouveau' || s.etat === 'pris_en_charge');
  return (ouvert ?? e.signalements[0]).id;
}

const REGROUPEMENT_VIDE: Regroupement = { groupes: [], isoles: [] };

/** Hauteur de la barre du bas de la coquille (les boutons flottants se posent au-dessus). */
const HAUTEUR_BARRE = 92;

type Props = {
  /** Dans la coquille de l'app (barre du bas, compte) : espace pour la barre et bouton de compte en haut. */
  coquille?: { espaceBas: number; onOpenProfile: () => void; /** Dit à la coquille quand la feuille de signalement est ouverte (la barre du bas se retire). */ onFeuille?: (ouverte: boolean) => void };
};

/** Carte des égouts : la carte plein écran, un en-tête vert avec la recherche d'adresse, un bouton de recentrage et « Signaler ». */
export default function CarteCitoyen({ coquille }: Props) {
  const { top, bottom } = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { etat } = useSource();
  const { couches } = useCouches();
  const { endroits, signalements, chargement, erreur, rafraichir } = useEndroits();
  const bandes = useBandesInondation(signalements);
  const [options, setOptions] = useState(false);
  const [feuille, setFeuille] = useState<{ point: { latitude: number; longitude: number } | null } | null>(null);
  const [choixProbleme, setChoixProbleme] = useState<Categorie | null>(null);
  const onFeuille = coquille?.onFeuille;
  const feuilleOuverte = feuille !== null;
  useEffect(() => {
    onFeuille?.(feuilleOuverte);
    return () => onFeuille?.(false);
  }, [onFeuille, feuilleOuverte]);
  const [coucheVisible, setCoucheVisible] = useState<EtatCouches>(COUCHES_PAR_DEFAUT);
  const [fiche, setFiche] = useState<{ element: ElementCarte; point: { latitude: number; longitude: number } | null } | null>(null);
  const [verifAdresse, setVerifAdresse] = useState<VerificationAvis | null>(null);
  const [texte, setTexte] = useState('');
  const [resultats, setResultats] = useState<ResultatRecherche[] | null>(null);
  const { chercher, indisponible } = useRechercheAdresse();
  const region = useMemo(() => chargerRegion(), []);
  const visibles = useMemo(() => endroits.filter((e) => e.nombre > 0), [endroits]);
  const { bouches, surRegion } = useBouchesExistantes(endroits);
  const { regroupement, surRegion: surRegionGroupes, surTaille } = useRegroupement(visibles, region);
  const carte = useRef<CarteCommandes>(null);
  const { position: maPosition, statut: statutPosition, actualiser } = usePositionCarte();
  const avis = useMemo(() => avisVisibles(couches.avisEau, coucheVisible), [couches.avisEau, coucheVisible]);
  // Position du téléphone : on le dit seulement si elle est sous un avis (sinon, rien à signaler de plus).
  const verifPosition = useMemo(() => (maPosition ? verifierAvis(maPosition, couches.avisEau, 'position') : null), [maPosition, couches.avisEau]);
  const dejaCentre = useRef(false);

  // À l'ouverture : la carte se centre sur le citoyen dès que sa position arrive, s'il est dans le quartier desservi.
  useEffect(() => {
    if (dejaCentre.current || chargement || erreur || !maPosition || !dansQuartier(maPosition, region)) return;
    if (!carte.current) return;
    dejaCentre.current = true;
    carte.current.surPosition(maPosition, RAYON_CITOYEN_M);
  }, [maPosition, chargement, erreur, region]);

  async function recentrer() {
    const p = maPosition ?? (await actualiser());
    if (p && dansQuartier(p, region)) carte.current?.surPosition(p, RAYON_CITOYEN_M);
  }
  const messagePosition = messagePositionCarte(statutPosition, maPosition, region);

  async function lancerRecherche() {
    setResultats(await chercher(texte));
  }

  // Toucher la carte : un élément officiel (avis, chantier, zone inondable) ouvre sa fiche ; sinon on signale à cet endroit.
  function toucherCarte(c: { latitude: number; longitude: number }) {
    const a = avis.find((f) => pointDansGeometrie(c, f.geometry));
    if (a) return setFiche({ element: ficheAvis(a), point: c });
    const ch = coucheVisible.chantiers ? chantierEn(couches.chantiers, c) : null;
    if (ch) return setFiche({ element: ficheChantier(ch), point: c });
    const z = coucheVisible.zonesInondables ? zoneInondableEn(couches.zonesInondables, c) : null;
    if (z) return setFiche({ element: ficheZoneInondable(z), point: c });
    signalerIci(c);
  }

  // Toucher un regard lance le signalement à cet endroit.
  function signalerIci(c: { latitude: number; longitude: number }) {
    setChoixProbleme(null);
    setFeuille({ point: c });
  }

  // La feuille « Quel problème ? » monte par-dessus la carte ; « Continuer » ouvre la photo, puis les détails (plein écran).
  function continuerSignalement() {
    if (!choixProbleme || !feuille) return;
    const p = feuille.point;
    setFeuille(null);
    router.push({
      pathname: '/signaler',
      params: { categorie: choixProbleme, ...(p ? { lat: String(p.latitude), lng: String(p.longitude) } : {}) },
    });
  }

  return (
    <View style={styles.fond}>
      {chargement ? (
        <View style={styles.centre}>
          <Chargement texte="Chargement de la carte…" />
        </View>
      ) : erreur ? (
        <View style={styles.centre}>
          <Erreur message={erreur} onReessayer={() => void rafraichir()} />
        </View>
      ) : (
        <Carte
          style={styles.carte}
          commandes={carte}
          regionInitiale={region}
          positionUtilisateur={statutPosition === 'ok'}
          onTaille={surTaille}
          onRegionChangeComplete={(r) => {
            surRegion(r);
            surRegionGroupes(r);
          }}
          onPress={toucherCarte}
          accessibilityLabel="Carte des signalements et des avis d'eau. Touchez la carte pour signaler un problème à cet endroit, ou un avis pour voir sa fiche.">
          <AvisEau avis={avis} onChoisir={(a) => setFiche({ element: ficheAvis(a), point: null })} />
          {coucheVisible.zonesInondables
            ? couches.zonesInondables.features.flatMap((f) => {
                const anneaux = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
                return anneaux.map((poly, i) => (
                  <Zone
                    key={`zi-${f.properties.id}-${i}`}
                    id={`zi-${f.properties.id}-${i}`}
                    exterieur={poly[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
                    fond={STYLE_ZONE_INONDABLE.fond}
                    contour={STYLE_ZONE_INONDABLE.contour}
                    epaisseur={STYLE_ZONE_INONDABLE.epaisseur}
                    onPress={() => setFiche({ element: ficheZoneInondable(f), point: null })}
                  />
                ));
              })
            : null}
          {coucheVisible.chantiers
            ? couches.chantiers.features.map((f) =>
                f.geometry ? (
                  <Cercle
                    key={`ch-${f.properties.id}`}
                    id={`ch-${f.properties.id}`}
                    centre={{ latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] }}
                    rayonM={STYLE_CHANTIER.rayonM}
                    fond={STYLE_CHANTIER.fond}
                    contour={STYLE_CHANTIER.contour}
                    epaisseur={STYLE_CHANTIER.epaisseur}
                  />
                ) : null,
              )
            : null}
          {coucheVisible.eauAccumulee ? <BandesInondation bandes={bandes} /> : null}
          {(coucheVisible.regards ? bouches : []).map((b) => (
            <Repere
              key={`b-${b.id}`}
              id={`regard-${b.id}`}
              position={b.position}
              couleur={COULEUR_REPERE.existant}
              zIndex={1}
              onPress={() => signalerIci(b.position)}
              accessibilityLabel={`Regard d'égout, sans signalement${b.adresse ? `, ${b.adresse}` : ''}. Toucher pour le signaler.`}
            />
          ))}
          <ReperesEndroits
            regroupement={coucheVisible.signalements ? regroupement : REGROUPEMENT_VIDE}
            onZoomer={(points) => carte.current?.zoomer(points)}
            rendreEndroit={(e) => {
              const nombre = formaterNombre(e.nombre, 'signalement ouvert', 'signalements ouverts');
              return (
                <Repere
                  key={e.cle}
                  id={`endroit-${e.cle}`}
                  position={e.position}
                  couleur={COULEUR_REPERE[e.gravite_affichee]}
                  zIndex={2}
                  titre={`Gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}`}
                  description={nombre}
                  accessibilityLabel={`${nombre}, gravité ${LIBELLES_GRAVITE[e.gravite_affichee]}. Voir le suivi.`}
                  onBulle={() => router.push({ pathname: '/suivi/[id]', params: { id: premierSignalement(e) } })}
                />
              );
            }}
          />
        </Carte>
      )}

      {/* En-tête vert : titre, compte, recherche d'adresse. */}
      <View style={[styles.entete, { backgroundColor: theme.header, paddingTop: top + 10 }]}>
        <View style={styles.ligneTitre}>
          <ThemedText type="subtitle" accessibilityRole="header" style={[styles.titre, { color: theme.onHeader }]} maxFontSizeMultiplier={1.3}>
            Carte des égouts
          </ThemedText>
          {coquille ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Mon compte et connexion du personnel" hitSlop={8} onPress={coquille.onOpenProfile} style={styles.compte}>
              <Ionicons name="person-circle-outline" size={44} color={theme.onHeader} />
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.recherche, { backgroundColor: theme.onHeader }]}>
          <Ionicons name="search" size={24} color={theme.primary} />
          <TextInput
            style={[styles.champ, { color: theme.text }]}
            placeholder="Rechercher une adresse à Montréal"
            placeholderTextColor={theme.textSecondary}
            value={texte}
            onChangeText={(v) => {
              setTexte(v);
              setVerifAdresse(null);
              if (!v) setResultats(null);
            }}
            onSubmitEditing={() => void lancerRecherche()}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Rechercher une adresse à Montréal"
          />
        </View>
      </View>

      {(() => {
        const v = verifAdresse ?? (verifPosition?.sous ? verifPosition : null);
        if (!v || resultats) return null;
        return (
          <View
            accessibilityRole="alert"
            style={[styles.verif, { top: top + 150, backgroundColor: v.sous ? '#E4F1F5' : theme.onHeader, borderColor: v.sous ? '#287F99' : theme.border }]}>
            <ThemedText type="smallBold">{v.message}</ThemedText>
            {v.sous ? (
              <Pressable accessibilityRole="button" onPress={() => setFiche({ element: ficheAvis(v.avis[0]), point: null })} style={styles.lienVerif}>
                <ThemedText type="small" style={{ textDecorationLine: 'underline' }}>
                  Voir l&apos;avis
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        );
      })()}

      {resultats ? (
        <View style={[styles.resultats, { top: top + 150, backgroundColor: theme.surface, borderColor: theme.border }]}>
          {resultats.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" accessibilityRole="alert" style={styles.ligneResultat}>
              {indisponible ? MESSAGE_RECHERCHE_INDISPONIBLE : 'Aucune adresse trouvée.'}
            </ThemedText>
          ) : (
            resultats.map((r) => (
              <Pressable
                key={`${r.libelle}-${r.position.latitude}`}
                accessibilityRole="button"
                accessibilityLabel={`Aller à ${r.libelle}`}
                style={styles.ligneResultat}
                onPress={() => {
                  carte.current?.surPosition(r.position, 300);
                  setResultats(null);
                  setTexte(r.libelle);
                  setVerifAdresse(verifierAvis(r.position, couches.avisEau, 'adresse'));
                }}>
                <ThemedText type="small">{r.libelle}</ThemedText>
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      {/* Boutons flottants : options de la carte, recentrage, signalement. */}
      <View pointerEvents="box-none" style={[styles.flottants, { bottom: HAUTEUR_BARRE * (coquille ? 1 : 0) + bottom + 16 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Options de la carte et liste des endroits" onPress={() => setOptions(true)} style={[styles.rond, { backgroundColor: theme.onHeader }]}>
          <Ionicons name="layers-outline" size={26} color={theme.primary} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setChoixProbleme(null); setFeuille({ point: null }); }} style={[styles.signaler, { backgroundColor: theme.accent }]}>
          <Ionicons name="add" size={24} color={theme.surface} />
          <ThemedText type="smallBold" style={{ color: theme.surface }} maxFontSizeMultiplier={1.3}>
            Signaler un problème
          </ThemedText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Ma position : recentrer la carte" onPress={() => void recentrer()} style={[styles.rond, { backgroundColor: theme.onHeader }]}>
          <Ionicons name="locate" size={28} color={theme.primary} />
        </Pressable>
      </View>
      {messagePosition ? (
        <View pointerEvents="none" style={[styles.avisPosition, { bottom: HAUTEUR_BARRE * (coquille ? 1 : 0) + bottom + 86, backgroundColor: theme.onHeader }]}>
          <ThemedText type="small" accessibilityRole="alert">
            {messagePosition}
          </ThemedText>
        </View>
      ) : null}

      {feuille ? (
        <FeuilleProbleme
          categorie={choixProbleme}
          onChoisir={setChoixProbleme}
          onContinuer={continuerSignalement}
          onFermer={() => setFeuille(null)}
        />
      ) : null}

      <Modal visible={fiche !== null} transparent animationType="slide" onRequestClose={() => setFiche(null)}>
        <Pressable style={styles.voile} onPress={() => setFiche(null)} accessibilityRole="button" accessibilityLabel="Fermer la fiche" />
        <View style={[styles.feuille, { backgroundColor: theme.background, paddingBottom: bottom + 16 }]}>
          <ScrollView contentContainerStyle={styles.contenuFeuille}>
            <ThemedText type="subtitle" accessibilityRole="header" style={{ fontSize: 20, lineHeight: 28 }}>
              {fiche?.element.type}
            </ThemedText>
            <ThemedText>{fiche?.element.titre}</ThemedText>
            {fiche?.element.lignes.map((l) => (
              <View key={l.etiquette} accessible accessibilityLabel={`${l.etiquette} : ${l.valeur}`}>
                <ThemedText type="small" themeColor="textSecondary">
                  {l.etiquette}
                </ThemedText>
                <ThemedText type="smallBold">{l.valeur}</ThemedText>
              </View>
            ))}
            {fiche?.point ? (
              <Bouton
                titre="Signaler un problème ici"
                pleineLargeur
                onPress={() => {
                  const p = fiche.point;
                  setFiche(null);
                  if (p) signalerIci(p);
                }}
              />
            ) : null}
            <Bouton titre="Fermer" variante="discret" pleineLargeur onPress={() => setFiche(null)} />
          </ScrollView>
        </View>
      </Modal>

      {/* Options : style de la carte, liste équivalente des endroits, explications. */}
      <Modal visible={options} transparent animationType="slide" onRequestClose={() => setOptions(false)}>
        <Pressable style={styles.voile} onPress={() => setOptions(false)} accessibilityRole="button" accessibilityLabel="Fermer les options de la carte" />
        <View style={[styles.feuille, { backgroundColor: theme.background, paddingBottom: bottom + 16 }]}>
          <ScrollView contentContainerStyle={styles.contenuFeuille}>
            <ThemedText type="subtitle" accessibilityRole="header">
              Options de la carte
            </ThemedText>
            <BandeauSource etat={etat} />
            <ThemedText type="smallBold" accessibilityRole="header">
              Couches de la carte
            </ThemedText>
            {COUCHES_CARTE.map((c) => (
              <View key={c} style={styles.ligneCouche}>
                <ThemedText style={{ flex: 1 }}>{LIBELLES_COUCHE[c]}</ThemedText>
                <Switch
                  value={coucheVisible[c]}
                  onValueChange={() => setCoucheVisible((e) => basculerCouche(e, c))}
                  accessibilityLabel={`${LIBELLES_COUCHE[c]} : ${coucheVisible[c] ? 'affichée' : 'masquée'}`}
                  trackColor={{ true: theme.primary, false: '#C9CFBD' }}
                />
              </View>
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              Avis d&apos;ébullition : bleu pétrole. Coupures d&apos;eau : indigo, contour plus épais. Toucher un avis ouvre sa fiche.
            </ThemedText>
            {avis.length > 0 ? (
              <View>
                <ThemedText type="smallBold">Avis d&apos;eau en cours ({formaterNombre(avis.length, 'avis', 'avis')})</ThemedText>
                {avis.slice(0, 20).map((a) => (
                  <Pressable
                    key={a.properties.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${a.properties.type === 'ebullition' ? "Avis d'ébullition" : "Coupure d'eau"} : ${a.properties.titre}. Ouvrir la fiche.`}
                    onPress={() => {
                      setOptions(false);
                      setFiche({ element: ficheAvis(a), point: null });
                    }}
                    style={styles.ligneAvis}>
                    <ThemedText type="small" numberOfLines={2}>
                      {a.properties.titre}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <SelecteurCarte />
            <ListeEndroits endroits={visibles} onOuvrir={(e) => { setOptions(false); router.push({ pathname: '/suivi/[id]', params: { id: premierSignalement(e) } }); }} />
            <ThemedText type="small" themeColor="textSecondary">
              Les repères montrent les endroits signalés, avec leur gravité. Touchez un repère, puis sa bulle, pour suivre un signalement.
              Touchez la carte ou un regard gris pour signaler un problème à cet endroit. Les zones bleues claires sont des avis d&apos;eau officiels, les bandes bleues sur une rue de l&apos;eau accumulée signalée (
              {formaterNombre(avis.length, 'avis', 'avis')}).
            </ThemedText>
            {bandes.length > 0 ? (
              <View accessible accessibilityLabel={`Rues touchées par de l'eau accumulée : ${bandes.map(libelleBande).join(', ')}`}>
                <ThemedText type="smallBold">Eau accumulée (bande bleue sur la rue)</ThemedText>
                {bandes.map((b) => (
                  <ThemedText key={b.id} type="small">
                    {libelleBande(b)}
                  </ThemedText>
                ))}
              </View>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              Regards d&apos;égout : Données ouvertes de la Ville de Montréal, CC BY 4.0.
            </ThemedText>
            <Bouton titre="Fermer" variante="discret" pleineLargeur onPress={() => setOptions(false)} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  centre: { flex: 1, justifyContent: 'center' },
  carte: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 },
  entete: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 18, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, gap: 12 },
  ligneTitre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titre: { flex: 1, fontSize: 28, lineHeight: 36, fontWeight: '800' },
  compte: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  recherche: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 28, paddingHorizontal: 16, minHeight: 52 },
  champ: { flex: 1, fontSize: 15, minHeight: 48 },
  resultats: { position: 'absolute', left: 20, right: 20, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  ligneResultat: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center' },
  flottants: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rond: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  signaler: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 56, paddingHorizontal: 20, borderRadius: 28, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  verif: { position: 'absolute', left: 20, right: 20, borderRadius: 16, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
  lienVerif: { minHeight: 36, justifyContent: 'center' },
  avisPosition: { position: 'absolute', left: 16, right: 16, borderRadius: 16, padding: 10 },
  voile: { flex: 1 },
  ligneCouche: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  ligneAvis: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#E6E2D3' },
  feuille: { maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  contenuFeuille: { padding: 20, gap: 12 },
});
