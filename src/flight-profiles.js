import { readFileSync } from 'node:fs';
import { validFlightData } from '../public/map/flight-path.js';
const profiles=JSON.parse(readFileSync(new URL('../data/flight-profiles.json',import.meta.url),'utf8')).profiles;
export function attachFlightProfile(launch,entries=profiles){
 const flightProfile=entries.find(p=>p.launchId===launch.id&&p.net===launch.timing?.net);
 const enriched={...launch,flightProfile};
 return validFlightData(enriched)?enriched:launch;
}
