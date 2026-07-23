(function () {
  try {
    if (sessionStorage.getItem("aleph_white_bg") === "1") return;
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
