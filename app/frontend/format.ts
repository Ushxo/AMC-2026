import { AlertKind } from "./types/models";

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// "2026-11-18" → "18 nov. 2026" ; ajoute l'heure si la date en contient une.
export function formatDate(value: string) {
  const [day, time] = value.split("T");
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return value;
  let text = `${d} ${MONTHS[m - 1]} ${y}`;
  if (time) {
    const [h, min] = time.split(":");
    text += ` à ${Number(h)} h ${min}`;
  }
  return text;
}

// Libellés complets des catégories (mêmes que l'écran de signalement).
export const KIND_TITLES: Record<AlertKind, string> = {
  "Égout bouché": "Égout bouché",
  "Eau accumulée": "Accumulation d’eau",
  Feuilles: "Affaissement autour d’un égout",
  Autre: "Grille d’égout endommagée",
};
