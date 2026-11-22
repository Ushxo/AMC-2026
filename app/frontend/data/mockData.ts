import { Sewer, CitizenAlert } from '../types/models';
// Coordonnées RELATIVES pour la maquette; ne représentent pas de vrais puisards de Montréal.
export const SEWERS: Sewer[] = [
  {id:'EG-101',label:'Égout 101',x:15,y:24,territory:'Centre'},
  {id:'EG-102',label:'Égout 102',x:38,y:18,territory:'Centre'},
  {id:'EG-103',label:'Égout 103',x:69,y:33,territory:'Est'},
  {id:'EG-104',label:'Égout 104',x:26,y:67,territory:'Ouest'},
  {id:'EG-105',label:'Égout 105',x:57,y:73,territory:'Est'},
  {id:'EG-106',label:'Égout 106',x:83,y:70,territory:'Est'},
];
export const INITIAL_ALERTS: CitizenAlert[] = [
  {id:'AL-001',sewerId:'EG-102',kind:'Feuilles',citizenId:'citoyen-demo',date:'2026-11-20',status:'Envoyée'},
  {id:'AL-002',sewerId:'EG-103',kind:'Eau accumulée',citizenId:'autre',date:'2026-11-19',status:'Envoyée'},
  {id:'AL-003',sewerId:'EG-103',kind:'Égout bouché',citizenId:'autre2',date:'2026-11-20',status:'Envoyée'},
  {id:'AL-004',sewerId:'EG-105',kind:'Égout bouché',citizenId:'citoyen-demo',date:'2026-11-18',status:'Envoyée'},
  {id:'AL-005',sewerId:'EG-101',kind:'Autre',citizenId:'autre3',date:'2026-11-21',status:'Envoyée'},
  {id:'AL-006',sewerId:'EG-104',kind:'Eau accumulée',citizenId:'autre4',date:'2026-11-19',status:'Envoyée'},
  {id:'AL-007',sewerId:'EG-106',kind:'Feuilles',citizenId:'autre5',date:'2026-11-18',status:'Envoyée'},
];
export const TEAM_IDS = ['Équipe A', 'Équipe B', 'Équipe C'];
