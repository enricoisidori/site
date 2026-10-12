import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";
const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("./app.js", import.meta.url), "utf8");
const init = app.slice(0, app.lastIndexOf("await start();"));
function context(storage = { getItem: () => null }) {
  const elements = {};
  return createContext({
    document: {
      querySelector(s) {
        return (elements[s] ||= {
          hidden: true,
          textContent: "",
          innerHTML: "",
        });
      },
      addEventListener() {},
    },
    sessionStorage: storage,
    URL,
    Set,
    performance: { now: () => 0 },
    setInterval() {},
    clearTimeout() {},
    setTimeout() {},
  });
}
test("standalone HTML requires no local scripts, imports or worker fetch", () => {
  assert.doesNotMatch(html, /<script[^>]+src=/);
  const scripts = [
    ...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),
  ];
  assert.equal(scripts.length, 2);
  assert.equal(
    JSON.parse(scripts[0][1]),
    readFileSync(new URL("./vision-worker.js", import.meta.url), "utf8"),
  );
  new Script(scripts[1][1]);
  assert.doesNotMatch(scripts[1][1], /new Worker\(["']\.\//);
});
test("unavailable or corrupted storage does not stop startup", () => {
  for (const storage of [
    {
      getItem() {
        throw Error("SecurityError");
      },
      setItem() {
        throw Error("SecurityError");
      },
    },
    {
      getItem() {
        return "{broken";
      },
      setItem() {},
    },
  ])
    new Script(
      init + '\nsaveSeen();if(seen.size)throw Error("seen");',
    ).runInContext(context(storage));
});
test("metadata validation uses complete words and weights title before subjects", () => {
  new Script(
    init +
      `\nterms=['boat'];if(!score({title:'A boat'}).total)throw Error('no match');if(score({title:'boathouse'}).total)throw Error('false match');if(score({title:'boat'}).total<=score({subject:'boat'}).total)throw Error('weights');`,
  ).runInContext(context());
});
test("failed streaming candidates are released before sequential retry", async () => {
  const c = context();
  new Script(
    init +
      `\nlet active=0,attempt=0;
 pick=async()=>({id:'candidate-'+attempt});
 preload=async c=>{active++;if(active!==1)throw Error('parallel');await Promise.resolve();active--;attempt++;if(attempt<3)throw Error('network');return c;};
 globalThis.result=loadCandidate(true).then(c=>{if(c.id!=='candidate-2'||rejected.size!==2||active)throw Error('bad recovery');});`,
  ).runInContext(c);
  await c.result;
});
test("buffer readiness uses the range containing current time, not a later range", () => {
  new Script(
    init +
      `\nconst v={currentTime:3,buffered:{length:2,start:i=>i?20:0,end:i=>i?60:9}};if(ahead(v)!==6)throw Error('buffer');v.currentTime=12;if(ahead(v)!==0)throw Error('gap');`,
  ).runInContext(context());
});
test("seen and rejected videos are discarded before metadata requests", async () => {
  const c = context();
  new Script(
    init +
      `\nseen.add('old');rejected.add('broken');json=()=>{throw Error('must not fetch')};globalThis.result=Promise.all([candidate({identifier:'old'},true),candidate({identifier:'broken'},true)]).then(x=>{if(x.some(Boolean))throw Error('repeated');});`,
  ).runInContext(c);
  await c.result;
});
