// The restricted edition uses only the named Archive collections. Add a
// verified Archive `uploader` value here to include every item from one person.
export const individualUploaders = [];
const collections = ['prelinger', 'opensource_movies', 'community_video'];
const uploaderClauses = individualUploaders.map(uploader => `uploader:"${uploader.replace(/["\\]/g, '')}"`);
export const sourceScope = `(${[...collections.map(collection => `collection:${collection}`), ...uploaderClauses].join(' OR ')})`;
export const exclusionTerms = [
  'trailer', 'spot', 'videogame', 'news', 'podcast', 'commercial',
  'advertisement', 'tiktok', 'compilation', 'tutorial', 'industrial',
  'educational', 'sponsored', 'instructional', 'corporate',
];
