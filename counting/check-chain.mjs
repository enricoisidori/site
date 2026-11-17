// node counting/check-chain.mjs — verifica la catena completa, secondo per secondo:
// foglio (vista palmo) → gesto del performer → immagine della camera → flip in post → video finale → numero.
// Il modello fisico qui sotto è scritto a mano, indipendente dal codice di disegno.
import { DEFAULT_CFG, buildTimeline, stateAt, handValues, PEOPLE } from './counting.js';
import { fingersFromValue, mirrorFor, DIGIT_X } from './hands.js';

const F = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const bits5 = (v) => v.toString(2).padStart(5, '0');
let errors = 0, checks = 0;
const fail = (msg) => { if (errors++ < 20) console.log('ERRORE', msg); };

// --- fisica -----------------------------------------------------------------
// Il performer guarda i propri palmi (dorsi verso la camera), dita in su.
// Mano sinistra col palmo verso di sé: pollice a sinistra. Mano destra: pollice a destra.
const performerSees = { left: ['thumb', 'index', 'middle', 'ring', 'pinky'], right: ['pinky', 'ring', 'middle', 'index', 'thumb'] };
// La camera sta davanti: vede tutto specchiato rispetto al performer (sinistra↔destra).
// Fila vista dalla camera: persona 6 per prima a sinistra (pagina "The row").
// Il video finale è l'immagine della camera specchiata in post.

// --- 1. il foglio: disegno vista palmo, come lo vede il performer -------------
// In hands.js la geometria non specchiata ha il pollice a sinistra (DIGIT_X[0] = pollice).
function drawnOrder(side, view, mirror) {
  const xs = F.map((f, i) => ({ f, x: mirror ? 200 - DIGIT_X[i] : DIGIT_X[i] }));
  return xs.sort((a, b) => a.x - b.x).map((o) => o.f);
}
for (const side of ['left', 'right']) {
  const got = drawnOrder(side, 'palm', mirrorFor(side, 'palm')).join(',');
  checks++; if (got !== performerSees[side].join(',')) fail(`foglio: mano ${side} disegnata ${got}, il performer vede ${performerSees[side]}`);
}

function checkTimeline(cfg, label) {
  const tl = buildTimeline(cfg);
  for (let t = 0; t < tl.duration - 1e-9; t += 1) {
    const st = stateAt(tl, t + 0.5);
    const n = st.n, hv = handValues(n);
    // gesto: per ogni persona e mano, quali dita sono su (anatomiche) — dal foglio
    const body = [];
    for (let p = 1; p <= PEOPLE; p++) {
      const L = hv[2 * (p - 1)], R = hv[2 * (p - 1) + 1];
      const hands = {};
      for (const [side, v] of [['left', L], ['right', R]]) {
        const ext = fingersFromValue(v, side, cfg.mapping); // [thumb..pinky] come disegnato
        // 2. il codice stampato sotto la mano si legge come le dita del disegno, da sinistra a destra
        const order = drawnOrder(side, 'palm', mirrorFor(side, 'palm'));
        const read = order.map((f) => ext[F.indexOf(f)]).join('');
        checks++; if (read !== bits5(v)) fail(`${label} t=${t} persona ${p} ${side}: dita lette ${read}, codice stampato ${bits5(v)}`);
        hands[side] = Object.fromEntries(F.map((f, i) => [f, ext[i]]));
      }
      body.push({ p, hands });
    }
    // 3. immagine della camera, da sinistra a destra: persone 6..1; per ognuna mano destra poi sinistra,
    //    dita in ordine specchiato rispetto a come le vede il performer
    const camera = [];
    for (const { p, hands } of [...body].reverse()) {
      for (const side of ['right', 'left']) for (const f of [...performerSees[side]].reverse()) camera.push({ p, side, f, up: hands[side][f] });
    }
    // 4. flip in post → video finale, da sinistra a destra
    const final = [...camera].reverse();
    // 5. il numero letto nel video finale (sx→dx = bit più alto → più basso)
    const read = BigInt('0b' + final.map((o) => o.up).join(''));
    checks++; if (read !== n) fail(`${label} t=${t}: il video finale si legge ${read}, il piano dice ${n}`);
    // 6. persona 1 a sinistra nel video finale, persona 6 a destra
    checks++; if (final[0].p !== 1 || final[59].p !== 6) fail(`${label}: ordine delle persone nel video finale`);
  }
}

// --- 7. animatic (render.js): mano sinistra a sinistra nel finale, disegno dorso, mirror = !leftOnScreen ---
// Nel video finale (immagine flippata) ogni mano appare come la vede il performer.
for (const [side, mirror] of [['left', false], ['right', true]]) {
  const got = drawnOrder(side, 'back', mirror).join(',');
  checks++; if (got !== performerSees[side].join(',')) fail(`animatic: mano ${side} dita ${got}, nel video finale ${performerSees[side]}`);
}
// --- 8. pagina "The row", vista dalla camera (dorsi): destra a sinistra, pollici come li vede la camera ---
for (const side of ['left', 'right']) {
  const got = drawnOrder(side, 'back', mirrorFor(side, 'back')).join(',');
  const cam = [...performerSees[side]].reverse().join(',');
  checks++; if (got !== cam) fail(`The row (camera): mano ${side} disegnata ${got}, la camera vede ${cam}`);
}

checkTimeline({ ...DEFAULT_CFG, video: 1 }, 'video 1');
checkTimeline({ ...DEFAULT_CFG, video: 2 }, 'video 2');
checkTimeline({ ...DEFAULT_CFG, video: 2, mode: 'custom' }, 'video 2 epoche');
console.log(errors ? `${errors} errori su ${checks} controlli` : `tutto corrisponde: ${checks} controlli, 0 errori`);
process.exit(errors ? 1 : 0);
