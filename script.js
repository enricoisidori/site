document.addEventListener("DOMContentLoaded", function () {
  const filterButtons = document.querySelectorAll(".btn[data-filter]");
  const items = document.querySelectorAll(
    ".artistpage, .designerpage, .digitalpage"
  );

  document.addEventListener(
    "click",
    function () {
      if (window.location.pathname !== "/specta.html") {
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

  // Retrieve stored filter from localStorage
  const storedFilter = localStorage.getItem("selectedFilter");

  if (storedFilter) {
    // Find the button with the stored filter
    const activeButton = document.querySelector(
      `.btn[data-filter='${storedFilter}']`
    );

    if (activeButton) {
      // Remove active class from all buttons
      filterButtons.forEach((btn) => {
        btn.classList.remove("active");
        btn.classList.add("inactive");
      });

      // Add active class to the stored filter button
      activeButton.classList.add("active");
      activeButton.classList.remove("inactive");

      // Apply the filter
      filterItems(storedFilter);
    }
  } else {
    // Default to designer page if no stored filter
    const designerButton = document.querySelector(
      ".btn[data-filter='designerpage']"
    );
    designerButton.classList.add("active");
    filterItems("designerpage");
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      if (button.classList.contains("active")) {
        // If active, deactivate it and show all items
        button.classList.remove("active");
        button.classList.add("inactive");
        showAllItems();
        // Remove stored filter
        localStorage.removeItem("selectedFilter");
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

document.getElementById("lang-toggle").addEventListener("click", function () {
  currentLang = currentLang === "en" ? "it" : "en";
  document.getElementById("lang-toggle").innerHTML =
    currentLang === "en" ? "ITA" : "ENG";
  updateText();
});
