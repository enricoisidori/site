import { shuffle, metadataMatches } from './archive.js?v=runtime-51';
const API = 'https://commons.wikimedia.org/w/api.php';
function plain(value) {
  const text = String(value || '');
  if (typeof document === 'undefined') return text.replace(/<[^>]*>/g, ' ');
  const element = document.createElement('div');
  // Parse only as inert text: never attach third-party markup to the document.
  const parsed = new DOMParser().parseFromString(text, 'text/html');
  element.textContent = parsed.body.textContent;
  return element.textContent.replace(/\s+/g, ' ').trim();
}
export function commonsQuery(term, field = 'title') {
  const safe = term.replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);
  return `${field === 'title' ? 'intitle:' : ''}"${safe}" filetype:bitmap`;
}
export function commonsItem(page) {
  const info = page.imageinfo?.[0];
  if (!info || !/^image\/(jpeg|png|webp|gif)$/.test(info.mime || '')) return null;
  const ext = info.extmetadata || {};
  const title = page.title.replace(/^File:/, '');
  return {
    id: String(page.pageid), title, filename: title,
    imageUrl: info.thumburl || info.url, source: info.descriptionurl,
    dimensions: `${info.width} × ${info.height} px`,
    license: [plain(ext.LicenseShortName?.value), plain(ext.Artist?.value)].filter(Boolean).join(' · '),
    searchMetadata: {
      title: title.replace(/_/g, ' '),
      description: plain(ext.ImageDescription?.value),
      subject: plain(ext.Categories?.value).replace(/\|/g, ' · '),
    },
  };
}
export async function commonsCandidates(term = '', field = '') {
  const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*',
    prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', iiurlwidth: '1600', iiextmetadatalanguage: 'en' });
  if (term) {
    params.set('generator', 'search');
    params.set('gsrsearch', commonsQuery(term, field));
    params.set('gsrnamespace', '6');
    params.set('gsrlimit', '20');
  } else {
    params.set('generator', 'random');
    params.set('grnnamespace', '6');
    params.set('grnlimit', '20');
    params.set('grnfilterredir', 'nonredirects');
  }
  const response = await fetch(`${API}?${params}`, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`Commons HTTP ${response.status}`);
  const result = await response.json();
  if (result.error) throw new Error(result.error.info || result.error.code);
  return shuffle((result.query?.pages || []).map(commonsItem).filter(Boolean));
}
export function commonsMatches(item, term, field) {
  return metadataMatches(item.searchMetadata, term).filter(match => match.key === field);
}
