export const HISTORY_RANGES=[{days:30,label:'30天'},{days:90,label:'3个月'},{days:180,label:'半年'},{days:365,label:'1年'}];
export function observationMatches({possible=false,reported=false,media=false},filters={}){
 const active=['possible','reported','media'].filter(key=>filters[key]);
 return !active.length||active.some(key=>({possible,reported,media})[key]);
}
export function archiveMatches(launch,{country='',crewed='',ownership=''}={}){
 return (!country||(launch.country?.code||'unknown')===country)&&(!crewed||(crewed==='unknown'?typeof launch.crewed!=='boolean':launch.crewed===(crewed==='true')))&&(!ownership||(launch.agency?.ownership||'unknown')===ownership);
}
