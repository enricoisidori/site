(() => {
  // Neutral mathematical and technical Unicode marks. The current mark stays
  // stable for one browsing session, then changes every five minutes.
  const symbols = ["⟐", "⟑", "⟒", "⟓", "⧈", "⧉", "⧊", "⧖", "⧗", "⌾", "⨳"];
  const sessionKey = "site_favicon_symbol";
  const interval = 5 * 60 * 1000;

  const choose = (previous) => {
    if (symbols.length < 2) return symbols[0];
    let symbol = previous;
    while (symbol === previous) {
      symbol = symbols[Math.floor(Math.random() * symbols.length)];
    }
    return symbol;
  };

  const setIcon = (symbol) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text x="32" y="43" text-anchor="middle" fill="#f00" font-family="Apple Symbols,Arial Unicode MS,Noto Sans Symbols 2,sans-serif" font-size="42">${symbol}</text></svg>`;
    const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    let icon = document.querySelector('link[data-dynamic-favicon]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      icon.type = "image/svg+xml";
      icon.dataset.dynamicFavicon = "true";
      document.head.appendChild(icon);
    }
    icon.href = href;
  };

  let current = sessionStorage.getItem(sessionKey);
  if (!symbols.includes(current)) {
    current = choose();
    sessionStorage.setItem(sessionKey, current);
  }
  setIcon(current);

  window.setInterval(() => {
    current = choose(current);
    sessionStorage.setItem(sessionKey, current);
    setIcon(current);
  }, interval);
})();
