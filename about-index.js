(function () {
  const index = document.querySelector("[data-project-index]");
  const projects = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];
  if (!index || !projects.length) return;

  const yearFor = (project) =>
    Number(String(project.date || "").match(/\b(\d{4})\b/)?.[1]) || 0;
  const orderedProjects = projects.filter((project) => !project.hidden).sort(
    (a, b) => yearFor(b) - yearFor(a) || a.title.localeCompare(b.title),
  );
  const fragment = document.createDocumentFragment();

  fragment.append("Projects", document.createElement("br"));
  orderedProjects.forEach((project) => {
    const link = document.createElement("a");
    const year = yearFor(project);
    const hash = project.slug === "n+" ? project.slug : encodeURIComponent(project.slug);
    link.href = `../work.html#${hash}`;
    link.textContent = `${project.title} ${year || "—"}`;
    fragment.append(link, document.createElement("br"));
  });
  index.replaceChildren(fragment);
})();
