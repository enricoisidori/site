document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".video-unmute").forEach((wrap) => {
    const video = wrap.querySelector("video");
    const btn = wrap.querySelector(".video-unmute-btn");
    if (!video || !btn) return;

    const sync = () => {
      btn.textContent = video.muted ? "Unmute" : "Mute";
      btn.setAttribute("aria-pressed", String(!video.muted));
    };

    const toggle = () => {
      video.muted = !video.muted;
      if (!video.muted) video.play().catch(() => {});
      sync();
    };

    sync();
    wrap.addEventListener("click", toggle);
  });
});
