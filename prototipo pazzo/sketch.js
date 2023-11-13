let img;
let site;

function preload() {
  // Load the image and site image
  img = loadImage("https://picsum.photos/200/300");
  site = loadImage("1.jpg");
}

let mouseXPos = 0;
let mouseYPos = 0;

let stopMovement = false; // Flag to control movement

function setup() {
  createCanvas(windowWidth, windowHeight);
  noCursor();
}

let xOffset = 0.1;
let yOffset = 0.0;
let step = 0.01;

let lastImageChangeTime = 0; // Variable to track the last image change time
let stopStartTime = 0; // Variable to track when to start stopping movement

function draw() {
  background(220);

  // Check if the sum of sizes fits the canvas perfectly
  const sumOfSizes =
    mouseXPos * mouseYPos * (width / mouseXPos) * (height / mouseYPos);
  const perfectlyFitsCanvas = sumOfSizes === width * height;

  // Check if it's time to stop movement
  if (millis() - lastImageChangeTime >= 5000 && !stopMovement) {
    stopStartTime = millis();
    stopMovement = true;
  }

  if (stopMovement) {
    // Check if it's time to resume movement
    if (millis() - stopStartTime >= 1000) {
      lastImageChangeTime = millis();
      img = loadImage("https://picsum.photos/200/300");
      stopMovement = false;
    }
  } else {
    // Update the Perlin noise values for smoother motion
    xOffset += step;
    yOffset += step;

    // Calculate the noise values for mouseXPos and mouseYPos
    let noiseX = noise(xOffset) * width;
    let noiseY = noise(yOffset) * height;

    // Update the simulated mouse positions using Perlin noise
    mouseXPos = noiseX;
    mouseYPos = noiseY;
  }

  // A nested loop that uses our step values
  for (let y = 0; y < height; y += mouseYPos) {
    for (let x = 0; x < width; x += mouseXPos) {
      // For every x and y, draw the image at the step size
      image(img, x, y, mouseXPos, mouseYPos);
    }
  }

  blendMode(DIFFERENCE);
  // image(site, 0, 0, 1920, 1080);
}

// Reload the image every 5 seconds
setInterval(function () {
  if (!stopMovement) {
    lastImageChangeTime = millis();
    img = loadImage("https://picsum.photos/200/300");
  }
}, 5000);
