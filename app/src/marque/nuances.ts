import type { Graines } from './jetons';

/** Nuancier proposé à l'administrateur pour chaque couleur principale. */
export const NUANCES: Record<keyof Graines, string[]> = {
  primary: ["#1D3A1B", "#B5121B", "#0F4C81", "#5B2A86", "#2F3E4E", "#6B4E16", "#0B6E4F", "#8A1538"],
  action: ["#B84A0B", "#8F0E15", "#A8460A", "#9C3D00", "#B0390A", "#1F5E23", "#005F73", "#7A3E9D"],
  header: ["#1D3A1B", "#B5121B", "#0F4C81", "#5B2A86", "#2F3E4E", "#6B4E16", "#0B6E4F", "#111111"],
  background: ["#F5F3ED", "#FBF8F8", "#F3F7FB", "#F8F5FB", "#F4F6F8", "#FAF6EC", "#FFFFFF", "#F2F7F2"],
};
