import { search, drawOne } from './archive.js';
// A single page request serves all workers of a query. They take different
// candidates, rather than each repeating count + search for its own video.
export class CandidatePool {
  constructor(terms, signal, report = () => {}) {
    this.terms = terms; this.signal = signal; this.report = report;
    this.queue = []; this.pending = null; this.result = null;
  }
  async take(excluded) {
    // A keyword with no results is not searched again.
    if (this.result && !this.result.total) return null;
    for (let pages = 0; pages < 2; pages++) {
      while (this.queue.length) {
        const candidate = this.queue.shift();
        if (!excluded(candidate.identifier)) return { candidate, result: this.result };
      }
      if (!this.pending) this.pending = search(this.terms, this.signal).then(result => {
        this.result = result; this.queue.push(...result.items); this.report(result);
      }).finally(() => { this.pending = null; });
      await this.pending;
      if (!this.result?.total) return null;
    }
    const candidate = this.queue.shift();
    return candidate && !excluded(candidate.identifier) ? { candidate, result: this.result } : null;
  }
}
export class Semaphore {
  constructor(limit) { this.limit = limit; this.used = 0; this.waiters = []; }
  async run(task, signal, priority = 0) {
    if (signal.aborted) throw signal.reason;
    if (this.used >= this.limit) await new Promise((resolve, reject) => {
      const waiter = { priority, resolve: () => { signal.removeEventListener('abort', abort); resolve(); } };
      const abort = () => { this.waiters = this.waiters.filter(x => x !== waiter); reject(signal.reason); };
      this.waiters.push(waiter); this.waiters.sort((a, b) => b.priority - a.priority); signal.addEventListener('abort', abort, { once: true });
    });
    else this.used++;
    try { if (signal.aborted) throw signal.reason; return await task(); }
    finally { const next = this.waiters.shift(); if (next) next.resolve(); else this.used--; }
  }
}

// Uniform tickets arrive one by one: a few draws stay in flight and every
// candidate goes to the first waiting lane, instead of waiting for a batch.
export class UniformPool {
  constructor(terms, signal, report = () => {}, { inflight = 4, target = 6, onItem = () => {} } = {}) {
    this.terms = terms; this.signal = signal; this.report = report; this.onItem = onItem;
    this.inflight = inflight; this.target = target;
    this.queue = []; this.waiters = []; this.active = 0; this.result = null; this.failures = 0; this.pause = 3000;
  }
  pump() {
    while (!this.signal.aborted && !this.paused && this.active < this.inflight && this.queue.length + this.active < this.target + this.waiters.length && this.result?.total !== 0) {
      this.active++;
      drawOne(this.terms, this.signal).then(r => {
        this.failures = 0; this.pause = 3000;
        const first = !this.result; this.result = { query: r.query, total: r.total };
        if (first) this.report({ ...this.result, items: r.item ? [r.item] : [] }); else if (r.item) this.onItem(r.item);
        if (r.item) this.queue.push(r.item);
      }, () => { this.failures++; }).finally(() => {
        this.active--;
        const wake = this.waiters.splice(0); for (const resolve of wake) resolve();
        // Repeated failures (Archive down or limiting this address): pause, and
        // pause longer each time, up to a minute.
        if (this.failures < 3) this.pump();
        else if (!this.paused) { this.paused = true; setTimeout(() => { this.paused = false; this.failures = 0; this.pump(); }, this.pause); this.pause = Math.min(60000, this.pause * 2); }
      });
    }
  }
  async take(excluded) {
    for (;;) {
      if (this.signal.aborted) return null;
      const index = this.queue.findIndex(c => !excluded(c.identifier));
      if (index >= 0) { const [candidate] = this.queue.splice(index, 1); this.pump(); return { candidate, result: this.result }; }
      if (this.result?.total === 0) return null;
      const arrived = new Promise(resolve => this.waiters.push(resolve));
      this.pump(); await arrived;
    }
  }
}
