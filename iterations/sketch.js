let img;
let isRuleApplied = false;
let sources = [
  "asset/g1.gif",
  "asset/img-2.jpg",
  "asset/g2.gif",
  "asset/g3.gif",
  "asset/g4.gif",
  "asset/g5.gif",
  "asset/g6.gif",
  "asset/g7.gif",
  "asset/g8.gif",
  "asset/g9.gif",
  "asset/g10.gif",
  "asset/g11.gif",
  "asset/g12.gif",
  "asset/g13.gif",
  "asset/g14.gif",
  "asset/g15.gif",
  "asset/g16.gif",
  "asset/g17.gif",
  "asset/g18.gif",
  "asset/g19.gif",
  "asset/g20.gif",
  "asset/g21.gif",
  "asset/g22.gif",
  "asset/g23.gif",
  "asset/g24.gif",
  "asset/g25.gif",
  "asset/g26.gif",
  "asset/g27.gif",
  "asset/g28.gif",
  "asset/g29.gif",
  "asset/g30.gif",
  "asset/g31.gif",
  "asset/g31.gif",
  "asset/g32.gif",
  "asset/g33.gif",
  "asset/g34.gif",
];

let currentSourceIndex;

function preload() {
  currentSourceIndex = floor(random(sources.length));
  img = loadImage(sources[currentSourceIndex]);
}

let mouseXPos = 0;
let mouseYPos = 0;

let stopMovement = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noCursor();
}

let xOffset = 0.1;
let yOffset = 0.0;
let step = 0.01;

let lastImageChangeTime = 0;
let stopStartTime = 0;

function draw() {
  background(220);

  const sumOfSizes =
    mouseXPos * mouseYPos * (width / mouseXPos) * (height / mouseYPos);
  const perfectlyFitsCanvas = sumOfSizes === width * height;

  if (millis() - lastImageChangeTime >= 5000 && !stopMovement) {
    stopStartTime = millis();
    stopMovement = true;
  }

  if (stopMovement) {
    if (millis() - stopStartTime >= 1000) {
      lastImageChangeTime = millis();
      currentSourceIndex = floor(random(sources.length));
      img = loadImage(sources[currentSourceIndex]);
      stopMovement = false;
    }
  } else {
    xOffset += step;
    yOffset += step;

    if (isRuleApplied) {
      let noiseX = noise(xOffset) * width;
      let noiseY = noise(yOffset) * height;
      mouseXPos = map(noiseX, 0, width, 30, width);
      mouseYPos = map(noiseY, 400, height, 30, height);
    } else {
      let noiseX = noise(xOffset) * 400;
      let noiseY = noise(yOffset) * 400;

      // Check if touch events are available
      if (touches.length > 0) {
        mouseXPos = map(touches[0].x + noiseX, 0, width, 30, width);
        mouseYPos = map(touches[0].y + noiseY, 0, height, 30, height);
      } else {
        mouseXPos = map(mouseX + noiseX, 0, width, 30, width);
        mouseYPos = map(mouseY + noiseY, 0, height, 30, height);
      }
    }
  }

  for (let y = 0; y < height; y += mouseYPos) {
    for (let x = 0; x < width; x += mouseXPos) {
      image(img, x, y, mouseXPos, mouseYPos);
    }
  }

  blendMode(DIFFERENCE);
}

function touchStarted() {
  // Prevent default behavior
  return false;
}

function keyPressed() {
  if (key === "A" || key === "a") {
    isRuleApplied = !isRuleApplied;
    console.log("change");
  }
}

setInterval(function () {
  if (!stopMovement) {
    lastImageChangeTime = millis();
    currentSourceIndex = floor(random(sources.length));
    img = loadImage(sources[currentSourceIndex]);
  }
}, 4000);
