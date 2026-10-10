(() => {
  const $ = id => document.getElementById(id);
  const svg = $('art');
  const W = 850, H = 1200;
  const STORAGE = 'linear-layers-project-v1';
  const defaults = {
    newText: 'JACK PURCELL', count: 12, chaos: 9, scaleSpread: 8, angleSpread: 5,
    depth: 72, opacity: 82, background: '#20284b', seed: 2847, selected: 6,
    layers: [
      {text:'THE',font:'Ortica Linear',weight:700,x:50,y:10,size:145,sx:1.1,sy:1,angle:0,slant:0,warp:'none',warpAmount:0,frequency:1.5,tracking:100,color:'#29417d',tone:0,opacity:44},
      {text:'JACK',font:'Ortica Linear',weight:400,x:50,y:23,size:157,sx:1.15,sy:1,angle:0,slant:0,warp:'none',warpAmount:0,frequency:1.5,tracking:100,color:'#2a4387',tone:0,opacity:48},
      {text:'PURCELL',font:'Ortica Linear',weight:400,x:50,y:36,size:137,sx:.9,sy:1,angle:0,slant:0,warp:'none',warpAmount:0,frequency:1.5,tracking:100,color:'#314b93',tone:0,opacity:47},
      {text:'BOOK',font:'Ortica Linear',weight:400,x:50,y:48,size:154,sx:1.18,sy:1,angle:0,slant:0,warp:'none',warpAmount:0,frequency:1.5,tracking:100,color:'#2e4487',tone:0,opacity:48},
      {text:'THE JACK PURCELL BOOK',font:'Ortica Linear',weight:400,x:50,y:54,size:48,sx:1.06,sy:.75,angle:0,slant:0,warp:'none',warpAmount:0,frequency:1.5,tracking:100,color:'#7e9edb',tone:35,opacity:90},
      {text:'JACK',font:'Ortica Linear',weight:700,x:53,y:68,size:162,sx:.9,sy:1.15,angle:0,slant:0,warp:'none',warpAmount:0,frequency:1.5,tracking:100,color:'#344e98',tone:0,opacity:45},
      {text:'PURCELL',font:'Ortica Linear',weight:400,x:49,y:81,size:138,sx:.92,sy:1,angle:0,slant:0,warp:'none',warpAmount:0,frequency:1.5,tracking:100,color:'#354f9c',tone:0,opacity:49},
      {text:'BOOK',font:'Ortica Linear',weight:700,x:51,y:92,size:150,sx:1.05,sy:1,angle:0,slant:0,warp:'none',warpAmount:0,frequency:1.5,tracking:100,color:'#3a56a2',tone:0,opacity:48},
      {text:'JACK PURCELL',font:'Ortica Linear',weight:700,x:55,y:31,size:105,sx:.75,sy:1.9,angle:-48,slant:20,warp:'wave',warpAmount:18,frequency:1.2,tracking:90,color:'#4971c3',tone:10,opacity:53},
      {text:'JACK PURCELL',font:'Ortica Linear',weight:700,x:42,y:57,size:112,sx:.55,sy:2.3,angle:-73,slant:-17,warp:'ribbon',warpAmount:24,frequency:1.4,tracking:85,color:'#527ac9',tone:12,opacity:59},
      {text:'JACK PURCELL BOOK',font:'Exposure Trial',exposure:40,weight:400,x:44,y:66,size:102,sx:.64,sy:1.6,angle:-55,slant:12,warp:'arc',warpAmount:25,frequency:1.3,tracking:88,color:'#6086ce',tone:17,opacity:52},
      {text:'JACK PURCELL',font:'Ortica Linear',weight:700,x:60,y:52,size:122,sx:.63,sy:1.7,angle:-55,slant:6,warp:'steps',warpAmount:14,frequency:1.8,tracking:90,color:'#5a82cf',tone:18,opacity:54}
    ]
  };
  defaults.fonts = { exposure: true, ortica: false };
  defaults.fontMigrationV2 = true;
  defaults.layers.forEach(layer => { if (layer.font === 'Ortica Linear') { layer.font = 'Exposure Trial'; layer.exposure = 0; } });
  const clone = value => JSON.parse(JSON.stringify(value));
  let state;
  try { const saved=JSON.parse(localStorage.getItem(STORAGE) || 'null');state = saved ? {...clone(defaults), ...saved, fontMigrationV2:saved.fontMigrationV2} : clone(defaults); }
  catch { state = clone(defaults); }
  if (!Array.isArray(state.layers)) state = clone(defaults);
  function migrateFonts(project) {
    if (!project.fontMigrationV2) {
      project.layers.forEach(layer => { if (layer.font === 'Ortica Linear') { layer.font = 'Exposure Trial'; layer.exposure ??= 0; } });
      project.fonts = { exposure: true, ortica: false };
      project.fontMigrationV2 = true;
    }
    return project;
  }
  migrateFonts(state);
  const serverMode = location.protocol === 'http:' || location.protocol === 'https:';
  let saveTimer, saveRequest = Promise.resolve();
  const writeProject = () => {
    if (!serverMode) return;
    const snapshot = JSON.stringify(state);
    saveRequest = saveRequest.catch(()=>{}).then(async () => {
      const response = await fetch('/api/project',{method:'PUT',headers:{'Content-Type':'application/json'},body:snapshot});
      if (!response.ok) throw Error('Salvataggio non riuscito');
      $('saveStatus').textContent = 'Salvato in linear-layers/project.json';
    }).catch(() => { $('saveStatus').textContent = 'Server non raggiungibile: usa Salva progetto JSON'; });
  };
  const save = () => {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch {}
    $('saveStatus').textContent = serverMode ? 'Salvataggio su disco…' : 'Salvato nel browser · avvia server.js per salvare su disco';
    clearTimeout(saveTimer);saveTimer=setTimeout(writeProject,180);
  };
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  const escapeXml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const hex = s => [1,3,5].map(i => parseInt(s.slice(i,i+2),16));
  const colorMix = (a,b,t) => { const x=hex(a),y=hex(b); return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join(''); };
  const random = (n) => { let x=(n+state.seed)|0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;return (x>>>0)/4294967296; };
  const exposureFamily = n => `Exposure Local ${n<0?'m'+Math.abs(n):'p'+n}`;
  const family = layer => layer.font === 'Exposure Trial' ? exposureFamily(layer.exposure || 0) : 'Ortica Local';
  const fontSpec = layer => `${layer.font==='Exposure Trial'?400:layer.weight||400} ${layer.size}px "${family(layer)}",Georgia,serif`;
  const fontStyles = document.createElement('style');
  for (let n=-100;n<=100;n+=10) fontStyles.textContent += `@font-face{font-family:"${exposureFamily(n)}";src:url("/fonts/exposure/${n}.otf") format("opentype");font-weight:400}`;
  for (const [name,weight] of [['light',300],['regular',400],['bold',700]]) fontStyles.textContent += `@font-face{font-family:"Ortica Local";src:url("/fonts/ortica/${name}.otf") format("opentype");font-weight:${weight}}`;
  document.head.append(fontStyles);
  const fontEnabled = layer => layer.font === 'Exposure Trial' ? state.fonts.exposure : state.fonts.ortica;
  const visibleLayers = () => state.layers.slice(0,state.count).map((layer,index)=>({layer,index})).filter(({layer})=>fontEnabled(layer));
  async function ensureFonts(){await Promise.allSettled([...new Set(visibleLayers().map(({layer})=>fontSpec(layer)))].map(spec=>document.fonts.load(spec,'JACK PURCELL')))}
  const measureCtx = document.createElement('canvas').getContext('2d');
  function glyphs(layer) {
    measureCtx.font = fontSpec(layer);
    const letters = Array.from(layer.text || ''), advances = letters.map(ch => measureCtx.measureText(ch).width*(layer.tracking||100)/100);
    const total = advances.reduce((a,b)=>a+b,0);let x=-total/2;
    return letters.map((ch,i)=>{const item={ch,x:x+advances[i]/2,index:i,total:letters.length};x+=advances[i];return item});
  }
  function offsets(layer,glyph,amount) {
    const u=glyph.total<=1?0:glyph.index/(glyph.total-1)*2-1,phase=u*Math.PI*(layer.frequency||1.5),a=amount;
    switch(layer.warp){
      case 'wave':return {y:Math.sin(phase)*a,angle:Math.cos(phase)*a*.23,scale:1};
      case 'arc':return {y:(u*u-.35)*a*1.8,angle:u*a*.48,scale:1};
      case 'fan':return {y:Math.abs(u)*a*.55,angle:u*a*.72,scale:1};
      case 'steps':return {y:Math.round(u*3)*a*.36,angle:0,scale:1};
      case 'ribbon':return {y:Math.sin(phase*1.5)*a*.8,angle:Math.cos(phase)*a*.5,scale:1+Math.sin(phase)*a/150};
      case 'perspective':return {y:-u*a*.4,angle:0,scale:clamp(1+u*a/90,.25,2.5)};
      default:return {y:0,angle:0,scale:1};
    }
  }
  function visual(layer,index) {
    const n=Math.max(1,state.count-1),front=index/n,chaos=state.chaos/100;
    const x=layer.x*W/100+(random(index*11+1)-.5)*W*.12*chaos;
    const y=layer.y*H/100+(random(index*11+2)-.5)*H*.12*chaos;
    const angle=layer.angle+(random(index*11+3)-.5)*state.angleSpread*.9;
    const sx=layer.sx*(1+(random(index*11+4)-.5)*state.scaleSpread/100);
    const sy=layer.sy*(1+(random(index*11+5)-.5)*state.scaleSpread/100);
    const tone=clamp((layer.tone||0)/100+front*state.depth/100*.42,0,.85);
    const color=colorMix(layer.color||'#314d95','#a4bff1',tone);
    const alpha=clamp((layer.opacity||50)/100*state.opacity/100*(.78+front*.4),.01,1);
    return {x,y,angle,sx,sy,color,alpha,amount:(layer.warpAmount||0)*(1+chaos*.9)};
  }
  function glyphItems(layer,index) { const v=visual(layer,index);return {v,items:glyphs(layer).map(g=>({...g,...offsets(layer,g,v.amount)}))}; }
  function render() {
    let out=`<rect width="${W}" height="${H}" fill="${escapeXml(state.background)}"/>`;
    visibleLayers().forEach(({layer,index})=>{
      const {v,items}=glyphItems(layer,index);
      out+=`<g data-layer="${index}" opacity="${v.alpha}" transform="translate(${v.x} ${v.y}) rotate(${v.angle}) skewX(${layer.slant||0}) scale(${v.sx} ${v.sy})" fill="${v.color}" style="cursor:grab">`;
      for(const item of items){
        out+=`<text x="0" y="0" font-family="${escapeXml(family(layer))}, Georgia, serif" font-size="${layer.size}" font-weight="${layer.font==='Exposure Trial'?400:layer.weight||400}" text-anchor="middle" dominant-baseline="central" transform="translate(${item.x} ${item.y}) rotate(${item.angle}) scale(${item.scale} 1)">${escapeXml(item.ch)}</text>`;
      }
      out+='</g>';
    });
    svg.innerHTML=out;
  }
  function syncGlobalUI(){for(const id of ['newText','count','chaos','scaleSpread','angleSpread','depth','opacity','background'])$(id).value=state[id];for(const id of ['count','chaos','scaleSpread','angleSpread','depth','opacity'])$(id+'Value').textContent=state[id]+(id==='count'?'':'%');$('layerTotal').textContent=`${state.count} / ${state.layers.length}`;$('enableExposure').checked=state.fonts.exposure;$('enableOrtica').checked=state.fonts.ortica}
  const range=(id,label,min,max,step=1,suffix='')=>`<div class="field"><label for="${id}">${label}<output data-out="${id}"></output></label><input id="${id}" data-field="${id.split('_').slice(1).join('_')}" type="range" min="${min}" max="${max}" step="${step}"></div>`;
  function renderLayerList(){
    $('layers').innerHTML=state.layers.slice(0,state.count).map((layer,index)=>{
      const selected=index===state.selected,swatch=visual(layer,index).color;
      return `<article class="layer ${selected?'active':''}" data-index="${index}"><div class="layer-top" data-open="${index}"><span class="swatch" style="background:${swatch}"></span><strong>${escapeXml(layer.text||'(vuota)')}</strong><small>${index+1} · ${layer.font==='Exposure Trial'?'Exposure':'Linear'}</small></div><div class="layer-controls">
      <div class="field"><label>Testo</label><input data-field="text" type="text" value="${escapeXml(layer.text||'')}"></div>
      <div class="grid"><div class="field"><label>Font</label><select data-field="font"><option value="Ortica Linear" ${layer.font==='Ortica Linear'?'selected':''}>Ortica Linear</option><option value="Exposure Trial" ${layer.font==='Exposure Trial'?'selected':''}>Exposure Trial</option></select></div><div class="field"><label>Peso Ortica</label><select data-field="weight"><option value="300" ${layer.weight===300?'selected':''}>Light</option><option value="400" ${layer.weight===400?'selected':''}>Regular</option><option value="700" ${layer.weight===700?'selected':''}>Bold</option></select></div></div>
      ${range('l_exposure','Esposizione',-100,100,10)}
      <div class="grid">${range('l_x','Posizione X',-30,130)}${range('l_y','Posizione Y',-30,130)}</div>
      ${range('l_size','Dimensione',10,300)}
      <div class="grid">${range('l_sx','Stira X',.1,4,.01,'×')}${range('l_sy','Stira Y',.1,4,.01,'×')}</div>
      <div class="grid">${range('l_angle','Rotazione',-180,180)}${range('l_slant','Inclinazione',-75,75)}</div>
      <div class="grid"><div class="field"><label>Tipo deformazione</label><select data-field="warp">${['none','wave','arc','fan','steps','ribbon','perspective'].map(mode=>`<option value="${mode}" ${layer.warp===mode?'selected':''}>${{none:'Nessuna',wave:'Onda',arc:'Arco',fan:'Ventaglio',steps:'Gradini',ribbon:'Nastro',perspective:'Prospettiva'}[mode]}</option>`).join('')}</select></div>${range('l_warpAmount','Intensità',0,100)}</div>
      <div class="grid">${range('l_frequency','Frequenza',.25,5,.05)}${range('l_tracking','Spaziatura',40,180)}</div>
      <div class="grid">${range('l_tone','Schiarisci',0,100)}${range('l_opacity','Opacità',1,100)}</div>
      <div class="field"><label>Colore base</label><input data-field="color" type="color" value="${layer.color||'#315096'}"></div>
      <div class="layer-actions"><button data-action="up" type="button">↑</button><button data-action="down" type="button">↓</button><button data-action="duplicate" type="button">Duplica</button><button data-action="delete" type="button">Elimina</button></div></div></article>`;
    }).join('');
    $('layers').querySelectorAll('article.layer').forEach(card=>{
      const layer=state.layers[+card.dataset.index];
      card.querySelectorAll('[data-field]').forEach(input=>{
        const field=input.dataset.field;if(input.type==='range'){input.value=layer[field]??0;const output=card.querySelector(`[data-out="${input.id}"]`);if(output)output.textContent=Number(input.value).toFixed(['sx','sy','frequency'].includes(field)?2:0)+(field==='sx'||field==='sy'?'×':['x','y','tone','opacity','tracking'].includes(field)?'%':['angle','slant'].includes(field)?'°':'')}
      });
    });
  }
  function persist(){save();render();syncGlobalUI();ensureFonts().then(render)}
  function newLayer(text=state.newText){const n=state.layers.length,colors=['#2c4789','#34569c','#4063ac','#4a6fba','#567fc6'],warps=['wave','arc','fan','ribbon','steps','perspective'];return {text:text||'JACK PURCELL',font:'Exposure Trial',weight:n%4===0?700:400,exposure:[-40,0,20,50][n%4],x:20+random(n*23+1)*60,y:8+random(n*23+2)*84,size:58+random(n*23+3)*115,sx:.45+random(n*23+4)*.85,sy:.8+random(n*23+5)*1.6,angle:-80+random(n*23+6)*160,slant:-25+random(n*23+7)*50,warp:warps[n%warps.length],warpAmount:8+random(n*23+8)*38,frequency:.8+random(n*23+9)*2.2,tracking:75+random(n*23+10)*55,color:colors[n%colors.length],tone:Math.round(random(n*23+11)*30),opacity:35+Math.round(random(n*23+12)*35)}}
  $('layers').addEventListener('click',event=>{
    const card=event.target.closest('.layer');if(!card)return;const index=+card.dataset.index,action=event.target.dataset.action;
    if(action){
      if(action==='duplicate'){state.layers.splice(index+1,0,clone(state.layers[index]));state.count=Math.min(state.layers.length,80);state.selected=index+1}
      if(action==='delete'&&state.layers.length>1){state.layers.splice(index,1);state.count=Math.min(state.count,state.layers.length);state.selected=Math.min(state.selected,state.count-1)}
      if(action==='up'&&index>0){[state.layers[index-1],state.layers[index]]=[state.layers[index],state.layers[index-1]];state.selected=index-1}
      if(action==='down'&&index<state.count-1){[state.layers[index+1],state.layers[index]]=[state.layers[index],state.layers[index+1]];state.selected=index+1}
      renderLayerList();persist();return;
    }
    if(event.target.closest('[data-open]')){state.selected=index;renderLayerList();save()}
  });
  $('layers').addEventListener('input',event=>{
    const card=event.target.closest('.layer'),input=event.target;if(!card||!input.dataset.field)return;
    const layer=state.layers[+card.dataset.index],field=input.dataset.field;
    layer[field]=input.type==='range'||field==='weight'?Number(input.value):input.value;
    if(field==='font') state.fonts[layer.font==='Exposure Trial'?'exposure':'ortica']=true;
    if(field==='text')card.querySelector('.layer-top strong').textContent=layer.text||'(vuota)';
    if(field==='font')card.querySelector('.layer-top small').textContent=`${+card.dataset.index+1} · ${layer.font==='Exposure Trial'?'Exposure':'Linear'}`;
    if(input.type==='range'){const output=card.querySelector(`[data-out="${input.id}"]`);if(output)output.textContent=Number(input.value).toFixed(['sx','sy','frequency'].includes(field)?2:0)+(field==='sx'||field==='sy'?'×':['x','y','tone','opacity','tracking'].includes(field)?'%':['angle','slant'].includes(field)?'°':'')}
    persist();
  });
  for(const id of ['newText','count','chaos','scaleSpread','angleSpread','depth','opacity','background'])$(id).addEventListener('input',event=>{
    const value=event.target.type==='range'?Number(event.target.value):event.target.value;state[id]=value;
    if(id==='count'){while(state.layers.length<value)state.layers.push(newLayer());state.selected=Math.min(state.selected,value-1);renderLayerList()}
    persist();
  });
  $('enableExposure').addEventListener('change',event=>{state.fonts.exposure=event.target.checked;persist()});
  $('enableOrtica').addEventListener('change',event=>{state.fonts.ortica=event.target.checked;persist()});
  $('addLayer').onclick=()=>{if(state.layers.length>=80)return;state.layers.splice(state.count,0,newLayer());state.count++;state.selected=state.count-1;renderLayerList();persist()};
  $('regenerate').onclick=()=>{state.seed=Math.floor(Math.random()*1e9);persist()};
  $('reset').onclick=()=>{state=clone(defaults);renderLayerList();persist()};
  $('downloadSvg').onclick=()=>{const content=`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="17cm" height="24cm" viewBox="0 0 ${W} ${H}">${svg.innerHTML}</svg>`;const a=document.createElement('a');a.download='linear-layers-17x24cm.svg';a.href=URL.createObjectURL(new Blob([content],{type:'image/svg+xml;charset=utf-8'}));a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  $('downloadPng').onclick=async()=>{await ensureFonts();const canvas=document.createElement('canvas'),scale=2008/W;canvas.width=2008;canvas.height=2835;const c=canvas.getContext('2d');c.scale(scale,2835/H);c.fillStyle=state.background;c.fillRect(0,0,W,H);visibleLayers().forEach(({layer,index})=>{const {v,items}=glyphItems(layer,index);c.save();c.globalAlpha=v.alpha;c.fillStyle=v.color;c.translate(v.x,v.y);c.rotate(v.angle*Math.PI/180);c.transform(1,0,Math.tan((layer.slant||0)*Math.PI/180),1,0,0);c.scale(v.sx,v.sy);c.font=fontSpec(layer);c.textBaseline='middle';for(const item of items){c.save();c.translate(item.x,item.y);c.rotate(item.angle*Math.PI/180);c.scale(item.scale,1);c.fillText(item.ch,-measureCtx.measureText(item.ch).width/2,0);c.restore()}c.restore()});const a=document.createElement('a');a.download='linear-layers-17x24cm-300dpi.png';a.href=canvas.toDataURL('image/png');a.click()};
  $('saveJson').onclick=()=>{const a=document.createElement('a');a.download='linear-layers-project.json';a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  $('loadJson').onclick=()=>$('jsonFile').click();$('jsonFile').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{const loaded=JSON.parse(await file.text());if(!Array.isArray(loaded.layers)||!loaded.layers.length)throw Error('Progetto non valido');state={...clone(defaults),...loaded,count:clamp(loaded.count||loaded.layers.length,1,Math.min(80,loaded.layers.length))};renderLayerList();persist()}catch{$('saveStatus').textContent='File JSON non valido'}event.target.value=''};
  let dragging=null;
  svg.addEventListener('pointerdown',event=>{const group=event.target.closest('[data-layer]');if(!group)return;const index=+group.dataset.layer;state.selected=index;renderLayerList();const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const p=point.matrixTransform(svg.getScreenCTM().inverse());dragging={index,startX:p.x,startY:p.y,x:state.layers[index].x,y:state.layers[index].y};svg.setPointerCapture(event.pointerId)});
  svg.addEventListener('pointermove',event=>{if(!dragging)return;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const p=point.matrixTransform(svg.getScreenCTM().inverse()),layer=state.layers[dragging.index];layer.x=clamp(dragging.x+(p.x-dragging.startX)/W*100,-30,130);layer.y=clamp(dragging.y+(p.y-dragging.startY)/H*100,-30,130);render();save()});
  const endDrag=()=>{if(!dragging)return;dragging=null;renderLayerList();persist()};svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);
  window.addEventListener('pagehide',()=>{if(serverMode&&navigator.sendBeacon)navigator.sendBeacon('/api/project',new Blob([JSON.stringify(state)],{type:'application/json'}))});
  async function start(){
    if(serverMode){try{const response=await fetch('/api/project',{cache:'no-store'});if(response.ok){const data=await response.json();if(data.current&&Array.isArray(data.current.layers)&&data.current.layers.length)state={...clone(defaults),...data.current,fontMigrationV2:data.current.fontMigrationV2}}}catch{}}
    migrateFonts(state);
    state.count=clamp(state.count||state.layers.length,1,Math.min(80,state.layers.length));
    state.selected=clamp(state.selected||0,0,state.count-1);
    syncGlobalUI();renderLayerList();await ensureFonts();render();save();
  }
  start();
})();
