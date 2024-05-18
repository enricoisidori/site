document.addEventListener("DOMContentLoaded", function () {
  const filterButtons = document.querySelectorAll(".btn[data-filter]");
  const items = document.querySelectorAll(
    ".artistpage, .designerpage, .digitalpage"
  );
  const aboutButton = document.querySelector("#about");
  const worksButton = document.querySelector("#works");
  const aboutItems = document.querySelectorAll(".aboutpage");

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

  // Function to hide all items
  function hideAllItems() {
    items.forEach((item) => {
      item.style.display = "none";
    });
    aboutItems.forEach((item) => {
      item.style.display = "none";
    });
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

  // Function to show about items
  function showAboutItems() {
    aboutItems.forEach((item) => {
      item.style.display = "block";
    });
  }

  // Function to hide about items
  function hideAboutItems() {
    aboutItems.forEach((item) => {
      item.style.display = "none";
    });
  }

  // Initial display of all items
  showAllItems();

  filterButtons.forEach((button) => {
    button.addEventListener("click", function () {
      // Check if the clicked button is already active
      if (button.classList.contains("active")) {
        // If active, deactivate it and show all items
        button.classList.remove("active");
        showAllItems();
      } else {
        // Otherwise, remove active class from all buttons and activate the clicked one
        filterButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        // Filter items based on the clicked button's data-filter attribute
        const filter = button.getAttribute("data-filter");
        filterItems(filter);
      }
    });
  });

  aboutButton.addEventListener("click", function () {
    hideAllItems();
    showAboutItems();
    aboutButton.classList.add("active");
    worksButton.classList.remove("active");
    aboutButton.style.color = "black";
    worksButton.style.color = "grey";
  });

  worksButton.addEventListener("click", function () {
    hideAboutItems(); // Hide about items when clicking Works
    showAllItems();
    aboutButton.classList.remove("active");
    worksButton.classList.add("active");
    aboutButton.style.color = "grey";
    worksButton.style.color = "black";
  });

  // Initial state for About and Works buttons
  worksButton.classList.add("active");
  worksButton.style.color = "black";
});
