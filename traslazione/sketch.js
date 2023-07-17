let clicks = 18;
let maxClicks = 27;
let number = clicks;
let containerSize = window.innerWidth / number; // Dimensione dei container
let maxOffset = containerSize; // Massimo spostamento delle immagini
let columns = 18; // Numero di colonne
let rows = 11; // Numero di righe
let img; // Immagine "opera-1.png"

function preload() {
  img = loadImage("opera-1.png"); // Carica l'immagine prima di avviare il programma
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noSmooth(); // Disabilita l'antialiasing per una migliore qualità dell'immagine ritagliata

  // Ridimensiona l'immagine per adattarla alle dimensioni del container
  img.resize(containerSize * 4, containerSize * 4);
}

function draw() {
  background(220);

  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      let x = i * containerSize; // Calcola la coordinata x del container
      let y = j * containerSize; // Calcola la coordinata y del container

      // Calcola la distanza tra l'immagine e la posizione del mouse
      let distance = dist(
        mouseX,
        mouseY,
        x + containerSize / 2,
        y + containerSize / 2
      );

      // Calcola l'offset proporzionale alla distanza
      let offset = map(distance, 0, width, 0, maxOffset);

      // Calcola l'offset relativo all'immagine basato sulla posizione del mouse
      let xOffset = map(
        mouseX + windowWidth / 2,
        0,
        width,
        -offset + containerSize,
        offset - containerSize
      );
      let yOffset = map(
        mouseY + windowHeight / 2,
        0,
        height,
        -offset + containerSize,
        offset - containerSize
      );
      imageMode(CENTER);
      // Ritaglia l'immagine in base allo spostamento
      let clippedImage = img.get(
        -xOffset,
        -yOffset,
        containerSize,
        containerSize
      );

      // Calcola la posizione centrale del container
      let centerX = x + containerSize / 2;
      let centerY = y + containerSize / 2;

      // Mostra l'immagine ritagliata centrata e dimensionata per coprire il container
      image(clippedImage, centerX, centerY, containerSize, containerSize);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
// Function is called when the user clicks
function mousePressed() {
  // Add 1 to the variable 'clicks'
  clicks++;
  console.log(clicks);

  // Check if the counter reaches the maximum clicks
  if (clicks >= maxClicks) {
    // Reset the counter
    clicks = 18;
  }

  // Aggiorna il numero di colonne e righe
  number = clicks;
  containerSize = window.innerWidth / number;
  columns = number;
  rows = Math.floor(number / 1.63);
}
