import * as THREE from './three/build/three.module.js';
import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js';
// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2520);
scene.fog = new THREE.Fog(0x2a2520, 20, 60);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Movement variables - optimized for air control
const moveSpeed = 0.12;
const airControlFactor = 0.8; // Reduced air control for more floaty movement
const jumpPower = 0.25; // Lower jump height
const gravity = 0.005; // Much lower gravity for longer air time
let velocityY = 0;
let isGrounded = false;
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false
};

let isPaused = false;
let thirdPerson = true;

const clock = new THREE.Clock();

// Room dimensions
const roomWidth = 20;
const roomHeight = 20;
const roomDepth = 60;

// Death and respawn variables
const DEATH_HEIGHT = 2; // Height at which player dies
let isDead = false;
let deathTime = 0;
const RESPAWN_DELAY = 2000; // 2 seconds respawn delay

// Victory condition
let victoryTextShown = false;
const VICTORY_DISTANCE = 1; // Distance from door to trigger victory text
const VICTORY_TEXT_DURATION = 7000; // 7 seconds

// Materials
const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4540 });
const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x3a3836 });

// Floor
const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Walls
const wallMaterialBack = wallMaterial.clone();
wallMaterialBack.side = THREE.BackSide;

function makeWall(geo, pos, rotY = 0) {
  const wall = new THREE.Mesh(geo, wallMaterialBack);
  wall.position.copy(pos);
  wall.rotation.y = rotY;
  wall.receiveShadow = true;
  scene.add(wall);
}

makeWall(new THREE.PlaneGeometry(roomWidth, roomHeight), new THREE.Vector3(0, roomHeight / 2, -roomDepth / 2));
makeWall(new THREE.PlaneGeometry(roomWidth, roomHeight), new THREE.Vector3(0, roomHeight / 2, roomDepth / 2));
makeWall(new THREE.PlaneGeometry(roomDepth, roomHeight), new THREE.Vector3(-roomWidth / 2, roomHeight / 2, 0), Math.PI / 2);
makeWall(new THREE.PlaneGeometry(roomDepth, roomHeight), new THREE.Vector3(roomWidth / 2, roomHeight / 2, 0), -Math.PI / 2);

// Platforms
const platformGeometry = new THREE.BoxGeometry(4, 0.5, 5);
const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x6d6965 });
const platformPositions = [
  [-6, 9, -25],
  [4, 9, -22],
  [3, 9, -11],
  [5, 9, -10],
  [4, 9, 3],
  [-4, 9, 5],
  [-2, 9, 17],
  [0, 10, 28]
];

const platforms = platformPositions.map(([x, y, z]) => {
  const p = new THREE.Mesh(platformGeometry, platformMaterial.clone());
  p.position.set(x, y, z);
  p.castShadow = true;
  p.receiveShadow = true;
  scene.add(p);
  return p;
});

// Door
const doorFrame = new THREE.Mesh(
  new THREE.BoxGeometry(4, 6, 0.3),
  new THREE.MeshStandardMaterial({ color: 0x4a3820 })
);
doorFrame.position.set(0, 13, 29);
doorFrame.castShadow = true;
scene.add(doorFrame);

const doorInner = new THREE.Mesh(
  new THREE.BoxGeometry(3, 5, 0.2),
  new THREE.MeshStandardMaterial({ color: 0x1a1210 })
);
doorInner.position.set(0, 13, 29.1);
scene.add(doorInner);

const doorLight = new THREE.PointLight(0xff6644, 1.2, 15);
doorLight.position.set(0, 13, 28);
scene.add(doorLight);

const spawnPlatform = platforms[0];
const platformTop = spawnPlatform.position.y + 0.5 / 2; // 0.5 is platform height



// Store furniture items for collision detection
const furniture = [...platforms, doorFrame];

// === ENHANCED LIGHTING SYSTEM WITH RED WALL LIGHTS ===
const redWallLights = [];
const platformLights = [];

// Ambient lighting - slightly increased for better base visibility
const hemi = new THREE.HemisphereLight(0x2a1a1a, 0x050505, 0.25);
scene.add(hemi);

// Main directional light - reduced intensity since we're adding more lights
const dir = new THREE.DirectionalLight(0x4a3a42, 0.15);
dir.position.set(10, 14, 8);
dir.castShadow = true;
dir.shadow.mapSize.width = 2048;
dir.shadow.mapSize.height = 2048;
dir.shadow.bias = -0.00025;
scene.add(dir);

// Central point light - keep but reduce intensity
const pointLight = new THREE.PointLight(0xffaa88, 1.0, 100);
pointLight.position.set(0, 15, 10);
pointLight.castShadow = true;
scene.add(pointLight);

// Function to create red wall lights
function createRedWallLights() {
    const redLightIntensity = 2.8;
    const redLightDistance = 8;
    const redLightColor = 0xff0000;
    
    // Positions for red lights along the walls
    const lightPositions = [
        // Left wall lights
        { x: -roomWidth/2 + 0.5, y: 9, z: -20 },
        { x: -roomWidth/2 + 0.5, y: 9, z: -10 },
        { x: -roomWidth/2 + 0.5, y: 9, z: 0 },
        { x: -roomWidth/2 + 0.5, y: 9, z: 10 },
        { x: -roomWidth/2 + 0.5, y: 9, z: 20 },
        
        // Right wall lights  
        { x: roomWidth/2 - 0.5, y: 9, z: -20 },
        { x: roomWidth/2 - 0.5, y: 9, z: -10 },
        { x: roomWidth/2 - 0.5, y: 9, z: 0 },
        { x: roomWidth/2 - 0.5, y: 9, z: 10 },
        { x: roomWidth/2 - 0.5, y: 9, z: 20 },
        
        // Back wall lights
        { x: -6, y: 8, z: -roomDepth/2 + 0.5 },
        { x: 0, y: 8, z: -roomDepth/2 + 0.5 },
        { x: 6, y: 8, z: -roomDepth/2 + 0.5 },
        
        // Front wall lights (near door)
        { x: -3, y: 8, z: roomDepth/2 - 0.5 },
        { x: 3, y: 8, z: roomDepth/2 - 0.5 }
    ];
    
    // Create each red light
    lightPositions.forEach(pos => {
        const redLight = new THREE.PointLight(redLightColor, redLightIntensity, redLightDistance);
        redLight.position.set(pos.x, pos.y, pos.z);
        
        // Add subtle flickering for creepy effect
        redLight.userData = {
            baseIntensity: redLightIntensity,
            flickerSpeed: 2 + Math.random() * 3,
            flickerAmount: 0.1 + Math.random() * 0.2
        };
        
        scene.add(redLight);
        redWallLights.push(redLight);
        
        // Optional: Add visible light sources (red glowing spheres)
        const lightGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const lightMaterial = new THREE.MeshBasicMaterial({ 
            color: redLightColor,
            transparent: true,
            opacity: 0.6
        });
        const lightSphere = new THREE.Mesh(lightGeometry, lightMaterial);
        lightSphere.position.copy(redLight.position);
        scene.add(lightSphere);
    });
}

// Create platform lights
function createPlatformLights() {
    platforms.forEach((platform, index) => {
        const platformLight = new THREE.PointLight(0xff4422, 0.3, 6);
        platformLight.position.set(
            platform.position.x,
            platform.position.y - 1,
            platform.position.z
        );
        scene.add(platformLight);
        platformLights.push(platformLight);
    });
}

// Additional door area lighting
const doorAmbientLight = new THREE.PointLight(0xff2222, 0.4, 12);
doorAmbientLight.position.set(0, 10, 25);
scene.add(doorAmbientLight);

// Initialize the enhanced lighting
createRedWallLights();
createPlatformLights();

// Function to update the flickering red lights
function updateRedLights() {
    const time = Date.now() * 0.001;
    
    redWallLights.forEach(light => {
        const flicker = Math.sin(time * light.userData.flickerSpeed) * light.userData.flickerAmount;
        const randomFlicker = (Math.random() - 0.5) * light.userData.flickerAmount * 0.5;
        light.intensity = Math.max(0.1, light.userData.baseIntensity + flicker + randomFlicker);
    });
    
    // Make door light pulse slightly
    const pulse = Math.sin(time * 1.5) * 0.2;
    doorLight.intensity = 1.0 + pulse;
}

// Create stickman character
const stickmanGroup = new THREE.Group();
stickmanGroup.position.set(platforms[0].position.x, platforms[0].position.y + 1, platforms[0].position.z);
scene.add(stickmanGroup);

// --- Flashlight System ---
const flashlight = new THREE.SpotLight(0xffffff, 50, 25, Math.PI / 4, 0.5, 1);
flashlight.castShadow = true;
flashlight.shadow.mapSize.width = 2048;
flashlight.shadow.mapSize.height = 2048;
flashlight.shadow.camera.near = 0.5;
flashlight.shadow.camera.far = 30;
flashlight.shadow.bias = -0.0001;
flashlight.shadow.focus = 1;

// Position flashlight at head level
flashlight.position.set(0, 1.6, 0.5);
stickmanGroup.add(flashlight);

// Create flashlight target
const flashlightTarget = new THREE.Object3D();
scene.add(flashlightTarget);
flashlight.target = flashlightTarget;

// Initially off
flashlight.visible = false;

// --- Fixed Battery System ---
const MAX_BATTERY = 300.0;
let battery = MAX_BATTERY;
let hasFlashlight = true;

// Battery UI
const batteryBar = document.createElement('div');
batteryBar.style.position = 'fixed';
batteryBar.style.right = '12px';
batteryBar.style.top = '12px';
batteryBar.style.width = '160px';
batteryBar.style.height = '18px';
batteryBar.style.border = '2px solid rgba(255,255,255,0.12)';
batteryBar.style.borderRadius = '6px';
batteryBar.style.background = 'rgba(0,0,0,0.35)';
batteryBar.style.zIndex = '9999';
batteryBar.style.display = 'none';
batteryBar.style.pointerEvents = 'none';

const batteryFill = document.createElement('div');
batteryFill.style.height = '100%';
batteryFill.style.width = '100%';
batteryFill.style.background = '#a6ffb3';
batteryFill.style.borderRadius = '4px';
batteryFill.style.transformOrigin = 'left center';
batteryFill.style.transition = 'width 0.12s linear, background 0.12s linear';
batteryBar.appendChild(batteryFill);

const batteryLabel = document.createElement('div');
batteryLabel.style.position = 'absolute';
batteryLabel.style.right = '8px';
batteryLabel.style.top = '0';
batteryLabel.style.fontSize = '11px';
batteryLabel.style.color = 'rgba(0,0,0,0.8)';
batteryLabel.style.fontFamily = 'sans-serif';
batteryLabel.style.fontWeight = '700';
batteryBar.appendChild(batteryLabel);
document.body.appendChild(batteryBar);

// Death/Respawn UI
const deathOverlay = document.createElement('div');
deathOverlay.style.position = 'fixed';
deathOverlay.style.top = '0';
deathOverlay.style.left = '0';
deathOverlay.style.width = '100%';
deathOverlay.style.height = '100%';
deathOverlay.style.background = 'rgba(255, 0, 0, 0.3)';
deathOverlay.style.display = 'none';
deathOverlay.style.justifyContent = 'center';
deathOverlay.style.alignItems = 'center';
deathOverlay.style.color = 'white';
deathOverlay.style.fontSize = '24px';
deathOverlay.style.fontFamily = 'Arial, sans-serif';
deathOverlay.style.zIndex = '10000';
deathOverlay.style.pointerEvents = 'none';
deathOverlay.innerHTML = '<div style="text-align: center;">YOU DIED<br><span style="font-size: 16px;">Respawning...</span></div>';
document.body.appendChild(deathOverlay);

// === OMINOUS FLOATING TEXT SYSTEM ===
function showOminousText(text, duration = 7000) {
    const el = document.createElement('div');
    el.style.cssText = `
        position: fixed;
        left: 50%;
        top: 30%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(80, 0, 0, 0.9) 0%, rgba(40, 0, 20, 0.95) 100%);
        color: #ffcc00;
        padding: 20px 25px;
        border-radius: 12px;
        font-family: 'Times New Roman', serif;
        font-size: 20px;
        font-weight: bold;
        font-style: italic;
        text-align: center;
        z-index: 9998;
        opacity: 0;
        transition: opacity 1500ms ease-in-out, transform 1500ms ease-in-out;
        border: 3px solid #ff6600;
        box-shadow: 0 8px 30px rgba(255, 50, 50, 0.6), 0 0 20px rgba(255, 100, 0, 0.8);
        text-shadow: 0 0 10px rgba(255, 100, 0, 0.8), 0 0 20px rgba(255, 50, 0, 0.6);
        backdrop-filter: blur(10px);
        line-height: 1.4;
        letter-spacing: 1px;
        max-width: 600px;
        word-wrap: break-word;
    `;
    el.textContent = text;
    document.body.appendChild(el);

    // Add pulsating animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ominousPulse {
            0% { box-shadow: 0 8px 30px rgba(255, 50, 50, 0.6), 0 0 20px rgba(255, 100, 0, 0.8); }
            50% { box-shadow: 0 8px 40px rgba(255, 50, 50, 0.8), 0 0 30px rgba(255, 100, 0, 1); }
            100% { box-shadow: 0 8px 30px rgba(255, 50, 50, 0.6), 0 0 20px rgba(255, 100, 0, 0.8); }
        }
    `;
    document.head.appendChild(style);
    el.style.animation = 'ominousPulse 3s ease-in-out infinite';

    // Dramatic entrance
    requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateX(-50%) translateY(0px) scale(1)';
    });

    // Exit after duration
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(-50%) translateY(-20px) scale(0.95)';
        setTimeout(() => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 1500);
    }, duration);
    setTimeout(() => {
    window.location.href = './secretRoom.html';
}, duration + 1500); // Wait for text fade-out + 1.5 seconds
}

function checkVictoryCondition() {
    if (victoryTextShown || isDead) return;
    
    // Calculate distance to door light
    const doorPosition = new THREE.Vector3(0, 13, 28);
    const distanceToDoor = stickmanGroup.position.distanceTo(doorPosition);
    
    // Check if player is on the final platform and close to the door
    const finalPlatform = platforms[7]; // Platform at [0, 10, 28]
    const platformBox = new THREE.Box3().setFromObject(finalPlatform);
    const onFinalPlatform = platformBox.containsPoint(stickmanGroup.position);
    
    if ((onFinalPlatform || distanceToDoor < VICTORY_DISTANCE) && !victoryTextShown) {
        victoryTextShown = true;
        showOminousText("Congratulations for making it this far... I hope you are ready to learn the truth about your father.");
        
        // Optional: Enhance the door light when text appears
        doorLight.intensity = 3.0;
        doorLight.color = new THREE.Color(0xff0000);
        
        // Return to normal after a moment
        setTimeout(() => {
            doorLight.intensity = 1.2;
            doorLight.color = new THREE.Color(0xff6644);
        }, 3000);
    }
}

// Flashlight toggle
window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "f" && !isDead) {
        if (hasFlashlight && battery > 0) {
            flashlight.visible = !flashlight.visible;
            updateAnimationState();
            
            // Show battery UI when flashlight is toggled
            batteryBar.style.display = flashlight.visible ? 'block' : 'none';
        } else if (battery <= 0) {
            console.log("Flashlight battery is dead!");
            flashlight.visible = false;
            batteryBar.style.display = 'none';
        }
    }
});

// Fixed battery update function
function updateFlashlight() {
    if (!hasFlashlight || isDead) return;
    
    if (!isPaused && battery > 0) {
        const drainRate = flashlight.visible ? 1.0/60 : 0.0;
        battery = Math.max(0, battery - drainRate);
        
        // Save battery to localStorage
        localStorage.setItem("stairsBattery", battery.toString());
        
        // Update battery display
        updateBatteryDisplay();
        
        const batteryFrac = battery / MAX_BATTERY;
        
        if (flashlight.visible) {
            const now = performance.now() / 1000;
            
            const baseIntensity = thirdPerson ? 50 : 6;
            const flickerFreq = 6 + (1 - batteryFrac) * 18;
            const flickerAmp = 0.06 + (1 - batteryFrac) * 0.28;
            const sine = Math.sin(now * flickerFreq) * flickerAmp;
            const dip = (Math.random() < 0.015 * (1 - batteryFrac)) ? -0.8 * (1 - batteryFrac) : 0;
            
            const intensity = Math.max(0, baseIntensity * (0.35 + 0.65 * batteryFrac) * (1 + sine + dip));
            flashlight.intensity = intensity;
            
            flashlight.angle = THREE.MathUtils.clamp(
                (Math.PI / 4) * (0.9 + 0.22 * batteryFrac), 
                Math.PI / 18, 
                Math.PI / 1.5
            );
        }
        
        // Handle battery depletion
        if (battery <= 0) {
            flashlight.visible = false;
            batteryBar.style.display = 'none';
            updateAnimationState();
            return;
        }
    }
    
    // Update flashlight direction
    if (flashlight.visible) {
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        const targetPosition = new THREE.Vector3();
        camera.getWorldPosition(targetPosition);
        targetPosition.add(cameraDirection.multiplyScalar(10));
        flashlightTarget.position.copy(targetPosition);
    }
}

function updateBatteryDisplay() {
    const batteryFrac = battery / MAX_BATTERY;
    const pct = Math.round(batteryFrac * 100);
    
    batteryLabel.textContent = `${pct}%`;
    const widthPct = Math.max(0, Math.min(100, pct));
    batteryFill.style.width = `${widthPct}%`;
    
    if (widthPct > 55) {
        batteryFill.style.background = '#a6ffb3';
    } else if (widthPct > 25) {
        batteryFill.style.background = '#ffd76b';
    } else {
        batteryFill.style.background = '#ff6b6b';
    }
}

function initializeBattery() {
    const savedBattery = localStorage.getItem("stairsBattery");
    if (savedBattery !== null) {
        battery = parseFloat(savedBattery);
        // If battery was depleted in previous session, start fresh
        if (battery <= 0) {
            battery = MAX_BATTERY;
            localStorage.setItem("stairsBattery", battery.toString());
        }
    } else {
        battery = MAX_BATTERY;
        localStorage.setItem("stairsBattery", battery.toString());
    }
    
    // Hide battery UI initially
    batteryBar.style.display = 'none';
}

// Load the Blender model
const loader = new GLTFLoader();
const MODEL_PATH = './maybeModel_LivingRoom4.glb';
let playerModelRoot = null;
let mixer;
let walkAction;
let idleAction;
let holdFlashAction;
let currentAction;

const ANIM_FADE = 0.2;
const HOLD_FLASH_WEIGHT = 0.7;

function switchTo(action) {
    if (!action || action === currentAction) return;
    if (currentAction) currentAction.fadeOut(ANIM_FADE);
    action.reset().fadeIn(ANIM_FADE).play();
    currentAction = action;
}

function updateAnimationState() {
    if (!mixer || isDead) return;

    let base = null;
    if (isWalking) base = walkAction || idleAction;
    else base = idleAction || walkAction;
    switchTo(base);

    if (holdFlashAction) {
        const shouldHold = flashlight.visible;
        holdFlashAction.enabled = true;
        holdFlashAction.play();
        holdFlashAction.setEffectiveWeight(shouldHold ? HOLD_FLASH_WEIGHT : 0.0);
    }
}

loader.load(MODEL_PATH, (gltf) => {
    const root = gltf.scene;

    let model = root.getObjectByName('metarig') || null;
    let firstSkinned = null;
    let firstMesh = null;
    root.traverse((o) => {
        if (!firstSkinned && o.isSkinnedMesh) firstSkinned = o;
        if (!firstMesh && o.isMesh) firstMesh = o;
    });
    
    if (!model && firstSkinned) {
        model = firstSkinned;
        while (model.parent && model.parent !== root) model = model.parent;
    }
    if (!model && firstMesh) {
        model = firstMesh;
        while (model.parent && model.parent !== root) model = model.parent;
    }
    if (!model) model = root;

    // Center and scale the character
    const unionBox = new THREE.Box3();
    let haveBox = false;
    model.updateMatrixWorld(true);
    model.traverse((o) => {
        if (o.isMesh) {
            o.updateWorldMatrix(true, false);
            const b = new THREE.Box3().setFromObject(o);
            if (!haveBox) { unionBox.copy(b); haveBox = true; }
            else { unionBox.union(b); }
        }
    });

    if (haveBox) {
        const preSize = new THREE.Vector3();
        unionBox.getSize(preSize);

        const targetHeight = 1.8;
        if (preSize.y > 0) {
            const scaleFactor = targetHeight / preSize.y;
            model.scale.setScalar(scaleFactor);
            model.updateMatrixWorld(true);
        }

        const scaledBox = new THREE.Box3();
        let haveScaled = false;
        model.traverse((o) => {
            if (o.isMesh) {
                o.updateWorldMatrix(true, false);
                const b = new THREE.Box3().setFromObject(o);
                if (!haveScaled) { scaledBox.copy(b); haveScaled = true; }
                else { scaledBox.union(b); }
            }
        });

        if (haveScaled) {
            const postCenter = new THREE.Vector3();
            const postSize = new THREE.Vector3();
            scaledBox.getCenter(postCenter);
            scaledBox.getSize(postSize);

            if (Number.isFinite(postCenter.x) && Number.isFinite(postCenter.y) && Number.isFinite(postCenter.z)) {
                model.position.sub(postCenter);
                model.position.y += postSize.y / 2;
            }
        }
    }

    stickmanGroup.add(model);
    playerModelRoot = model;

    // Setup animations
    if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);

        const clips = gltf.animations;
        const findClip = (names) => {
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
        const holdFlashClip = findClip(['Hold_Flash.004-metarig.001', 'flash', 'torch']);

        if (idleClip) {
            idleAction = mixer.clipAction(idleClip);
            idleAction.setLoop(THREE.LoopRepeat, Infinity);
        }
        if (walkClip) {
            walkAction = mixer.clipAction(walkClip);
            walkAction.setLoop(THREE.LoopRepeat, Infinity);
        }
        if (holdFlashClip) {
            holdFlashAction = mixer.clipAction(holdFlashClip);
            holdFlashAction.setLoop(THREE.LoopRepeat, Infinity);
            holdFlashAction.enabled = true;
            holdFlashAction.play();
            holdFlashAction.setEffectiveWeight(0.0);
        }

        currentAction = null;
        if (idleAction) {
            switchTo(idleAction);
        }
        updateAnimationState();
    }
}, undefined, (error) => {
    console.error('Error loading model:', error);
});

// Mouse controls
let mouseX = 0;
let mouseY = 0;
const mouseSensitivity = 0.002;

renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});

document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === renderer.domElement && !isDead) {
        const proposedMouseX = mouseX - event.movementX * mouseSensitivity;
        const proposedMouseY = mouseY - event.movementY * mouseSensitivity;
        
        const clampedMouseY = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, proposedMouseY));
        
        const tempCamera = camera.clone();
        tempCamera.position.copy(stickmanGroup.position);
        tempCamera.position.y += (thirdPerson ? 5 : 1.6);
        
        const lookDirection = new THREE.Vector3(
            Math.sin(proposedMouseX) * Math.cos(clampedMouseY),
            Math.sin(clampedMouseY),
            Math.cos(proposedMouseX) * Math.cos(clampedMouseY)
        );
        
        const testPoint = tempCamera.position.clone().add(lookDirection.multiplyScalar(3));
        
        const margin = 0.5;
        const withinWalls = 
            testPoint.y >= margin && 
            testPoint.y <= roomHeight - margin &&
            testPoint.x >= -roomWidth/2 + margin && 
            testPoint.x <= roomWidth/2 - margin &&
            testPoint.z >= -roomDepth/2 + margin && 
            testPoint.z <= roomDepth/2 - margin;
        
        if (withinWalls) {
            mouseX = proposedMouseX;
            mouseY = clampedMouseY;
        }
    }
});

// Keyboard controls
document.addEventListener('keydown', (event) => {
    if (isDead) return;
    
    switch (event.code) {
        case 'KeyW':
            keys.w = true;
            break;
        case 'KeyA':
            keys.a = true;
            break;
        case 'KeyS':
            keys.s = true;
            break;
        case 'KeyD':
            keys.d = true;
            break;
        case 'Space':
            keys.space = true;
            event.preventDefault();
            break;
        case 'KeyC':
            thirdPerson = !thirdPerson;
            break;
        case 'KeyF':
            // Flashlight toggle handled above
            break;
    }
});

document.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW':
            keys.w = false;
            break;
        case 'KeyA':
            keys.a = false;
            break;
        case 'KeyS':
            keys.s = false;
            break;
        case 'KeyD':
            keys.d = false;
            break;
        case 'Space':
            keys.space = false;
            break;
    }
});

// Collision detection
function checkCollisions(position, playerY) {
    let highestSurface = 0;
    
    furniture.forEach(item => {
        const box = new THREE.Box3().setFromObject(item);
        
        if (position.x >= box.min.x - 0.3 && position.x <= box.max.x + 0.3 &&
            position.z >= box.min.z - 0.3 && position.z <= box.max.z + 0.3) {
            
            if (box.max.y > highestSurface) {
                if (Math.abs(playerY - box.max.y) < 1.0) {
                    highestSurface = box.max.y;
                }
            }
        }
    });
    
    return highestSurface;
}

function checkHorizontalCollisions(newPosition, playerY) {
    const playerRadius = 0.4;
    const epsilon = 0.05;

    const halfWidth = roomWidth / 2 - playerRadius;
    const halfDepth = roomDepth / 2 - playerRadius;
    
    if (newPosition.x < -halfWidth || newPosition.x > halfWidth ||
        newPosition.z < -halfDepth || newPosition.z > halfDepth) {
        return false;
    }

    for (let item of furniture) {
        const box = new THREE.Box3().setFromObject(item);

        const expandedBox = new THREE.Box3(
            new THREE.Vector3(box.min.x - playerRadius, box.min.y, box.min.z - playerRadius),
            new THREE.Vector3(box.max.x + playerRadius, box.max.y, box.max.z + playerRadius)
        );

        if (newPosition.x >= expandedBox.min.x && newPosition.x <= expandedBox.max.x &&
            newPosition.z >= expandedBox.min.z && newPosition.z <= expandedBox.max.z) {

            if (playerY >= expandedBox.max.y - epsilon) {
                continue;
            }

            if (playerY <= expandedBox.max.y) {
                return false;
            }
        }
    }

    return true;
}

let wasWalking = false;
let isWalking = false;
let lastPlayerIntent = new THREE.Vector3();

// Death and respawn functions
function killPlayer(reason = "Fell to death") {
    if (isDead) return;
    
    console.log(`Player died: ${reason}`);
    isDead = true;
    deathTime = Date.now();
    
    // Show death overlay
    deathOverlay.style.display = 'flex';
    
    // Disable flashlight
    flashlight.visible = false;
    batteryBar.style.display = 'none';
    
    // Stop player movement
    velocityY = 0;
    isWalking = false;
    updateAnimationState();
    
    // Visual effects
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '9999';
    document.body.appendChild(flash);
    
    setTimeout(() => {
        flash.style.transition = 'opacity 1s';
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 1000);
    }, 200);
}

function respawnPlayer() {
    isDead = false;
    
    // Hide death overlay
    deathOverlay.style.display = 'none';
    
    // Reset player position to spawn platform
    stickmanGroup.position.set(
        spawnPlatform.position.x,
        platformTop + 1,
        spawnPlatform.position.z
    );
    
    // Reset physics
    velocityY = 0;
    isGrounded = true;
    
    // Reset animation
    updateAnimationState();
    
    console.log("Player respawned");
}

function checkDeathCondition() {
    // Check if player fell below death height
    if (stickmanGroup.position.y < DEATH_HEIGHT && !isDead) {
        killPlayer("Fell to death");
    }
    
    // Handle respawn - FIXED: This now properly checks the time
    if (isDead && Date.now() - deathTime > RESPAWN_DELAY) {
        respawnPlayer();
    }
}

// Movement and physics - OPTIMIZED FOR LONG AIR TIME
function updateStickman() {
    if (isDead) {
        // During death, just update camera position
        if (thirdPerson) {
            const cameraDistance = 5.0;
            const cameraHeight = 4.0;

            const offsetX = Math.sin(mouseX) * cameraDistance;
            const offsetZ = Math.cos(mouseX) * cameraDistance;
            const offsetY = cameraHeight;

            const desiredPos = new THREE.Vector3(
                stickmanGroup.position.x - offsetX,
                stickmanGroup.position.y + offsetY,
                stickmanGroup.position.z - offsetZ
            );

            camera.position.lerp(desiredPos, 0.1);
            
            camera.lookAt(
                stickmanGroup.position.x,
                stickmanGroup.position.y + 1.5,
                stickmanGroup.position.z
            );
        }
        
        // CRITICAL FIX: Check for respawn even during death state
        checkDeathCondition();
        return;
    }

    const direction = new THREE.Vector3();
    
    const cameraForward = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();
    
    cameraForward.set(
        Math.sin(mouseX),
        0,
        Math.cos(mouseX)
    ).normalize();
    
    cameraRight.set(
        Math.cos(mouseX),
        0,
        -Math.sin(mouseX)
    ).normalize();
    
    if (keys.w) direction.add(cameraForward);
    if (keys.s) direction.sub(cameraForward);
    if (keys.a) direction.add(cameraRight);
    if (keys.d) direction.sub(cameraRight);
    
    isWalking = direction.length() > 0;

    // Apply movement with air control
    if (isWalking) {
        direction.normalize();
        
        // Use different movement speed based on whether grounded or in air
        const currentMoveSpeed = isGrounded ? moveSpeed : moveSpeed * airControlFactor;
        
        const moveVec = direction.clone().multiplyScalar(currentMoveSpeed);
        const newPosition = stickmanGroup.position.clone().add(moveVec);
        
        if (checkHorizontalCollisions(newPosition, stickmanGroup.position.y)) {
            stickmanGroup.position.copy(newPosition);
        }
    }

    if (direction.lengthSq() > 1e-6) {
        lastPlayerIntent.copy(direction).normalize();
    } else {
        lastPlayerIntent.set(0, 0, 0);
    }

    // Jumping with low height but long air time
    if (keys.space && isGrounded) {
        velocityY = jumpPower; // Low jump height
        isGrounded = false;
    }
    
    // Very low gravity for extended air time
    velocityY -= gravity;
    stickmanGroup.position.y += velocityY;
    
    const currentGroundLevel = checkCollisions(stickmanGroup.position, stickmanGroup.position.y);
    
    if (stickmanGroup.position.y <= currentGroundLevel + 0.1) {
        stickmanGroup.position.y = currentGroundLevel;
        velocityY = 0;
        isGrounded = true;
    } else {
        isGrounded = false;
    }
    
    // Check for death condition (falling)
    checkDeathCondition();
    
    // Check for victory condition (reaching the door)
    checkVictoryCondition();
    
    if (isWalking !== wasWalking) {
        updateAnimationState();
        wasWalking = isWalking;
    }
    
    // FIXED CAMERA POSITION - Better third-person view
    if (thirdPerson) {
        const cameraDistance = 5.0;
        const cameraHeight = 4.0;

        const offsetX = Math.sin(mouseX) * cameraDistance;
        const offsetZ = Math.cos(mouseX) * cameraDistance;
        const offsetY = cameraHeight;

        const desiredPos = new THREE.Vector3(
            stickmanGroup.position.x - offsetX,
            stickmanGroup.position.y + offsetY,
            stickmanGroup.position.z - offsetZ
        );

        // Smooth camera movement
        camera.position.lerp(desiredPos, 0.1);

        // Look slightly ahead of the player for better visibility
        const lookAhead = new THREE.Vector3(
            Math.sin(mouseX) * 2,
            0,
            Math.cos(mouseX) * 2
        );
        
        camera.lookAt(
            stickmanGroup.position.x + lookAhead.x,
            stickmanGroup.position.y + 1.5,
            stickmanGroup.position.z + lookAhead.z
        );

        if (playerModelRoot) playerModelRoot.visible = true;
    } else {
        const cameraHeight = 1.6;
        camera.position.copy(stickmanGroup.position).add(new THREE.Vector3(0, cameraHeight, 0));
        const lookDirection = new THREE.Vector3(
            Math.sin(mouseX) * Math.cos(mouseY),
            Math.sin(mouseY),
            Math.cos(mouseX) * Math.cos(mouseY)
        );
        camera.lookAt(camera.position.clone().add(lookDirection));

        if (playerModelRoot) playerModelRoot.visible = false;
    }

    stickmanGroup.rotation.y = mouseX;
}

// Mini-map
const minimapCanvas = document.createElement('canvas');
minimapCanvas.id = 'minimap';
const minimapCtx = minimapCanvas.getContext('2d');
minimapCanvas.width = 200;
minimapCanvas.height = 200;
minimapCanvas.style.position = 'fixed';
minimapCanvas.style.bottom = '10px';
minimapCanvas.style.right = '10px';
minimapCanvas.style.border = '2px solid white';
minimapCanvas.style.backgroundColor = 'rgba(0,0,0,0.5)';
document.body.appendChild(minimapCanvas);

function drawMinimap() {
    const ctx = minimapCtx;
    const scale = 0.1;
    const centerX = minimapCanvas.width / 2;
    const centerY = minimapCanvas.height / 2;
    
    ctx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        centerX - (roomWidth / 2) / scale,
        centerY - (roomDepth / 2) / scale,
        roomWidth / scale,
        roomDepth / scale
    );
    
    ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
    furniture.forEach(item => {
        const box = new THREE.Box3().setFromObject(item);
        const itemWidth = (box.max.x - box.min.x) / scale;
        const itemDepth = (box.max.z - box.min.z) / scale;
        const itemX = centerX + (item.position.x - stickmanGroup.position.x) / scale - itemWidth / 2;
        const itemZ = centerY + (item.position.z - stickmanGroup.position.z) / scale - itemDepth / 2;
        
        ctx.fillRect(itemX, itemZ, itemWidth, itemDepth);
    });
    
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    const doorX = centerX + (doorFrame.position.x - stickmanGroup.position.x) / scale;
    const doorZ = centerY + (doorFrame.position.z - stickmanGroup.position.z) / scale;
    ctx.fillRect(doorX - 2, doorZ - 2, 4, 8);
    
    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-mouseX + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-5, 5);
    ctx.lineTo(5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', centerX, 15);
    ctx.fillText('S', centerX, minimapCanvas.height - 5);
    ctx.fillText('W', 10, centerY + 4);
    ctx.fillText('E', minimapCanvas.width - 10, centerY + 4);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    if (isPaused) {
        renderer.render(scene, camera);
        return;
    }

    const delta = clock.getDelta();
    const currentTime = Date.now();

    if (mixer) {
        mixer.update(delta);
    }

    

    updateFlashlight();
    updateStickman();
    updateRedLights(); // Update the flickering red lights
    drawMinimap();
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Instructions
const instructions = document.createElement('div');
instructions.style.position = 'absolute';
instructions.style.top = '10px';
instructions.style.left = '10px';
instructions.style.color = 'white';
instructions.style.fontFamily = 'Arial, sans-serif';
instructions.style.fontSize = '14px';
instructions.style.background = 'rgba(0,0,0,0.8)';
instructions.style.padding = '15px';
instructions.style.borderRadius = '8px';
instructions.style.lineHeight = '1.4';
instructions.innerHTML = `
    OBJECTIVES:<br>
    Navigate the platforms<br>
    Reach the door at the end<br><br>
    CONTROLS:<br>
    WASD - Move (full control in air!)<br>
    Space - Jump (low but floaty)<br>
    C - Toggle camera view<br>
    F - Toggle flashlight<br>
    Mouse - Look around<br><br>
    WARNING:<br>
    Falling off platforms will kill you!<br>
    You will respawn after 2 seconds.
`;
document.body.appendChild(instructions);

// Start the animation loop
initializeBattery();
animate();
