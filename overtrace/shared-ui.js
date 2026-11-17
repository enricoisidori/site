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
      // Every project that becomes active (in any view) is also the one
      // suggested next time the user opens something.
      await saveRecentProject(context);
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

  /* ------------------------------------------------------------------
   * Unified project open / save helpers
   *
   * A project can be:
   *   - a folder containing a project JSON (any name, "project.json" preferred)
   *     plus an optional assets/ directory;
   *   - a single loose JSON file (any name), with assets embedded or by path.
   * The last project opened or saved is remembered (handle + name) in a
   * dedicated IndexedDB key that is never cleared by "New project", so every
   * view can offer to reopen it and every picker starts from it.
   * ------------------------------------------------------------------ */
  const RECENT_STORE_KEY = "recent-project";
  const PICKER_ID = "overtrace-project";
  const PREFERRED_PROJECT_FILE = "project.json";

  function looksLikeProject(value) {
    return !!value && typeof value === "object" && Array.isArray(value.nodes);
  }

  function hasFsAccess() {
    return "showDirectoryPicker" in window || "showOpenFilePicker" in window;
  }

  async function ensureHandlePermission(handle, mode = "readwrite") {
    if (!handle) return false;
    if (typeof handle.queryPermission !== "function") return true;
    try {
      const opts = { mode };
      if ((await handle.queryPermission(opts)) === "granted") return true;
      if (typeof handle.requestPermission !== "function") return false;
      return (await handle.requestPermission(opts)) === "granted";
    } catch (err) {
      console.warn("Permission request failed", err);
      return false;
    }
  }

  async function readProjectFromFileHandle(fileHandle) {
    const file = await fileHandle.getFile();
    const text = await file.text();
    let project;
    try {
      project = JSON.parse(text);
    } catch (err) {
      const e = new Error(`“${file.name}” is not valid JSON`);
      e.name = "InvalidProjectError";
      throw e;
    }
    if (!looksLikeProject(project)) {
      const e = new Error(`“${file.name}” is not an Overtrace project`);
      e.name = "InvalidProjectError";
      throw e;
    }
    return { file, project };
  }

  // Finds the project JSON inside a folder. Order: the preferred name (e.g. the
  // file used last time), project.json, then any other *.json at the root that
  // contains a project (most recently modified wins).
  async function findProjectFileInDirectory(dirHandle, preferredName = "") {
    const tried = new Set();
    const tryName = async (name) => {
      if (!name || tried.has(name)) return null;
      tried.add(name);
      try {
        const fileHandle = await dirHandle.getFileHandle(name, { create: false });
        const { file, project } = await readProjectFromFileHandle(fileHandle);
        return { fileHandle, file, project };
      } catch (_) {
        return null;
      }
    };
    const direct =
      (await tryName(preferredName)) || (await tryName(PREFERRED_PROJECT_FILE));
    if (direct) return direct;

    const candidates = [];
    if (typeof dirHandle.values === "function") {
      for await (const entry of dirHandle.values()) {
        if (entry.kind !== "file") continue;
        if (!/\.json$/i.test(entry.name) || entry.name.startsWith(".")) continue;
        if (tried.has(entry.name)) continue;
        candidates.push(entry);
      }
    }
    let best = null;
    for (const fileHandle of candidates) {
      try {
        const { file, project } = await readProjectFromFileHandle(fileHandle);
        if (!best || file.lastModified > best.file.lastModified) {
          best = { fileHandle, file, project };
        }
      } catch (_) {
        // Not a project JSON: ignore.
      }
    }
    return best;
  }

  async function directoryIsEmpty(dirHandle) {
    if (typeof dirHandle?.values !== "function") return false;
    for await (const entry of dirHandle.values()) {
      if (entry.name === ".DS_Store") continue;
      return false;
    }
    return true;
  }

  function entryFromParts({ kind, project, file, fileHandle, dirHandle }) {
    const folderName = kind === "folder" ? dirHandle?.name || null : null;
    return {
      kind,
      project,
      file,
      fileHandle,
      dirHandle: kind === "folder" ? dirHandle : null,
      folderName,
      fileName: file?.name || fileHandle?.name || PREFERRED_PROJECT_FILE,
      assetBase: folderName ? `${folderName}/` : "",
    };
  }

  // Opens whatever handle the user picked or dropped: a folder or a JSON file.
  async function openProjectFromHandle(handle, options = {}) {
    if (!handle) return null;
    const mode = options.mode || "readwrite";
    if (handle.kind === "directory") {
      if (options.requestPermission !== false) {
        const ok = await ensureHandlePermission(handle, mode);
        if (!ok) {
          const e = new Error("Permission to the project folder was denied");
          e.name = "NotAllowedError";
          throw e;
        }
      }
      const found = await findProjectFileInDirectory(
        handle,
        options.preferredFileName || "",
      );
      if (!found) {
        const e = new Error(`No project JSON found in “${handle.name}”`);
        e.name = "NotFoundError";
        throw e;
      }
      return entryFromParts({ kind: "folder", ...found, dirHandle: handle });
    }
    if (options.requestPermission !== false) {
      const ok = await ensureHandlePermission(handle, mode);
      if (!ok) {
        const e = new Error("Permission to the project file was denied");
        e.name = "NotAllowedError";
        throw e;
      }
    }
    const { file, project } = await readProjectFromFileHandle(handle);
    return entryFromParts({ kind: "file", project, file, fileHandle: handle });
  }

  async function saveRecentProject(entry) {
    const db = await openFsDb();
    const handle =
      entry?.kind === "folder" ? entry.dirHandle || entry.handle : entry?.fileHandle || entry?.handle;
    if (!db || !handle) return false;
    const payload = {
      version: 1,
      savedAt: Date.now(),
      kind: entry.kind,
      name: entry.kind === "folder" ? handle.name : entry.fileName || handle.name,
      fileName: entry.fileName || (entry.kind === "file" ? handle.name : null),
      handle,
    };
    try {
      const tx = db.transaction(FS_STORE_NAME, "readwrite");
      tx.objectStore(FS_STORE_NAME).put(payload, RECENT_STORE_KEY);
      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return true;
    } catch (err) {
      console.warn("Unable to remember recent project", err);
      return false;
    }
  }

  async function loadRecentProject() {
    const db = await openFsDb();
    if (!db) return null;
    try {
      const tx = db.transaction(FS_STORE_NAME, "readonly");
      const recent = await withRequest(
        tx.objectStore(FS_STORE_NAME).get(RECENT_STORE_KEY),
      );
      if (recent?.handle) return recent;
      // Backward compatibility: before "recent-project" existed, the last
      // project was only stored as the active cross-view context.
      const active = await withRequest(
        db
          .transaction(FS_STORE_NAME, "readonly")
          .objectStore(FS_STORE_NAME)
          .get(FS_STORE_KEY),
      );
      if (!active?.handle) return null;
      return {
        version: 1,
        savedAt: active.savedAt || 0,
        kind: active.kind,
        name:
          active.kind === "folder"
            ? active.folderName || active.handle.name
            : active.fileName || active.handle.name,
        fileName: active.fileName || null,
        handle: active.handle,
      };
    } catch (err) {
      console.warn("Unable to load recent project", err);
      return null;
    }
  }

  async function reopenRecentProject(options = {}) {
    const recent = await loadRecentProject();
    if (!recent) return null;
    return openProjectFromHandle(recent.handle, {
      ...options,
      preferredFileName: recent.kind === "folder" ? recent.fileName : "",
    });
  }

  async function pickerStartIn() {
    const recent = await loadRecentProject();
    return recent?.handle || "documents";
  }

  async function withStartInFallback(fn, startIn) {
    try {
      return await fn(startIn);
    } catch (err) {
      if (err?.name === "AbortError" || startIn === "documents") throw err;
      // A stale handle (moved/deleted folder) cannot be used as startIn.
      return fn("documents");
    }
  }

  async function openProjectFolder(options = {}) {
    if (!("showDirectoryPicker" in window)) {
      throw new Error("Directory picker unsupported");
    }
    const mode = options.mode || "readwrite";
    const startIn = options.startIn || (await pickerStartIn());
    const dirHandle = await withStartInFallback(
      (start) => window.showDirectoryPicker({ id: PICKER_ID, mode, startIn: start }),
      startIn,
    );
    return openProjectFromHandle(dirHandle, { mode, requestPermission: false });
  }

  async function openProjectJsonFile(options = {}) {
    if (!("showOpenFilePicker" in window)) {
      throw new Error("File picker unsupported");
    }
    const startIn = options.startIn || (await pickerStartIn());
    const [fileHandle] = await withStartInFallback(
      (start) =>
        window.showOpenFilePicker({
          id: PICKER_ID,
          startIn: start,
          multiple: false,
          types: [
            {
              description: options.description || "Overtrace project (JSON)",
              accept: { "application/json": [".json"] },
            },
          ],
        }),
      startIn,
    );
    if (!fileHandle) return null;
    return openProjectFromHandle(fileHandle, {
      mode: options.mode || "readwrite",
      requestPermission: options.mode === "read" ? false : undefined,
    });
  }

  // Drag & drop of a folder or a JSON file (any name). Returns an entry (with
  // live handles when the browser supports it) or { kind: "blob", file }.
  async function projectEntryFromDataTransfer(dataTransfer, options = {}) {
    const item = dataTransfer?.items?.[0];
    if (item && typeof item.getAsFileSystemHandle === "function") {
      const handlePromise = item.getAsFileSystemHandle();
      const handle = await handlePromise;
      if (handle) return openProjectFromHandle(handle, options);
    }
    const file = dataTransfer?.files?.[0];
    if (!file) return null;
    const text = await file.text();
    let project;
    try {
      project = JSON.parse(text);
    } catch (_) {
      const e = new Error(`“${file.name}” is not a project JSON (or drop the folder)`);
      e.name = "InvalidProjectError";
      throw e;
    }
    if (!looksLikeProject(project)) {
      const e = new Error(`“${file.name}” is not an Overtrace project`);
      e.name = "InvalidProjectError";
      throw e;
    }
    return {
      kind: "blob",
      project,
      file,
      fileHandle: null,
      dirHandle: null,
      folderName: null,
      fileName: file.name,
      assetBase: "",
    };
  }

  function describeOpenError(err) {
    if (!err) return "Unable to open project";
    if (err.name === "NotFoundError") return err.message || "No project JSON found";
    if (err.name === "NotAllowedError") return "Permission denied — choose the project again";
    if (err.name === "InvalidProjectError") return err.message;
    return "Unable to open project";
  }

  /* ---------- Open menu: reopen last · folder · file ---------- */
  function injectOpenMenuStyle() {
    if (document.getElementById("ot-open-menu-style")) return;
    const style = document.createElement("style");
    style.id = "ot-open-menu-style";
    style.textContent = `
      .ot-open-menu{position:fixed;z-index:10000;min-width:260px;max-width:340px;
        background:#fff;color:#111;border:1px solid rgba(0,0,0,.14);border-radius:10px;
        box-shadow:0 10px 30px rgba(0,0,0,.16);padding:6px;font:13px/1.35 system-ui,-apple-system,sans-serif}
      .ot-open-menu button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;
        border:0;background:transparent;color:inherit;padding:8px 10px;border-radius:7px;cursor:pointer;font:inherit}
      .ot-open-menu button:hover,.ot-open-menu button:focus-visible{background:rgba(0,0,0,.06);outline:none}
      .ot-open-menu .ot-k{margin-left:auto;opacity:.45;font-size:11px;white-space:nowrap}
      .ot-open-menu .ot-sub{display:block;opacity:.55;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ot-open-menu .ot-main{min-width:0;flex:1}
      .ot-open-menu hr{border:0;border-top:1px solid rgba(0,0,0,.08);margin:4px 2px}
      .ot-open-menu .ot-note{padding:6px 10px 4px;opacity:.5;font-size:11px}
      @media (prefers-color-scheme: dark){.ot-open-menu{background:#1d1d1d;color:#eee;border-color:rgba(255,255,255,.14)}
        .ot-open-menu button:hover,.ot-open-menu button:focus-visible{background:rgba(255,255,255,.08)}
        .ot-open-menu hr{border-top-color:rgba(255,255,255,.1)}}`;
    document.head.appendChild(style);
  }

  function closeOpenMenu() {
    const menu = document.querySelector(".ot-open-menu");
    if (menu) {
      menu.__cleanup?.();
      menu.remove();
    }
  }

  // Shows the open menu. onChoice(action) is called synchronously inside the
  // click/keydown gesture with "recent" | "folder" | "file" | "input", so the
  // caller can launch a picker or a permission prompt immediately.
  async function showOpenMenu({ anchor = null, onChoice } = {}) {
    if (document.querySelector(".ot-open-menu")) {
      closeOpenMenu();
      return;
    }
    const recent = await loadRecentProject();
    const canFolder = "showDirectoryPicker" in window;
    const canFile = "showOpenFilePicker" in window;
    if (!recent && !canFolder && !canFile) {
      onChoice?.("input");
      return;
    }
    injectOpenMenuStyle();
    const esc = (s) =>
      String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const when = recent?.savedAt
      ? new Date(recent.savedAt).toLocaleString(undefined, {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
    const menu = document.createElement("div");
    menu.className = "ot-open-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
      ${
        recent
          ? `<button data-act="recent" role="menuitem"><span class="ot-main">Reopen <strong>${esc(
              formatProjectDisplayName(recent.name, recent.name),
            )}</strong><span class="ot-sub">${recent.kind === "folder" ? "Folder" : "File"}${
              recent.kind === "folder" && recent.fileName && recent.fileName !== PREFERRED_PROJECT_FILE
                ? ` · ${esc(recent.fileName)}`
                : ""
            }${when ? ` · ${esc(when)}` : ""}</span></span><span class="ot-k">↵</span></button><hr>`
          : ""
      }
      ${canFolder ? `<button data-act="folder" role="menuitem"><span class="ot-main">Open project folder…</span><span class="ot-k">F</span></button>` : ""}
      ${canFile ? `<button data-act="file" role="menuitem"><span class="ot-main">Open JSON file…</span><span class="ot-k">J</span></button>` : ""}
      ${!canFolder && !canFile ? `<button data-act="input" role="menuitem"><span class="ot-main">Open JSON file…</span><span class="ot-k">J</span></button>` : ""}
      <div class="ot-note">You can also drop a project folder or JSON file on the page.</div>`;
    document.body.appendChild(menu);

    const rect = anchor?.getBoundingClientRect?.();
    const w = menu.offsetWidth;
    const left = rect
      ? Math.max(8, Math.min(rect.left, window.innerWidth - w - 8))
      : Math.max(8, (window.innerWidth - w) / 2);
    const top = rect ? rect.bottom + 6 : Math.max(8, window.innerHeight * 0.2);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    const choose = (act) => {
      closeOpenMenu();
      onChoice?.(act);
    };
    menu.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (btn) choose(btn.dataset.act);
    });
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (k === "escape") {
        e.preventDefault();
        e.stopPropagation();
        closeOpenMenu();
        return;
      }
      if (k === "enter") {
        e.preventDefault();
        e.stopPropagation();
        const focused = document.activeElement?.closest?.(".ot-open-menu button[data-act]");
        choose(
          focused?.dataset.act ||
            (recent ? "recent" : canFolder ? "folder" : canFile ? "file" : "input"),
        );
        return;
      }
      if (k === "arrowdown" || k === "arrowup") {
        e.preventDefault();
        const items = [...menu.querySelectorAll("button[data-act]")];
        const i = items.indexOf(document.activeElement);
        const next = k === "arrowdown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next]?.focus();
        return;
      }
      const map = { f: canFolder && "folder", j: canFile ? "file" : !canFolder && "input", r: recent && "recent" };
      if (map[k] && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        choose(map[k]);
      }
    };
    const onDown = (e) => {
      if (!menu.contains(e.target)) closeOpenMenu();
    };
    window.addEventListener("keydown", onKey, true);
    setTimeout(() => document.addEventListener("pointerdown", onDown, true), 0);
    menu.__cleanup = () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
    menu.querySelector("button")?.focus();
  }

  // Runs one open-menu choice and returns an entry (or null if cancelled).
  // Must be called synchronously from the gesture (onChoice of showOpenMenu).
  async function openProjectByChoice(act, options = {}) {
    if (act === "recent") return reopenRecentProject(options);
    if (act === "folder") return openProjectFolder(options);
    if (act === "file") return openProjectJsonFile(options);
    return null;
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
  NS.closeOpenMenu = closeOpenMenu;
  NS.describeOpenError = describeOpenError;
  NS.directoryIsEmpty = directoryIsEmpty;
  NS.ensureHandlePermission = ensureHandlePermission;
  NS.findProjectFileInDirectory = findProjectFileInDirectory;
  NS.hasFsAccess = hasFsAccess;
  NS.loadRecentProject = loadRecentProject;
  NS.looksLikeProject = looksLikeProject;
  NS.openProjectByChoice = openProjectByChoice;
  NS.openProjectFromHandle = openProjectFromHandle;
  NS.pickerStartIn = pickerStartIn;
  NS.projectEntryFromDataTransfer = projectEntryFromDataTransfer;
  NS.reopenRecentProject = reopenRecentProject;
  NS.saveRecentProject = saveRecentProject;
  NS.showOpenMenu = showOpenMenu;
  NS.PICKER_ID = PICKER_ID;
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
