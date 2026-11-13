import { search } from './archive.js';
// A single page request serves all workers of a query. They take different
// candidates, rather than each repeating count + search for its own video.
export class CandidatePool {
  constructor(terms, signal, report = () => {}) {
    this.terms = terms; this.signal = signal; this.report = report;
    this.queue = []; this.pending = null; this.result = null;
  }
  async take(excluded) {
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
