(function () {
  try {
    const isControlledPage = /\/(?:work|about)\.html$/.test(
      window.location.pathname,
    );
    const navigation = performance.getEntriesByType("navigation")[0];
    const isReload =
      navigation?.type === "reload" || performance.navigation?.type === 1;
    if (isControlledPage && isReload) {
      // Work/About share a state while navigating, but an explicit refresh
      // always begins again from ON.
      sessionStorage.removeItem("aleph_control_state");
      return;
    }
    if (isControlledPage) {
      const saved = JSON.parse(
        sessionStorage.getItem("aleph_control_state") || "null",
      );
      if (saved?.backgroundOn === false) return;
    } else if (sessionStorage.getItem("aleph_white_bg") === "1") {
      return;
    }
    const cachedUrl =
      sessionStorage.getItem("aleph_transition_bg") ||
      localStorage.getItem("aleph_last_url");
    if (!cachedUrl) return;

    const url = new URL(cachedUrl, window.location.href);
    const isRemoteImage = /^https?:$/.test(url.protocol);
    const isTransitionFrame =
      url.protocol === "data:" && cachedUrl.startsWith("data:image/jpeg;base64,");
    if (!isRemoteImage && !isTransitionFrame) return;

    const safeUrl = url.href.replace(/"/g, "%22");
    document.documentElement.style.setProperty(
      "--aleph-cached-bg",
      `url("${safeUrl}")`,
    );
  } catch (_) {}
})();
