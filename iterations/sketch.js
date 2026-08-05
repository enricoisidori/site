let img;
let isRuleApplied = false;
let sources = [
  "../assets/iterations/g1.gif",
  "../assets/iterations/img-2.jpg",
  "../assets/iterations/g2.gif",
  "../assets/iterations/g3.gif",
  "../assets/iterations/g4.gif",
  "../assets/iterations/g5.gif",
  "../assets/iterations/g6.gif",
  "../assets/iterations/g7.gif",
  "../assets/iterations/g8.gif",
  "../assets/iterations/g9.gif",
  "../assets/iterations/g10.gif",
  "../assets/iterations/g11.gif",
  "../assets/iterations/g12.gif",
  "../assets/iterations/g13.gif",
  "../assets/iterations/g14.gif",
  "../assets/iterations/g15.gif",
  "../assets/iterations/g16.gif",
  "../assets/iterations/g17.gif",
  "../assets/iterations/g18.gif",
  "../assets/iterations/g19.gif",
  "../assets/iterations/g20.gif",
  "../assets/iterations/g21.gif",
  "../assets/iterations/g22.gif",
  "../assets/iterations/g23.gif",
  "../assets/iterations/g24.gif",
  "../assets/iterations/g25.gif",
  "../assets/iterations/g26.gif",
  "../assets/iterations/g27.gif",
  "../assets/iterations/g28.gif",
  "../assets/iterations/g29.gif",
  "../assets/iterations/g30.gif",
  "../assets/iterations/g31.gif",
  "../assets/iterations/g31.gif",
  "../assets/iterations/g32.gif",
  "../assets/iterations/g33.gif",
  "../assets/iterations/g34.gif",
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
      let noiseX = noise(xOffset);
      let noiseY = noise(yOffset);

      // Check if touch events are available
      if (touches.length > 0) {
        mouseXPos = map(touches[0].x + noiseX * 10, 0, width, 30, width);
        mouseYPos = map(touches[0].y + noiseY * 10, 0, height, 30, height);
      } else {
        mouseXPos = map(mouseX + noiseX * 200, 0, width, 30, width);
        mouseYPos = map(mouseY + noiseY + 200, 0, height, 30, height);
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
