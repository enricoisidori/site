import test from 'node:test';
import assert from 'node:assert/strict';
import {captionTerms} from './caption-terms.js';
test('caption extracts searchable concepts without ImageNet category vocabulary',()=>{
 assert.deepEqual(captionTerms('A swimming pool next to a futuristic observatory.'),['swimming pool','futuristic','observatory']);
 assert.deepEqual(captionTerms('A black and white image of a horse standing near a fence.'),['horse','fence']);
 assert.deepEqual(captionTerms(''),[]);
});

test('keep compound objects together to avoid overly broad queries',()=>{
 assert.deepEqual(captionTerms('a large red and white fire hydrant on a street'),['fire hydrant','street']);
});

test('ignore grammatical words and quoted instructions instead of searching for them',()=>{
 assert.deepEqual(captionTerms('a man is walking past a sign that reads "don t touch me"'),['sign']);
});

test('use a person as a last resort rather than pronouns or verbs',()=>{
 assert.deepEqual(captionTerms('a woman smiles as she poses for a picture'),['woman']);
});
