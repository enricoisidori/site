import * as THREE from "../three.module.js";

const clusters = [
  {
    id: "processo",
    label: "Metodo / processo",
    color: "#2f6fed",
    center: new THREE.Vector3(-3.35, 0.75, -1.15),
    radius: 1.14,
    terms: ["metodo", "ordine", "passaggi", "procedura", "organizzare", "chiaro", "workflow", "processo", "struttura", "priorita"],
  },
  {
    id: "emotivo",
    label: "Tono emotivo",
    color: "#ef4f70",
    center: new THREE.Vector3(2.55, 1.08, -1.58),
    radius: 1.18,
    terms: ["sento", "fiducia", "ansia", "calma", "umano", "ascoltato", "tono", "frustrazione", "empatia", "vicino"],
  },
  {
    id: "critico",
    label: "Critica / rischi",
    color: "#f0a51a",
    center: new THREE.Vector3(-2.28, -1.42, 1.92),
    radius: 1.2,
    terms: ["rischio", "problema", "errore", "non", "dubbi", "privacy", "bias", "limite", "controllo", "trasparenza"],
  },
  {
    id: "creativo",
    label: "Idee laterali",
    color: "#19a16f",
    center: new THREE.Vector3(2.78, -0.82, 1.48),
    radius: 1.12,
    terms: ["idea", "immagino", "nuovo", "visuale", "gioco", "esplorare", "creativo", "metafora", "scena", "forma"],
  },
  {
    id: "dati",
    label: "Dati / evidenze",
    color: "#7b59e6",
    center: new THREE.Vector3(0.18, 2.36, 2.22),
    radius: 1.04,
    terms: ["dato", "dati", "misura", "numero", "evidenza", "grafico", "metriche", "campione", "analisi", "confronto"],
  },
];

const seedAnswers = [
  ["processo", "Vorrei vedere i passaggi ordinati prima della sintesi finale."],
  ["processo", "Mi aiuta quando il metodo e chiaro e posso seguire il ragionamento."],
  ["processo", "La risposta dovrebbe separare priorita, vincoli e prossime azioni."],
  ["processo", "Preferisco una struttura che distingua ipotesi, decisioni e dubbi aperti."],
  ["processo", "Mi serve un workflow breve, non solo una descrizione generale."],
  ["processo", "Vorrei capire quale procedura porta da un dato alla conclusione."],
  ["processo", "La parte piu utile sarebbe una sequenza di passi verificabili."],
  ["emotivo", "Mi sento piu coinvolto quando il tono resta umano e diretto."],
  ["emotivo", "La risposta dovrebbe ridurre ansia e confusione, non aumentarle."],
  ["emotivo", "Mi interessa una voce calma che riconosca il contesto personale."],
  ["emotivo", "Voglio sentirmi ascoltato prima di ricevere una soluzione."],
  ["emotivo", "Il sistema dovrebbe gestire meglio frustrazione e incertezza."],
  ["emotivo", "Un tono piu vicino mi farebbe fidare del risultato."],
  ["emotivo", "Vorrei una risposta meno fredda quando il tema e delicato."],
  ["critico", "Il problema maggiore e capire dove potrebbe esserci un errore."],
  ["critico", "Vorrei piu trasparenza sui limiti e sui rischi della risposta."],
  ["critico", "Non mi basta una soluzione se non vedo anche i dubbi."],
  ["critico", "Mi interessa sapere se i dati possono introdurre bias."],
  ["critico", "La privacy dovrebbe essere chiara prima di aggiungere contenuti."],
  ["critico", "Vorrei un controllo esplicito sulle assunzioni usate dal sistema."],
  ["critico", "Mi serve distinguere sicurezza reale e sicurezza apparente."],
  ["creativo", "Vorrei esplorare idee alternative senza perdere il filo principale."],
  ["creativo", "Mi piacerebbe una forma visuale che faccia emergere nuove connessioni."],
  ["creativo", "Immagino una scena dove ogni risposta apre un percorso laterale."],
  ["creativo", "La cosa piu utile sarebbe trasformare il testo in mappe e metafore."],
  ["creativo", "Vorrei provare varianti creative invece di una sola formulazione."],
  ["creativo", "Il sistema dovrebbe aiutarmi a giocare con ipotesi diverse."],
  ["creativo", "Mi interessa vedere come una nuova idea cambia il paesaggio."],
  ["dati", "Vorrei metriche semplici per confrontare risposte simili."],
  ["dati", "Mi serve vedere il campione di dati da cui nasce il grafico."],
  ["dati", "Una misura di confidenza renderebbe la sintesi piu credibile."],
  ["dati", "Vorrei poter confrontare numeri, esempi e fonti nello stesso spazio."],
  ["dati", "Il grafico dovrebbe mostrare evidenze e non solo impressioni."],
  ["dati", "Mi aiuterebbe un indicatore sul peso di ogni dato."],
  ["dati", "La parte analitica dovrebbe restare leggibile anche con molte risposte."],
];

const clusterById = new Map(clusters.map((cluster) => [cluster.id, cluster]));
const responses = seedAnswers.map(([clusterId, text], index) => makeResponse(text, clusterId, index));
const stage = document.querySelector("#stage");
const canvas = document.querySelector("#embeddingCanvas");
const labelLayer = document.querySelector("#labelLayer");
const answerCount = document.querySelector("#answerCount");
const clusterCount = document.querySelector("#clusterCount");
const resetView = document.querySelector("#resetView");
const responseForm = document.querySelector("#responseForm");
const answerInput = document.querySelector("#answerInput");
const formNote = document.querySelector("#formNote");
const detailSource = document.querySelector("#detailSource");
const detailCluster = document.querySelector("#detailCluster");
const detailText = document.querySelector("#detailText");
const detailCoordinates = document.querySelector("#detailCoordinates");
const detailSimilarity = document.querySelector("#detailSimilarity");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#f7f8f4");

const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
if ("outputColorSpace" in renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pointGeometry = new THREE.SphereGeometry(0.105, 18, 14);
const pointMeshes = [];
const clusterLabels = new Map();
const animatedSpawns = [];

const view = {
  yaw: -0.72,
  pitch: 0.44,
  distance: 8.9,
  target: new THREE.Vector3(0, 0.25, 0),
};

let selectedMesh = null;
let hoverMesh = null;
let dragState = null;

setupScene();
setupClusterLabels();
responses.forEach((response) => addPointMesh(response));
selectPoint(pointMeshes[0]);
updateMetrics();
resizeRenderer();
animate();

responseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = answerInput.value.trim();

  if (!text) {
    formNote.textContent = "Aggiungi una risposta prima di inviarla.";
    answerInput.focus();
    return;
  }

  const response = makeResponse(text, null, responses.length, true);
  responses.push(response);
  const mesh = addPointMesh(response, true);
  updateMetrics();
  selectPoint(mesh);
  answerInput.value = "";
  formNote.textContent = `Aggiunta in: ${clusterById.get(response.clusterId).label}.`;
});

resetView.addEventListener("click", () => {
  view.yaw = -0.72;
  view.pitch = 0.44;
  view.distance = 8.9;
  view.target.set(0, 0.25, 0);
});

canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("wheel", onWheel, { passive: false });
window.addEventListener("resize", resizeRenderer);

function setupScene() {
  const ambient = new THREE.HemisphereLight("#ffffff", "#c8c9bf", 2.4);
  scene.add(ambient);

  const key = new THREE.DirectionalLight("#ffffff", 2.1);
  key.position.set(3, 5, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight("#b9d9ff", 0.8);
  fill.position.set(-4, 2, -3);
  scene.add(fill);

  const grid = new THREE.GridHelper(9, 9, "#bec5c5", "#dfe3df");
  grid.position.y = -2.4;
  scene.add(grid);

  addAxis(new THREE.Vector3(-4.8, 0, 0), new THREE.Vector3(4.8, 0, 0), "#2f6fed");
  addAxis(new THREE.Vector3(0, -2.75, 0), new THREE.Vector3(0, 3.35, 0), "#19a16f");
  addAxis(new THREE.Vector3(0, 0, -4.4), new THREE.Vector3(0, 0, 4.4), "#ef4f70");

  clusters.forEach((cluster) => {
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(cluster.radius, 28, 16),
      new THREE.MeshBasicMaterial({
        color: cluster.color,
        transparent: true,
        opacity: 0.1,
        wireframe: true,
        depthWrite: false,
      }),
    );
    cloud.position.copy(cluster.center);
    scene.add(cloud);
  });

  const selectedMaterial = new THREE.MeshBasicMaterial({
    color: "#202124",
    transparent: true,
    opacity: 0.88,
  });
  const selectedRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.01, 10, 48), selectedMaterial);
  selectedRing.name = "selected-ring";
  selectedRing.visible = false;
  scene.add(selectedRing);
}

function addAxis(start, end, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 });
  scene.add(new THREE.Line(geometry, material));
}

function setupClusterLabels() {
  clusters.forEach((cluster) => {
    const label = document.createElement("div");
    label.className = "cluster-label";
    label.style.setProperty("--cluster-color", cluster.color);
    label.innerHTML = `${cluster.label}<span>0 risposte</span>`;
    labelLayer.appendChild(label);
    clusterLabels.set(cluster.id, label);
  });
  clusterCount.textContent = String(clusters.length);
}

function makeResponse(text, forcedClusterId, index, isUser = false) {
  const assignment = assignCluster(text, forcedClusterId);
  const cluster = clusterById.get(assignment.clusterId);
  const position = positionForText(text, cluster, index, assignment.scores);

  return {
    id: `answer-${index}-${hashString(text).toString(16)}`,
    text,
    clusterId: cluster.id,
    position,
    similarity: assignment.similarity,
    isUser,
  };
}

function assignCluster(text, forcedClusterId) {
  if (forcedClusterId) {
    return { clusterId: forcedClusterId, scores: scoreClusters(text), similarity: 0.82 + hashUnit(text, "forced") * 0.12 };
  }

  const scores = scoreClusters(text);
  const best = scores.reduce((current, next) => (next.score > current.score ? next : current), scores[0]);

  if (best.score <= 0) {
    const index = Math.floor(hashUnit(text, "fallback") * clusters.length) % clusters.length;
    return {
      clusterId: clusters[index].id,
      scores,
      similarity: 0.38 + hashUnit(text, "weak-similarity") * 0.22,
    };
  }

  const second = scores
    .filter((entry) => entry.cluster.id !== best.cluster.id)
    .reduce((current, next) => (next.score > current.score ? next : current), { score: 0 });
  const confidence = Math.min(0.96, 0.54 + (best.score - second.score * 0.35) * 0.13);

  return {
    clusterId: best.cluster.id,
    scores,
    similarity: confidence,
  };
}

function scoreClusters(text) {
  const cleanText = normalizeText(text);
  return clusters.map((cluster) => {
    const score = cluster.terms.reduce((total, term) => {
      if (cleanText.includes(term)) {
        return total + (term.length > 6 ? 1.25 : 1);
      }
      return total;
    }, 0);
    return { cluster, score };
  });
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ");
}

function positionForText(text, cluster, index, scores) {
  const seed = `${cluster.id}-${index}-${text}`;
  const jitter = new THREE.Vector3(
    (hashUnit(seed, "x") - 0.5) * cluster.radius * 1.25,
    (hashUnit(seed, "y") - 0.5) * cluster.radius * 0.92,
    (hashUnit(seed, "z") - 0.5) * cluster.radius * 1.25,
  );
  const position = cluster.center.clone().add(jitter);
  const activeScores = scores.filter((entry) => entry.score > 0 && entry.cluster.id !== cluster.id);

  if (activeScores.length) {
    const pull = activeScores.reduce((vector, entry) => {
      return vector.add(entry.cluster.center.clone().sub(cluster.center).multiplyScalar(Math.min(entry.score, 2.5) * 0.035));
    }, new THREE.Vector3());
    position.add(pull);
  }

  return position;
}

function addPointMesh(response, animateFromCenter = false) {
  const cluster = clusterById.get(response.clusterId);
  const baseColor = new THREE.Color(cluster.color);
  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    emissive: baseColor.clone().multiplyScalar(response.isUser ? 0.32 : 0.18),
    roughness: 0.42,
    metalness: response.isUser ? 0.18 : 0.05,
  });
  const mesh = new THREE.Mesh(pointGeometry, material);
  mesh.userData.response = response;
  mesh.position.copy(response.position);
  mesh.scale.setScalar(response.isUser ? 1.22 : 1);
  scene.add(mesh);
  pointMeshes.push(mesh);

  if (animateFromCenter) {
    const start = new THREE.Vector3(0, -2.9, 0);
    mesh.position.copy(start);
    animatedSpawns.push({
      mesh,
      start,
      end: response.position.clone(),
      startTime: performance.now(),
      duration: 880,
    });
  }

  return mesh;
}

function selectPoint(mesh) {
  selectedMesh = mesh;
  const response = mesh.userData.response;
  const cluster = clusterById.get(response.clusterId);
  const selectedRing = scene.getObjectByName("selected-ring");

  selectedRing.visible = true;
  selectedRing.position.copy(mesh.position);
  selectedRing.material.color.set(cluster.color);

  detailSource.textContent = response.isUser ? "Risposta aggiunta" : "Risposta campione";
  detailCluster.textContent = cluster.label;
  detailText.textContent = `"${response.text}"`;
  detailCoordinates.textContent = `x ${response.position.x.toFixed(2)}, y ${response.position.y.toFixed(2)}, z ${response.position.z.toFixed(2)}`;
  detailSimilarity.textContent = `${Math.round(response.similarity * 100)}%`;
}

function updateMetrics() {
  answerCount.textContent = String(responses.length);

  clusters.forEach((cluster) => {
    const count = responses.filter((response) => response.clusterId === cluster.id).length;
    const label = clusterLabels.get(cluster.id);
    label.querySelector("span").textContent = `${count} risposte`;
  });
}

function onPointerDown(event) {
  stage.classList.add("is-grabbing");
  canvas.setPointerCapture(event.pointerId);
  dragState = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false,
  };
}

function onPointerMove(event) {
  if (dragState && dragState.id === event.pointerId) {
    const dx = event.clientX - dragState.lastX;
    const dy = event.clientY - dragState.lastY;
    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;

    if (Math.abs(event.clientX - dragState.startX) + Math.abs(event.clientY - dragState.startY) > 5) {
      dragState.moved = true;
    }

    view.yaw -= dx * 0.006;
    view.pitch = THREE.MathUtils.clamp(view.pitch - dy * 0.005, -1.08, 1.08);
    return;
  }

  const hit = pickMesh(event.clientX, event.clientY);
  if (hit !== hoverMesh) {
    hoverMesh = hit;
    canvas.style.cursor = hoverMesh ? "pointer" : "grab";
  }
}

function onPointerUp(event) {
  if (!dragState || dragState.id !== event.pointerId) {
    return;
  }

  if (!dragState.moved) {
    const hit = pickMesh(event.clientX, event.clientY);
    if (hit) {
      selectPoint(hit);
    }
  }

  endDrag(event);
}

function endDrag(event) {
  if (dragState) {
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Capture can already be released after a cancelled pointer.
    }
  }
  dragState = null;
  stage.classList.remove("is-grabbing");
}

function onWheel(event) {
  event.preventDefault();
  view.distance = THREE.MathUtils.clamp(view.distance + event.deltaY * 0.006, 5.6, 14.2);
}

function pickMesh(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pointMeshes, false);
  return hits.length ? hits[0].object : null;
}

function resizeRenderer() {
  const width = Math.max(1, stage.clientWidth);
  const height = Math.max(1, stage.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  updateCamera();
  animateSpawns();
  updateHighlights();
  updateLabels();
  renderer.render(scene, camera);
}

function updateCamera() {
  const radius = view.distance;
  const x = Math.cos(view.pitch) * Math.sin(view.yaw) * radius;
  const y = Math.sin(view.pitch) * radius;
  const z = Math.cos(view.pitch) * Math.cos(view.yaw) * radius;
  camera.position.set(x, y, z).add(view.target);
  camera.lookAt(view.target);
}

function animateSpawns() {
  const now = performance.now();

  for (let index = animatedSpawns.length - 1; index >= 0; index -= 1) {
    const spawn = animatedSpawns[index];
    const elapsed = now - spawn.startTime;
    const t = THREE.MathUtils.clamp(elapsed / spawn.duration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    spawn.mesh.position.lerpVectors(spawn.start, spawn.end, eased);

    if (t >= 1) {
      spawn.mesh.position.copy(spawn.end);
      animatedSpawns.splice(index, 1);
    }
  }
}

function updateHighlights() {
  pointMeshes.forEach((mesh) => {
    const response = mesh.userData.response;
    const targetScale = mesh === selectedMesh ? 1.46 : mesh === hoverMesh ? 1.28 : response.isUser ? 1.22 : 1;
    mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.18);
  });

  const selectedRing = scene.getObjectByName("selected-ring");
  if (selectedMesh && selectedRing) {
    selectedRing.position.lerp(selectedMesh.position, 0.32);
    selectedRing.lookAt(camera.position);
  }
}

function updateLabels() {
  const rect = canvas.getBoundingClientRect();

  clusters.forEach((cluster) => {
    const label = clusterLabels.get(cluster.id);
    const position = cluster.center.clone().add(new THREE.Vector3(0, cluster.radius + 0.32, 0));
    position.project(camera);

    const rawX = (position.x * 0.5 + 0.5) * rect.width;
    const rawY = (-position.y * 0.5 + 0.5) * rect.height;
    const labelWidth = label.offsetWidth || 120;
    const labelHeight = label.offsetHeight || 44;
    const x = THREE.MathUtils.clamp(rawX, labelWidth / 2 + 12, rect.width - labelWidth / 2 - 12);
    const y = THREE.MathUtils.clamp(rawY, labelHeight / 2 + 12, rect.height - labelHeight / 2 - 12);
    const visible = position.z < 1 && position.z > -1;
    label.style.opacity = visible ? "1" : "0";
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    label.style.transform = "translate(-50%, -50%)";
  });
}

function hashUnit(value, salt) {
  const hash = hashString(`${value}:${salt}`);
  return (hash % 100000) / 100000;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
