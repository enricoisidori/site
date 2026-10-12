export function setupWords(state) {
  const overlay = document.querySelector('#words');
  let enabled = false;
  let lastAnalysis;
  let timers = [];
  function clear() {
    timers.forEach(clearTimeout);
    timers = [];
    overlay.replaceChildren();
  }
  function stop() {
    enabled = false;
    clear();
    overlay.hidden = true;
    document.body.classList.remove('words-mode');
  }
  function update() {
    if (!enabled || !state.analysis || lastAnalysis === state.analysis) return;
    lastAnalysis = state.analysis;
    clear();
    const labels = [...new Set(state.predictions.filter(p => (p.score == null || p.score >= .06)).slice(0, 3)
      .map(p => p.label.split(',')[0]))];
    labels.forEach((label, index) => {
      const line = document.createElement('div');
      line.textContent = label;
      overlay.append(line);
      line.classList.add('visible');
      timers.push(setTimeout(() => line.classList.remove('visible'), 4800 + index * 900));
    });
  }
  document.addEventListener('spiral:info-open', stop);
  document.addEventListener('keydown', event => {
    if (event.code !== 'KeyW' || event.repeat || event.ctrlKey || event.metaKey || event.altKey
      || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (enabled) return stop();
    enabled = true;
    lastAnalysis = null;
    overlay.hidden = false;
    document.querySelector('#info').hidden = true;
    document.body.classList.add('words-mode');
    update();
  });
  setInterval(update, 250);
}
