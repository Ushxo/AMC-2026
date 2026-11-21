import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
export const C={bg:'#F5F8FC',white:'#FFFFFF',ink:'#15243A',muted:'#607286',blue:'#1764D6',green:'#138B56',red:'#CC384B',border:'#DCE5EF'};
export function Page({children}:{children:React.ReactNode}){return <ScrollView contentContainerStyle={s.page}>{children}</ScrollView>}
export function Heading({children}:{children:React.ReactNode}){return <Text style={s.heading}>{children}</Text>}
export function Sub({children}:{children:React.ReactNode}){return <Text style={s.sub}>{children}</Text>}
export function Card({children}:{children:React.ReactNode}){return <View style={s.card}>{children}</View>}
export function Btn({label,onPress,outline=false,disabled=false}:{label:string,onPress:()=>void,outline?:boolean,disabled?:boolean}){return <Pressable onPress={onPress} disabled={disabled} style={[s.btn,outline&&s.btnOutline,disabled&&{opacity:.4}]}><Text style={[s.btnText,outline&&{color:C.blue}]}>{label}</Text></Pressable>}
export function Status({label}:{label:string}){return <View style={s.status}><Text style={{color:C.blue,fontSize:12,fontWeight:'700'}}>{label}</Text></View>}
export const styles=s;
const s=StyleSheet.create({page:{padding:16,paddingBottom:50,gap:12,backgroundColor:C.bg,flexGrow:1},heading:{fontSize:23,fontWeight:'800',color:C.ink},sub:{color:C.muted,fontSize:14,lineHeight:21},card:{backgroundColor:C.white,borderWidth:1,borderColor:C.border,borderRadius:14,padding:15,gap:10},btn:{backgroundColor:C.blue,paddingVertical:12,paddingHorizontal:15,borderRadius:10,alignItems:'center',justifyContent:'center'},btnOutline:{backgroundColor:C.white,borderWidth:1,borderColor:C.blue},btnText:{color:'white',fontWeight:'700'},status:{alignSelf:'flex-start',paddingVertical:5,paddingHorizontal:9,borderRadius:12,backgroundColor:'#EAF1FF'}});
