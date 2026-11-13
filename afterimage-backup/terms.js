// A caption produces literal search words, never an invented model confidence.
const STOP = new Set(`a an pair bunch couple piece part day cloudy sunny clear floating posing this that the there is are was were be been being of on in at to for from with without by and or as it its his her their some one two three four several many image picture photo photograph scene view close up black white blurry small large big red blue green yellow standing sitting walking running looking holding wearing next front behind near over under beside around shown showing appears looks seems very something background foreground top bottom side left right group lot set young old has have had does did do not can could would will playing talking smiling watching making taking using moving going doing riding driving lying laying beautiful colorful empty full wooden metal`.split(' '));
const PHRASES = ['fire hydrant','traffic sign','street sign','stop sign','baseball field','baseball game','basketball court','golf course','traffic light','tennis court','swimming pool','fire truck','police car','train station','dining table','cell phone','computer screen','mountain range','city street','parking lot'];
export function captionTerms(caption) {
  const text = caption.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const phrases = PHRASES.filter(p => text.includes(p));
  const used = new Set(phrases.flatMap(p => p.split(' ')));
  const words = text.split(' ').filter(w => w.length > 2 && !STOP.has(w) && !used.has(w));
  return rankKeywords([...new Set([...phrases, ...words])]).slice(0, 6);
}
// Tiny local specificity heuristic: not corpus frequency or another AI call.
// Human nouns remain candidates; specific roles are treated like other specific nouns.
const GENERIC = new Set('thing stuff object objects person people man woman men women image photo picture scene view area place room building street road table chair wall floor ground background foreground water sky day night crowd group children child boy girl'.split(' '));
const COMMON = new Set('car tree house dog cat food face hand body city town beach boat train bird flower clothes'.split(' '));
const COMMON_PHRASES = new Set(['city street', 'dining table', 'parking lot', 'computer screen', 'cell phone', 'swimming pool']);
export function rankKeywords(terms) {
  const score = term => (term.includes(' ') ? .45 : 0) + Math.min(term.length, 14) * .06
    - (GENERIC.has(term) ? 3 : COMMON.has(term) || COMMON_PHRASES.has(term) ? 1.5 : 0);
  return [...terms].sort((a, b) => score(b) - score(a));
}
export function sanitizeTerms(terms) {
  return [...new Set(terms.map(t => String(t).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean))].slice(0, 6);
}
export function highlightParts(text, terms) {
  const words = sanitizeTerms(terms).sort((a, b) => b.length - a.length);
  if (!words.length) return [{ text: String(text), match: false }];
  const expression = new RegExp(`\\b(${words.join('|')})\\b`, 'gi');
  const result = []; let last = 0;
  for (const hit of String(text).matchAll(expression)) {
    if (hit.index > last) result.push({ text: String(text).slice(last, hit.index), match: false });
    result.push({ text: hit[0], match: true }); last = hit.index + hit[0].length;
  }
  if (last < String(text).length) result.push({ text: String(text).slice(last), match: false });
  return result;
}
