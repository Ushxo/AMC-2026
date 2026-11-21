import React from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {SEWERS} from '../data/mockData';
import {useDemo} from '../context/DemoContext';
import {C} from './UI';
// Carte de MAQUETTE : coordonnées fictives. Remplacer par un fournisseur cartographique compatible Expo.
export function SewerMap({selected,onSelect,route=[]}:{selected?:string,onSelect?:(id:string)=>void,route?:string[]}){
 const {rank}=useDemo();
 return <View style={s.map}>
 {Array.from({length:6},(_,i)=><View key={`v${i}`} style={[s.vertical,{left:`${i*20}%` as any}]}/>)}
 {Array.from({length:5},(_,i)=><View key={`h${i}`} style={[s.horizontal,{top:`${i*25}%` as any}]}/>)}
 <Text style={s.watermark}>MONTRÉAL · CARTE DÉMO</Text>
 {SEWERS.map(sewer=><Pressable accessibilityLabel={sewer.label} key={sewer.id} onPress={()=>onSelect?.(sewer.id)} style={[s.marker,{left:`${sewer.x}%` as any,top:`${sewer.y}%` as any,backgroundColor:selected===sewer.id?'#F59E0B':rank(sewer.id)?C.red:C.blue}]}><Text style={s.markerText}>{route.includes(sewer.id)?String(route.indexOf(sewer.id)+1):'●'}</Text></Pressable>)}
 </View>
}
const s=StyleSheet.create({map:{height:265,backgroundColor:'#E8EDF0',borderRadius:12,overflow:'hidden',position:'relative'},vertical:{position:'absolute',top:0,bottom:0,width:9,backgroundColor:'white'},horizontal:{position:'absolute',left:0,right:0,height:9,backgroundColor:'white'},watermark:{position:'absolute',bottom:10,left:12,color:'#5F7080',fontSize:10,fontWeight:'700'},marker:{position:'absolute',width:31,height:31,borderRadius:17,borderWidth:2,borderColor:'white',alignItems:'center',justifyContent:'center',marginLeft:-15,marginTop:-15},markerText:{color:'white',fontWeight:'800',fontSize:12}});
