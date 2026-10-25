// Offline only: save blue coordinates against the complete, downloaded thumbnails.
import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const {createCanvas,loadImage}=await import(process.env.CANVAS_MODULE||'@napi-rs/canvas');
const destination=new URL('./catalogs/blueness-images.json',import.meta.url);
const catalog=JSON.parse(await readFile(destination,'utf8'));
const source=await readFile(new URL('./blue-flow.js',import.meta.url),'utf8');
const settings={size:50,redMax:40,greenMax:65,saturation:55,brightness:45,hue:25,rgbDistance:210,disturbance:20,minZoom:.5,maxZoom:8,quality:160};
const analysis=createCanvas(1,1),context=vm.createContext({settings,stills:true,analysis,ac:analysis.getContext('2d'),analysisStats:{full:0,roi:0},integralSums:new Uint32Array(641*641)});
vm.runInContext(source.slice(source.indexOf('function colorTest(){'),source.indexOf('// Hysteresis in space'))+';this.run=detect;',context);
let saved=0;
for(const item of catalog){
 const image=await loadImage(await readFile(new URL('../blueness/preload/'+encodeURIComponent(item.id)+'.jpg',import.meta.url)));
 const match=context.run(image);
 if(match){item.match={...match};saved++;}
}
await writeFile(destination,JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({candidates:catalog.length,savedMatches:saved}));
