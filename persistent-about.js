(() => {
  if (!new URLSearchParams(location.search).has("persistent-about")) return;
  if (window.parent === window) return;

  document.addEventListener("click", (event) => {
    const alephToggle = event.target.closest("[data-aleph-toggle]");
    if (alephToggle) {
      event.preventDefault();
      window.parent.postMessage(
        { type: "persistent-about:aleph-on" },
        location.origin,
      );
      return;
    }
    const link = event.target.closest('a[href*="work.html"]');
    if (!link || link.target === "_blank") return;
    event.preventDefault();
    window.parent.postMessage(
      { type: "persistent-about:work", href: link.href },
      location.origin,
    );
  });
})();
