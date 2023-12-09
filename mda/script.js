// script.js
import * as THREE from "https://cdn.skypack.dev/three@0.133.1/build/three.module.js";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.133.1/examples/jsm/loaders/GLTFLoader.js";

let scene, camera, renderer, cone;

const galleryItems = Array.from(document.querySelectorAll(".gallery-item"));

galleryItems.forEach((item, index) => {
  item.addEventListener("click", () => {
    openModal("mda/" + (index + 1) + ".glb");
  });
});

function openModal(modelUrl, caption) {
  var modal = document.getElementById("myModal");
  var modalContent = document.getElementById("modal-content");
  var modalCaption = document.getElementById("caption");

  modalCaption.innerHTML = caption;
  modal.style.display = "block";

  var viewerContainer = document.getElementById("viewer-container");

  // Rimuovi il modello corrente dalla scena
  if (cone) {
    scene.remove(cone);
    cone = null;
  }

  // Setup Three.js scene
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    viewerContainer.offsetWidth / viewerContainer.offsetHeight,
    0.1,
    1000
  );
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(viewerContainer.offsetWidth, viewerContainer.offsetHeight);
  viewerContainer.appendChild(renderer.domElement);

  // Load GLB model asynchronously
  var loader = new GLTFLoader();
  loader.load(modelUrl, function (gltf) {
    cone = gltf.scene; // Usa il modello direttamente

    // Aggiungi il modello alla scena
    scene.add(cone);

    // Aggiungi luce direzionale per migliorare la visibilità
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(directionalLight);

    // Aumenta la risoluzione del modello
    cone.scale.set(2, 2, 2);

    const light = new THREE.AmbientLight(0x404040, 5); // soft white light
    scene.add(light);

    camera.position.z = 5;

    // Abilita la rotazione del modello al movimento del mouse
    var mouseDown = false,
      mouseX = 0,
      mouseY = 0;

    viewerContainer.addEventListener("mousedown", (event) => {
      mouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    });

    viewerContainer.addEventListener("mouseup", () => {
      mouseDown = false;
    });

    viewerContainer.addEventListener("mousemove", (event) => {
      if (!mouseDown) return;

      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      mouseX = event.clientX;
      mouseY = event.clientY;

      cone.rotation.y += deltaX * 0.01;
      cone.rotation.x += deltaY * 0.01;
    });

    // ...

    // Abilita la rotazione del modello al movimento del mouse e touch su dispositivi mobili
    var mouseDown = false,
      mouseX = 0,
      mouseY = 0;

    viewerContainer.addEventListener("mousedown", handleMouseDown);
    viewerContainer.addEventListener("touchstart", handleTouchStart);

    viewerContainer.addEventListener("mouseup", handleMouseUp);
    viewerContainer.addEventListener("touchend", handleTouchEnd);

    viewerContainer.addEventListener("mousemove", handleMouseMove);
    viewerContainer.addEventListener("touchmove", handleTouchMove);

    function handleMouseDown(event) {
      mouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    }

    function handleTouchStart(event) {
      mouseDown = true;
      mouseX = event.touches[0].clientX;
      mouseY = event.touches[0].clientY;
    }

    function handleMouseUp() {
      mouseDown = false;
    }

    function handleTouchEnd() {
      mouseDown = false;
    }

    function handleMouseMove(event) {
      if (!mouseDown) return;

      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      mouseX = event.clientX;
      mouseY = event.clientY;

      rotateModel(deltaX, deltaY);
    }

    function handleTouchMove(event) {
      if (!mouseDown || event.touches.length !== 1) {
        mouseDown = false;
        return;
      }

      const deltaX = event.touches[0].clientX - mouseX;
      const deltaY = event.touches[0].clientY - mouseY;

      mouseX = event.touches[0].clientX;
      mouseY = event.touches[0].clientY;

      rotateModel(deltaX, deltaY);
    }

    function rotateModel(deltaX, deltaY) {
      cone.rotation.y += deltaX * 0.01;
      cone.rotation.x += deltaY * 0.01;
    }

    // ...

    // Render loop
    var animate = function () {
      if (cone) {
        cone.rotation.y += 0.01;
      }

      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };

    animate();
  });
}

// function closeModal() {
//   var modal = document.getElementById("myModal");
//   modal.style.display = "none";
// }

// Chiudi il modello al clic su desktop
window.addEventListener("click", handleWindowClick);

// Chiudi il modello al tocco su dispositivi mobili
window.addEventListener("touchstart", handleWindowTouch);

function handleWindowClick(event) {
  var modal = document.getElementById("myModal");
  if (event.target == modal) {
    location.reload();
  }
}

function handleWindowTouch(event) {
  var modal = document.getElementById("myModal");
  if (event.target == modal) {
    location.reload();
  }
}

//location.reload();
