import React,{useState} from 'react';
import {Alert,Text,View} from 'react-native';
import {Card,Heading,Page,Sub,Btn,C} from '../components/UI';
import {SewerMap} from '../components/SewerMap';
import {SEWERS} from '../data/mockData';
import {useDemo} from '../context/DemoContext';
import {AlertKind} from '../types/models';
const kinds:AlertKind[]=['Feuilles','Eau accumulée','Égout bouché','Autre'];
export default function CitizenMap(){
 const [id,setId]=useState<string>(); const [kind,setKind]=useState<AlertKind>('Feuilles');const {report}=useDemo();
 return <Page><Heading>Carte des égouts</Heading><Sub>Appuie sur un égout pour signaler un problème. Positions fictives dans cette démo.</Sub><SewerMap selected={id} onSelect={setId}/>
 {id&&<Card><Text style={{fontWeight:'800',color:C.ink}}>Signaler : {SEWERS.find(s=>s.id===id)?.label}</Text><Sub>Choisis le type de problème :</Sub>
 <View style={{gap:7}}>{kinds.map(k=><Btn key={k} outline={kind!==k} label={`${kind===k?'✓  ':''}${k}`} onPress={()=>setKind(k)}/>)}</View>
 <Btn label="Envoyer l'alerte" onPress={()=>{report(id,kind);Alert.alert('Alerte envoyée','Retrouve son suivi dans Mes alertes.');setId(undefined)}}/>
 <Sub>Photo facultative : à connecter plus tard à la caméra et au stockage.</Sub></Card>}
 </Page>;
}
