import test from 'node:test';
import assert from 'node:assert/strict';
import { commonsItem, commonsMatches, commonsQuery } from './commons-api.js';

test('Commons gives title priority and restricts searches to bitmap images', () => {
  assert.equal(commonsQuery('computer keyboard', 'title'), 'intitle:"computer keyboard" filetype:bitmap');
  assert.equal(commonsQuery('computer keyboard', 'description'), '"computer keyboard" filetype:bitmap');
});
test('require literal evidence in the selected metadata field', () => {
  const item = commonsItem({ pageid: 1, title: 'File:A_keyboard.jpg', imageinfo: [{
    mime: 'image/jpeg', thumburl: 'https://thumb.wikimedia.org/image.jpg',
    width: 100, height: 80, descriptionurl: 'https://commons.wikimedia.org/wiki/File:A_keyboard.jpg',
    extmetadata: { ImageDescription: { value: 'A computer input device.' }, Categories: { value: 'Keyboards|Computers' } },
  }] });
  assert.equal(commonsMatches(item, 'keyboard', 'title')[0].keyword, 'keyboard');
  assert.deepEqual(commonsMatches(item, 'keyboard', 'description'), []);
  assert.equal(commonsMatches(item, 'computer', 'description')[0].field, 'Descrizione');
  assert.equal(commonsItem({ title:'File:movie.webm', imageinfo:[{mime:'video/webm'}] }), null);
});
