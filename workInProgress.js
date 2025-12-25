import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// === ASSET LOADING TRACKER ===
let assetsLoaded = 0;
let totalAssets = 0;
let allAssetsLoaded = false;

// Function to track asset loading
function trackAssetLoading() {
    totalAssets++;
}

function assetLoaded() {
    assetsLoaded++;
    console.log(`Asset loaded: ${assetsLoaded}/${totalAssets}`);
    if (assetsLoaded >= totalAssets && !allAssetsLoaded) {
        allAssetsLoaded = true;
        console.log("All assets loaded, scene is fully rendered");
        triggerIntroDialogue();
    }
}

// === GAME STATE MANAGEMENT ===
let gameState = {
    isPaused: false,
    isGameOver: false,
    initialCameraPosition: new THREE.Vector3(2, 2, 9),
    initialCameraTarget: new THREE.Vector3(0, -2, -10)
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const listener = new THREE.AudioListener();
camera.add(listener);

// First-person camera settings
let thirdPerson = false; // Start in first-person
let mouseX = 0;
let mouseY = 0;
const mouseSensitivity = 0.002;

camera.position.set(0, 1.6, 30); // Start at back of room, eye level

const backgroundMusic = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();

let backgroundMusicReady = false;

trackAssetLoading();
audioLoader.load('sounds/background_music.wav', function(buffer) {
    backgroundMusic.setBuffer(buffer);
    backgroundMusic.setLoop(true);
    backgroundMusic.setVolume(0.5);
    backgroundMusicReady = true;
    assetLoaded();
}, undefined, error => {
    console.error("Error loading background music:", error);
    assetLoaded();
});

// === Scream sound for hell pull ===
const screamSound = new THREE.Audio(listener);
trackAssetLoading();
audioLoader.load('sounds/scream.wav', function(buffer) {
    screamSound.setBuffer(buffer);
    screamSound.setLoop(false);
    screamSound.setVolume(1.0);
    assetLoaded();
}, undefined, error => {
    console.error("Error loading scream sound:", error);
    assetLoaded();
});

// === Sound for demon attacks ===
const demonAttackSound = new THREE.Audio(listener);
trackAssetLoading();
audioLoader.load('sounds/demonAttack.mp3', function(buffer) {
    demonAttackSound.setBuffer(buffer);
    demonAttackSound.setLoop(false);
    demonAttackSound.setVolume(0.8);
    assetLoaded();
}, undefined, error => {
    console.error("Error loading demon attack sound:", error);
    assetLoaded();
});

window.addEventListener('click', () => {
    if (backgroundMusicReady && !backgroundMusic.isPlaying && !gameState.isPaused) {
        backgroundMusic.play();
    }
}, { once: true });

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Request pointer lock on click
renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});

// Mouse controls for camera
document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === renderer.domElement) {
        const proposedMouseX = mouseX - event.movementX * mouseSensitivity;
        const proposedMouseY = mouseY - event.movementY * mouseSensitivity;
        
        // Clamp vertical rotation
        const clampedMouseY = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, proposedMouseY));
        
        mouseX = proposedMouseX;
        mouseY = clampedMouseY;
    }
});

// Exit pointer lock with ESC
document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && !gameState.isPaused) {
        pauseGame();
    }
});

// === GAME CONTROL UI (HIDDEN BY DEFAULT) ===
function createGameControlsUI() {
    const pauseMenu = document.createElement('div');
    pauseMenu.id = 'pauseMenu';
    pauseMenu.style.cssText = `
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.9);
        padding: 30px;
        border-radius: 10px;
        z-index: 10000;
        text-align: center;
    `;
    pauseMenu.innerHTML = `
        <h2 style="color: white; margin-bottom: 20px;">Game Paused</h2>
        <button id="resumeBtn" style="display: block; width: 200px; margin: 10px auto; padding: 10px; font-size: 16px; cursor: pointer;">Resume</button>
        <button id="restartBtnPause" style="display: block; width: 200px; margin: 10px auto; padding: 10px; font-size: 16px; cursor: pointer;">Restart</button>
        <button id="quitBtn" style="display: block; width: 200px; margin: 10px auto; padding: 10px; font-size: 16px; cursor: pointer;">Quit to Menu</button>
    `;
    document.body.appendChild(pauseMenu);
    
    document.getElementById('resumeBtn').addEventListener('click', resumeGame);
    document.getElementById('restartBtnPause').addEventListener('click', restartGame);
    document.getElementById('quitBtn').addEventListener('click', () => {
        window.location.href = 'level-select.html';
    });
}
// === GAME CONTROL FUNCTIONS ===
function pauseGame() {
    if (gameState.isGameOver) return;
    
    gameState.isPaused = true;
    
    // Pause audio
    if (backgroundMusic.isPlaying) {
        backgroundMusic.pause();
    }
    
    // Show pause menu
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) {
        pauseMenu.style.display = 'block';
    }
}

function resumeGame() {
    gameState.isPaused = false;
    
    // Resume audio
    if (backgroundMusicReady && !backgroundMusic.isPlaying) {
        backgroundMusic.play();
    }
    
    // Hide pause menu
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) {
        pauseMenu.style.display = 'none';
    }
    
    // Re-request pointer lock
    renderer.domElement.requestPointerLock();
}


function showGameControls() {
    const controls = document.getElementById('gameControls');
    if (controls) {
        controls.style.display = 'flex';
    }
}

function hideGameControls() {
    const controls = document.getElementById('gameControls');
    if (controls) {
        controls.style.display = 'none';
    }
}

function restartGame() {
    // Reset game state
    gameState.isPaused = false;
    gameState.isGameOver = false;
    
    // Reset camera position
    camera.position.set(0, 1.6, 30);
    mouseX = 0;
    mouseY = 0;
    
    // Reset game variables
    riddleActive = false;
    pullingToHell = false;
    pullStart = 0;
    introDialogueShown = false;
    approachDialogueShown = false;
    
    // Reset audio
    if (backgroundMusic.isPlaying) {
        backgroundMusic.stop();
    }
    if (screamSound.isPlaying) {
        screamSound.stop();
    }
    if (demonAttackSound.isPlaying) {
        demonAttackSound.stop();
    }
    
    // Reset demons
    demonStatues.forEach(demon => {
        demon.userData.active = false;
        demon.userData.health = 3;
        demon.userData.attacksDone = 0;
        demon.userData.lastAttackAt = 0;
        
        // Reset visual state
        demon.traverse(n => {
            if (n.isMesh && n.userData._tintSaved) {
                n.material.color.copy(n.userData._tintSaved);
                if (n.material.emissive !== undefined) {
                    n.material.emissive.setHex(0x000000);
                }
            }
        });
        
        // Make sure demon is back in scene if it was removed
        if (!scene.children.includes(demon)) {
            scene.add(demon);
        }
    });
    
    // Reset door
    if (doorMesh) {
        doorMesh.position.set(0, -3, 40);
        doorMesh.userData.opening = false;
    }
    
    // Reset pentagram
    if (typeof circle !== 'undefined') {
        circle.scale.set(1, 1, 1);
        circle.material.color.set(0xff0000);
        circle.userData.pulsing = false;
    }
    
    // Remove any game over or pause overlays
    const pauseMenu = document.getElementById('pauseMenu');
    if (pauseMenu) {
        pauseMenu.style.display = 'none';
    }
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    if (gameOverOverlay) {
        gameOverOverlay.remove();
    }
    const hellOverlay = document.getElementById('hellOverlay');
    if (hellOverlay) {
        hellOverlay.remove();
    }
    
    // Restart background music after a delay
    setTimeout(() => {
        if (backgroundMusicReady) {
            backgroundMusic.play();
        }
    }, 1000);
    
    showFloatingText2("Game Restarted", 2000, "instruction");
    
    // Re-trigger intro dialogue
    setTimeout(() => {
        introDialogueShown = false;
        triggerIntroDialogue();
    }, 2500);
}

function quitGame() {
    if (confirm("Are you sure you want to quit the game?")) {
        // Stop all audio
        if (backgroundMusic.isPlaying) {
            backgroundMusic.stop();
        }
        if (screamSound.isPlaying) {
            screamSound.stop();
        }
        if (demonAttackSound.isPlaying) {
            demonAttackSound.stop();
        }
        
        // Show quit message
        showFloatingText2("Thanks for playing!", 3000, "instruction");
        
        // Show quit overlay
        setTimeout(() => {
            const quitOverlay = document.createElement('div');
            quitOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                font-family: Arial, sans-serif;
                text-align: center;
            `;
            quitOverlay.innerHTML = `
                <h1 style="color: #ff6b6b; font-size: 3em; margin-bottom: 20px;">Game Ended</h1>
                <p style="font-size: 1.5em; margin-bottom: 30px;">Thanks for playing!</p>
                <button id="playAgainBtn" style="
                    padding: 15px 30px;
                    font-size: 1.2em;
                    background: linear-gradient(135deg, #74b9ff, #0984e3);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                ">Play Again</button>
            `;
            document.body.appendChild(quitOverlay);
            
            // Add event listener for play again button
            setTimeout(() => {
                const playAgainBtn = document.getElementById('playAgainBtn');
                if (playAgainBtn) {
                    playAgainBtn.addEventListener('click', () => {
                        location.reload();
                    });
                    // Add hover effect
                    playAgainBtn.addEventListener('mouseenter', function() {
                        this.style.transform = 'scale(1.05)';
                        this.style.boxShadow = '0 6px 20px rgba(255, 255, 255, 0.3)';
                    });
                    playAgainBtn.addEventListener('mouseleave', function() {
                        this.style.transform = 'scale(1)';
                        this.style.boxShadow = 'none';
                    });
                }
            }, 100);
        }, 2000);
    }
}

function showPauseOverlay() {
    let overlay = document.getElementById('pauseOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'pauseOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            font-family: 'Courier New', monospace;
            font-size: 3em;
            font-weight: bold;
            text-shadow: 0 0 10px rgba(255, 0, 0, 0.8);
        `;
        overlay.textContent = 'PAUSED';
        document.body.appendChild(overlay);
    } else {
        overlay.style.display = 'flex';
    }
}

function hidePauseOverlay() {
    const overlay = document.getElementById('pauseOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// === KEYBOARD SHORTCUTS ===
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'p') {
        event.preventDefault();
        if (gameState.isPaused) {
            resumeGame();
        } else if (!gameState.isGameOver) {
            pauseGame();
        }
    }
    
    if (event.key === 'r' && event.ctrlKey) {
        event.preventDefault();
        restartGame();
    }
});

// Create the UI when the script loads (but keep it hidden)
createGameControlsUI();

// === MINIMAP SETUP ===
const minimapCanvas = document.createElement('canvas');
minimapCanvas.id = 'minimap';
minimapCanvas.style.cssText = `
    position: fixed;
    bottom: 12px;
    right: 12px;
    width: 200px;
    height: 200px;
    border: 2px solid rgba(255, 255, 255, 0.5);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.35);
    z-index: 1000;
    pointer-events: none;
`;
document.body.appendChild(minimapCanvas);

const minimapCtx = minimapCanvas.getContext('2d');
minimapCanvas.width = 200;
minimapCanvas.height = 200;

// Store objects for minimap rendering
const minimapObjects = [];

function drawMinimap() {
    if (gameState.isPaused) return;
    
    const ctx = minimapCtx;
    const scale = 0.08;
    const centerX = minimapCanvas.width / 2;
    const centerY = minimapCanvas.height / 2;
    
    // Clear canvas
    ctx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    // Draw room bounds
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        centerX - (60 / 2) / scale,
        centerY - (120 / 2) / scale,
        60 / scale,
        120 / scale
    );
    
    // Draw furniture as small rectangles
    ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
    minimapObjects.forEach(item => {
        if (item.position && item.geometry) {
            const box = new THREE.Box3().setFromObject(item);
            const itemWidth = (box.max.x - box.min.x) / scale;
            const itemDepth = (box.max.z - box.min.z) / scale;
            const itemX = centerX + (item.position.x - camera.position.x) / scale - itemWidth / 2;
            const itemZ = centerY + (item.position.z - camera.position.z) / scale - itemDepth / 2;
            
            ctx.fillRect(itemX, itemZ, itemWidth, itemDepth);
        }
    });
    
    // Draw pentagram
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    const pentagramX = centerX + (0 - camera.position.x) / scale;
    const pentagramZ = centerY + (-10 - camera.position.z) / scale;
    ctx.fillRect(pentagramX - 3, pentagramZ - 3, 6, 6);
    
    // Draw throne
    ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
    const throneX = centerX + (0 - camera.position.x) / scale;
    const throneZ = centerY + (-40 - camera.position.z) / scale;
    ctx.fillRect(throneX - 4, throneZ - 4, 8, 8);
    
    // Draw door
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    const doorX = centerX + (0 - camera.position.x) / scale;
    const doorZ = centerY + (40 - camera.position.z) / scale;
    ctx.fillRect(doorX - 2, doorZ - 2, 4, 8);
    
    // Draw demon statues
    ctx.fillStyle = 'rgba(139, 0, 0, 0.8)';
    demonStatues.forEach(demon => {
        if (demon.position) {
            const demonX = centerX + (demon.position.x - camera.position.x) / scale;
            const demonZ = centerY + (demon.position.z - camera.position.z) / scale;
            ctx.fillRect(demonX - 2, demonZ - 2, 4, 4);
        }
    });
    
    // Draw player as triangle (ALWAYS FACING UP)
    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    ctx.save();
    ctx.translate(centerX, centerY);
    
    // Remove camera rotation - triangle always faces up (north)
    // No rotation applied - triangle points upward by default
    
    ctx.beginPath();
    ctx.moveTo(0, -8);    // Top point
    ctx.lineTo(-5, 5);    // Bottom left
    ctx.lineTo(5, 5);     // Bottom right
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    
    // Draw cardinal directions
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', centerX, 15);
    ctx.fillText('S', centerX, minimapCanvas.height - 5);
    ctx.fillText('W', 10, centerY + 4);
    ctx.fillText('E', minimapCanvas.width - 10, centerY + 4);
}

// === LIGHTS ===
const ambientLight = new THREE.AmbientLight(0xff1111, 0.6);
scene.add(ambientLight);

const redLight = new THREE.PointLight(0xff0000, 3.5, 150);
redLight.position.set(0, 5, -10);
redLight.castShadow = true;
scene.add(redLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.3);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// === FLOOR & CEILING ===
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 120),
  new THREE.MeshStandardMaterial({ color: 0x220000 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -3;
floor.receiveShadow = true;
scene.add(floor);
minimapObjects.push(floor);

const ceiling = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 100),
  new THREE.MeshStandardMaterial({ color: 0x111111 })
);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = 14;
ceiling.position.z = -10;
scene.add(ceiling);
minimapObjects.push(ceiling);

// === WALLS ===
const textureLoader = new THREE.TextureLoader();
const wallMaterial = new THREE.MeshStandardMaterial({
  map: textureLoader.load('models/textures/dungeon-stone1-albedo2.png'),
  normalMap: textureLoader.load('models/textures/dungeon-stone1-normal.png'),
  roughnessMap: textureLoader.load('models/textures/dungeon-stone1-roughness.png'),
  displacementMap: textureLoader.load('models/textures/dungeon-stone1-height.png'),
  displacementScale: 0.2
});

const wallWidth = 60, wallHeightValue = 20, wallDepth = 100;

const backWall = new THREE.Mesh(new THREE.PlaneGeometry(wallWidth, wallHeightValue), wallMaterial);
backWall.position.set(0, 4, -wallDepth/2);
scene.add(backWall);
minimapObjects.push(backWall);

const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(wallWidth, wallHeightValue), wallMaterial);
frontWall.position.set(0, 4, wallDepth/2 -10);
frontWall.rotation.y = Math.PI;
scene.add(frontWall);
minimapObjects.push(frontWall);

const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(wallDepth, wallHeightValue), wallMaterial);
leftWall.position.set(-wallWidth/2, 4, 0);
leftWall.rotation.y = Math.PI/2;
scene.add(leftWall);
minimapObjects.push(leftWall);

const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(wallDepth, wallHeightValue), wallMaterial);
rightWall.position.set(wallWidth/2, 4, 0);
rightWall.rotation.y = -Math.PI/2;
scene.add(rightWall);
minimapObjects.push(rightWall);

// === PENTAGRAM & CIRCLE ===
const pentagramGeometry = new THREE.BufferGeometry();
const pentagonRadius = 4;
const pentagonPoints = [];
for (let i = 0; i < 5; i++) {
  const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
  pentagonPoints.push(new THREE.Vector3(
    Math.cos(angle) * pentagonRadius,
    -2.99,
    Math.sin(angle) * pentagonRadius -10
  ));
}
const starIndices = [0,2,4,1,3,0];
const starVerts = [];
starIndices.forEach(i => starVerts.push(pentagonPoints[i].x, pentagonPoints[i].y, pentagonPoints[i].z));
pentagramGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starVerts, 3));
const pentagramLine = new THREE.Line(pentagramGeometry, new THREE.LineBasicMaterial({ color: 0xff0000 }));
scene.add(pentagramLine);
minimapObjects.push(pentagramLine);

const circle = new THREE.Mesh(
  new THREE.RingGeometry(pentagonRadius * 0.95, pentagonRadius * 1.05, 64),
  new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide })
);
circle.rotation.x = -Math.PI/2;
circle.position.set(0, -2.99, -10);
scene.add(circle);
minimapObjects.push(circle);

// === PENTAGRAM CANDLES ===
pentagonPoints.forEach(point => {
  const candle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.5, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffaa })
  );
  candle.position.set(point.x, point.y + 0.25, point.z);
  scene.add(candle);
  minimapObjects.push(candle);

  const flame = new THREE.PointLight(0xffaa33, 1.2, 7);
  flame.position.set(point.x, point.y + 0.5, point.z);
  scene.add(flame);
});

// === GLTF LOADER ===
const loader = new GLTFLoader();

// ensure doorMesh exists before functions use it
let doorMesh = null;
let playerModel = null;

// Load player model
trackAssetLoading();
let playerModelRoot = null;
let mixer = null;
let walkAction = null;
let idleAction = null;
let currentAction = null;

loader.load("models/maybeModel_LivingRoom4.glb", gltf => {
  playerModel = gltf.scene;
  
  // Find the metarig or main body
  let model = playerModel.getObjectByName('metarig') || playerModel;
  
  // Scale and position
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  
  const targetHeight = 1.8;
  if (size.y > 0) {
    const scaleFactor = targetHeight / size.y;
    model.scale.setScalar(scaleFactor);
  }
  
  // Center model
  box.setFromObject(model);
  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.sub(center);
  model.position.y += size.y / 2;
  
  // Setup shadows
  model.traverse(n => { 
    if(n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
      n.visible = true;
    }
  });
  
  // Position at camera location but hide in first-person
  model.position.copy(camera.position);
  model.position.y = -3; // Ground level
  playerModelRoot = model;
  playerModelRoot.visible = thirdPerson; // Hide in first-person
  
  scene.add(playerModel);
  minimapObjects.push(playerModel);
  
  // Setup animations
  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    
    const findClip = (names) => {
      const clips = gltf.animations;
      const lc = clips.map(c => ({ c, n: (c.name || '').toLowerCase() }));
      for (const desired of names) {
        const d = desired.toLowerCase();
        let hit = lc.find(x => x.n === d);
        if (hit) return hit.c;
        hit = lc.find(x => x.n.includes(d));
        if (hit) return hit.c;
      }
      return null;
    };
    
    const idleClip = findClip(['idle_anim', 'idle']);
    const walkClip = findClip(['DefWalking', 'walking', 'walk']);
    
    if (idleClip) {
      idleAction = mixer.clipAction(idleClip);
      idleAction.setLoop(THREE.LoopRepeat, Infinity);
      idleAction.play();
      currentAction = idleAction;
    }
    
    if (walkClip) {
      walkAction = mixer.clipAction(walkClip);
      walkAction.setLoop(THREE.LoopRepeat, Infinity);
    }
  }
  
  console.log("Player model loaded successfully");
  assetLoaded();
}, undefined, error => {
  console.error("Error loading player model:", error);
  assetLoaded();
});

// Skull throne
trackAssetLoading();
loader.load("models/scene.gltf", gltf => {
  const model = gltf.scene;
  model.position.set(0, -0.5, -40);
  model.scale.set(5,5,5);
  model.rotation.y = 3*Math.PI/2;
  model.traverse(n => { if(n.isMesh) n.castShadow = true; });
  scene.add(model);
  minimapObjects.push(model);
  assetLoaded();
}, undefined, error => {
  console.error("Error loading throne:", error);
  assetLoaded();
});

// Door
trackAssetLoading();
loader.load("models/door.gltf", gltf => {
  doorMesh = gltf.scene;
  doorMesh.position.set(0, -3, 40);
  doorMesh.scale.set(5, 5, 5);
  doorMesh.rotation.y = Math.PI / 2;
  doorMesh.traverse(n => { if (n.isMesh) n.castShadow = true; });
  doorMesh.userData = doorMesh.userData || {};
  scene.add(doorMesh);
  minimapObjects.push(doorMesh);
  assetLoaded();
}, undefined, error => {
  console.error("Error loading door:", error);
  assetLoaded();
});

// Demon sculptures
const demonStatues = [];

trackAssetLoading();
loader.load("models/scene (2).gltf", gltf => {
  const base = gltf.scene;
  const makeDemon = (x, y, z, rotationY = 0, scale = 3) => {
    const demon = base.clone();
    demon.position.set(x, y, z);
    demon.scale.set(scale, scale, scale);
    demon.rotation.y = rotationY;
    demon.userData = {
      isStatue: true,
      active: false,
      health: 3,
      speed: 6,
      baseY: y,
      attacksDone: 0,
      lastAttackAt: 0,
      attackCooldown: 900
    };
    demon.traverse(n => {
      if (n.isMesh) {
        n.castShadow = true;
        n.userData = n.userData || {};
        n.userData.parentDemon = demon;
        if (n.material) n.material = n.material.clone();
      }
    });
    scene.add(demon);
    demonStatues.push(demon);
    minimapObjects.push(demon);
  };

  makeDemon(-15, -3.2, -40, Math.PI, 3);
  makeDemon(30, -3.2, -40, Math.PI, 3);
  assetLoaded();
}, undefined, error => {
  console.error("Error loading demon:", error);
  assetLoaded();
});

// Chandelier
trackAssetLoading();
loader.load("models/chandelier.gltf", gltf => {
  const chandelier = gltf.scene;
  chandelier.position.set(0,6,-10);
  chandelier.scale.set(2,2,2);
  chandelier.traverse(n => { if(n.isMesh) n.castShadow = true; });
  scene.add(chandelier);
  minimapObjects.push(chandelier);
  assetLoaded();
}, undefined, error => {
  console.error("Error loading chandelier:", error);
  assetLoaded();
});

// Bookshelves
trackAssetLoading();
loader.load("models/bookshelf.gltf", gltf => {
  const addBookshelf = (x,y,z,rotationY=0,scale=5) => {
    const shelf = gltf.scene.clone();
    shelf.scale.set(scale,scale,scale);
    shelf.position.set(x,y,z);
    shelf.rotation.y = rotationY;
    shelf.traverse(n => { if(n.isMesh) n.castShadow = true; });
    scene.add(shelf);
    minimapObjects.push(shelf);
  };
  addBookshelf(0,-3,-48,-Math.PI/2);
  addBookshelf(-12,-3,-48,-Math.PI/2);
  addBookshelf(12,-3,-48,-Math.PI/2);
  assetLoaded();
}, undefined, error => {
  console.error("Error loading bookshelf:", error);
  assetLoaded();
});

// === WALL-MOUNTED CANDLES ===
const wallCandleCount = 12;
const wallY = -2;
const wallOffset = 0.2;

for(let i=0;i<wallCandleCount;i++){
  const t = i/(wallCandleCount-1);

  // Back wall
  let xBack = -wallWidth/2 + t*wallWidth;
  let zBack = -wallDepth/2 + wallOffset;
  let candleBack = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.5,16), new THREE.MeshStandardMaterial({color:0xffffaa}));
  candleBack.position.set(xBack, wallY, zBack);
  scene.add(candleBack);
  minimapObjects.push(candleBack);
  let flameBack = new THREE.PointLight(0xffaa33,1,6);
  flameBack.position.set(xBack, wallY+0.3,zBack);
  scene.add(flameBack);

  // Front wall
  let xFront = -wallWidth/2 + t*wallWidth;
  let zFront = wallDepth/2 - wallOffset -10;
  let candleFront = candleBack.clone();
  candleFront.position.set(xFront, wallY, zFront);
  scene.add(candleFront);
  minimapObjects.push(candleFront);
  let flameFront = new THREE.PointLight(0xffaa33,1,6);
  flameFront.position.set(xFront, wallY+0.3, zFront);
  scene.add(flameFront);

  // Left wall
  let zLeft = -wallDepth/2 + t*wallDepth;
  let xLeft = -wallWidth/2 + wallOffset;
  let candleLeft = candleBack.clone();
  candleLeft.position.set(xLeft, wallY, zLeft);
  scene.add(candleLeft);
  minimapObjects.push(candleLeft);
  let flameLeft = new THREE.PointLight(0xffaa33,1,6);
  flameLeft.position.set(xLeft, wallY+0.3,zLeft);
  scene.add(flameLeft);

  // Right wall
  let zRight = -wallDepth/2 + t*wallDepth;
  let xRight = wallWidth/2 - wallOffset;
  let candleRight = candleBack.clone();
  candleRight.position.set(xRight, wallY, zRight);
  scene.add(candleRight);
  minimapObjects.push(candleRight);
  let flameRight = new THREE.PointLight(0xffaa33,1,6);
  flameRight.position.set(xRight, wallY+0.3,zRight);
  scene.add(flameRight);
}

// === ANIMATION ===
const clockForInteraction = new THREE.Clock();

// small helpers / state
let riddleActive = false;
let pullingToHell = false;
let pullStart = 0;

const riddles = [
  { q: "I have cities, but no houses; forests, but no trees; and water, but no fish. What am I?", a: "map" },
  { q: "I speak without a mouth and hear without ears. I have nobody, but I come alive with wind. What am I?", a: "echo" }
];

// === ENHANCED FLOATING TEXT SYSTEM ===
function showFloatingText2(text, duration = 2200, type = "dialogue") {
  const el = document.createElement('div');
  
  let styles = {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '15px 20px',
    borderRadius: '12px',
    fontFamily: '"Courier New", monospace',
    zIndex: '9998',
    opacity: '0',
    transition: 'all 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    textAlign: 'center',
    maxWidth: '70%',
    wordWrap: 'break-word',
    backdropFilter: 'blur(10px)',
    border: '2px solid',
    lineHeight: '1.4',
    letterSpacing: '0.5px'
  };

  if (type === "dialogue") {
    styles.background = 'linear-gradient(135deg, rgba(20, 40, 80, 0.9) 0%, rgba(10, 25, 60, 0.9) 100%)';
    styles.color = '#ffffff';
    styles.borderColor = '#5ab9ff';
    styles.boxShadow = '0 8px 25px rgba(90, 185, 255, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
    styles.top = '25%';
    styles.fontSize = '17px';
    styles.fontWeight = '500';
    styles.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
    
    el.innerHTML = `
      <div style="position: relative;">
        ${text}
        <div style="content: ''; position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 12px solid transparent; border-right: 12px solid transparent; border-top: 12px solid #5ab9ff;"></div>
      </div>
    `;
  } else if (type === "room") {
    styles.background = 'linear-gradient(135deg, rgba(80, 0, 0, 0.85) 0%, rgba(40, 0, 20, 0.9) 100%)';
    styles.color = '#ffcc00';
    styles.borderColor = '#ff6600';
    styles.boxShadow = '0 8px 25px rgba(255, 50, 50, 0.5), 0 0 15px rgba(255, 100, 0, 0.6)';
    styles.top = '18%';
    styles.fontSize = '16px';
    styles.fontWeight = 'bold';
    styles.textShadow = '0 0 10px rgba(255, 100, 0, 0.8), 0 0 20px rgba(255, 50, 0, 0.4)';
    styles.fontFamily = '"Times New Roman", serif';
    styles.fontStyle = 'italic';
    styles.letterSpacing = '1px';
    el.textContent = text;
  } else if (type === "instruction") {
    styles.background = 'linear-gradient(135deg, rgba(30, 60, 30, 0.9) 0%, rgba(15, 40, 15, 0.9) 100%)';
    styles.color = '#88ff88';
    styles.borderColor = '#44ff44';
    styles.boxShadow = '0 6px 20px rgba(0, 255, 100, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)';
    styles.top = '12%';
    styles.fontSize = '15px';
    styles.fontWeight = '600';
    styles.fontFamily = 'Arial, sans-serif';
    styles.textShadow = '0 0 8px rgba(0, 255, 100, 0.4)';
    el.textContent = text;
  } else if (type === "warning") {
    styles.background = 'linear-gradient(135deg, rgba(100, 0, 0, 0.95) 0%, rgba(60, 0, 0, 0.9) 100%)';
    styles.color = '#ff8888';
    styles.borderColor = '#ff0000';
    styles.boxShadow = '0 8px 30px rgba(255, 0, 0, 0.6), 0 0 20px rgba(255, 50, 50, 0.8)';
    styles.top = '22%';
    styles.fontSize = '16px';
    styles.fontWeight = 'bold';
    styles.fontFamily = 'Arial, sans-serif';
    styles.textShadow = '0 0 12px rgba(255, 0, 0, 0.9)';
    styles.animation = 'pulse 2s infinite';
    el.textContent = text;
    
    if (!document.querySelector('#warning-animations')) {
      const style = document.createElement('style');
      style.id = 'warning-animations';
      style.textContent = `
        @keyframes pulse {
          0% { box-shadow: 0 8px 30px rgba(255, 0, 0, 0.6), 0 0 20px rgba(255, 50, 50, 0.8); }
          50% { box-shadow: 0 8px 40px rgba(255, 0, 0, 0.8), 0 0 30px rgba(255, 50, 50, 1); }
          100% { box-shadow: 0 8px 30px rgba(255, 0, 0, 0.6), 0 0 20px rgba(255, 50, 50, 0.8); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  Object.assign(el.style, styles);
  if (type !== "dialogue") {
    el.textContent = text;
  }
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = '1';
    if (type === "dialogue") {
      el.style.transform = 'translateX(-50%) translateY(0px) scale(1)';
    } else if (type === "room") {
      el.style.transform = 'translateX(-50%) scale(1)';
      el.style.animation = 'roomGlow 3s ease-in-out infinite';
    } else {
      el.style.transform = 'translateX(-50%) translateY(0px)';
    }
  });

  if (type === "room" && !document.querySelector('#room-glow-animation')) {
    const style = document.createElement('style');
    style.id = 'room-glow-animation';
    style.textContent = `
      @keyframes roomGlow {
        0% { box-shadow: 0 8px 25px rgba(255, 50, 50, 0.5), 0 0 15px rgba(255, 100, 0, 0.6); }
        50% { box-shadow: 0 8px 30px rgba(255, 50, 50, 0.7), 0 0 20px rgba(255, 100, 0, 0.8); }
        100% { box-shadow: 0 8px 25px rgba(255, 50, 50, 0.5), 0 0 15px rgba(255, 100, 0, 0.6); }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => {
    el.style.opacity = '0';
    if (type === "dialogue") {
      el.style.transform = 'translateX(-50%) translateY(-20px) scale(0.95)';
    } else {
      el.style.transform = 'translateX(-50%) translateY(-15px)';
    }
    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 800);
  }, duration);
}

function showFloatingText(text, duration = 2200) {
  showFloatingText2(text, duration, "room");
}

function showWarningText(text, duration = 3000) {
  showFloatingText2(text, duration, "warning");
}

// Create a small modal UI for riddles
function createRiddleModal() {
  if (document.getElementById('riddleModal')) return;
  const modal = document.createElement('div');
  modal.id = 'riddleModal';
  modal.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);z-index:9999;';
  modal.innerHTML = `
  <div style="background:#121212;color:#ffd;padding:18px;border-radius:8px;min-width:320px;max-width:640px;font-family:Arial,Helvetica,sans-serif;">
    <p id="riddleText" style="margin:0 0 10px;font-size:18px;"></p>
    <input id="riddleInput" style="width:100%;padding:8px;border-radius:6px;border:1px solid #333;margin-bottom:10px;font-size:16px;" />
    <div style="text-align:right;">
      <button id="riddleCancel" style="margin-right:8px;padding:8px 12px;border-radius:6px;background:#333;color:#fff;border:none;cursor:pointer;">Cancel</button>
      <button id="riddleSubmit" style="padding:8px 12px;border-radius:6px;background:#b33;color:#fff;border:none;cursor:pointer;">Answer</button>
    </div>
  </div>
  `;
  document.body.appendChild(modal);

  // Prevent WASD movement when typing in riddle input
  const riddleInput = modal.querySelector('#riddleInput');
  riddleInput.addEventListener('keydown', (e) => {
    // Stop propagation for all keys to prevent movement
    e.stopPropagation();
  });
  
  riddleInput.addEventListener('keyup', (e) => {
    // Stop propagation for all keys to prevent movement
    e.stopPropagation();
  });

  modal.querySelector('#riddleCancel').addEventListener('click', () => {
    modal.style.display = 'none'; 
    riddleActive = false;
  });
  
  modal.querySelector('#riddleSubmit').addEventListener('click', () => {
    const input = modal.querySelector('#riddleInput');
    const answer = input.value || '';
    modal.dispatchEvent(new CustomEvent('submitRiddle', { detail: answer }));
  });
  
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') modal.querySelector('#riddleSubmit').click();
  });
}

function askRiddle(index, onCorrect, onWrong) {
  if (gameState.isPaused) return;
  
  createRiddleModal();
  const modal = document.getElementById('riddleModal');
  modal.style.display = 'flex';
  const textEl = modal.querySelector('#riddleText');
  const input = modal.querySelector('#riddleInput');
  input.value = ''; // Clear the input field
  textEl.textContent = riddles[index].q;
  
  // Use setTimeout to focus after a brief delay, which prevents the 'E' key from being captured
  setTimeout(() => {
    input.focus();
    
    // Add a one-time event listener to prevent the initial 'E' key from being entered
    const preventInitialE = (e) => {
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        e.stopPropagation();
      }
      // Remove this listener after the first keypress
      input.removeEventListener('keydown', preventInitialE);
    };
    
    input.addEventListener('keydown', preventInitialE);
  }, 100);

  const handler = (e) => {
    modal.removeEventListener('submitRiddle', handler);
    modal.style.display = 'none';
    riddleActive = false;
    const raw = String(e.detail || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    const expected = riddles[index].a.toLowerCase().replace(/[^a-z]/g, '');
    if (raw === expected || raw === 'a' + expected) {
      showFloatingText2("The skull throne acknowledges your wisdom. The door loosens.", 4000, "dialogue");
      onCorrect && onCorrect();
    } else {
      showWarningText("Wrong answer... a demon statue awakens!");
      onWrong && onWrong();
    }
  };
  modal.addEventListener('submitRiddle', handler);
}

// press E near the throne to start the first riddle
const thronePosition = new THREE.Vector3(0, -0.5, -40);
window.addEventListener('keydown', (ev) => {
  if (gameState.isPaused || gameState.isGameOver) return;
  
  if (ev.key.toLowerCase() !== 'e' || riddleActive || pullingToHell) return;
  const dist = camera.position.distanceTo(thronePosition);
  if (dist < 6) {
    riddleActive = true;
    askRiddle(0,
      () => {
        showFloatingText2("The skull throne acknowledges your wisdom. The door loosens.", 4000, "dialogue");
        openDoor();
      },
      () => {
        showWarningText("Wrong answer... a demon statue awakens!");
        awakenDemon();
      }
    );
  } else {
    showFloatingText2("Move closer to the throne and press E.", 3000, "instruction");
  }
});

// awaken a demon
function awakenDemon() {
  if (demonStatues.length === 0) {
    showFloatingText("No demon statues present to awaken.");
    return;
  }
  const candidates = demonStatues.filter(d => !d.userData.active);
  const demon = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : demonStatues[0];
  demon.userData.active = true;
  demon.userData.health = 3;
  demon.userData.speed = 6;
  demon.userData.attacksDone = 0;
  demon.userData.awakeAt = performance.now();
  demon.userData.lastAttackAt = 0;
  demon.traverse(n => {
    if (n.isMesh) {
      if (!n.userData._tintSaved) {
        n.userData._tintSaved = n.material.color.clone();
      }
      if (n.material.emissive !== undefined) n.material.emissive.setHex(0x220000);
      n.material.color.lerp(new THREE.Color(0x885555), 0.5);
    }
  });
}

// ----------------- Blood splash overlay -----------------
const bloodOverlayId = 'bloodOverlay';
let bloodImageLoaded = false;

function createBloodOverlay() {
  if (document.getElementById(bloodOverlayId)) return;
  const el = document.createElement('div');
  el.id = bloodOverlayId;
  el.style.cssText = `
    position:fixed;
    left:0;top:0;right:0;bottom:0;
    pointer-events:none;
    opacity:0;
    background-position:center;
    background-repeat:no-repeat;
    background-size:cover;
    transition:opacity 300ms ease-out;
    z-index:10001;
  `;
  document.body.appendChild(el);
  const img = new Image();
  img.onload = () => {
    bloodImageLoaded = true;
    el.style.backgroundImage = "url('models/blood_splash.gltf')";
    el.style.backgroundSize = 'contain';
  };
  img.onerror = () => {
    bloodImageLoaded = false;
    el.style.backgroundImage = '';
    el.style.background = 'radial-gradient(ellipse at center, rgba(255,0,0,0.35) 0%, rgba(0,0,0,0.6) 70%)';
  };
  img.src = 'models/blood_splash.gltf';
}
createBloodOverlay();

function intensifyRedLights(duration = 700, intensityMultiplier = 3) {
  const baseIntensities = [];
  const flickerLights = [];

  scene.traverse(obj => {
    if (obj.isPointLight && obj.color && obj.color.getHex() === 0xff0000) {
      flickerLights.push(obj);
      baseIntensities.push(obj.intensity);
    }
  });

  const startTime = performance.now();
  (function flicker() {
    const elapsed = performance.now() - startTime;
    if (elapsed < duration) {
      flickerLights.forEach((l, i) => {
        l.intensity = baseIntensities[i] * (1 + intensityMultiplier * 0.2 * Math.sin(elapsed * 0.05 + i) + (Math.random() - 0.5) * 0.3);
      });
      requestAnimationFrame(flicker);
    } else {
      flickerLights.forEach((l, i) => l.intensity = baseIntensities[i]);
    }
  })();
}

function playBloodSplash(intensity = 1.0, duration = 1000) {
  const el = document.getElementById('bloodOverlay');
  if (!el) return;

  const maxOpacity = Math.min(1.0, 0.6 + intensity * 0.5);
  el.style.opacity = String(maxOpacity);

  el.style.transition = 'opacity 60ms ease-in';
  el.style.transform = `scale(${1.05 + 0.05 * intensity}) rotate(${(Math.random() - 0.5) * 10}deg)`;
  el.style.filter = 'blur(2px) saturate(3) brightness(1.5)';

  const shakeStrength = 1.5 * intensity;
  const shakeDuration = 400;
  const startTime = performance.now();
  const baseX = camera.position.x;
  const baseY = camera.position.y;
  const baseZ = camera.position.z;

  (function shake() {
    const elapsed = performance.now() - startTime;
    if (elapsed < shakeDuration) {
      const factor = 1 - elapsed / shakeDuration;
      camera.position.x = baseX + (Math.random() - 0.5) * shakeStrength * factor;
      camera.position.y = baseY + (Math.random() - 0.5) * shakeStrength * factor;
      camera.position.z = baseZ + (Math.random() - 0.5) * 0.3 * factor;
      requestAnimationFrame(shake);
    } else {
      camera.position.set(baseX, baseY, baseZ);
    }
  })();

  setTimeout(() => {
    el.style.transition = 'opacity 800ms ease-out, transform 400ms ease-out, filter 500ms ease-out';
    el.style.opacity = '0';
    el.style.transform = 'scale(1) rotate(0deg)';
    el.style.filter = 'blur(0px) saturate(1) brightness(1)';
  }, duration);
}

// ----------------- Raycast clicking to damage awakened demons -----------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener('click', (ev) => {
  if (gameState.isPaused || pullingToHell) return;
  mouse.x = (ev.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (ev.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const meshes = [];
  demonStatues.forEach(d => {
    if (d.userData.active) d.traverse(n => { if (n.isMesh) meshes.push(n); });
  });
  if (meshes.length === 0) return;
  const ints = raycaster.intersectObjects(meshes, true);
  if (ints.length === 0) return;
  const hit = ints[0].object;
  const parentDemon = hit.userData && hit.userData.parentDemon;
  if (!parentDemon || !parentDemon.userData.active) return;

  parentDemon.userData.health -= 1;
  parentDemon.scale.multiplyScalar(1.03);
  setTimeout(() => parentDemon.scale.multiplyScalar(0.97), 120);
  if (parentDemon.userData.health <= 0) {
    killDemon(parentDemon);
  } else {
    parentDemon.traverse(n => {
      if (n.isMesh && n.material && n.material.emissive) {
        const orig = n.material.emissive.clone();
        n.material.emissive.setHex(0xff2222);
        setTimeout(() => n.material.emissive.copy(orig), 140);
      }
    });
  }
});

function killDemon(demon) {
  demon.userData.active = false;
  const start = performance.now();
  const dur = 600;
  const startScale = demon.scale.clone();
  (function shrink() {
    const now = performance.now();
    const p = Math.min(1, (now - start) / dur);
    const s = 1 - p;
    demon.scale.set(startScale.x * s, startScale.y * s, startScale.z * s);
    if (p < 1) requestAnimationFrame(shrink);
    else {
      scene.remove(demon);
      const idx = demonStatues.indexOf(demon);
      if (idx >= 0) demonStatues.splice(idx, 1);
      askRiddle(1,
        () => {
          showFloatingText2("You answer correctly. The path forward opens.", 4000, "dialogue");
          openDoor();
        },
        () => {
          showWarningText("Wrong again... the pentagram glows with hungry spirits!");
          triggerPentagramPull();
        }
      );
    }
  })();
}

// ---------- Door opening ----------
function openDoor() {
  if (!doorMesh) {
    const candidate = scene.children.find(c => c.position && Math.abs(c.position.z - 40) < 2);
    if (candidate) doorMesh = candidate;
  }
  if (!doorMesh) {
    showFloatingText("Door not found (make sure door loader sets doorMesh).");
    return;
  }
  doorMesh.userData.opening = true;
}

// ---------- Pentagram-pull to hell ----------
function triggerPentagramPull() {
  pullingToHell = true;
  pullStart = performance.now();
  if (typeof circle !== 'undefined') circle.userData.pulsing = true;
  const overlay = document.createElement('div');
  overlay.id = 'hellOverlay';
  overlay.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;background:linear-gradient(rgba(64,0,0,0), rgba(0,0,0,0.95));opacity:0;transition:opacity 1.6s;z-index:9997;';
  document.body.appendChild(overlay);
  setTimeout(() => overlay.style.opacity = '1', 40);
}

// ---------- WASD movement ----------
const keys = { w: false, a: false, s: false, d: false };
const moveSpeed = 6;

window.addEventListener('keydown', (e) => {
  if (gameState.isPaused || gameState.isGameOver) return;
  
  const k = e.key.toLowerCase();
  if (["w","a","s","d"].includes(k)) {
    e.preventDefault();
    keys[k] = true;
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (["w","a","s","d"].includes(k)) {
    keys[k] = false;
  }
});

window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'c') {
        thirdPerson = !thirdPerson;
        if (playerModelRoot) {
            playerModelRoot.visible = thirdPerson;
        }
    }
    
    if (event.key === 'Escape' || event.key === 'p') {
        event.preventDefault();
        if (gameState.isPaused) {
            resumeGame();
        } else if (!gameState.isGameOver) {
            pauseGame();
        }
    }
    
    if (event.key === 'r' && event.ctrlKey) {
        event.preventDefault();
        restartGame();
    }
});

function updateMovement(dt) {
  if (gameState.isPaused) return;
  
  const move = new THREE.Vector3();
  
  // Get camera's forward and right directions
  const forward = new THREE.Vector3();
  forward.set(
    Math.sin(mouseX),
    0,
    Math.cos(mouseX)
  ).normalize();
  
  const right = new THREE.Vector3();
  right.set(
    Math.cos(mouseX),
    0,
    -Math.sin(mouseX)
  ).normalize();
  
  let isMoving = false;
  
  if (keys.w) { move.add(forward); isMoving = true; }
  if (keys.s) { move.sub(forward); isMoving = true; }
  if (keys.a) { move.add(right); isMoving = true; }
  if (keys.d) { move.sub(right); isMoving = true; }
  
  // Update animation
  if (mixer) {
    if (isMoving && walkAction && currentAction !== walkAction) {
      if (currentAction) currentAction.fadeOut(0.2);
      walkAction.reset().fadeIn(0.2).play();
      currentAction = walkAction;
    } else if (!isMoving && idleAction && currentAction !== idleAction) {
      if (currentAction) currentAction.fadeOut(0.2);
      idleAction.reset().fadeIn(0.2).play();
      currentAction = idleAction;
    }
  }
  
  if (move.lengthSq() > 0) {
    move.normalize();
    move.multiplyScalar(moveSpeed * dt);
    camera.position.add(move);
    
    // Update player model position
    if (playerModel) {
      playerModel.position.copy(camera.position);
      playerModel.position.y = -3; // Keep at ground level
    }
  }
}

// === PLAYER ARRIVAL DIALOGUE ===
let introDialogueShown = false;
let approachDialogueShown = false;

function triggerIntroDialogue() {
  if (introDialogueShown || !allAssetsLoaded) return;
  introDialogueShown = true;
  showFloatingText2("What...what is this place? It's so creepy...", 4000, "dialogue");
}

function triggerApproachDialogue() {
  if (approachDialogueShown) return;
  approachDialogueShown = true;
  showFloatingText2("Walk to the throne and press E to accept your riddle", 7000, "instruction");
}

// Add a fallback in case something goes wrong with tracking
setTimeout(() => {
  if (!introDialogueShown && !allAssetsLoaded) {
    console.warn("Assets taking too long to load, forcing intro dialogue");
    allAssetsLoaded = true;
    triggerIntroDialogue();
  }
}, 10000); // 10 second fallback

function updateDialogues() {
  if (!approachDialogueShown && camera.position.z < 5) {
    triggerApproachDialogue();
  }
}

// === MODIFIED ANIMATE FUNCTION ===
function animate() {
    if (!gameState.isPaused && !gameState.isGameOver) {
        requestAnimationFrame(animate);
    } else {
        if (!gameState.isGameOver) {
            requestAnimationFrame(animate);
        }
        return;
    }

    const dt = clockForInteraction.getDelta();
    
    // Update animation mixer
    if (mixer) {
        mixer.update(dt);
    }
    
    updateMovement(dt);

    // Update camera orientation
    if (thirdPerson) {
        // Third-person camera
        const cameraDistance = 2.0;
        const cameraHeight = 1.8;
        
        const offsetX = Math.sin(mouseX) * cameraDistance;
        const offsetZ = Math.cos(mouseX) * cameraDistance;
        
        camera.position.set(
            playerModel.position.x - offsetX,
            playerModel.position.y + cameraHeight,
            playerModel.position.z - offsetZ
        );
        
        camera.lookAt(
            playerModel.position.x,
            playerModel.position.y + 1.5,
            playerModel.position.z
        );
        
        if (playerModelRoot) playerModelRoot.visible = true;
    } else {
        // First-person camera
        const lookDirection = new THREE.Vector3(
            Math.sin(mouseX) * Math.cos(mouseY),
            Math.sin(mouseY),
            Math.cos(mouseX) * Math.cos(mouseY)
        );
        camera.lookAt(camera.position.clone().add(lookDirection));
        
        if (playerModelRoot) playerModelRoot.visible = false;
    }
    
    // Update player model rotation
    if (playerModel) {
        playerModel.rotation.y = mouseX;
    }

    const t = clockForInteraction.getElapsedTime();

    if (typeof redLight !== 'undefined') redLight.intensity = 2.5 + Math.sin(t * 3) * 0.5;
    scene.traverse(obj => {
        if (obj.isPointLight && obj !== redLight) {
            obj.intensity = 0.8 + Math.sin(t * 12 + (obj.position.z || 0)) * 0.4;
        }
    });

    for (let i = 0; i < demonStatues.length; i++) {
        const d = demonStatues[i];
        if (!d.userData.active) continue;
        
        const dir = new THREE.Vector3().subVectors(camera.position, d.position);
        const dist = dir.length();
        if (dist > 1.2) {
            dir.normalize();
            const speed = (d.userData.speed || 4);
            d.position.addScaledVector(dir, speed * dt);
        } else {
            const now = performance.now();
            if (!d.userData.lastAttackAt) d.userData.lastAttackAt = 0;
            if (now - d.userData.lastAttackAt > (d.userData.attackCooldown || 900)) {
                d.userData.lastAttackAt = now;
                d.userData.attacksDone = (d.userData.attacksDone || 0) + 1;
                const intensity = Math.min(1.0, 0.2 + d.userData.attacksDone * 0.18);
                playBloodSplash(intensity, 700);
                intensifyRedLights(1000, 4);
                
                // Play demon attack sound
                if (!demonAttackSound.isPlaying) {
                    demonAttackSound.play();
                }
                
                camera.position.x += (Math.random() - 0.5) * 0.06 * d.userData.attacksDone;
                camera.position.y += (Math.random() - 0.5) * 0.04 * d.userData.attacksDone;
                
                if (d.userData.attacksDone >= 5) {
                    d.userData.active = false;
                    showWarningText("You've been staggered by the demon's assault. Another riddle appears...");
                    askRiddle(1,
                        () => {
                            showFloatingText2("You answer correctly. The path forward opens.", 4000, "dialogue");
                            openDoor();
                        },
                        () => {
                            showWarningText("Wrong again... the pentagram glows with hungry spirits!");
                            triggerPentagramPull();
                        }
                    );
                }
            }
            d.position.y = d.userData.baseY + Math.sin(t * 10) * 0.03;
        }
        d.lookAt(camera.position.x, d.position.y, camera.position.z);
    }

    if (doorMesh && doorMesh.userData.opening) {
        doorMesh.position.z += dt * 20;
        if (doorMesh.position.z > 70) doorMesh.userData.opening = false;
    }

    if (pullingToHell) {
        if (typeof circle !== 'undefined' && circle.userData && circle.userData.pulsing) {
            const scale = 1 + 0.08 * Math.sin((performance.now() - pullStart) / 120);
            circle.scale.set(scale, 1, scale);
            if (circle.material && circle.material.color) {
                circle.material.color.lerp(new THREE.Color(0xff6666), 0.06);
            }
        }
        
        if (typeof redLight !== 'undefined') redLight.intensity = THREE.MathUtils.lerp(redLight.intensity, 6.0, 0.02);
        
        camera.position.y -= dt * 6;
        camera.position.z -= dt * 1.5;
        camera.lookAt(0, -2, -10);
        
        if (camera.position.y < -20) {
            gameState.isGameOver = true;
            
            if (!screamSound.isPlaying) {
                if (backgroundMusic.isPlaying) {
                    const vol = backgroundMusic.getVolume();
                    const fadeDuration = 400;
                    const startTime = performance.now();
                    (function fade() {
                        const elapsed = performance.now() - startTime;
                        if (elapsed < fadeDuration) {
                            backgroundMusic.setVolume(vol * (1 - elapsed / fadeDuration));
                            requestAnimationFrame(fade);
                        } else {
                            backgroundMusic.pause();
                            backgroundMusic.setVolume(vol);
                        }
                    })();
                }
                screamSound.play();
            }

            // Enhanced Game Over Screen
            const end = document.createElement('div');
            end.id = 'gameOverOverlay';
            end.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle, rgba(139,0,0,0.9) 0%, rgba(0,0,0,0.95) 70%);
                color: #ff4444;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                font-family: 'Courier New', monospace;
                text-align: center;
                animation: hellPulse 2s infinite;
            `;
            end.innerHTML = `
                <div style="text-align: center; margin-bottom: 40px;">
                    <h1 style="font-size: 4em; margin-bottom: 20px; text-shadow: 0 0 20px rgba(255,0,0,0.8);">HELL AWAITS</h1>
                    <p style="font-size: 1.5em; margin-bottom: 10px; text-shadow: 0 0 10px rgba(255,0,0,0.6);">The pentagram's power was too great...</p>
                    <p style="font-size: 1.3em; margin-bottom: 30px; text-shadow: 0 0 10px rgba(255,0,0,0.6);">You have been dragged into the abyss</p>
                </div>
                <div style="display: flex; gap: 20px;">
                    <button id="quitGameBtn" style="
                        padding: 15px 30px;
                        font-size: 1.2em;
                        background: linear-gradient(135deg, #a29bfe, #6c5ce7);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-family: 'Courier New', monospace;
                        font-weight: bold;
                        transition: all 0.3s ease;
                    ">Quit</button>
                </div>
            `;
            
            // Add event listeners directly to the buttons
            document.body.appendChild(end);
            
            // Add event listeners after the element is added to the DOM
            setTimeout(() => {
                const tryAgainBtn = document.getElementById('tryAgainBtn');
                const quitGameBtn = document.getElementById('quitGameBtn');
                
                if (tryAgainBtn) {
                    tryAgainBtn.addEventListener('click', restartGame);
                    // Add hover effect
                    tryAgainBtn.addEventListener('mouseenter', function() {
                        this.style.transform = 'scale(1.05)';
                        this.style.boxShadow = '0 6px 20px rgba(255, 255, 255, 0.3)';
                    });
                    tryAgainBtn.addEventListener('mouseleave', function() {
                        this.style.transform = 'scale(1)';
                        this.style.boxShadow = 'none';
                    });
                }
                
                if (quitGameBtn) {
                    quitGameBtn.addEventListener('click', quitGame);
                    // Add hover effect
                    quitGameBtn.addEventListener('mouseenter', function() {
                        this.style.transform = 'scale(1.05)';
                        this.style.boxShadow = '0 6px 20px rgba(255, 255, 255, 0.3)';
                    });
                    quitGameBtn.addEventListener('mouseleave', function() {
                        this.style.transform = 'scale(1)';
                        this.style.boxShadow = 'none';
                    });
                }
            }, 100);
            
            // Add pulsating animation for hell overlay
            if (!document.querySelector('#hell-pulse-animation')) {
                const style = document.createElement('style');
                style.id = 'hell-pulse-animation';
                style.textContent = `
                    @keyframes hellPulse {
                        0% { background: radial-gradient(circle, rgba(139,0,0,0.9) 0%, rgba(0,0,0,0.95) 70%); }
                        50% { background: radial-gradient(circle, rgba(255,0,0,0.8) 0%, rgba(0,0,0,0.95) 70%); }
                        100% { background: radial-gradient(circle, rgba(139,0,0,0.9) 0%, rgba(0,0,0,0.95) 70%); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            pullingToHell = false;
        }
    }

    updateDialogues();

    drawMinimap();

    renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
});

// Make functions globally available
window.restartGame = restartGame;
window.quitGame = quitGame;
window.resumeGame = resumeGame;
window.pauseGame = pauseGame;
