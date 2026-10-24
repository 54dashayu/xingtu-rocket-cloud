import { readFileSync } from 'node:fs';
const records=JSON.parse(readFileSync(new URL('../data/rocket-cloud-evidence.json',import.meta.url),'utf8')).records;
export function attachCloudEvidence(launch,entries=records,now=Date.now()){
 const completed=['success','failure','partial'].includes(launch.result?.code)&&Date.parse(launch.timing?.net)<=now;
 if(!completed)return launch;
 const evidence=entries.find(e=>e.launchId===launch.id&&Date.parse(e.net)===Date.parse(launch.timing?.net));
 if(!evidence)return launch;
 return {...launch,cloudEvidence:evidence};
}
