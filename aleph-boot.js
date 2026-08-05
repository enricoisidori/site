(function () {
  try {
    const isControlledPage = /\/(?:work\.html|about(?:\/index\.html)?\/?)$/.test(
      window.location.pathname,
    );
    const configuredStyle = document.documentElement.dataset.alephStyle;
    const storedStyle = sessionStorage.getItem("aleph_style");
    const baseStyle =
      configuredStyle === "base" ||
      (!configuredStyle && storedStyle === "base");
    document.documentElement.dataset.alephStyle = baseStyle ? "base" : "overload";
    if (configuredStyle && storedStyle && configuredStyle !== storedStyle) {
      sessionStorage.removeItem("aleph_control_state");
    }
    const navigation = performance.getEntriesByType("navigation")[0];
    const isReload =
      navigation?.type === "reload" || performance.navigation?.type === 1;
    if (isControlledPage && isReload) {
      // Work/About share a state while navigating, but an explicit refresh
      // always begins again from OFF.
      sessionStorage.removeItem("aleph_control_state");
    }
    if (isControlledPage) {
      const saved = JSON.parse(
        sessionStorage.getItem("aleph_control_state") || "null",
      );
      if (saved?.backgroundOn !== true) return;
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
