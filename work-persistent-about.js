(() => {
  if (!document.body.classList.contains("projects-page")) return;

  const aboutLink = document.querySelector(
    '.projects-navigation .page-link[href="about.html"]',
  );
  if (!aboutLink) return;

  let aboutFrame = null;

  function isWorkUrl(url) {
    return /\/(?:work|projects)\.html$/.test(url.pathname);
  }

  function frame() {
    if (aboutFrame) return aboutFrame;
    aboutFrame = document.createElement("iframe");
    aboutFrame.id = "persistent-about-frame";
    aboutFrame.title = "About";
    aboutFrame.src = "about.html?persistent-about=1";
    document.body.appendChild(aboutFrame);
    return aboutFrame;
  }

  function showAbout({ push = false } = {}) {
    frame();
    document.body.classList.add("persistent-about-active");
    if (push) history.pushState({ persistentView: "about" }, "", "about.html");
  }

  function showWork(url = new URL("work.html", location.href), { push = false } = {}) {
    document.body.classList.remove("persistent-about-active");
    if (push) {
      history.pushState(
        { persistentView: "work" },
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
    if (url.hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  aboutLink.addEventListener("click", (event) => {
    event.preventDefault();
    showAbout({ push: true });
  });

  window.addEventListener("popstate", () => {
    if (isWorkUrl(new URL(location.href))) showWork();
    else showAbout();
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin) {
      return;
    }
    if (event.data?.type === "persistent-about:aleph-on") {
      window.dispatchEvent(new Event("aleph:activate"));
      return;
    }
    if (event.data?.type !== "persistent-about:work") return;
    const target = new URL(event.data.href || "work.html", location.href);
    if (!isWorkUrl(target)) return;
    showWork(target, { push: true });
  });

  history.replaceState({ persistentView: "work" }, "", location.href);
})();
