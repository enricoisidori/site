const countryFromRecord = record => record.country === "italy" ? "italy" : record.country === "abroad" ? "abroad" : italy.test(record.based) ? "italy" : "abroad";
const splitCommaList = value => String(value || "").split(",").map(item => item.trim()).filter(Boolean);

const refreshCommaSuggestions = key => {
  const list = document.querySelector(`#suggestions-${key}`);
  if (!list) return;
  const values = [...new Set(records.flatMap(record => splitCommaList(record[key])))] .sort();
  list.replaceChildren(...values.map(value => new Option(value)));
};

locations.italy = record => countryFromRecord(record) === "italy";
locations.abroad = record => countryFromRecord(record) === "abroad";

const renderArchiveCards = render;
render = () => {
  const term = search.value.trim().toLowerCase();
  const globalSearch = Boolean(term);
  const shown = records
    .filter(record => (showHidden || !record.hidden) && (globalSearch || !activeCategory || categories[activeCategory](record)) && (globalSearch || !activeLocation || locations[activeLocation](record)) && (globalSearch || !starredOnly || record.starred))
    .filter(record => !term || [record.name, record.entityType, record.field, record.based, record.tags].join(" ").toLowerCase().includes(term));
  grid.replaceChildren();
  if (!shown.length) { grid.innerHTML = '<p class="empty">no records</p>'; return; }
  for (const record of shown) {
    const card = template.content.cloneNode(true);
    card.querySelector("h2").textContent = record.name;
    card.querySelector(".card-tags").textContent = [record.based, record.field].filter(Boolean).join(" | ");
    const links = card.querySelector(".card-links");
    if (record.instagram) { const link = document.createElement("a"); link.href = record.instagram; link.target = "_blank"; link.rel = "noreferrer"; link.textContent = instagramHandle(record.instagram); links.append(link); }
    if (record.website) { const link = document.createElement("a"); link.href = record.website; link.target = "_blank"; link.rel = "noreferrer"; const icon = document.createElement("img"); icon.className = "site-favicon"; icon.src = siteFavicon(record.website); icon.alt = ""; link.append(icon, siteLabel(record.website)); links.append(link); }
    const article = card.querySelector("article");
    renderMedia(card.querySelector(".card-media"), record);
    enableLongPress(article, record);
    grid.append(card);
  }
};

const openEditorWithHide = openEditor;
openEditor = record => {
  openEditorWithHide(record);
  const label = document.createElement("label");
  const input = document.createElement("input");
  const button = document.createElement("button");
  label.textContent = "country";
  input.name = "country";
  input.type = "hidden";
  input.value = countryFromRecord(record);
  button.type = "button";
  button.className = "country-picker";
  button.textContent = input.value;
  button.onclick = () => { input.value = input.value === "italy" ? "abroad" : "italy"; button.textContent = input.value; };
  label.append(input, button);
  const fields = document.querySelector("#form-fields");
  fields.insertBefore(label, fields.children[6]);
  ["field", "based", "tags"].forEach(refreshCommaSuggestions);
  const typeSelect = form.elements.entityType;
  const fieldInput = form.elements.field;
  const fieldLabel = fieldInput.closest("label");
  const updateFieldVisibility = () => {
    const isStudio = typeSelect.value === "Studio";
    fieldLabel.hidden = !isStudio;
    if (!isStudio) fieldInput.value = "";
  };
  typeSelect.addEventListener("change", updateFieldVisibility);
  updateFieldVisibility();
};

form.addEventListener("submit", () => {
  if (form.elements.entityType.value !== "Studio") form.elements.field.value = "";
}, true);

for (const record of base.filter(record => record.entityType === "Agency")) {
  if (!overrides[record.id]) continue;
  overrides[record.id].entityType = "Studio";
  overrides[record.id].field = "art direction";
}
localStorage.setItem("realities-overrides", JSON.stringify(overrides));

let editorPointerStartedInside = false;
editor.addEventListener("pointerdown", event => {
  const bounds = editor.getBoundingClientRect();
  editorPointerStartedInside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
}, true);

editor.addEventListener("click", event => {
  const bounds = editor.getBoundingClientRect();
  const inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
  if (event.target === editor && (inside || editorPointerStartedInside)) event.stopImmediatePropagation();
  editorPointerStartedInside = false;
}, true);

rebuild();
