import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
const source=new URL('../prototypes/rocket-cloud-3d/',import.meta.url);
const output=new URL('../public/3d/',import.meta.url);
await mkdir(output,{recursive:true});
for(const name of ['index.html','style.css','app.js','scene.js','geometry.js','events.js','missions.js','observers.js','observer-weather.js']){
 let text=await readFile(new URL(name,source),'utf8');
 if(name==='index.html'){const calendar=await readFile(new URL('../public/map.html',import.meta.url),'utf8');text=text.replace(/<footer class="safety release-footer">[\s\S]*?<\/footer>/,calendar.match(/<footer class="safety release-footer">[\s\S]*?<\/footer>/)[0]);}
 text=text.replaceAll('../../public/','../').replaceAll('/public/map/','../map/').replaceAll('/vendor/','./vendor/').replaceAll('http://127.0.0.1:4186/map.html','../map.html');
 text=text.replaceAll("'/api/observer-weather'", "'../api/observer-weather'");
 text=text.replace("'/api/missions?range='+range","(range==='history'?'../api/launches/previous?days=365':'../api/launches?days=30')");
 await writeFile(new URL(name,output),text);
}
for(const name of ['build/three.module.js','examples/jsm/controls/OrbitControls.js','LICENSE']){
 const dest=new URL('vendor/'+name,output);await mkdir(new URL('./',dest),{recursive:true});await copyFile(new URL('node_modules/three/'+name,source),dest);
}
console.log('Built public/3d/index.html with local Three.js and relative shared/API paths.');
