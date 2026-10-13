import { defaultFilters } from './filter-defaults.js';
// Global movie index with full content exclusions. Playable lightweight
// derivatives are checked in metadata rather than a remote format filter.
export const sourceScopes = [''];
export const exclusionTerms = [
  '"call of duty"',
  '"launch trailer"', '"game trailer"', '"official trailer"', 'cinematic',
  '"announcement trailer"', 'reveal', '"release date"', '"coming soon"',
  '"pre-order"', 'preorder', 'E3', 'gamescom', '"out now"', '"available now"',
  '"official video"', '"live action trailer"',
  'trailer', 'teaser', 'spot', 'videogame', 'gameplay', 'walkthrough',
  '"let\'s play"', 'speedrun', 'news', 'podcast', 'commercial',
  'advertisement', 'infomercial', 'tiktok', 'reels', 'compilation', 'tutorial',
];

// Run against metadata already fetched, before any video is buffered.
export function promotionalMetadata(metadata) {
  if (!filterState.promotional) return false;
  const text = ['title', 'subject', 'description'].map(field => String(metadata[field] || '')).join(' ').slice(0, 12000).replace(/<[^>]+>/g, ' ').toLowerCase();
  return /\bcall[\s_-]+of[\s_-]+duty\b|\b(trailers?|teasers?|promos?|promotional|advertisements?|advertising|adverts?|commercials?|infomercials?|werbespot|reklame)\b|\b(tv|television|radio)\s*[-:]?\s*spot\b|bande[ -]annonce|tr[aá]iler|pubblicit[àa]|anuncio publicitario|\b(in cinemas|in theaters|in theatres|coming soon|pre[ -]?order|available now|out now|release date|official video|launch campaign)\b/.test(text);
}

const filterKey='afterimage:filters:v2';
export const filterState={...defaultFilters,collections:[...defaultFilters.collections]};
try{Object.assign(filterState,JSON.parse(localStorage.getItem(filterKey)||'{}'));}catch{}
export function updateFilters(changes){Object.assign(filterState,changes);filterState.collections=[...new Set(filterState.collections||[])];try{localStorage.setItem(filterKey,JSON.stringify(filterState));}catch{}window.dispatchEvent(new CustomEvent('afterimage:filters'));}
export function blockedCollection(metadata){return [].concat(metadata.collection||[]).some(id=>filterState.collections.includes(id));}
export function filterDefaultsCode(){return 'export const defaultFilters = '+JSON.stringify(filterState,null,2)+';\n';}
