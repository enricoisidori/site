import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const text=await readFile(new URL('../blue-flow.js',import.meta.url),'utf8');
const code=text.slice(text.indexOf('function colorTest(){'),text.indexOf('// Hysteresis in space'));
function detector(){
 let pixels;
 const sandbox={settings:{size:50,redMax:40,greenMax:65,saturation:55,brightness:45,hue:25,rgbDistance:210,disturbance:20,minZoom:.5,maxZoom:8,quality:160,motionStep:18},stills:true,analysis:{width:0,height:0},analysisStats:{full:0,roi:0},integralSums:new Uint32Array(641*641),ac:{clearRect(){},drawImage(media){pixels=media.data;},getImageData(){return {data:pixels};}}};
 vm.createContext(sandbox);vm.runInContext(code+';this.run=detect;',sandbox);return sandbox.run;
}
test('fast still detector keeps the blue threshold and rejects red, grey and purple',()=>{
 const detect=detector();
 for(const color of [[255,0,0],[120,120,120],[120,20,180],[0,0,255]]){
  const w=160,h=100,data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4)data.set([...color,255],i);
  assert.equal(Boolean(detect({naturalWidth:w,naturalHeight:h,data})),color[2]===255);
 }
});
test('every accepted square has at least the configured blue coverage at multiple patch sizes',()=>{
 const detect=detector();
 for(const side of [6,7,8,13,25,50,80])for(const x of [0,37,71]){
  const w=160,h=100,data=new Uint8ClampedArray(w*h*4);
  for(let i=0;i<data.length;i+=4)data.set([255,0,0,255],i);
  for(let y=12;y<12+side&&y<h;y++)for(let px=x;px<x+side&&px<w;px++)data.set([0,0,255,255],(y*w+px)*4);
  const found=detect({naturalWidth:w,naturalHeight:h,data});if(!found){assert.ok(side<7);continue;}
  let blue=0;for(let y=found.y-found.side/2;y<found.y+found.side/2;y++)for(let px=found.x-found.side/2;px<found.x+found.side/2;px++)if(data[(y*w+px)*4+2]===255)blue++;
  assert.ok(blue/(found.side*found.side)>=.8);
 }
});
