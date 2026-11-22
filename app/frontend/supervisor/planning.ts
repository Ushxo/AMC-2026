import { SEWERS } from "../data/mockData";
import { AlertKind, CitizenAlert, Sewer } from "../types/models";

// Degré d'importance d'une intervention, du plus au moins prioritaire.
export type Importance = "Urgent" | "Élevée" | "Moyenne";
export const IMPORTANCE_ORDER: Importance[] = ["Urgent", "Élevée", "Moyenne"];

// Importance de base selon le type de problème (règle de démonstration).
const KIND_LEVEL: Record<AlertKind, number> = {
  Autre: 0, // Grille d'égout endommagée : danger pour les passants
  "Eau accumulée": 1,
  "Égout bouché": 2,
  Feuilles: 2, // Affaissement
};

export type Intervention = {
  sewer: Sewer;
  alerts: CitizenAlert[];
  kind: AlertKind; // problème le plus grave signalé sur cet égout
  importance: Importance;
  lastDate: string;
};

// Une intervention par égout ayant des signalements pas encore planifiés.
// Trois signalements ou plus sur le même égout font monter l'importance d'un niveau.
export function buildInterventions(alerts: CitizenAlert[]): Intervention[] {
  const open = alerts.filter((a) => a.status === "Envoyée" || a.status === "En évaluation");
  const list: Intervention[] = [];

  for (const sewer of SEWERS) {
    const own = open.filter((a) => a.sewerId === sewer.id);
    if (!own.length) continue;
    const kind = own.reduce((best, a) => (KIND_LEVEL[a.kind] < KIND_LEVEL[best] ? a.kind : best), own[0].kind);
    let level = KIND_LEVEL[kind];
    if (own.length >= 3) level = Math.max(0, level - 1);
    const lastDate = own.map((a) => a.date).sort().reverse()[0];
    list.push({ sewer, alerts: own, kind, importance: IMPORTANCE_ORDER[level], lastDate });
  }

  return list.sort(
    (a, b) =>
      IMPORTANCE_ORDER.indexOf(a.importance) - IMPORTANCE_ORDER.indexOf(b.importance) ||
      b.alerts.length - a.alerts.length ||
      b.lastDate.localeCompare(a.lastDate),
  );
}

// Ordre de visite : les plus importantes d'abord ; à importance égale,
// l'égout le plus proche de l'arrêt précédent (coordonnées de la maquette).
export function orderRoute(items: Intervention[]): Intervention[] {
  const left = [...items];
  const route: Intervention[] = [];
  let pos = { x: 0, y: 100 };
  while (left.length) {
    const top = Math.min(...left.map((i) => IMPORTANCE_ORDER.indexOf(i.importance)));
    const candidates = left.filter((i) => IMPORTANCE_ORDER.indexOf(i.importance) === top);
    candidates.sort(
      (a, b) => Math.hypot(a.sewer.x - pos.x, a.sewer.y - pos.y) - Math.hypot(b.sewer.x - pos.x, b.sewer.y - pos.y),
    );
    const next = candidates[0];
    route.push(next);
    left.splice(left.indexOf(next), 1);
    pos = next.sewer;
  }
  return route;
}

// Durée estimée (démo) : déplacement sur la grille de la maquette + 4 min par arrêt.
export function estimateMinutes(route: Intervention[]) {
  let pos = { x: 0, y: 100 };
  let distance = 0;
  for (const item of route) {
    distance += Math.hypot(item.sewer.x - pos.x, item.sewer.y - pos.y);
    pos = item.sewer;
  }
  return Math.max(5, Math.round(distance / 20 + route.length * 4));
}
