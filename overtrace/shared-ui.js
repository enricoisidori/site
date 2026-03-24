(function initOvertraceUI() {
  const NS = (window.OvertraceUI = window.OvertraceUI || {});
  const FS_DB_NAME = "overtrace-ui";
  const FS_DB_VERSION = 1;
  const FS_STORE_NAME = "project-fs-context";
  const FS_STORE_KEY = "active-project";

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
  NS.loadProjectFsContext = loadProjectFsContext;
  NS.openProjectFolder = openProjectFolder;
  NS.openProjectJsonFile = openProjectJsonFile;
  NS.saveProjectFsContext = saveProjectFsContext;
})();
