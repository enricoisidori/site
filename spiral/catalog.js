import { mediaBitrate } from './media-policy.js?v=runtime-51';
import { MAX_VIDEO_BYTES, LIMITED_ARCHIVE } from './config.js?v=runtime-51';
// A metadata cache, never a playlist of startup videos. Streams remain on Archive.
const records=new Map();
const usable=row=>row.files?.some(f=>Number(f.size)<=MAX_VIDEO_BYTES && mediaBitrate(f)<=700000);
const collections=new Set(['prelinger','home_movies','prelingerhomemovies']);
export async function primeCatalog(signal) {
  const response=await fetch(new URL('./archive-catalog.json?v=36',import.meta.url),{signal});
  if(!response.ok)return;
  for(const row of await response.json()) {
    const scope=[row.metadata?.collection].flat().filter(Boolean);
    if(((row.scope==='dreamachine-collections' && scope.some(name=>collections.has(name))) || (!LIMITED_ARCHIVE && row.scope==='archive-global')) && row.metadata?.['access-restricted-item'] !== 'true' && row.metadata?.['access-restricted-item'] !== true) records.set(row.identifier,row);
  }
}
export const catalogRecord=id=>records.get(id);
export const catalogCandidates=eligible=>[...records.keys()].filter(id=>usable(records.get(id)) && eligible(id)).map(identifier=>({identifier}));
export const catalogMetadata=()=>[...records.values()].filter(usable);
