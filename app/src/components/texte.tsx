import { StyleSheet, Text, TextInput, type TextInputProps, type TextProps, type TextStyle } from 'react-native';

import { famillePolice } from '@/constants/theme';

let policesChargees = false;

/** La racine dit si les polices de l'interface sont chargées ; sinon tout reste en police du système. */
export function definirPolicesChargees(ok: boolean) {
  policesChargees = ok;
}

/** Remplace la graisse du style par la famille de police qui lui correspond (une famille par graisse). */
export function avecPolice<T>(style: T): T | TextStyle {
  if (!policesChargees) return style;
  const plat = (StyleSheet.flatten(style as never) ?? {}) as TextStyle;
  if (plat.fontFamily) return plat;
  const { fontWeight, ...reste } = plat;
  return { ...reste, fontFamily: famillePolice(fontWeight) };
}

/** Texte de l'app : même rendu que Text, dans la police de l'interface. */
export function Texte({ style, ...rest }: TextProps) {
  return <Text style={avecPolice(style)} {...rest} />;
}

/** Champ de saisie dans la police de l'interface. */
export function ChampTexte({ style, ...rest }: TextInputProps) {
  return <TextInput style={avecPolice(style)} {...rest} />;
}
