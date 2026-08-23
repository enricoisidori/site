const saveFeedback = document.querySelector("#save-feedback");
let saveFeedbackTimer;

const matchFavouriteToHide = () => {
  document.querySelectorAll(".star-picker").forEach(button => button.classList.add("hide-picker"));
};

new MutationObserver(matchFavouriteToHide).observe(document.querySelector("#form-fields"), { childList: true, subtree: true });

document.addEventListener("keydown", event => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
  window.clearTimeout(saveFeedbackTimer);
  saveFeedback.classList.add("visible");
  saveFeedbackTimer = window.setTimeout(() => saveFeedback.classList.remove("visible"), 1000);
});
