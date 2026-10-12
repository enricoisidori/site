const STOP = new Set(`he she they smiles poses smile pose has have had does did do not don can could would will says said reads read past through across touch please dark bright touching playing talking smiling watching making taking using moving going doing riding driving lying laying beautiful colorful empty full wooden metala an the this that there is are was were be been being of on in at to for from with without by and or as it its his her their some two three four one several many image picture photo photograph scene view close up black white blurry small large big red blue green yellow standing sitting walking running looking holding wearing next front behind near over under beside around shown showing appears looks seems very people person something background foreground top bottom side left right group lot set man woman young old`.split(' '));
export function captionTerms(caption) {
  const text = caption.toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
  const phrases = ['fire hydrant','traffic sign','street sign','stop sign','baseball field','baseball game','basketball court','golf course','hot dog','traffic light','tennis court','swimming pool','fire truck','police car','train station','dining table','cell phone','computer screen','mountain range','city street','parking lot'];
  const found = phrases.filter(phrase=>text.includes(phrase));
  const used = new Set(found.flatMap(phrase=>phrase.split(' ')));
  const terms = [...new Set([...found, ...text.split(' ').filter(word=>word.length>2 && !STOP.has(word) && !used.has(word))])].slice(0,6);
  return terms.length ? terms : text.split(' ').filter(word=>word==='man' || word==='woman').slice(0,1);
}
