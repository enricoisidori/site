import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const transport=readFileSync(new URL('../afterimage/archive-transport.js',import.meta.url),'utf8').replace(/^export /gm,'');
mkdirSync(new URL('../bluenessmovements/',import.meta.url),{recursive:true});
mkdirSync(new URL('../blueness-image/',import.meta.url),{recursive:true});
mkdirSync(new URL('../blueness/',import.meta.url),{recursive:true});
const pdf=readFileSync(new URL('./blueness-pdf.js',import.meta.url),'utf8');
const renderer=readFileSync(new URL('../assets/shared/recording/render.js',import.meta.url),'utf8').replace(/^export /gm,'');
const recorder=renderer+'\n'+readFileSync(new URL('../assets/shared/recording/mp4-muxer.js',import.meta.url),'utf8').replace(/^export /gm,'')+'\n'+readFileSync(new URL('../assets/shared/recording/recorder.js',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
const bootstrap='const BLUENESS_CATALOG='+JSON.stringify(JSON.parse(readFileSync(new URL('./catalogs/blueness.json',import.meta.url),'utf8')))+';\n';
const code=bootstrap+transport+'\n'+pdf+'\n'+recorder+'\n'+readFileSync(new URL('./blueness-ios-video.js',import.meta.url),'utf8')+'\n'+readFileSync(new URL('./blue-flow.js',import.meta.url),'utf8');new vm.Script(code);
if(process.argv[2]&&!['base','movements','stills','projects'].includes(process.argv[2]))throw Error('build sconosciuto: '+process.argv[2]);
for(const [name,mode,sources] of [['blue','image','both'],['blue-video','video','both'],['blue-mixed','mixed','both'],['blue-archive','archive','archive'],['blue-commons','image','commons'],['blue-video-archive','video','archive'],['blue-video-commons','video','commons'],['blueness-stills','image','archive'],['blueness-wiki','image','commons']]){
const wiki=name==='blueness-wiki',stills=name==='blueness-stills'||wiki;if(process.argv[2]==='base'&&name!=='blueness-stills')continue;if(process.argv[2]==='movements'&&name!=='blue-video')continue;if(process.argv[2]==='stills'&&!stills)continue;if(process.argv[2]==='projects'&&!stills&&name!=='blue-video')continue;
const introFile=new URL('../blueness/intro.svg',import.meta.url),videosIntroFile=new URL('../blueness/intro-videos.svg',import.meta.url);
const hasIntro=stills&&!wiki||name==='blue-video';
const intro=hasIntro&&existsSync(videosIntroFile)?readFileSync(videosIntroFile,'utf8'):'';
const startup=hasIntro?{image:'data:image/jpeg;base64,'+readFileSync(new URL('../blueness/startup.jpg',import.meta.url)).toString('base64'),frames:JSON.parse(readFileSync(new URL('../blueness/startup.json',import.meta.url),'utf8'))}:null;
const startupCatalog=[];
const introPrelude='const BLUENESS_STARTUP='+JSON.stringify(startup)+';\n// Variante IMAGES conservata e disattivata:\n// const BLUENESS_INTRO_SVG='+JSON.stringify(hasIntro?readFileSync(introFile,'utf8'):'')+';\nconst BLUENESS_INTRO_SVG='+JSON.stringify(intro)+';\n'+readFileSync(new URL('./blueness-intro-layout.js',import.meta.url),'utf8')+'\n';
const pageCode=stills?'const BLUENESS_CATALOG='+JSON.stringify(startupCatalog)+';\n'+introPrelude+readFileSync(new URL('./blueness-intro-export.js',import.meta.url),'utf8')+'\n'+renderer+'\n'+readFileSync(new URL('./blueness-highres.js',import.meta.url),'utf8')+'\n'+readFileSync(new URL('./blueness-stills-export.js',import.meta.url),'utf8')+'\n'+transport+'\nconst createSelectiveRecorder=()=>({controlsHTML:()=>"",sample(){},releaseMedia(){},syncAudioMonitor(){},status:{phase:"disabled"}});\n'+readFileSync(new URL('./blue-flow.js',import.meta.url),'utf8'):(name==='blue-video'?introPrelude+readFileSync(new URL('./blueness-intro-export.js',import.meta.url),'utf8')+'\n'+code:code);new vm.Script(pageCode);
const page=`<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${stills?(wiki?'Blueness wiki':'Blueness image'):'Blueness'}</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27%3E%3Cpath fill=%27%230000ff%27 d=%27M0 0h16v16H0z%27/%3E%3C/svg%3E"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000;color:#fff;font:12px/1.5 Helvetica,Arial,sans-serif}
#stage{display:block;position:relative;z-index:1;width:100%;height:100%}
#controls,#info{position:fixed;z-index:3;box-sizing:border-box;font:inherit;background:transparent;border:0;padding:0;text-shadow:0 1px 2px #000}
#controls{top:16px;right:16px;width:min(360px,calc(100% - 32px));max-height:calc(100dvh - 32px);display:flex;flex-direction:column;overflow:hidden}
.search-status{flex:none;margin:0 0 10px;white-space:pre-line}.control-fields{overflow:auto;scrollbar-width:none}.control-fields::-webkit-scrollbar{display:none}
#info{bottom:16px;left:16px;max-width:min(550px,calc(100% - 32px));max-height:70vh;overflow:auto}
button,input,select,summary,output,label,p,a{font:inherit;color:inherit;letter-spacing:0}
button{padding:0;background:none;border:0;cursor:pointer;text-shadow:inherit}button:hover,a:hover{opacity:.65}
.actions{display:flex;flex-direction:column;align-items:flex-start;gap:3px;margin:0 0 10px}.navigation{display:flex;justify-content:flex-start;gap:24px;margin:0}.navigation button{font:inherit}
a{display:block;text-decoration:none;overflow-wrap:anywhere}.control-fields>a{margin-bottom:18px}
details{margin:0 0 12px;padding:0;border:0}summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between}summary:after{content:'+';font:inherit}details[open]>summary:after{content:'−'}summary::-webkit-details-marker{display:none}details[open]>summary{margin-bottom:12px}
label{display:grid;grid-template-columns:1fr 6ch;gap:12px;margin-bottom:8px;align-items:start}
input[type=range]{grid-column:1/3;appearance:none;-webkit-appearance:none;display:block;width:100%;height:16px;margin:0;padding:0;background:transparent;cursor:pointer;border:0}
input[type=range]::-webkit-slider-runnable-track{height:1px;background:#aaa;border:0}input[type=range]::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:1px;height:13px;margin-top:-6px;background:white;border:0;border-radius:0}
input[type=range]::-moz-range-track{height:1px;background:#aaa;border:0}input[type=range]::-moz-range-thumb{width:1px;height:13px;background:white;border:0;border-radius:0}output{text-align:right;font-variant-numeric:tabular-nums}

select{grid-column:1/3;appearance:none;border:0;padding:0;background:transparent;cursor:pointer;text-shadow:inherit}select option{background:black;color:white}
label>button{text-align:right}.screen-button{display:block;margin:0;padding:0;text-align:left;text-decoration:underline;text-underline-offset:2px}p{white-space:pre-line;margin:0 0 12px}.swatch{display:none}
.export-button{display:block;text-decoration:underline;text-underline-offset:2px;margin-top:14px}footer{margin-top:16px;font:inherit}footer a{display:inline;text-decoration:underline;text-underline-offset:2px}
:focus-visible{outline:1px dotted #888;outline-offset:2px}[hidden]{display:none!important}

</style></head><body data-mode="${mode}" data-wiki="${wiki?'1':'0'}" data-project="${stills?'stills':'movements'}" data-sources="${sources}"><canvas id="stage"></canvas><aside id="controls" hidden></aside><aside id="info" hidden></aside><script>${pageCode.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
if(wiki){writeFileSync(new URL('../blueness-wiki.html',import.meta.url),page);console.log('blueness-wiki.html');continue;}
if(stills){writeFileSync(new URL('../blueness-image/index.html',import.meta.url),page);console.log('blueness-image/index.html');continue;}
if(name==='blue-video'){writeFileSync(new URL('../blueness/index.html',import.meta.url),page);console.log('blueness/index.html');}
for(const output of [name,name.replace(/^blue/,'blueness')])writeFileSync(new URL('../'+output+'.html',import.meta.url),page);
const localName=name==='blue-video'?'index':name==='blue'?'images':name.replace(/^blue-/,'');
const projectIcon='<link rel="shortcut icon" href="./favicon.ico?v=blue1"><link rel="icon" type="image/png" sizes="32x32" href="./favicon-32.png?v=blue1"><link rel="icon" type="image/svg+xml" sizes="any" href="./favicon.svg?v=blue1">';
writeFileSync(new URL('../bluenessmovements/'+localName+'.html',import.meta.url),page.replace(/<link rel="icon" href="data:image\/svg\+xml,[^"]*">/,projectIcon));
console.log('bluenessmovements/'+localName+'.html');
}
