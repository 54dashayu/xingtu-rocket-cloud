// Private geometry fixture; never served by the public app or called real telemetry.
import { destination } from '../../public/map/model.js';
export function testProfile(launch){
 return {launchId:launch.id,net:launch.timing.net,kind:'planned',frame:'WGS84-geodetic',publishedAt:'2026-10-01T00:00:00Z',sourceName:'test fixture',sourceUrl:'https://example.test/fixture',points:[0,50,100,150,200].map((height,i)=>({...destination(launch.coordinates,90,i*100),height,seconds:i*90,downrange:i*100}))};
}
