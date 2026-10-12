// Prefer Prelinger without mandatory amateur/raw labels. Global candidates
// still need explicit evidence of both home footage and unedited recording.
const homeScope = '("home movie" OR "home movies" OR "home video" OR "home videos" OR "family film" OR "family footage" OR "amateur footage" OR "amateur film")';
const rawScope = '(unedited OR uncut OR "raw footage" OR "camera original" OR "camera originals" OR rushes OR "unedited footage")';
const globalScope = `date:[1920-01-01 TO 2015-12-31] AND ${homeScope} AND ${rawScope}`;
export const sourceScopes = ['collection:prelinger', 'collection:prelinger', 'collection:prelinger', globalScope];
export function amateurMetadataMatches(metadata) {
  const text = ['title', 'subject', 'description'].map(field => String(metadata[field] || '')).join(' ').replace(/<[^>]+>/g, ' ').toLowerCase();
  const blocked = /\bcall[\s_-]+of[\s_-]+duty\b|\b(montage|compilation|edited version|edited footage|music video|documentary|trailer|teaser|highlights|commercial|advertisement|industrial|educational|sponsored|instructional|corporate|gameplay|football|soccer|basketball|baseball|sports?)\b/.test(text);
  if (blocked) return false;
  if ([].concat(metadata.collection || []).includes('prelinger')) return true;
  return /\b(home movies?|home videos?|family (film|footage)|amateur (footage|film))\b/.test(text)
    && /\b(unedited|uncut|raw footage|camera originals?|rushes)\b/.test(text);
}
export const exclusionTerms = [
  '"call of duty"',
  'montage', 'edited', '"edited version"', '"edited footage"', '"short film"', '"feature film"', '"film festival"', '"music montage"',
  'teaser', 'sport', 'sports', 'football', 'soccer', 'basketball', 'baseball',
  'nfl', 'nba', '"world cup"', 'olympics', '"highlights"',
  'infomercial', 'gameplay', 'walkthrough', '"let\'s play"', 'speedrun',
  'reels', 'lecture', '"music video"', 'episode', 'documentary', '"tv spot"',
  '"launch trailer"', '"game trailer"', '"official trailer"', 'cinematic',
  '"announcement trailer"', 'reveal', '"release date"', '"coming soon"',
  '"pre-order"', 'preorder', 'E3', 'gamescom', '"out now"', '"available now"',
  '"official video"', '"live action trailer"',
  'trailer', 'spot', 'videogame', 'news', 'podcast', 'commercial',
  'advertisement', 'tiktok', 'compilation', 'tutorial', 'industrial',
  'educational', 'sponsored', 'instructional', 'corporate',
];
