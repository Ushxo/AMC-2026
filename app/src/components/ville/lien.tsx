import { Link, type Href } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Appuyable as Pressable } from '@/components/appuyable';

import { ThemedText } from '@/components/themed-text';

import { useCouleursTexte } from './couleurs';
import { CIBLE_MIN } from './style';

export function Lien({ href, titre }: { href: Href; titre: string }) {
  const c = useCouleursTexte();
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={titre} style={styles.lien}>
        <ThemedText type="default" style={{ color: c.lien, textDecorationLine: 'underline' }}>
          {titre}
        </ThemedText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  lien: { minHeight: CIBLE_MIN, justifyContent: 'center', alignSelf: 'flex-start' },
});
