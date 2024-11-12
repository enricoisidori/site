let img;

function preload() {
  // Carica l'immagine
  img = loadImage("https://picsum.photos/200/300");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
}

let mouseXPos = 600; // Inizializza le variabili con valori iniziali
let mouseYPos = 600;

function draw() {
  background(220);

  // Simula il movimento casuale del mouse

  mouseXPos += random(-100, 100); // Aggiorna la posizione X in modo casuale
  mouseYPos += random(-100, 100); // Aggiorna la posizione Y in modo casuale

  // Limita le posizioni del mouse simulato all'interno del canvas
  mouseXPos = constrain(mouseXPos, 20, width);
  mouseYPos = constrain(mouseYPos, 20, height);

  // Un ciclo annidato che utilizza le coordinate x e y
  for (let y = 0; y < height; y += 50) {
    for (let x = 0; x < width; x += 50) {
      // Calcola la larghezza dell'immagine in base alla posizione del mouse

      let containerWidth = map(mouseX, 0, width, 50, 704);
      let containerHeight = map(mouseY, 0, width, 50, 1408);

      let imgWidth = map(mouseYPos, 0, width, 50, 200);
      let imgHeight = map(mouseXPos, 0, width, 50, 200);
      // Disegna l'immagine con la larghezza calcolata
      image(
        img,
        x,
        y,
        mouseXPos,
        mouseYPos,
        x,
        y,
        containerWidth,
        containerHeight
      );
    }
  }
}

setInterval(function () {
  img = loadImage("https://picsum.photos/200/300");
}, 5000);
