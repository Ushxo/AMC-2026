import React, {createContext, useContext, useMemo, useState} from 'react';
import {INITIAL_ALERTS, SEWERS} from '../data/mockData';
import {AlertKind, CitizenAlert, Tour, WorkStatus} from '../types/models';

type DemoStore = {
  alerts: CitizenAlert[]; tours: Tour[];
  report: (sewerId:string, kind: AlertKind, photoUri?: string) => void;
  createTour: (sewerIds:string[], teamId:string) => void;
  mark: (tourId:string, sewerId:string, status:WorkStatus, reason?:string) => void;
  submitTour: (tourId:string) => void;
  approveTour: (tourId:string) => void;
  rank: (sewerId:string) => number;
};
const Context=createContext<DemoStore | null>(null);
export function DemoProvider({children}:{children:React.ReactNode}) {
 const [alerts,setAlerts]=useState<CitizenAlert[]>(INITIAL_ALERTS);
 const [tours,setTours]=useState<Tour[]>([]);
 const rank=(id:string)=>alerts.filter(a=>a.sewerId===id && a.status!=='Résolue').length;
 const report=(sewerId:string,kind:AlertKind,photoUri?:string)=>setAlerts(prev=>[...prev, {id:`AL-${Date.now()}`,sewerId,kind,citizenId:'citoyen-demo',date:new Date().toISOString().slice(0,10),status:'Envoyée',photoUri}]);
 const createTour=(ids:string[],teamId:string)=>{
   if(!ids.length)return;
   // Heuristique de démonstration : favoriser le nombre d'alertes puis la proximité.
   let left=[...ids];let px=0,py=0;const ordered:string[]=[];
   while(left.length){left.sort((a,b)=>{
     const A=SEWERS.find(s=>s.id===a)!,B=SEWERS.find(s=>s.id===b)!;
     const score=(s:typeof A)=>Math.hypot(px-s.x,py-s.y)-rank(s.id)*25;
     return score(A)-score(B);
   });const next=left.shift()!;ordered.push(next);const sewer=SEWERS.find(s=>s.id===next)!;px=sewer.x;py=sewer.y;}
   const id=`TOUR-${Date.now()}`;
   setTours(prev=>[...prev,{id,teamId,sewerIds:ordered,items:ordered.map(sewerId=>({sewerId,status:'À faire'})),state:'Assignée',createdAt:new Date().toISOString()}]);
   setAlerts(prev=>prev.map(a=>ordered.includes(a.sewerId)&&a.status!=='Résolue'?{...a,status:'Intervention planifiée'}:a));
 };
 const mark=(tourId:string,sewerId:string,status:WorkStatus,reason='')=>setTours(prev=>prev.map(t=>t.id!==tourId?t:{...t,state:'En cours',items:t.items.map(i=>i.sewerId===sewerId?{...i,status,reason}:i)}));
 const submitTour=(tourId:string)=>setTours(prev=>prev.map(t=>t.id===tourId?{...t,state:'À valider'}:t));
 const approveTour=(tourId:string)=>{
   const tour=tours.find(t=>t.id===tourId);if(!tour)return;
   const done=new Set(tour.items.filter(i=>i.status==='Fait').map(i=>i.sewerId));
   setAlerts(prev=>prev.map(a=>done.has(a.sewerId)?{...a,status:'Résolue'}:a));
   setTours(prev=>prev.map(t=>t.id===tourId?{...t,state:'Validée'}:t));
 };
 const value=useMemo(()=>({alerts,tours,report,createTour,mark,submitTour,approveTour,rank}),[alerts,tours]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDemo(){const v=useContext(Context);if(!v)throw new Error('Envelopper les écrans avec DemoProvider');return v;}
