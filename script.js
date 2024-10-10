document.addEventListener("DOMContentLoaded", function () {
  const filterButtons = document.querySelectorAll(".btn[data-filter]");
  const items = document.querySelectorAll(
    ".artistpage, .designerpage, .digitalpage"
  );

  const artistText = document.querySelectorAll(".artistpart");
  const designerText = document.querySelectorAll(".designerpart");
  const digitalText = document.querySelectorAll(".digitalpart");

  // Function to show all items
  function showAllItems() {
    items.forEach((item) => {
      item.style.display = "block";
    });
    // Reset text colors
    resetTextColors();
  }

  // Function to filter items
  function filterItems(filter) {
    items.forEach((item) => {
      if (item.classList.contains(filter)) {
        item.style.display = "block";
      } else {
        item.style.display = "none";
      }
    });
    // Update text colors based on the active filter
    updateTextColors(filter);
  }

  // Function to reset text colors to default
  function resetTextColors() {
    artistText.forEach((text) => (text.style.color = "black"));
    designerText.forEach((text) => (text.style.color = "black"));
    digitalText.forEach((text) => (text.style.color = "black"));
  }

  // Function to update text colors based on the active filter
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

  // Initial display of all items
  // showAllItems();

  // Activate the artist button and filter items by artistpage on initial load
  const artistButton = document.querySelector(".btn[data-filter='artistpage']");
  artistButton.classList.add("active");
  filterItems("artistpage");

  filterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      // Check if the clicked button is already active
      if (button.classList.contains("active")) {
        // If active, deactivate it and show all items
        button.classList.remove("active");
        button.classList.add("inactive");
        showAllItems();
      } else {
        // Otherwise, remove active class from all buttons and activate the clicked one
        filterButtons.forEach((btn) => {
          btn.classList.remove("active");
          btn.classList.add("inactive");
        });
        button.classList.add("active");
        button.classList.remove("inactive");
        // Filter items based on the clicked button's data-filter attribute
        const filter = button.getAttribute("data-filter");
        filterItems(filter);
      }
    });
  });
});

function hasTouch() {
  return (
    "ontouchstart" in document.documentElement ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
}

if (hasTouch()) {
  // remove all the :hover stylesheets
  try {
    // prevent exception on browsers not supporting DOM styleSheets properly
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

// Stato iniziale (Inglese)
let currentLang = "en";

// Funzione per aggiornare il testo
function updateText() {
  document.getElementById("content").innerHTML = texts[currentLang].content;
  document.getElementById("description").innerHTML =
    texts[currentLang].description;
}

// Gestore per il cambio lingua
document.getElementById("lang-toggle").addEventListener("click", function () {
  currentLang = currentLang === "en" ? "it" : "en";
  document.getElementById("lang-toggle").innerHTML =
    currentLang === "en" ? "ITA" : "ENG";
  updateText();
});
