(function () {
  try {
    if (sessionStorage.getItem("aleph_white_bg") === "1") return;
    const cachedUrl = localStorage.getItem("aleph_last_url");
    if (!cachedUrl) return;

    const url = new URL(cachedUrl, window.location.href);
    if (!/^https?:$/.test(url.protocol)) return;

    const safeUrl = url.href.replace(/"/g, "%22");
    document.documentElement.style.setProperty(
      "--aleph-cached-bg",
      `url("${safeUrl}")`,
    );
  } catch (_) {}
})();
