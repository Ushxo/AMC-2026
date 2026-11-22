import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BandeauSource } from '@/components/ville/bandeau-source';
import { Bouton } from '@/components/ville/bouton';
import { Lien } from '@/components/ville/lien';
import { ListeAlertes } from '@/components/ville/liste-alertes';
import { useMonEquipe } from '@/hooks/use-mon-equipe';
import { useSessionEmploye } from '@/hooks/use-session-employe';
import { useSource } from '@/hooks/use-source';

/** Accueil classique du mode Ville (repli de la coquille de l'app) : actions rapides et liste des endroits signalés. */
export default function AccueilVille() {
  const router = useRouter();
  const { etat } = useSource();
  const { employe, deconnecter, demoHorsLigne: simule } = useSessionEmploye();
  const { equipeId: monEquipe } = useMonEquipe();

  return (
    <ThemedView style={styles.fond}>
      <SafeAreaView style={styles.fond} edges={['top']}>
        <ListeAlertes
          entete={
            <View style={styles.entete}>
              <ThemedText type="subtitle" accessibilityRole="header">
                Mode Ville
              </ThemedText>
              <ThemedText themeColor="textSecondary">Connecté : {employe?.nom}</ThemedText>
              <BandeauSource etat={etat} simule={simule} />
              <View style={styles.actions}>
                {monEquipe ? (
                  <Bouton
                    titre="Ma tournée"
                    pleineLargeur
                    onPress={() => router.push({ pathname: '/ville/trajet/[equipe]', params: { equipe: monEquipe } })}
                  />
                ) : null}
                <Bouton titre="Tournées des équipes" pleineLargeur onPress={() => router.push('/ville/tournees')} />
                <Bouton titre="Équipes" variante="discret" onPress={() => router.push('/ville/equipes')} />
                <Bouton titre="Voir la carte" variante="discret" onPress={() => router.push('/ville/carte')} />
                <Bouton titre="Se déconnecter" variante="discret" onPress={() => void deconnecter()} />
              </View>
            </View>
          }
          pied={<Lien href="/" titre="Retour au mode citoyen" />}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1 },
  entete: { gap: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
