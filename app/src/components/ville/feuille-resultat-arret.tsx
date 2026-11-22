import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModaleAnimee } from '@/components/mouvement/modale-animee';
import { BoutonAction } from '@/components/bouton-action';
import { ChampTexte as TextInput, Texte as Text } from '@/components/texte';
import { useStyles } from '@/marque/utiliser';
import type { Jetons } from '@/marque/jetons';
import { sansBruit, tracer } from '@/lib/trace';
import { erreurCommentaire, LIMITE_COMMENTAIRE, QUESTION_ARRET_FAIT, RAISONS_NON_FAIT } from '@/lib/messages-resultat';

import { Bouton } from './bouton';
import { ChoixResultatArret, type ChoixResultat } from './choix-resultat-arret';
import { FEUILLE_BASE } from './style';

type Props = {
  visible: boolean;
  rang: number;
  /** Choix déjà fait (correction) ou touché sur la carte ; null : la personne choisit ici. */
  choixInitial: ChoixResultat | null;
  commentaireInitial?: string;
  /** Écrit le résultat. Rend un message d'erreur (la saisie reste), ou null. */
  onEnregistrer: (p: { fait: boolean; commentaire: string }) => Promise<string | null>;
  onFermer: () => void;
};

/** Petite feuille de confirmation d'un arrêt : Oui (commentaire facultatif) ou Non (commentaire obligatoire, avec des raisons en un toucher). */
export function FeuilleResultatArret(props: Props) {
  const styles = useStyles(creerStyles);
  // Chaque ouverture repart d'un contenu neuf (choix, texte, erreur), même si la fenêtre reste montée le temps de sa sortie.
  const [ouverture, setOuverture] = useState(props.visible ? 1 : 0);
  const [etaitVisible, setEtaitVisible] = useState(props.visible);
  if (props.visible !== etaitVisible) {
    setEtaitVisible(props.visible);
    if (props.visible) setOuverture((n) => n + 1);
  }
  return (
    <ModaleAnimee visible={props.visible} onFermer={props.onFermer} libelleFermer="Fermer sans enregistrer">
      <View style={styles.feuille}>
        <Contenu key={ouverture} {...props} />
      </View>
    </ModaleAnimee>
  );
}

function Contenu({ rang, choixInitial, commentaireInitial = '', onEnregistrer, onFermer }: Props) {
  const styles = useStyles(creerStyles);
  const { bottom } = useSafeAreaInsets();
  const [choix, setChoix] = useState<ChoixResultat | null>(choixInitial);
  const [texte, setTexte] = useState(commentaireInitial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function enregistrer() {
    if (!choix) return;
    const invalide = erreurCommentaire(choix === 'oui', texte);
    if (invalide) {
      setErreur(invalide);
      return;
    }
    setOccupe(true);
    let refus: string | null;
    try {
      refus = await onEnregistrer({ fait: choix === 'oui', commentaire: texte });
    } catch (e) {
      tracer('résultat de l’arrêt', e);
      refus = "L'enregistrement n'a pas pu se faire. Réessayez.";
    }
    setOccupe(false);
    if (refus) setErreur(refus);
    else onFermer();
  }

  const libelle = choix === 'non' ? "Pourquoi l'arrêt n'est-il pas fait ? (obligatoire)" : 'Quelque chose à signaler ? (facultatif)';
  return (
    <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bottom + 20 }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.titre} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            Arrêt {rang}
          </Text>
          <Text style={styles.question}>{QUESTION_ARRET_FAIT}</Text>
          <ChoixResultatArret
            choix={choix}
            onChoisir={(c) => {
              setChoix(c);
              setErreur(null);
            }}
            actif={!occupe}
          />
          {choix ? (
            <View style={styles.groupe}>
              <Text style={styles.etiquette}>{libelle}</Text>
              {choix === 'non' ? (
                <View style={styles.raisons}>
                  {RAISONS_NON_FAIT.map((r) => (
                    <Bouton
                      key={r}
                      titre={r}
                      variante="discret"
                      selectionne={texte === r}
                      onPress={() => {
                        setTexte(r);
                        setErreur(null);
                      }}
                    />
                  ))}
                </View>
              ) : null}
              <TextInput
                style={[styles.champ, !!erreur && styles.champErreur]}
                value={texte}
                onChangeText={(v) => {
                  setTexte(v);
                  setErreur(null);
                }}
                multiline
                maxLength={LIMITE_COMMENTAIRE}
                accessibilityLabel={libelle}
                accessibilityHint={erreur ?? undefined}
                placeholder={choix === 'non' ? 'Ce qui a empêché de faire l’arrêt' : 'Ce que vous avez vu'}
              />
              <Text style={styles.compteur} accessibilityLabel={`${texte.length} caractères sur ${LIMITE_COMMENTAIRE}`}>
                {`${texte.length} / ${LIMITE_COMMENTAIRE}`}
              </Text>
              {erreur ? (
                <Text style={styles.erreur} accessibilityRole="alert">
                  {erreur}
                </Text>
              ) : null}
            </View>
          ) : null}
          <BoutonAction titre={occupe ? 'Enregistrement…' : 'Enregistrer'} actif={!!choix} occupe={occupe} onPress={() => sansBruit(enregistrer, 'résultat de l’arrêt')} />
          <Bouton titre="Annuler" variante="discret" pleineLargeur onPress={onFermer} actif={!occupe} />
    </ScrollView>
  );
}

const creerStyles = (P: Jetons) =>
  StyleSheet.create({
    feuille: { backgroundColor: P.background, ...FEUILLE_BASE },
    contenu: { padding: 20, gap: 12 },
    titre: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: P.text },
    question: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: P.text },
    groupe: { gap: 8 },
    etiquette: { fontSize: 14, fontWeight: '700', color: P.text },
    raisons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    champ: { minHeight: 96, borderRadius: 16, borderWidth: 2, borderColor: P.borderForte, backgroundColor: P.surface, color: P.text, padding: 12, fontSize: 16, textAlignVertical: 'top' },
    champErreur: { borderColor: P.danger },
    compteur: { fontSize: 13, color: P.textSecondary, textAlign: 'right' },
    erreur: { fontSize: 14, fontWeight: '600', color: P.danger },
  });
