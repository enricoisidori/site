document.addEventListener("DOMContentLoaded", function () {
  const filterButtons = document.querySelectorAll(".btn[data-filter]");
  const items = document.querySelectorAll(
    ".artistpage, .designerpage, .digitalpage"
  );
  const isProjectsPage = document.body.classList.contains("projects-page");
  const filterNames = {
    designerpage: "design",
    artistpage: "art",
  };

  function filterFromUrl() {
    if (!isProjectsPage) return null;
    const filterName = new URLSearchParams(window.location.search).get("filter");
    return Object.entries(filterNames).find(([, name]) => name === filterName)?.[0] || null;
  }

  function updateFilterUrl(filter) {
    if (!isProjectsPage) return;
    const url = new URL(window.location.href);
    const filterName = filterNames[filter];

    if (filterName) url.searchParams.set("filter", filterName);
    else url.searchParams.delete("filter");

    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  document.addEventListener(
    "click",
    function () {
      if (!isProjectsPage && window.location.pathname !== "/specta.html") {
        let videos = document.querySelectorAll("video");
        videos.forEach((video) => {
          video.play().catch((error) => {
            console.error("Autoplay prevented:", error);
          });
        });
      }
    },
    { once: true }
  );

  const artistText = document.querySelectorAll(".artistpart");
  const designerText = document.querySelectorAll(".designerpart");
  const digitalText = document.querySelectorAll(".digitalpart");

  function showAllItems() {
    items.forEach((item) => {
      item.style.display = "block";
    });
    resetTextColors();
  }

  function filterItems(filter) {
    items.forEach((item) => {
      if (item.classList.contains(filter)) {
        item.style.display = "block";
      } else {
        item.style.display = "none";
      }
    });
    updateTextColors(filter);
  }

  function resetTextColors() {
    artistText.forEach((text) => (text.style.color = "black"));
    designerText.forEach((text) => (text.style.color = "black"));
    digitalText.forEach((text) => (text.style.color = "black"));
  }

  function updateTextColors(filter) {
    resetTextColors();
    if (filter === "artistpage") {
      designerText.forEach((text) => (text.style.color = "grey"));
      digitalText.forEach((text) => (text.style.color = "grey"));
    } else if (filter === "designerpage") {
      artistText.forEach((text) => (text.style.color = "grey"));
      digitalText.forEach((text) => (text.style.color = "grey"));
    } else if (filter === "digitalpage") {
      artistText.forEach((text) => (text.style.color = "grey"));
      designerText.forEach((text) => (text.style.color = "grey"));
    }
  }

  document
    .querySelectorAll('a[href$="work.html"], a[href$="projects.html"]')
    .forEach((link) => {
      link.addEventListener("click", (event) => {
        localStorage.removeItem("selectedFilter");
        if (!isProjectsPage) return;

        event.preventDefault();
        window.closeProjectDetails?.();
        filterButtons.forEach((button) => {
          button.classList.remove("active", "inactive");
        });
        showAllItems();

        const url = new URL(window.location.href);
        url.searchParams.delete("filter");
        url.hash = "";
        history.replaceState(null, "", `${url.pathname}${url.search}`);
      });
    });

  // Retrieve stored filter from localStorage
  const storedFilter = filterFromUrl() || localStorage.getItem("selectedFilter");

  if (storedFilter) {
    const activeButton = document.querySelector(
      `.btn[data-filter='${storedFilter}']`
    );

    if (activeButton) {
      filterButtons.forEach((btn) => {
        btn.classList.remove("active");
      });
      activeButton.classList.add("active");
      filterItems(storedFilter);
    } else {
      showAllItems();
    }
  } else {
    // Default: nessun filtro attivo, mostra tutto
    filterButtons.forEach((btn) => btn.classList.remove("active"));
    showAllItems();
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      window.closeProjectDetails?.();

      if (button.classList.contains("active")) {
        // If active, deactivate it and show all items
        button.classList.remove("active");
        button.classList.add("inactive");
        showAllItems();
        // Remove stored filter
        localStorage.removeItem("selectedFilter");
        updateFilterUrl(null);
      } else {
        // Remove active class from all buttons and activate the clicked one
        filterButtons.forEach((btn) => {
          btn.classList.remove("active");
          btn.classList.add("inactive");
        });
        button.classList.add("active");
        button.classList.remove("inactive");

        // Get filter and apply it
        const filter = button.getAttribute("data-filter");
        filterItems(filter);

        // Store the selected filter in localStorage
        localStorage.setItem("selectedFilter", filter);
        updateFilterUrl(filter);
      }
    });
  });
});

// Existing touch and language toggle code remains the same
function hasTouch() {
  return (
    "ontouchstart" in document.documentElement ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
}

if (hasTouch()) {
  try {
    for (var si in document.styleSheets) {
      var styleSheet = document.styleSheets[si];
      if (!styleSheet.rules) continue;

      for (var ri = styleSheet.rules.length - 1; ri >= 0; ri--) {
        if (!styleSheet.rules[ri].selectorText) continue;

        if (styleSheet.rules[ri].selectorText.match(":hover")) {
          styleSheet.deleteRule(ri);
        }
      }
    }
  } catch (ex) {}
}

// Language toggle code
let currentLang = "en";

function updateText() {
  document.getElementById("content").innerHTML = texts[currentLang].content;
  document.getElementById("description").innerHTML =
    texts[currentLang].description;
}

const langToggle = document.getElementById("lang-toggle");
if (langToggle) {
  langToggle.addEventListener("click", function () {
    currentLang = currentLang === "en" ? "it" : "en";
    langToggle.innerHTML = currentLang === "en" ? "ITA" : "ENG";
    updateText();
  });
}
