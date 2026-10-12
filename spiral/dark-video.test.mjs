import test from 'node:test';
import assert from 'node:assert/strict';
import {hasAudioTrack,isDarkFrame} from './dark-video.js';
const box=(name,...parts)=>{const payload=Buffer.concat(parts);const out=Buffer.alloc(8+payload.length);out.writeUInt32BE(out.length);out.write(name,4);payload.copy(out,8);return out;};
const buffer=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
test('require a real nested MP4 audio handler',()=>{
 const handler=Buffer.alloc(12);handler.write('soun',8);
 assert.equal(hasAudioTrack(buffer(box('moov',box('trak',box('mdia',box('hdlr',handler)))))),true);
 handler.write('vide',8);
 assert.equal(hasAudioTrack(buffer(box('moov',box('trak',box('mdia',box('hdlr',handler)))))),false);
 assert.equal(hasAudioTrack(new ArrayBuffer(0)),false);
 assert.equal(hasAudioTrack(buffer(Buffer.from('not an mp4 soun'))),false);
});
test('reject bright or mostly dark but illuminated scenes',()=>{
 assert.equal(isDarkFrame(new Uint8ClampedArray([0,0,0,255,10,10,10,255])),true);
 assert.equal(isDarkFrame(new Uint8ClampedArray([100,100,100,255,0,0,0,255])),false);
 assert.equal(isDarkFrame(new Uint8ClampedArray()),false);
});
