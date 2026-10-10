import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseBeforeDeadline } from './shot.js';

function clock() {
  const timers = new Map();
  let id = 0;
  return { timers, now: () => 0, schedule(fn, delay) { timers.set(++id, {fn, delay}); return id; }, cancel(id) { timers.delete(id); } };
}
test('a pending search is aborted at 120 seconds and selects the cached reserve', async () => {
  const timer = clock(), controller = new AbortController();
  const result = chooseBeforeDeadline(new Promise(() => {}), {deadline:120000,controller,...timer});
  assert.equal([...timer.timers.values()][0].delay, 120000);
  assert.equal(controller.signal.aborted,false);
  [...timer.timers.values()][0].fn();
  assert.equal(await result,null);
  assert.equal(controller.signal.aborted,true);
});
test('a prepared correlated film wins and clears the deadline', async () => {
  const timer = clock(), controller = new AbortController();
  const video = {item:{id:'correlated'}};
  assert.equal(await chooseBeforeDeadline(Promise.resolve(video),{deadline:120000,controller,...timer}),video);
  assert.equal(timer.timers.size,0);
  assert.equal(controller.signal.aborted,false);
});
test('a failed search keeps the current video until the deadline', async () => {
  const timer = clock(), controller = new AbortController();
  let settled = false;
  const result = chooseBeforeDeadline(Promise.reject(new Error('No match')),{deadline:120000,controller,...timer});
  result.then(() => { settled=true; });
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(settled,false);
  [...timer.timers.values()][0].fn();
  assert.equal(await result,null);
});
