export type AlertKind = 'Feuilles' | 'Eau accumulée' | 'Égout bouché' | 'Autre';
export type AlertStatus = 'Envoyée' | 'En évaluation' | 'Intervention planifiée' | 'En cours' | 'Résolue';
export type WorkStatus = 'À faire' | 'Fait' | 'À suivre';
export type Sewer = { id: string; label: string; x: number; y: number; territory: string };
export type CitizenAlert = { id: string; sewerId: string; kind: AlertKind; citizenId: string; date: string; status: AlertStatus; photoUri?: string };
export type WorkItem = { sewerId: string; status: WorkStatus; reason?: string };
export type Tour = { id: string; teamId: string; sewerIds: string[]; items: WorkItem[]; state: 'Assignée' | 'En cours' | 'À valider' | 'Validée'; createdAt: string };
