// Offline asset build: one small JPEG sheet, with the same detector as playback.
import {readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const catalog=JSON.parse(await readFile(new URL('./catalogs/blueness-images.json',import.meta.url),'utf8'));
const images=await Promise.all(catalog.map(async item=>({...item,data:'data:image/jpeg;base64,'+(await readFile(new URL('../blueness/preload/'+encodeURIComponent(item.id)+'.jpg',import.meta.url))).toString('base64')})));
const source=await readFile(new URL('./blue-flow.js',import.meta.url),'utf8');
const detector=source.slice(source.indexOf('function colorTest(){'),source.indexOf('// Hysteresis in space'));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 const result=await page.evaluate(async({images,detector})=>{
  const size=96,columns=10,sheet=document.createElement('canvas');sheet.width=columns*size;sheet.height=Math.ceil(images.length/columns)*size;
  const ctx=sheet.getContext('2d');ctx.fillStyle='black';ctx.fillRect(0,0,sheet.width,sheet.height);
  const load=async src=>{const image=new Image();image.src=src;await image.decode();return image;};
  for(let i=0;i<images.length;i++){const image=await load(images[i].data),scale=Math.min(size/image.width,size/image.height);images[i].imageBox={x:(size-image.width*scale)/2,y:(size-image.height*scale)/2,width:image.width*scale,height:image.height*scale};ctx.drawImage(image,i%columns*size+(size-image.width*scale)/2,Math.floor(i/columns)*size+(size-image.height*scale)/2,image.width*scale,image.height*scale);}
  const jpeg=sheet.toDataURL('image/jpeg',.55),atlas=await load(jpeg);
  const analysis=document.createElement('canvas'),ac=analysis.getContext('2d',{willReadFrequently:true});
  const settings={size:50,redMax:40,greenMax:65,saturation:55,brightness:45,hue:25,rgbDistance:210,disturbance:20,minZoom:.5,maxZoom:8,quality:160,motionStep:18};
  const detect=Function('settings','stills','analysis','ac','analysisStats','integralSums',detector+';return detect;')(settings,true,analysis,ac,{full:0,roi:0},new Uint32Array(641*641));
  const tile=document.createElement('canvas');tile.width=tile.height=size;const tc=tile.getContext('2d'),frames=[];
  // Verify after JPEG compression, so the saved coordinates match the actual asset.
  for(let i=0;i<images.length;i++){
   const x=i%columns*size,y=Math.floor(i/columns)*size;tc.drawImage(atlas,x,y,size,size,0,0,size,size);
   const image=await load(tile.toDataURL()),match=detect(image);if(!match)continue;
   frames.push({imageBox:images[i].imageBox,source:images[i].source,fingerprint:images[i].fingerprint,tile:{x,y,size},match:{x:match.x,y:match.y,side:match.side}});
  }
  return {jpeg:jpeg.split(',')[1],frames};
 },{images,detector});
 await writeFile(new URL('../blueness/startup.jpg',import.meta.url),Buffer.from(result.jpeg,'base64'));
 await writeFile(new URL('../blueness/startup.json',import.meta.url),JSON.stringify(result.frames)+'\n');
 console.log(JSON.stringify({frames:result.frames.length,jpegBytes:Buffer.from(result.jpeg,'base64').length}));
}finally{await browser.close();}
