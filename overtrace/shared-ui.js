(function initOvertraceUI() {
  const NS = (window.OvertraceUI = window.OvertraceUI || {});
  const FS_DB_NAME = "overtrace-ui";
  const FS_DB_VERSION = 2;
  const FS_STORE_NAME = "project-fs-context";
  const FS_STORE_KEY = "active-project";
  const SHARED_STORE_NAME = "shared-project-state";
  const SHARED_STORE_KEY = "active-project";
  const LEGACY_SHARED_PROJECT_KEY = "overtrace.shared.project.v1";
  const PROJECT_DISPLAY_META = Object.freeze({
    "1_linguistic": {
      id: "1_linguistic",
      index: 1,
      name: "Linguistic",
      displayName: "1. Linguistic",
    },
    "2_media": {
      id: "2_media",
      index: 2,
      name: "Media",
      displayName: "2. Media",
    },
    "3_cognitive": {
      id: "3_cognitive",
      index: 3,
      name: "Cognitive",
      displayName: "3. Cognitive",
    },
    "4_metric": {
      id: "4_metric",
      index: 4,
      name: "Metric",
      displayName: "4. Metric",
    },
    "5_symbolic": {
      id: "5_symbolic",
      index: 5,
      name: "Symbolic",
      displayName: "5. Symbolic",
    },
    "6_cultural": {
      id: "6_cultural",
      index: 6,
      name: "Cultural",
      displayName: "6. Cultural",
    },
    "7_social": {
      id: "7_social",
      index: 7,
      name: "Social",
      displayName: "7. Social",
    },
    "8_bureaucratic": {
      id: "8_bureaucratic",
      index: 8,
      name: "Burocratic",
      displayName: "8. Burocratic",
    },
    "9_ecological": {
      id: "9_ecological",
      index: 9,
      name: "Ecological",
      displayName: "9. Ecological",
    },
    "10_infrastructural": {
      id: "10_infrastructural",
      index: 10,
      name: "Infrastructural",
      displayName: "10. Infrastructural",
    },
  });

  function normalizeProjectKey(value) {
    return String(value || "")
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/project\.json$/i, "")
      .replace(/\.json$/i, "");
  }

  function getProjectDisplayMeta(value) {
    const key = normalizeProjectKey(value);
    if (!key) return null;
    if (PROJECT_DISPLAY_META[key]) return PROJECT_DISPLAY_META[key];
    const fromDisplayName = Object.values(PROJECT_DISPLAY_META).find(
      (entry) => entry.displayName === key,
    );
    if (fromDisplayName) return fromDisplayName;
    const match = key.match(/^(\d+)_([a-z0-9_-]+)$/i);
    if (!match) return null;
    const index = Number(match[1]);
    const name = match[2]
      .split(/[_-]+/)
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
    return {
      id: key,
      index,
      name,
      displayName: `${index}. ${name}`,
    };
  }

  function formatProjectDisplayName(value, fallback = "Project") {
    const meta = getProjectDisplayMeta(value);
    if (meta?.displayName) return meta.displayName;
    const raw = String(value || "").trim();
    return raw || fallback;
  }

  function isMobileAppMode() {
    try {
      return !!window.matchMedia("(max-width: 900px)").matches;
    } catch (_) {
      return window.innerWidth <= 900;
    }
  }

  function resolveToolbar(toolbarOrSelector) {
    if (!toolbarOrSelector) {
      return (
        document.querySelector(".ts-toolbar") || document.querySelector("header")
      );
    }
    if (typeof toolbarOrSelector === "string") {
      return document.querySelector(toolbarOrSelector);
    }
    return toolbarOrSelector;
  }

  function ensureTooltipNode() {
    let tip = document.querySelector(".ts-toolbar-tooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "ts-toolbar-tooltip";
      document.body.appendChild(tip);
    }
    return tip;
  }

  function attachToolbarTooltips(toolbarOrSelector) {
    const toolbar = resolveToolbar(toolbarOrSelector);
    if (!toolbar) return false;

    const tip = ensureTooltipNode();
    const PAD_Y = 6;
    const PAD_X = 8;

    const hide = () => {
      tip.style.display = "none";
    };

    const show = (el) => {
      const text = el.getAttribute("data-tip");
      if (!text) return;
      tip.textContent = text;
      tip.style.display = "block";

      const rect = el.getBoundingClientRect();
      let left = rect.left;
      const top = rect.bottom + PAD_Y;

      tip.style.left = left + "px";
      tip.style.top = top + "px";

      const w = tip.offsetWidth;
      left = Math.max(PAD_X, Math.min(left, window.innerWidth - w - PAD_X));
      tip.style.left = left + "px";
    };

    const targets = toolbar.querySelectorAll("[data-tip]");
    targets.forEach((el) => {
      if (el.__tsTipBound) return;
      el.__tsTipBound = true;
      el.addEventListener("mouseenter", () => show(el));
      el.addEventListener("mouseleave", hide);
      el.addEventListener("blur", hide);
    });

    if (!window.__tsToolbarTipGlobalBound) {
      window.__tsToolbarTipGlobalBound = true;
      window.addEventListener("scroll", hide, { passive: true });
      window.addEventListener("resize", hide);
      document.addEventListener("pointerdown", hide, { passive: true });
    }

    return true;
  }

  function withRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
  }

  function projectNodePayload(rawNode) {
    if (!rawNode || typeof rawNode !== "object") return {};
    if (rawNode.data && typeof rawNode.data === "object") return rawNode.data;
    return rawNode;
  }

  function projectFileEntries(project) {
    const files = [];
    for (const rawNode of Array.isArray(project?.nodes) ? project.nodes : []) {
      const data = projectNodePayload(rawNode);
      const nodeFiles = Array.isArray(data?.files)
        ? data.files
        : Array.isArray(rawNode?.files)
          ? rawNode.files
          : [];
      for (const file of nodeFiles) {
        if (file && typeof file === "object") files.push(file);
      }
    }
    return files;
  }

  function edgeEndpoints(edge) {
    if (!edge || typeof edge !== "object") return { source: null, target: null };
    return {
      source: edge.s ?? edge.source ?? edge.from ?? null,
      target: edge.t ?? edge.target ?? edge.to ?? null,
    };
  }

  function stripTransientProjectData(project) {
    if (!project) return project;
    let clean;
    try {
      clean = structuredClone(project);
    } catch (_) {
      clean = JSON.parse(JSON.stringify(project));
    }
    for (const file of projectFileEntries(clean)) {
      delete file.resolvedUrl;
      delete file._resolvedUrl;
      delete file._resolvedObjectUrl;
    }
    return clean;
  }

  function isUsableAssetUrl(value) {
    return /^(?:data:|blob:|https?:|file:)/i.test(String(value || "").trim());
  }

  function resolveWebAssetUrl(pathValue, assetBase = "") {
    const path = String(pathValue || "").trim();
    if (!path) return "";
    if (isUsableAssetUrl(path)) return path;
    const cleanPath = path.replace(/^\.?\//, "");
    try {
      const baseUrl = new URL(String(assetBase || ""), document.baseURI);
      return new URL(cleanPath, baseUrl).href;
    } catch (_) {
      return `${assetBase || ""}${cleanPath}`;
    }
  }

  async function readFileFromDirectory(dirHandle, pathValue) {
    if (!dirHandle || !pathValue) return null;
    const parts = String(pathValue)
      .replace(/\\/g, "/")
      .replace(/^\.?\//, "")
      .split("/")
      .filter((part) => part && part !== ".");
    if (!parts.length || parts.some((part) => part === "..")) return null;
    let current = dirHandle;
    for (let i = 0; i < parts.length - 1; i += 1) {
      current = await current.getDirectoryHandle(parts[i], { create: false });
    }
    const fileHandle = await current.getFileHandle(parts[parts.length - 1], {
      create: false,
    });
    return fileHandle.getFile();
  }

  function resolveProjectAssetUrl(fileEntry, assetBase = "") {
    if (!fileEntry || typeof fileEntry !== "object") return "";
    const resolved = String(
      fileEntry.resolvedUrl || fileEntry._resolvedUrl || "",
    ).trim();
    if (resolved) return resolved;
    const embedded = String(fileEntry.dataUrl || "").trim();
    if (embedded) return embedded;
    const direct = String(fileEntry.url || "").trim();
    if (isUsableAssetUrl(direct)) return direct;
    const path = String(fileEntry.path || direct || "").trim();
    return path ? resolveWebAssetUrl(path, assetBase) : "";
  }

  async function hydrateProjectAssets(project, options = {}) {
    const files = projectFileEntries(project);
    const dirHandle = options.dirHandle || null;
    const assetBase = String(options.assetBase || "");
    const concurrency = Math.max(1, Math.min(12, Number(options.concurrency) || 6));
    let cursor = 0;

    async function hydrateFile(file) {
      const embedded = String(file.dataUrl || "").trim();
      if (embedded) {
        file.resolvedUrl = embedded;
        return;
      }
      const direct = String(file.url || "").trim();
      if (isUsableAssetUrl(direct) && !direct.startsWith("blob:")) {
        file.resolvedUrl = direct;
        return;
      }
      const path = String(file.path || direct || "").trim();
      if (!path) {
        file.resolvedUrl = "";
        return;
      }
      if (dirHandle) {
        try {
          const diskFile = await readFileFromDirectory(dirHandle, path);
          if (diskFile) {
            const objectUrl = URL.createObjectURL(diskFile);
            file.resolvedUrl = objectUrl;
            file._resolvedObjectUrl = objectUrl;
            return;
          }
        } catch (err) {
          console.warn(`Unable to read project asset "${path}"`, err);
        }
      }
      file.resolvedUrl = resolveWebAssetUrl(path, assetBase);
    }

    async function worker() {
      while (cursor < files.length) {
        const index = cursor++;
        await hydrateFile(files[index]);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, files.length) }, () => worker()),
    );
    return project;
  }

  function releaseProjectAssetUrls(project) {
    for (const file of projectFileEntries(project)) {
      const objectUrl = String(file._resolvedObjectUrl || "");
      if (objectUrl.startsWith("blob:")) URL.revokeObjectURL(objectUrl);
      delete file.resolvedUrl;
      delete file._resolvedUrl;
      delete file._resolvedObjectUrl;
    }
  }

  function openFsDb() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    if (NS.__fsDbPromise) return NS.__fsDbPromise;
    NS.__fsDbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(FS_DB_NAME, FS_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(FS_STORE_NAME)) {
          db.createObjectStore(FS_STORE_NAME);
        }
        if (!db.objectStoreNames.contains(SHARED_STORE_NAME)) {
          db.createObjectStore(SHARED_STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error || new Error("Unable to open IndexedDB"));
    }).catch((err) => {
      console.warn("Unable to initialize FS context store", err);
      NS.__fsDbPromise = null;
      return null;
    });
    return NS.__fsDbPromise;
  }

  async function saveProjectFsContext(context) {
    const db = await openFsDb();
    if (!db || !context?.handle) return false;
    const payload = {
      version: 1,
      savedAt: Date.now(),
      kind: context.kind || null,
      folderName: context.folderName || null,
      assetBase: context.assetBase || "",
      fileName: context.fileName || null,
      handle: context.handle,
    };
    try {
      const tx = db.transaction(FS_STORE_NAME, "readwrite");
      await withRequest(tx.objectStore(FS_STORE_NAME).put(payload, FS_STORE_KEY));
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () =>
          reject(tx.error || new Error("Unable to save FS context"));
        tx.onabort = () =>
          reject(tx.error || new Error("FS context transaction aborted"));
      });
      return true;
    } catch (err) {
      console.warn("Unable to persist FS context", err);
      return false;
    }
  }

  async function loadProjectFsContext() {
    const db = await openFsDb();
    if (!db) return null;
    try {
      const tx = db.transaction(FS_STORE_NAME, "readonly");
      const payload = await withRequest(
        tx.objectStore(FS_STORE_NAME).get(FS_STORE_KEY),
      );
      return payload && payload.handle ? payload : null;
    } catch (err) {
      console.warn("Unable to load FS context", err);
      return null;
    }
  }

  async function clearProjectFsContext() {
    const db = await openFsDb();
    if (!db) return false;
    try {
      const tx = db.transaction(FS_STORE_NAME, "readwrite");
      await withRequest(tx.objectStore(FS_STORE_NAME).delete(FS_STORE_KEY));
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () =>
          reject(tx.error || new Error("Unable to clear FS context"));
        tx.onabort = () =>
          reject(tx.error || new Error("FS context clear aborted"));
      });
      return true;
    } catch (err) {
      console.warn("Unable to clear FS context", err);
      return false;
    }
  }

  async function saveSharedProjectState(payload) {
    if (!payload?.project) return false;
    const db = await openFsDb();
    if (db) {
      try {
        const tx = db.transaction(SHARED_STORE_NAME, "readwrite");
        await withRequest(
          tx.objectStore(SHARED_STORE_NAME).put(payload, SHARED_STORE_KEY),
        );
        await new Promise((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () =>
            reject(tx.error || new Error("Unable to save shared project"));
          tx.onabort = () =>
            reject(tx.error || new Error("Shared project transaction aborted"));
        });
        try {
          const legacyJson = JSON.stringify(payload);
          if (legacyJson.length <= 1_500_000) {
            localStorage.setItem(LEGACY_SHARED_PROJECT_KEY, legacyJson);
          } else {
            localStorage.removeItem(LEGACY_SHARED_PROJECT_KEY);
          }
        } catch (_) {
          // IndexedDB is the primary store; localStorage is compatibility only.
        }
        return true;
      } catch (err) {
        console.warn("Unable to persist shared project in IndexedDB", err);
      }
    }
    try {
      localStorage.setItem(LEGACY_SHARED_PROJECT_KEY, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.warn("Unable to persist shared project", err);
      return false;
    }
  }

  async function loadSharedProjectState() {
    const db = await openFsDb();
    if (db) {
      try {
        const tx = db.transaction(SHARED_STORE_NAME, "readonly");
        const payload = await withRequest(
          tx.objectStore(SHARED_STORE_NAME).get(SHARED_STORE_KEY),
        );
        if (payload?.project) return payload;
      } catch (err) {
        console.warn("Unable to load shared project from IndexedDB", err);
      }
    }
    try {
      const raw = localStorage.getItem(LEGACY_SHARED_PROJECT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn("Unable to load legacy shared project", err);
      return null;
    }
  }

  async function clearSharedProjectState() {
    const db = await openFsDb();
    if (db) {
      try {
        const tx = db.transaction(SHARED_STORE_NAME, "readwrite");
        await withRequest(
          tx.objectStore(SHARED_STORE_NAME).delete(SHARED_STORE_KEY),
        );
      } catch (err) {
        console.warn("Unable to clear shared project", err);
      }
    }
    try {
      localStorage.removeItem(LEGACY_SHARED_PROJECT_KEY);
    } catch (_) {}
    return true;
  }

  async function openProjectFolder(options = {}) {
    if (!("showDirectoryPicker" in window)) {
      throw new Error("Directory picker unsupported");
    }
    const dirHandle = await window.showDirectoryPicker({
      mode: options.mode || "readwrite",
    });
    const fileHandle = await dirHandle.getFileHandle("project.json", {
      create: false,
    });
    const file = await fileHandle.getFile();
    const project = JSON.parse(await file.text());
    const folderName = dirHandle?.name || null;
    return {
      kind: "folder",
      project,
      file,
      fileHandle,
      dirHandle,
      folderName,
      fileName: file.name || "project.json",
      assetBase: folderName ? `${folderName}/` : "",
    };
  }

  async function openProjectJsonFile(options = {}) {
    if (!("showOpenFilePicker" in window)) {
      throw new Error("File picker unsupported");
    }
    const [fileHandle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: options.description || "JSON Project",
          accept: {
            "application/json": [".json"],
          },
        },
      ],
    });
    if (!fileHandle) return null;
    const file = await fileHandle.getFile();
    const project = JSON.parse(await file.text());
    return {
      kind: "file",
      project,
      file,
      fileHandle,
      dirHandle: null,
      folderName: null,
      fileName: file.name || null,
      assetBase: "",
    };
  }

  function buildProjectFsContext(entry) {
    if (!entry) return null;
    if (entry.kind === "folder" && entry.dirHandle) {
      return {
        kind: "folder",
        handle: entry.dirHandle,
        folderName: entry.folderName || entry.dirHandle?.name || null,
        assetBase:
          entry.assetBase ||
          (entry.dirHandle?.name ? `${entry.dirHandle.name}/` : ""),
        fileName: entry.fileName || "project.json",
      };
    }
    if (entry.kind === "file" && entry.fileHandle) {
      return {
        kind: "file",
        handle: entry.fileHandle,
        folderName: null,
        assetBase: "",
        fileName: entry.fileName || entry.fileHandle?.name || null,
      };
    }
    return null;
  }

  NS.attachToolbarTooltips = attachToolbarTooltips;
  NS.buildProjectFsContext = buildProjectFsContext;
  NS.clearProjectFsContext = clearProjectFsContext;
  NS.clearSharedProjectState = clearSharedProjectState;
  NS.edgeEndpoints = edgeEndpoints;
  NS.formatProjectDisplayName = formatProjectDisplayName;
  NS.getProjectDisplayMeta = getProjectDisplayMeta;
  NS.hydrateProjectAssets = hydrateProjectAssets;
  NS.isMobileAppMode = isMobileAppMode;
  NS.loadProjectFsContext = loadProjectFsContext;
  NS.loadSharedProjectState = loadSharedProjectState;
  NS.openProjectFolder = openProjectFolder;
  NS.openProjectJsonFile = openProjectJsonFile;
  NS.projectFileEntries = projectFileEntries;
  NS.projectNodePayload = projectNodePayload;
  NS.readFileFromDirectory = readFileFromDirectory;
  NS.releaseProjectAssetUrls = releaseProjectAssetUrls;
  NS.resolveProjectAssetUrl = resolveProjectAssetUrl;
  NS.saveProjectFsContext = saveProjectFsContext;
  NS.saveSharedProjectState = saveSharedProjectState;
  NS.stripTransientProjectData = stripTransientProjectData;
})();
