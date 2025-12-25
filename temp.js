import * as THREE from 'three';
import { metalness } from 'three/tsl';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Movement variables
const moveSpeed = 0.12;
const jumpPower = 0.3;
const gravity = 0.015;
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
let levelComplete = false;

// Create kitchen dimensions (much bigger)
const roomWidth = 45;
const roomDepth = 35;
const wallHeight = 12;
const counterHeight = 0.2;
const cabinetHeight = 3;

const clock = new THREE.Clock();

// Materials (dark indie escape room theme)
const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x2b1d0e }); // Dark, aged wood
const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x2a2a2a }); // Nearly black/dirty concrete walls
const ceilingMaterial = new THREE.MeshLambertMaterial({ color: 0x1c1c1c }); // Very dark ceiling
const counterMaterial = new THREE.MeshLambertMaterial({ color: 0x3d3d3d }); // Charcoal counters
const cabinetMaterial = new THREE.MeshLambertMaterial({ color: 0x4b3621 }, {metalness: 0.2}); // Old dark wood cabinets
const applianceMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 }); // Worn, dull metal
const knobMaterial = new THREE.MeshLambertMaterial({ color: 0x8b0000 }); // Deep red knobs (rust/blood hint)
const tileMaterial = new THREE.MeshLambertMaterial({ color: 0x383838 }); // Dirty, cracked tiles

// Store furniture items for collision detection
const furniture = [];

// Floor
const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Ceiling
const ceiling = new THREE.Mesh(floorGeometry, ceilingMaterial);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = wallHeight;
scene.add(ceiling);

// Wall thickness
const wallThickness = 0.5; // adjust as needed

// North wall (depth along Z)
const northWallGeo = new THREE.BoxGeometry(roomWidth, wallHeight, wallThickness);
const northWall = new THREE.Mesh(northWallGeo, wallMaterial);
northWall.position.set(0, wallHeight / 2, -roomDepth / 2 + wallThickness / 2);
northWall.receiveShadow = true;
scene.add(northWall);

// South wall
const southWallGeo = new THREE.BoxGeometry(roomWidth, wallHeight, wallThickness);
const southWall = new THREE.Mesh(southWallGeo, wallMaterial);
southWall.position.set(0, wallHeight / 2, roomDepth / 2 - wallThickness / 2);
southWall.receiveShadow = true;
//scene.add(southWall);

// East wall (depth along X)
const eastWallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, roomDepth);
const eastWall = new THREE.Mesh(eastWallGeo, wallMaterial);
eastWall.position.set(roomWidth / 2 - wallThickness / 2, wallHeight / 2, 0);
eastWall.receiveShadow = true;
scene.add(eastWall);

// West wall
const westWallGeo = new THREE.BoxGeometry(wallThickness, wallHeight, roomDepth);
const westWall = new THREE.Mesh(westWallGeo, wallMaterial);
westWall.position.set(-roomWidth / 2 + wallThickness / 2 - 0.5, wallHeight / 2, 0);
westWall.receiveShadow = true;
scene.add(westWall);


// Create an island group
const islandGroup = new THREE.Group();
islandGroup.position.set(0, 0, 0);

// Island mesh
const islandGeometry = new THREE.BoxGeometry(12, cabinetHeight, 6);
const island = new THREE.Mesh(islandGeometry, counterMaterial);
island.position.set(0, cabinetHeight / 2, 0);
island.castShadow = true;
island.receiveShadow = true;
islandGroup.add(island);

// Island knobs (attached to back face)
for (let i = 0; i < 6; i++) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), knobMaterial);
    knob.position.set(-5 + i * 2, cabinetHeight * 0.5, -3.05); // slightly behind island
    islandGroup.add(knob);
}

// Add group to scene
scene.add(islandGroup);
furniture.push(islandGroup);

// --- Island Light ---
const islandLight = new THREE.PointLight(0xffffff, 1.5, 8); // white light
islandLight.position.set(0, cabinetHeight + 1, 0); // above the island
islandLight.castShadow = true;
scene.add(islandLight);

// Visual light orb
const lightOrbGeometry = new THREE.SphereGeometry(0.2, 16, 16);
const lightOrbMaterial = new THREE.MeshStandardMaterial({ 
    emissive: 0xffffff, 
    emissiveIntensity: 0.8,
    color: 0xffffff,
    transparent: true,
    opacity: 0.7
});
const lightOrb = new THREE.Mesh(lightOrbGeometry, lightOrbMaterial);
lightOrb.position.set(0, cabinetHeight + 1, 0);
scene.add(lightOrb);

// Make light pulse
function animateIslandLight(time) {
    const pulseFactor = 0.8 + Math.sin(time * 0.003) * 0.3;
    islandLight.intensity = 1.2 * pulseFactor;
    lightOrbMaterial.emissiveIntensity = 0.8 * pulseFactor;
}

// Island light interaction variables
let isNearIslandLight = false;
const islandLightInteractDistance = 3.0;

function checkIslandLightProximity() {
    const playerPos = stickmanGroup.position.clone();
    const lightPos = new THREE.Vector3();
    lightOrb.getWorldPosition(lightPos);

    const distance = playerPos.distanceTo(lightPos);

    if (distance < islandLightInteractDistance) {
        if (!isNearIslandLight) {
            showInteractionPopup(true);
            isNearIslandLight = true;
        }
    } else {
        if (isNearIslandLight) {
            showInteractionPopup(false);
            isNearIslandLight = false;
        }
    }
}

// Kitchen Counters along walls (extended)
const counterGeometry = new THREE.BoxGeometry(18, counterHeight / 2, 2.5);

// Left counter (longer)
const leftCounter = new THREE.Mesh(counterGeometry, counterMaterial);
leftCounter.position.set(8, 3, -16.8);
leftCounter.castShadow = true;
leftCounter.receiveShadow = true;
scene.add(leftCounter);
furniture.push(leftCounter);

// Right counter (longer)
const rightCounter = new THREE.Mesh(counterGeometry, counterMaterial);
rightCounter.position.set(12, 3, -16.8);
rightCounter.castShadow = true;
rightCounter.receiveShadow = true;
scene.add(rightCounter);
furniture.push(rightCounter);

// Back counter (L-shaped, extended)
const backCounterGeometry = new THREE.BoxGeometry(2.5, counterHeight, 16);
const backCounter = new THREE.Mesh(backCounterGeometry, counterMaterial);
backCounter.position.set(-21.5, 3, -2);
backCounter.castShadow = true;
backCounter.receiveShadow = true;
scene.add(backCounter);
furniture.push(backCounter);

///////////////////// LOWER CABINETS ///////////////////////

// Cabinets under counters (with knobs) - Modified for door animation
const cabinetGeometry = new THREE.BoxGeometry(18, cabinetHeight, 2.3);

// --- LEFT CABINET GROUP ---
const leftCabinetGroup = new THREE.Group();

const frameThickness = 0.3;
const doorWidth = 4;
const doorHeight = cabinetHeight - 0.2;
const cabinetDepth = 2.3;
const totalWidth = 18;

// Left side frame
const leftFrame = new THREE.Mesh(
    new THREE.BoxGeometry(frameThickness, cabinetHeight, cabinetDepth),
    cabinetMaterial
);
leftFrame.position.set(-totalWidth/2 + frameThickness/2, 0, 0);
leftCabinetGroup.add(leftFrame);

// Right solid part (everything except the door space)
const rightWidth = totalWidth - doorWidth - frameThickness;
const rightPart = new THREE.Mesh(
    new THREE.BoxGeometry(rightWidth, cabinetHeight, cabinetDepth),
    cabinetMaterial
);
// position so its left edge starts right after the door opening
rightPart.position.set(-totalWidth/2 + frameThickness + doorWidth + rightWidth/2, 0, 0);
leftCabinetGroup.add(rightPart);

// Top frame
const topFrame = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth, frameThickness, cabinetDepth),
    cabinetMaterial
);
topFrame.position.set(-totalWidth/2 + frameThickness + doorWidth/2, cabinetHeight/2 - frameThickness/2, 0);
leftCabinetGroup.add(topFrame);

// Bottom frame
const bottomFrame = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth, frameThickness, cabinetDepth),
    cabinetMaterial
);
bottomFrame.position.set(-totalWidth/2 + frameThickness + doorWidth/2, -cabinetHeight/2 + frameThickness/2, 0);
leftCabinetGroup.add(bottomFrame);

// Back panel
const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(doorWidth, doorHeight, 0.1),
    cabinetMaterial
);
backPanel.position.set(-totalWidth/2 + frameThickness + doorWidth/2, 0, -cabinetDepth/2 + 0.05);
leftCabinetGroup.add(backPanel);

// Door + pivot
const doorGeometry = new THREE.BoxGeometry(doorWidth - 0.05, doorHeight, 0.15);
const cabinetDoor = new THREE.Mesh(doorGeometry, cabinetMaterial);

const doorPivot = new THREE.Group();
// Pivot at left edge of the door opening
doorPivot.position.set(-totalWidth/2 + frameThickness, 0, cabinetDepth/2 - 0.15/2);
doorPivot.add(cabinetDoor);

// Offset door so hinge aligns
cabinetDoor.position.set(doorWidth/2, 0, 0);
leftCabinetGroup.add(doorPivot);

// Position entire group
leftCabinetGroup.position.set(-12, cabinetHeight/2, -16.8);
scene.add(leftCabinetGroup);
furniture.push(leftCabinetGroup);


// Right cabinet (unchanged)
const rightCabinet = new THREE.Mesh(cabinetGeometry, cabinetMaterial);
rightCabinet.position.set(12, (cabinetHeight) / 2, -16.8);
rightCabinet.castShadow = true;
rightCabinet.receiveShadow = true;
scene.add(rightCabinet);
furniture.push(rightCabinet);

// Door animation variables
let isDoorOpen = false;
let doorAnimating = false;
const doorOpenAngle = Math.PI / 2; // 90 degrees
const doorAnimationSpeed = 0.05;

// Door animation function
function animateCabinetDoor() {
    if (!doorAnimating) return;
    
    const targetAngle = isDoorOpen ? doorOpenAngle : 0;
    const currentAngle = doorPivot.rotation.y;
    const difference = targetAngle - currentAngle;
    
    if (Math.abs(difference) > 0.01) {
        // Continue animating
        doorPivot.rotation.y += Math.sign(difference) * doorAnimationSpeed;
    } else {
        // Animation complete
        doorPivot.rotation.y = targetAngle;
        doorAnimating = false;
    }
}

// Function to toggle door (called when button is pressed)
function toggleCabinetDoor() {
    if (doorAnimating) return; // Don't start new animation if already animating
    
    isDoorOpen = !isDoorOpen;
    doorAnimating = true;
    console.log(`Cabinet door ${isDoorOpen ? 'opening' : 'closing'}...`);
}

// --- Cabinet Glow Light ---
const cabinetLight = new THREE.PointLight(0xffffff, 1, 5); // color, intensity, range
cabinetLight.position.set(-18, 1, -16.2); // near the left cabinet interior
scene.add(cabinetLight);

// Make it pulse
function animateCabinetLight(time) {
    if (isDoorOpen) {
        cabinetLight.intensity = 1 + Math.sin(time * 0.005) * 0.5;
    } else {
        cabinetLight.intensity = 0;
    }
}

let isNearCabinet = false;

// --- Check cabinet proximity and only allow interaction if door is open ---
function checkCabinetProximity() {
    const playerPos = stickmanGroup.position.clone();
    
    const lightPos = new THREE.Vector3();
    cabinetLight.getWorldPosition(lightPos); // use the light as reference

    const distance = playerPos.distanceTo(lightPos);
    const interactDistance = 2.0;

    if (distance < interactDistance && isDoorOpen) {
        if (!isNearCabinet) {
            showInteractionPopup(true);
            isNearCabinet = true;
        }
    } else {
        if (isNearCabinet) {
            showInteractionPopup(false);
            isNearCabinet = false;
        }
    }
}

// Cabinet knobs for left counter (adjust positions to avoid door area)
for (let i = 0; i < 9; i++) {
    // Skip knobs where the door is (first 2 positions)
    if (i < 2) continue;
    
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), knobMaterial);
    knob.position.set(-20 + i * 2, cabinetHeight * 0.7, -15.6);
    scene.add(knob);
}

// Add door knob
const doorKnob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), knobMaterial);
doorKnob.position.set(-16, cabinetHeight * 0.7, -15.5);
scene.add(doorKnob);

// Cabinet knobs for right counter (unchanged)
for (let i = 0; i < 9; i++) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), knobMaterial);
    knob.position.set(4 + i * 2, cabinetHeight * 0.7, -15.6);
    scene.add(knob);
}

///////////////// END OF LOWER CABINETS ///////////////////

// Upper cabinets
const upperCabinetGeometry = new THREE.BoxGeometry(18, 2, 1.5);

const leftUpperCabinet = new THREE.Mesh(upperCabinetGeometry, cabinetMaterial);
leftUpperCabinet.position.set(-12, 7, -16.8);
leftUpperCabinet.castShadow = true;
scene.add(leftUpperCabinet);

const rightUpperCabinet = new THREE.Mesh(upperCabinetGeometry, cabinetMaterial);
rightUpperCabinet.position.set(12, 7, -16.8);
rightUpperCabinet.castShadow = true;
scene.add(rightUpperCabinet);

// Upper cabinet knobs
for (let i = 0; i < 9; i++) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), knobMaterial);
    knob.position.set(-20 + i * 2, 6.5, -16);
    scene.add(knob);
    
    const knob2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), knobMaterial);
    knob2.position.set(4 + i * 2, 6.5, -16);
    scene.add(knob2);
}

// Appliances (more and bigger)
// Create a group for the fridge and its attachments
const fridgeGroup = new THREE.Group();
fridgeGroup.position.set(21, 0, -12); // Base position of the fridge

// Fridge body
const fridgeGeometry = new THREE.BoxGeometry(3, 7, 3);
const fridge = new THREE.Mesh(fridgeGeometry, applianceMaterial);
fridge.position.set(0, 3.5, 0); // relative to group
fridge.castShadow = true;
fridgeGroup.add(fridge);

// Fridge center divider line
const dividerGeometry = new THREE.BoxGeometry(0.05, 6.8, 0.05);
const dividerMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
const fridgeDivider = new THREE.Mesh(dividerGeometry, dividerMaterial);
fridgeDivider.position.set(0, 3.5, -1.52); // relative to rotated fridge
fridgeGroup.add(fridgeDivider);

// Water dispenser panel (on right half)
const dispenserGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.08);
const dispenserMaterial = new THREE.MeshLambertMaterial({ color: 0x404040 });
const waterDispenser = new THREE.Mesh(dispenserGeometry, dispenserMaterial);
waterDispenser.position.set(0.6, 4.5, -1.53); // relative to rotated fridge
fridgeGroup.add(waterDispenser);

// Small dispenser nozzle
const nozzleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.15);
const nozzle = new THREE.Mesh(nozzleGeometry, new THREE.MeshLambertMaterial({ color: 0x000000 }));
nozzle.position.set(0.6, 4.2, -1.60);
nozzle.rotation.x = Math.PI / 2;
fridgeGroup.add(nozzle);

// Rotate the entire fridge group 90° to the right
fridgeGroup.rotation.y = Math.PI / 2; // 90° clockwise

// Add the group to the scene and furniture array
scene.add(fridgeGroup);
furniture.push(fridgeGroup);

// Create a group for the oven and stovetop
const ovenGroup = new THREE.Group();
ovenGroup.position.set(-20.2, 0, -12); // Base position for the whole setup

// Double Oven
const ovenGeometry = new THREE.BoxGeometry(2.5, 3, 2.5);
const oven = new THREE.Mesh(ovenGeometry, applianceMaterial);
oven.position.set(0, counterHeight + 1.5, 0); // relative to group
oven.castShadow = true;
ovenGroup.add(oven);

// Horizontal divider between upper and lower oven
const stoveDividerGeometry = new THREE.BoxGeometry(2.4, 0.05, 0.05);
const stoveDividerMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
const stoveDivider = new THREE.Mesh(stoveDividerGeometry, stoveDividerMaterial);
stoveDivider.position.set(0, counterHeight + 1.5, 1.35); // adjust relative to group
ovenGroup.add(stoveDivider);

// Oven glass windows
const windowMaterial = new THREE.MeshLambertMaterial({ color: 0x404040 });
const upperWindowGeometry = new THREE.BoxGeometry(1.5, 0.8, 0.03);

// Upper oven window
const upperOvenWindow = new THREE.Mesh(upperWindowGeometry, windowMaterial);
upperOvenWindow.position.set(0, counterHeight + 2.2, 1.35);
ovenGroup.add(upperOvenWindow);

// Lower oven window
const lowerOvenWindow = new THREE.Mesh(upperWindowGeometry, windowMaterial);
lowerOvenWindow.position.set(0, counterHeight + 0.8, 1.35);
ovenGroup.add(lowerOvenWindow);

// Stovetop
const stoveGeometry = new THREE.BoxGeometry(2.5, 0.3, 2.5);
const stove = new THREE.Mesh(stoveGeometry, applianceMaterial);
stove.position.set(0, cabinetHeight + 0.15, 0);
stove.castShadow = true;
ovenGroup.add(stove);

// Stove burners
for (let i = 0; i < 4; i++) {
    const burner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.05),
        new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    const x = (i % 2) ? 0.5 : -0.5;
    const z = (i < 2) ? 0.5 : -0.5;
    burner.position.set(x, cabinetHeight + 0.3, z);
    ovenGroup.add(burner);
}

// Add the entire group to the scene and furniture array
ovenGroup.rotation.y = Math.PI / 2; // Rotate 90° to the right
scene.add(ovenGroup);
furniture.push(ovenGroup);

// --- Stove Side Light ---
const stoveSideLight = new THREE.PointLight(0xff6600, 1.0, 5); // orange light
stoveSideLight.position.set(-18, cabinetHeight + 2, -12); // to the right of stove
stoveSideLight.castShadow = true;
scene.add(stoveSideLight);

// Visual light orb for stove
const stoveLightOrbGeometry = new THREE.SphereGeometry(0.12, 16, 16);
const stoveLightOrbMaterial = new THREE.MeshStandardMaterial({ 
    emissive: 0xff6600, 
    emissiveIntensity: 0.7,
    color: 0xff6600,
    transparent: true,
    opacity: 0.8
});
const stoveLightOrb = new THREE.Mesh(stoveLightOrbGeometry, stoveLightOrbMaterial);
stoveLightOrb.position.set(-20, 1, -14);
scene.add(stoveLightOrb);

// Stove light animation
function animateStoveLight(time) {
    const pulseFactor = 0.5 + Math.sin(time * 0.005) * 0.5;
    stoveSideLight.intensity = 0.8 * pulseFactor;
    stoveLightOrbMaterial.emissiveIntensity = 0.7 * pulseFactor;
}

// Stove light interaction variables
let isNearStoveLight = false;
const stoveLightInteractDistance = 2.0;

function checkStoveLightProximity() {
    const playerPos = stickmanGroup.position.clone();
    const lightPos = new THREE.Vector3();
    stoveLightOrb.getWorldPosition(lightPos);

    const distance = playerPos.distanceTo(lightPos);

    if (distance < stoveLightInteractDistance) {
        if (!isNearStoveLight) {
            showInteractionPopup(true);
            isNearStoveLight = true;
        }
    } else {
        if (isNearStoveLight) {
            showInteractionPopup(false);
            isNearStoveLight = false;
        }
    }
}

// Dishwasher
const dishwasherGeometry = new THREE.BoxGeometry(2, cabinetHeight, 2.3);
const dishwasher = new THREE.Mesh(dishwasherGeometry, applianceMaterial);
dishwasher.position.set(0, 1.5, -16.8);
dishwasher.castShadow = true;
scene.add(dishwasher);
furniture.push(dishwasher);

// Dishwasher handle
const dishHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5), new THREE.MeshLambertMaterial({ color: 0x000000 }));
dishHandle.position.set(0, cabinetHeight - 1, -15.6);
dishHandle.rotation.z = Math.PI / 2;
scene.add(dishHandle);

// --- Dishwasher Light ---
const dishwasherLight = new THREE.PointLight(0x4169E1, 1.2, 6); // blue light
dishwasherLight.position.set(0, cabinetHeight + 2, -16.8); // above dishwasher
dishwasherLight.castShadow = true;
scene.add(dishwasherLight);

// Visual light orb for dishwasher
const dishwasherLightOrbGeometry = new THREE.SphereGeometry(0.15, 16, 16);
const dishwasherLightOrbMaterial = new THREE.MeshStandardMaterial({ 
    emissive: 0x4169E1, 
    emissiveIntensity: 0.6,
    color: 0x4169E1,
    transparent: true,
    opacity: 0.8
});
const dishwasherLightOrb = new THREE.Mesh(dishwasherLightOrbGeometry, dishwasherLightOrbMaterial);
dishwasherLightOrb.position.set(0, cabinetHeight + 2, -16.8);
scene.add(dishwasherLightOrb);

// Dishwasher light animation
function animateDishwasherLight(time) {
    const pulseFactor = 0.6 + Math.sin(time * 0.004) * 0.4;
    dishwasherLight.intensity = 1.0 * pulseFactor;
    dishwasherLightOrbMaterial.emissiveIntensity = 0.6 * pulseFactor;
}

// Dishwasher light interaction variables
let isNearDishwasherLight = false;
const dishwasherLightInteractDistance = 2.5;

function checkDishwasherLightProximity() {
    const playerPos = stickmanGroup.position.clone();
    const lightPos = new THREE.Vector3();
    dishwasherLightOrb.getWorldPosition(lightPos);

    const distance = playerPos.distanceTo(lightPos);

    if (distance < dishwasherLightInteractDistance) {
        if (!isNearDishwasherLight) {
            showInteractionPopup(true);
            isNearDishwasherLight = true;
        }
    } else {
        if (isNearDishwasherLight) {
            showInteractionPopup(false);
            isNearDishwasherLight = false;
        }
    }
}

// Create a group for the sink
const sinkGroup = new THREE.Group();

// Sink body
const sinkGeometry = new THREE.BoxGeometry(3, 0.3, 2);
const sink = new THREE.Mesh(sinkGeometry, new THREE.MeshLambertMaterial({ color: 0x4169E1 }));
sink.position.set(0, 0.15, 0); // relative to group
sink.castShadow = true;
sinkGroup.add(sink);

// Faucet base
const faucetBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.4),
    applianceMaterial
);
faucetBase.position.set(0, 0.5, 1); // relative to sink
sinkGroup.add(faucetBase);

// Faucet neck
const faucetNeck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.8),
    applianceMaterial
);
faucetNeck.position.set(0, 0.9, 0.5); // relative to sink
faucetNeck.rotation.x = Math.PI / 6;
sinkGroup.add(faucetNeck);

// Position the whole sink group in the scene
sinkGroup.position.set(12, cabinetHeight - 0.25, -16.8);
scene.add(sinkGroup);
furniture.push(sinkGroup);

// --- Clock Group ---
const clockGroup = new THREE.Group();

// Clock face
const clockFaceGeometry = new THREE.CylinderGeometry(2, 2, 0.2, 32);
const clockFaceMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffffff, 
    metalness: 0.2, 
    roughness: 0.7 
});
const clockFace = new THREE.Mesh(clockFaceGeometry, clockFaceMaterial);
clockFace.rotation.x = Math.PI / 2; // stand the clock vertically
clockFace.castShadow = true;
clockFace.receiveShadow = true;
clockGroup.add(clockFace);

// Hour hand (shorter, pointing to 3 o'clock)
const hourHandGeometry = new THREE.BoxGeometry(1, 0.05, 0.1);
const hourHandMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
const hourHand = new THREE.Mesh(hourHandGeometry, hourHandMaterial);
hourHand.position.set(0.5, 0, 0.11); // center the hand at the pivot point
hourHand.castShadow = true;
// No rotation needed for 3 o'clock position since it's positioned along X-axis
clockGroup.add(hourHand);

// Minute hand (longer, pointing to 12 o'clock)
const minuteHandGeometry = new THREE.BoxGeometry(1.5, 0.05, 0.1);
const minuteHandMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
const minuteHand = new THREE.Mesh(minuteHandGeometry, minuteHandMaterial);
minuteHand.position.set(0, 0.75, 0.12); // position along Y-axis for 12 o'clock
minuteHand.rotation.z = Math.PI / 2; // point to 12
minuteHand.castShadow = true;
// No rotation needed for 12 o'clock position since it's positioned along Y-axis
clockGroup.add(minuteHand);

// Clock center knob
const knobGeometry = new THREE.SphereGeometry(0.1, 16, 16);
const clockKnobMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
const knob = new THREE.Mesh(knobGeometry, clockKnobMaterial);
knob.position.set(0, 0, 0.13); // slightly in front
clockGroup.add(knob);

// Position the clock in the scene
clockGroup.position.set(0, 8, -16.8); 
scene.add(clockGroup);

// Microwave group
const microwaveGroup = new THREE.Group();
microwaveGroup.position.set(20, 3.5, -16.8); // base position for the group

// Microwave body
const microwaveGeometry = new THREE.BoxGeometry(2, 1, 1.5);
const microwave = new THREE.Mesh(microwaveGeometry, applianceMaterial);
microwave.position.set(0, 0, 0); // relative to group
microwave.castShadow = true;
microwaveGroup.add(microwave);

// Microwave glass panel
const glassGeometry = new THREE.BoxGeometry(0.8, 0.4, 0.05); // width, height, depth
const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.2 });
const microwaveGlass = new THREE.Mesh(glassGeometry, glassMaterial);

// Position relative to microwave body
microwaveGlass.position.set(-1, 0, -0.2);
microwaveGlass.rotation.y = Math.PI / 2; // face outward
microwaveGroup.add(microwaveGlass);

// Microwave handle
const microHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x000000 })
);
// Adjust handle position relative to the microwave body
microHandle.position.set(-1, 0, 0.5); // front side of microwave
microwaveGroup.add(microHandle);

// Add group to scene
microwaveGroup.rotation.y = Math.PI / 2; // Rotate to face front
scene.add(microwaveGroup);
furniture.push(microwaveGroup);


// Kitchen Table (bigger)
const tableTopGeometry = new THREE.BoxGeometry(8, 0.2, 4);
const tableLegGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2.4);
const tableMaterial = new THREE.MeshLambertMaterial({ color: 0xDEB887 });

const tableTop = new THREE.Mesh(tableTopGeometry, tableMaterial);
tableTop.position.set(0, 2.5, 12); // Moved further from center
tableTop.castShadow = true;
tableTop.receiveShadow = true;
scene.add(tableTop);
furniture.push(tableTop);

// Table legs (2.4 units tall, so top is at 2.4, plus 0.1 for tabletop = 2.5 total)
for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(tableLegGeometry, tableMaterial);
    const x = (i % 2) ? 3.7 : -3.7;
    const z = (i < 2) ? 10.8 : 13.2;
    leg.position.set(x, 1.2, z); // Half the leg height (2.4/2 = 1.2)
    leg.castShadow = true;
    scene.add(leg);
}

// Chairs (6 chairs for bigger table)
const chairSeatGeometry = new THREE.BoxGeometry(1, 0.1, 1);
const chairBackGeometry = new THREE.BoxGeometry(1, 1.2, 0.1);
const chairLegGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1);

const tableCenterX = 0;
const tableCenterZ = 12;
const tableWidth = 8;
const tableDepth = 4;

for (let i = 0; i < 6; i++) {
    const chairGroup = new THREE.Group();
    
    // Chair legs
    for (let j = 0; j < 4; j++) {
        const chairLeg = new THREE.Mesh(chairLegGeometry, tableMaterial);
        const legX = (j % 2) ? 0.4 : -0.4;
        const legZ = (j < 2) ? 0.4 : -0.4;
        chairLeg.position.set(legX, 0.5, legZ);
        chairLeg.castShadow = true;
        chairGroup.add(chairLeg);
    }

    // Chair seat
    const seat = new THREE.Mesh(chairSeatGeometry, tableMaterial);
    seat.position.y = 1.05;
    seat.castShadow = true;
    seat.receiveShadow = true;
    chairGroup.add(seat);

    // Chair back
    const back = new THREE.Mesh(chairBackGeometry, tableMaterial);
    back.position.set(0, 1.65, -0.45);
    back.castShadow = true;
    chairGroup.add(back);

    // Position chairs
    switch (i) {
        case 0: // front long side
            chairGroup.position.set(tableCenterX - 2, 0, tableCenterZ + tableDepth/2 + 0.5);
            chairGroup.rotation.y = Math.PI; // face table
            break;
        case 1: // front long side
            chairGroup.position.set(tableCenterX + 2, 0, tableCenterZ + tableDepth/2 + 0.5);
            chairGroup.rotation.y = Math.PI;
            break;
        case 2: // back long side
            chairGroup.position.set(tableCenterX - 2, 0, tableCenterZ - tableDepth/2 - 0.5);
            chairGroup.rotation.y = 0;
            break;
        case 3: // back long side
            chairGroup.position.set(tableCenterX + 2, 0, tableCenterZ - tableDepth/2 - 0.5);
            chairGroup.rotation.y = 0;
            break;
        case 4: // left short side
            chairGroup.position.set(tableCenterX - tableWidth/2 - 0.5, 0, tableCenterZ);
            chairGroup.rotation.y = Math.PI / 2;
            break;
        case 5: // right short side
            chairGroup.position.set(tableCenterX + tableWidth/2 + 0.5, 0, tableCenterZ);
            chairGroup.rotation.y = -Math.PI / 2;
            break;
    }

    scene.add(chairGroup);
    furniture.push(chairGroup);
}


// Additional Kitchen Items
// Create a group for the pantry and knobs
const pantryGroup = new THREE.Group();
pantryGroup.position.set(-21.5, 0, 9); // base position of the pantry group
pantryGroup.rotation.y = Math.PI / 2; // rotate 90° right

// Pantry Cabinet
const pantryGeometry = new THREE.BoxGeometry(3, 8, 2);
const pantry = new THREE.Mesh(pantryGeometry, counterMaterial);
pantry.position.set(0, 4, 0); // relative to group
pantry.castShadow = true;
pantryGroup.add(pantry);

// Pantry knobs
for (let i = 0; i < 4; i++) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), knobMaterial);
    knob.position.set(0, 2 + i * 1.5, 1.1); // Z now offset in front of pantry after rotation
    pantryGroup.add(knob);
}

scene.add(pantryGroup);
furniture.push(pantryGroup);

// --- Button on side ---
const buttonGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16);
const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const button = new THREE.Mesh(buttonGeometry, buttonMaterial);

// Place it near bottom-right of the pantry, sticking out on the +X side
button.rotation.z = Math.PI / 2; // make it face outward
button.position.set(1.6, 0.5, 0); // (X, Y, Z) relative to pantry center
pantryGroup.add(button);

const interactDistance = 2; // max distance to interact
let isNearButton = false;

// Inside your animation/game loop:
function checkButtonProximity() {
    const playerPos = stickmanGroup.position; // Use stickmanGroup instead of player
    const buttonWorldPos = new THREE.Vector3();
    button.getWorldPosition(buttonWorldPos);
    
    const distance = playerPos.distanceTo(buttonWorldPos);
    
    if (distance < interactDistance) {
        if (!isNearButton) {
            showInteractionPopup(true); // show popup
            isNearButton = true;
        }
    } else {
        if (isNearButton) {
            showInteractionPopup(false); // hide popup
            isNearButton = false;
        }
    }
}

function showInteractionPopup(show) {
    const popup = document.getElementById("interactionPopup");
    popup.style.display = show ? "block" : "none";
}

// Update your button press handler:
document.addEventListener('keydown', (event) => {
    const key = event.key;

    // --- ESC key to pause/unpause ---
    if (key === 'Escape') {
        if (!isGameOver) {
            if (isPaused) {
                resumeGame();
            } else {
                pauseGame();
            }
        }
        return; // Exit early after handling pause
    }

    // --- Don't process other keys if paused ---
    if (isPaused) return;

    // --- Movement keys ---
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
            event.preventDefault(); // Prevent page scroll
            break;
    }

    // --- Press E to interact ---
    if (key.toLowerCase() === "e") {
        // Cabinet button
        if (isNearButton) {
            toggleCabinetDoor();
        }

        // Cabinet glow (only if door open)
        if (isNearCabinet && isDoorOpen) {
            const paperUI = document.getElementById("paperUI");
            paperUI.innerHTML = "5&nbsp;&nbsp;2";
            paperUI.style.display = "flex";

            setTimeout(() => {
                paperUI.style.display = "none";
            }, 2000);

            showInteractionPopup(false);
        }

        // Safe interaction (locked)
        if (isNearSafe && !safeUnlocked) {
            showSafeInput(); // display input UI
            showInteractionPopup(false);
        }

        // Safe unlocked: show paper every time interact
        if (isNearSafe && safeUnlocked) {
            safeOpen = true; // mark as open for distance checks
            const paperUI = document.getElementById("safePaperUI");
            paperUI.innerHTML = "7&nbsp;&nbsp;4&nbsp;&nbsp;9&nbsp;&nbsp;1"; // 4 numbers
            paperUI.style.display = "flex";

            setTimeout(() => {
                paperUI.style.display = "none";
            }, 2000);

            showInteractionPopup(false);
        }

        // --- Door interaction (press E to bring up numpad) ---
        if (isNearDoor && !doorUnlocked) {
            showDoorInput(); // display 4-digit door input UI
            showInteractionPopup(false);
        }

        if (isNearDoor && doorUnlocked) {
            if (!levelComplete) {
                levelComplete = true;
                clearInterval(timerInterval); // Stop the timer
                document.getElementById('victoryScreen').style.display = 'flex';
                isGameOver = true; // Stop game updates
            }
        }

        // Island light interaction
        if (isNearIslandLight) {
            const textPanel = document.getElementById("textPanel");
            textPanel.innerHTML = "Seems like a fragment of...<br/>someone...<br/>I should try to find more.";
            textPanel.style.display = "block";

            setTimeout(() => {
                textPanel.style.display = "none";
            }, 5000);

            showInteractionPopup(false);
        }

        // Dishwasher light interaction
        if (isNearDishwasherLight) {
            const dishwasherMessage = document.getElementById("dishwasherMessage");
            dishwasherMessage.innerHTML = "The time's 3 o'clock.<br/>Its quite late...<br/>Nevermind that - why is this fragment here?";
            dishwasherMessage.style.display = "block";

            setTimeout(() => {
                dishwasherMessage.style.display = "none";
            }, 5000);

            showInteractionPopup(false);
        }

        // Stove light interaction
        if (isNearStoveLight) {
            const stoveMessage = document.getElementById("stoveMessage");
            stoveMessage.innerHTML = "<i>&quot;There's a button on the side of the pantry.&quot;</i><br/>So the fragment says...";
            stoveMessage.style.display = "block";

            setTimeout(() => {
                stoveMessage.style.display = "none";
            }, 5000);

            showInteractionPopup(false);
        }
    }

    // --- Handle digit entry for safe code ---
    const safeInputVisible = document.getElementById("safeInputUI").style.display !== "none";
    if (!safeUnlocked && isNearSafe && safeInputVisible) {
        if (/^[0-9]$/.test(key) && enteredCode.length < 3) {
            enteredCode.push(parseInt(key));
        } else if (key === "Backspace") {
            enteredCode.pop();
        }

        document.getElementById("enteredDigits").innerText = enteredCode.join(" ");

        if (enteredCode.length === 3) {
            const sortedEntered = [...enteredCode].sort().join("");
            const sortedCode = [...safeCode].sort().join("");

            if (sortedEntered === sortedCode) {
                safeUnlocked = true;
                hideSafeInput();
                if (safe.doorPivot) safe.doorOpen = true;

                setTimeout(() => {
                    const paperUI = document.getElementById("safePaperUI");
                    paperUI.style.display = "flex";
                    setTimeout(() => { paperUI.style.display = "none"; }, 2000);
                }, 500);

            } else {
                enteredCode = [];
                document.getElementById("enteredDigits").innerText = "";
                const codeUI = document.getElementById("codeInputUI");
                codeUI.innerText = "❌ Incorrect! Try again.";
                setTimeout(() => { codeUI.innerText = ""; }, 1500);
            }
        }
    }

    // --- Handle digit entry for door code ---
    const doorInputVisible = document.getElementById("doorInputUI").style.display !== "none";
    if (!doorUnlocked && isNearDoor && doorInputVisible) {
        if (/^[0-9]$/.test(key) && enteredDoorCode.length < 4) {
            enteredDoorCode.push(parseInt(key));
        } else if (key === "Backspace") {
            enteredDoorCode.pop();
        }

        document.getElementById("doorEnteredDigits").innerText = enteredDoorCode.join("");

        if (enteredDoorCode.length === 4) {
            const enteredStr = enteredDoorCode.join("");
            const codeStr = doorCode.join("");

            if (enteredStr === codeStr) {
                doorUnlocked = true;
                hideDoorInput();
                myDoor.isOpen = true; // open the door

                const feedback = document.getElementById("doorCodeFeedback");
                feedback.innerText = "✅ Door unlocked!";
                feedback.style.display = "block";
                setTimeout(() => { feedback.style.display = "none"; }, 1500);

            } else {
                enteredDoorCode = [];
                document.getElementById("doorEnteredDigits").innerText = "";
                const feedback = document.getElementById("doorCodeFeedback");
                feedback.innerText = "❌ Incorrect! Try again.";
                feedback.style.display = "block";
                setTimeout(() => { feedback.style.display = "none"; }, 1500);
            }
        }
    }
});

///////////////////////// KITCHEN DOOR /////////////////////////

function createDoor(x = 0, y = 0, z = 0) {
    const doorGroup = new THREE.Group();
    doorGroup.position.set(x, y, z);

    const doorWidth = 1.0;
    const doorHeight = 2.0;
    const frameThickness = 0.1;
    const frameDepth = 0.15;

    // --- Door Frame (outer) ---
    const frameGroup = new THREE.Group();
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x5a3d1e,
        roughness: 0.5,
        metalness: 0.05
    });

    const frameGeometryH = new THREE.BoxGeometry(doorWidth + frameThickness * 2, frameThickness, frameDepth);
    const frameGeometryV = new THREE.BoxGeometry(frameThickness, doorHeight + frameThickness * 2, frameDepth);

    const topFrame = new THREE.Mesh(frameGeometryH, frameMaterial);
    topFrame.position.set(doorWidth / 2, doorHeight / 2 + frameThickness / 2, 0);
    topFrame.castShadow = true;

    const bottomFrame = new THREE.Mesh(frameGeometryH, frameMaterial);
    bottomFrame.position.set(doorWidth / 2, -doorHeight / 2 - frameThickness / 2, 0);
    bottomFrame.castShadow = true;

    const leftFrame = new THREE.Mesh(frameGeometryV, frameMaterial);
    leftFrame.position.set(-frameThickness / 2, 0, 0);
    leftFrame.castShadow = true;

    const rightFrame = new THREE.Mesh(frameGeometryV, frameMaterial);
    rightFrame.position.set(doorWidth + frameThickness / 2, 0, 0);
    rightFrame.castShadow = true;

    frameGroup.add(topFrame, bottomFrame, leftFrame, rightFrame);
    doorGroup.add(frameGroup);

    // --- Black Fill Panel (behind door) ---
    const fillGeometry = new THREE.PlaneGeometry(doorWidth, doorHeight);
    const fillMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide
    });
    const fillPanel = new THREE.Mesh(fillGeometry, fillMaterial);
    fillPanel.position.set(doorWidth / 2, 0, 0.05); // slightly recessed behind door
    doorGroup.add(fillPanel);

    // --- Door Pivot ---
    const doorPivot = new THREE.Group();
    doorPivot.position.set(0, 0, 0); // hinge at left edge
    doorGroup.add(doorPivot);

    // --- Door Body ---
    const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, 0.1);
    const doorMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b5a2b,
        roughness: 0.6,
        metalness: 0.1
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.castShadow = true;
    door.receiveShadow = true;
    door.position.x = doorWidth / 2; // hinge from left edge
    doorPivot.add(door);

    // --- Door Panels ---
    const panelGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.05);
    const panelMaterial = new THREE.MeshStandardMaterial({
        color: 0x7a4a20,
        roughness: 0.6,
        metalness: 0.05
    });
    const topPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    topPanel.position.set(0, 0.5, 0.06);
    topPanel.castShadow = true;

    const bottomPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    bottomPanel.position.set(0, -0.5, 0.06);
    bottomPanel.castShadow = true;

    door.add(topPanel, bottomPanel);

    // --- Handle ---
    const handleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        metalness: 0.8,
        roughness: 0.3
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.3, 0, 0.08);
    handle.castShadow = true;
    door.add(handle);

    // --- Store references ---
    doorGroup.doorPivot = doorPivot;
    doorGroup.door = door;
    doorGroup.isOpen = false;
    doorGroup.openAngle = Math.PI / 2;
    doorGroup.currentAngle = 0;

    // Adjust overall orientation & size
    doorGroup.rotation.y = Math.PI / 2;
    doorGroup.scale.set(3, 3, 3);

    scene.add(doorGroup);

    return doorGroup;
}

const myDoor = createDoor(-22.5, 3, 17);

const doorClock = new THREE.Clock(); // Create clock outside animate function

function animateDoor(doorGroup) {
    if (!doorGroup || !doorGroup.doorPivot) return;

    const delta = doorClock.getDelta(); // Get delta from dedicated clock
    const speed = 2.0; // radians per second
    const targetAngle = doorGroup.isOpen ? doorGroup.openAngle : 0;

    // Smoothly move currentAngle toward targetAngle
    if (Math.abs(doorGroup.currentAngle - targetAngle) > 0.001) {
        const direction = doorGroup.currentAngle < targetAngle ? 1 : -1;
        doorGroup.currentAngle += direction * speed * delta;

        // Clamp so it doesn't overshoot
        if ((direction > 0 && doorGroup.currentAngle > targetAngle) ||
            (direction < 0 && doorGroup.currentAngle < targetAngle)) {
            doorGroup.currentAngle = targetAngle;
        }

        // Apply rotation to pivot
        doorGroup.doorPivot.rotation.y = doorGroup.currentAngle;
    }
}

let doorUnlocked = false;
let enteredDoorCode = [];
const doorCode = [7, 4, 9, 1]; // correct 4-digit code
let isNearDoor = false; // set via proximity check

function checkDoorProximity() {
    const playerPos = stickmanGroup.position.clone();
    const doorPos = new THREE.Vector3();
    myDoor.getWorldPosition(doorPos);

    const distance = playerPos.distanceTo(doorPos);
    const interactDistance = 6; // how close player needs to be

    if (distance < interactDistance) {
        if (!isNearDoor) {
            showInteractionPopup(true);
            isNearDoor = true;
        }
    } else {
        if (isNearDoor) {
            showInteractionPopup(false);
            isNearDoor = false;
        }
    }
}

function showDoorInput() {
    document.getElementById("doorInputUI").style.display = "block";
    enteredDoorCode = [];
    document.getElementById("doorEnteredDigits").innerText = "";
}

function hideDoorInput() {
    document.getElementById("doorInputUI").style.display = "none";
    document.getElementById("doorCodeFeedback").style.display = "none";
}

function createNumpad(x = 0, y = 0, z = 0) {
    const numpadGroup = new THREE.Group();
    numpadGroup.position.set(x, y, z);

    // --- Numpad Base ---
    const baseGeometry = new THREE.BoxGeometry(1, 0.1, 1.2);
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.castShadow = true;
    base.receiveShadow = true;
    numpadGroup.add(base);

    // --- Buttons ---
    const buttonGeometry = new THREE.BoxGeometry(0.25, 0.1, 0.25);
    const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.5 });

    const digits = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [null, 0, 'back']
    ];

    const xOffset = -0.25; // starting x position
    const zOffset = 0.45;  // starting z position
    const xStep = 0.25;
    const zStep = 0.3;

    for (let row = 0; row < digits.length; row++) {
        for (let col = 0; col < digits[row].length; col++) {
            const val = digits[row][col];
            if (val === null) continue;

            const btn = new THREE.Mesh(buttonGeometry, buttonMaterial.clone());
            btn.userData.value = val;
            btn.position.set(
                xOffset + col * xStep,
                0.05,             // slightly above base
                zOffset - row * zStep
            );
            btn.castShadow = true;
            btn.receiveShadow = true;
            numpadGroup.add(btn);
        }
    }

    // --- Add black divider lines ---
    const lineMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.7 });

    // Vertical lines (between columns)
    for (let i = 1; i < 3; i++) {
        const vLine = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 1.2), lineMaterial);
        vLine.position.set(xOffset + i * xStep - xStep/2, 0.06, 0); 
        numpadGroup.add(vLine);
    }

    // Horizontal lines (between rows)
    for (let i = 1; i < 4; i++) {
        const hLine = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 0.02), lineMaterial);
        hLine.position.set(0, 0.06, zOffset - i * zStep + zStep/2);
        numpadGroup.add(hLine);
    }

    scene.add(numpadGroup);
    return numpadGroup;
}

// Usage:
const myNumpad = createNumpad(-22.5, 3, 13);
myNumpad.rotation.x = -Math.PI / 2; // rotate to face player
myNumpad.rotation.z = -Math.PI / 2;  // slight angle

function createDishWithUtensils(x = 0, y = 0, z = 0) {
    const dishGroup = new THREE.Group();
    dishGroup.position.set(x, y, z);

    // --- Plate ---
    const plateGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32);
    const plateMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.6,
        metalness: 0.1
    });
    const plate = new THREE.Mesh(plateGeometry, plateMaterial);
    plate.castShadow = true;
    plate.receiveShadow = true;
    dishGroup.add(plate);

    // --- Fork ---
    const forkGeometry = new THREE.BoxGeometry(0.05, 0.2, 0.02);
    const forkMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 });
    const fork = new THREE.Mesh(forkGeometry, forkMaterial);
    fork.rotation.x = -Math.PI / 4;
    fork.position.set(-0.2, 0.03, 0.2);
    dishGroup.add(fork);

    // --- Knife ---
    const knifeGeometry = new THREE.BoxGeometry(0.05, 0.25, 0.03);
    const knifeMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.2 });
    const knife = new THREE.Mesh(knifeGeometry, knifeMaterial);
    knife.rotation.x = -Math.PI / 6;
    knife.position.set(0.2, 0.03, 0.2);
    dishGroup.add(knife);

    scene.add(dishGroup);
    return dishGroup;
}

function createDishStack(x = 0, y = 0, z = 0, count = 5) {
    const stackGroup = new THREE.Group();
    stackGroup.position.set(x, y, z);

    const plateGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32);
    const plateMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.6,
        metalness: 0.1
    });

    for (let i = 0; i < count; i++) {
        const plate = new THREE.Mesh(plateGeometry, plateMaterial);
        plate.position.y = i * 0.05; // stack vertically
        plate.castShadow = true;
        plate.receiveShadow = true;
        stackGroup.add(plate);
    }

    scene.add(stackGroup);
    return stackGroup;
}

// Example usage:
const tableDish1 = createDishWithUtensils(3.2, 2.6, 12);  // adjust table position
const tableDish2 = createDishWithUtensils(-3.2, 2.6, 12);  // adjust table position
const basinStack = createDishStack(9.8, 3.1, -16.3, 6); // adjust basin position



// --- Kitchen Cart Group ---
const cartGroup = new THREE.Group();

// mark as pushable and give half-extents (for overlap checks)
cartGroup.userData.pushable = true;
cartGroup.userData.halfX = 1.5; // half width (x)
cartGroup.userData.halfZ = 1.0; // half depth (z)

// Cart top
const cartTopGeometry = new THREE.BoxGeometry(3, 0.2, 2);
const cartTop = new THREE.Mesh(cartTopGeometry, tableMaterial);
cartTop.position.set(0, 2, 0); // relative to group
cartTop.castShadow = true;
cartTop.receiveShadow = true;
cartGroup.add(cartTop);

// Cart base
const cartBaseGeometry = new THREE.BoxGeometry(3, 1.6, 2);
const cartBase = new THREE.Mesh(cartBaseGeometry, cabinetMaterial);
cartBase.position.set(0, 1, 0); // relative to group
cartBase.castShadow = true;
cartBase.receiveShadow = true;
cartGroup.add(cartBase);

// Cart wheels
const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 32), wheelMaterial);
    const x = (i % 2 === 0) ? -1.2 : 1.2;  // left/right relative to cart
    const z = (i < 2) ? -0.8 : 0.8;       // front/back relative to cart
    wheel.position.set(x, 0.15, z);
    wheel.rotation.z = Math.PI / 2;       // lay the wheel flat
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    cartGroup.add(wheel);
}

// Position the whole cart in the scene
cartGroup.position.set(-8, 0, 6);
scene.add(cartGroup);
furniture.push(cartGroup);

// --- Cart physics properties ---
cartGroup.velocity = new THREE.Vector3(0, 0, 0); // current movement velocity
cartGroup.mass = 2; // adjust for "heaviness"
let cartFriction = 0.85; // slows the cart over time
const cartStopThreshold = 0.001; // threshold to zero small velocities

function checkStickmanCartCollision(stickmanPosition) {
    if (!cartGroup) return;
    const cartPos = cartGroup.position;
    const dx = stickmanPosition.x - cartPos.x;
    const dz = stickmanPosition.z - cartPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // compute cart top Y for vertical checks (so landing is allowed)
    const cartBox = new THREE.Box3().setFromObject(cartGroup);
    const cartTopY = cartBox.max.y;
    const playerY = stickmanGroup.position.y;

    // If player is at/above the cart top (within tolerance), allow landing — do not push.
    const verticalToleranceToLand = 0.12;
    if (playerY >= cartTopY - verticalToleranceToLand) {
        return;
    }

    const playerRadius = 0.4;
    const cartHalfX = cartGroup.userData.halfX || 1.5;
    const collisionRadius = cartHalfX + playerRadius;

    // nothing to do if we're outside collision radius
    if (dist >= collisionRadius) return;

    // avoid divide-by-zero for exact overlap
    if (dist < 1e-6) {
        // degeneracy: move player slightly along their intent (if any),
        // otherwise along camera forward, then gently nudge the cart.
        const fallbackDir = (lastPlayerIntent.lengthSq() > 0)
            ? lastPlayerIntent.clone()
            : new THREE.Vector3(Math.sin(mouseX), 0, Math.cos(mouseX)).normalize();

        const overlap = collisionRadius;
        const separation = Math.min(overlap, 0.25);

        // push player a little so they don't stick
        stickmanGroup.position.add(fallbackDir.clone().multiplyScalar(-separation * 0.5));

        // tiny impulse on cart so it starts moving if player was actively pushing
        const intentDot = lastPlayerIntent.dot(fallbackDir);
        if (intentDot > 0.25) {
            const pushStrength = THREE.MathUtils.clamp(0.12 * intentDot, 0.03, 0.25);
            if (!cartGroup.velocity) cartGroup.velocity = new THREE.Vector3();
            cartGroup.velocity.add(fallbackDir.clone().multiplyScalar((pushStrength * overlap) / cartGroup.mass));
        }
        return;
    }

    const pushDir = new THREE.Vector3(dx, 0, dz).normalize();
    const overlap = collisionRadius - dist;

    // Is the player actively moving toward the cart?
    const intentDot = lastPlayerIntent.dot(pushDir); // positive if moving toward cart
    const movingTowardsThreshold = 0.35; // tuneable

    if (intentDot > movingTowardsThreshold) {
        // Player is actively pushing into the cart — apply an impulse proportional
        // to how directly they are pushing (intentDot) and the overlap.
        const pushStrengthBase = 0.18; // base force scale (tweakable)
        const pushStrength = THREE.MathUtils.clamp(pushStrengthBase * intentDot, 0.03, 0.35);

        if (!cartGroup.velocity) cartGroup.velocity = new THREE.Vector3();
        const impulse = pushDir.clone().multiplyScalar((pushStrength * overlap) / cartGroup.mass);
        cartGroup.velocity.add(impulse);

        // tiny sideways nudge to player so they don't immediately re-penetrate;
        // keep this small so it doesn't push the player off the cart when landing.
        const playerNudgeAmount = Math.min(overlap * 0.12, 0.12);
        stickmanGroup.position.add(pushDir.clone().multiplyScalar(-playerNudgeAmount));
    } else {
        // Player not actively pushing: gently separate player so they don't stick.
        // Move the player just enough to remove overlap but not so much that it's jarring.
        const separation = overlap + 0.02;
        // use half separation so the player still feels like they're nudging the cart by holding position
        stickmanGroup.position.add(pushDir.clone().multiplyScalar(-separation * 0.5));
        // do NOT impart a large impulse to the cart in this case
    }
}

// --- Overlap resolver that preserves landing on top ---
// (replace your existing resolveStickmanCartOverlap with this or add it if missing)
function resolveStickmanCartOverlap() {
  const cartBox = new THREE.Box3().setFromObject(cartGroup);
  const cartTopY = cartBox.max.y;

  const dx = stickmanGroup.position.x - cartGroup.position.x;
  const dz = stickmanGroup.position.z - cartGroup.position.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  const playerRadius = 0.4;
  const collisionRadius = (cartGroup.userData.halfX || 1.5) + playerRadius;

  // Allow standing on top
  const allowIfAbove = 0.12;
  if (stickmanGroup.position.y >= cartTopY - allowIfAbove) {
    return;
  }

  if (distance < collisionRadius && distance > 1e-6) {
    const pushDir = new THREE.Vector3(dx, 0, dz).normalize();
    const overlap = collisionRadius - distance;
    const separation = overlap + 0.02;

    // ✅ Instead of pushing stickman completely out, just move them to the surface
    stickmanGroup.position.add(pushDir.clone().multiplyScalar(separation * 0.5));

    // ✅ Transfer most of the correction into cart movement
    if (!cartGroup.velocity) cartGroup.velocity = new THREE.Vector3(0, 0, 0);
    const cartImpulse = pushDir.clone().multiplyScalar(-(separation * 0.5) / cartGroup.mass);
    cartGroup.velocity.add(cartImpulse);
  } 
}



// Improved cart physics update
function updateCartPhysics() {
    // Apply velocity
    cartGroup.position.add(cartGroup.velocity);
    
    // Apply friction
    cartGroup.velocity.multiplyScalar(cartFriction);
    
    // Stop jittering when velocity very small
    if (cartGroup.velocity.lengthSq() < cartStopThreshold * cartStopThreshold) {
        cartGroup.velocity.set(0, 0, 0);
    }
    
    // Keep cart inside room bounds with proper collision
    const halfWidth = roomWidth / 2 - 1.5;
    const halfDepth = roomDepth / 2 - 1.5;
    
    // Check and handle wall collisions
    if (cartGroup.position.x < -halfWidth) {
        cartGroup.position.x = -halfWidth;
        cartGroup.velocity.x = Math.abs(cartGroup.velocity.x) * 0.3; // Bounce slightly
    } else if (cartGroup.position.x > halfWidth) {
        cartGroup.position.x = halfWidth;
        cartGroup.velocity.x = -Math.abs(cartGroup.velocity.x) * 0.3;
    }
    
    if (cartGroup.position.z < -halfDepth) {
        cartGroup.position.z = -halfDepth;
        cartGroup.velocity.z = Math.abs(cartGroup.velocity.z) * 0.3;
    } else if (cartGroup.position.z > halfDepth) {
        cartGroup.position.z = halfDepth;
        cartGroup.velocity.z = -Math.abs(cartGroup.velocity.z) * 0.3;
    }
    
    // Check collisions with other furniture (simplified)
    furniture.forEach(item => {
        if (item === cartGroup) return; // Skip self
        
        const itemBox = new THREE.Box3().setFromObject(item);
        const cartBox = new THREE.Box3().setFromObject(cartGroup);
        
        // Simple AABB collision
        if (cartBox.intersectsBox(itemBox)) {
            // Calculate push direction
            const dx = cartGroup.position.x - item.position.x;
            const dz = cartGroup.position.z - item.position.z;
            const pushDir = new THREE.Vector3(dx, 0, dz);
            
            if (pushDir.lengthSq() > 0) {
                pushDir.normalize();
                // Push cart away from furniture
                cartGroup.velocity.add(pushDir.multiplyScalar(0.2));
            }
        }
    });
}

// --- Materials ---
const rackMaterial = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, metalness: 0.2, roughness: 0.7 }); // wood
const bottleMaterial = new THREE.MeshStandardMaterial({ color: 0x2F4F2F, metalness: 0.1, roughness: 0.3, transparent: true, opacity: 0.9 }); // dark glass
const capMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 }); // cap

function createRackGroup() {
    const rackGroup = new THREE.Group();
    const beamThickness = 0.08;
    const rackWidth = 1.4;
    const rackHeight = 2.5;
    const rackDepth = 0.6;

    function addBeam(w, h, d, x, y, z) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rackMaterial);
        beam.position.set(x, y, z);
        rackGroup.add(beam);
    }

    // Vertical beams (front + back)
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
            addBeam(
                beamThickness,
                rackHeight,
                beamThickness,
                i * rackWidth - rackWidth / 2,
                rackHeight / 2,
                j * rackDepth - rackDepth / 2
            );
        }
    }

    // Horizontal beams (top + bottom, front + back)
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
            addBeam(
                rackWidth,
                beamThickness,
                beamThickness,
                0,
                i * rackHeight,
                j * rackDepth - rackDepth / 2
            );
        }
    }

    // Side beams (connect front + back, top + bottom)
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
            addBeam(
                beamThickness,
                beamThickness,
                rackDepth,
                i * rackWidth - rackWidth / 2,
                j * rackHeight,
                0
            );
        }
    }

    // Middle shelves (for 3 bottle rows)
    for (let r = 1; r < 3; r++) {
        addBeam(
            rackWidth,
            beamThickness,
            beamThickness,
            0,
            r * (rackHeight / 3),
            0
        );
    }

    rackGroup.castShadow = true;
    return rackGroup;
}

function createBottleGroup() {
    const bottleGroup = new THREE.Group();

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
            const bottle = new THREE.Group();

            // Bottle body
            const body = new THREE.Mesh(
                new THREE.CylinderGeometry(0.12, 0.11, 0.65, 20),
                bottleMaterial
            );
            body.rotation.z = Math.PI / 2;
            bottle.add(body);

            // Bottle neck
            const neck = new THREE.Mesh(
                new THREE.CylinderGeometry(0.055, 0.055, 0.18, 16),
                bottleMaterial
            );
            neck.position.x = 0.36;
            neck.rotation.z = Math.PI / 2;
            bottle.add(neck);

            // Bottle cap
            const cap = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16),
                capMaterial
            );
            cap.position.x = 0.45;
            cap.rotation.z = Math.PI / 2;
            bottle.add(cap);

            // Position in rack
            bottle.position.set(-0.6 + col * 0.4, 0.4 + row * 0.8, 0);
            bottleGroup.add(bottle);
        }
    }

    bottleGroup.castShadow = true;
    return bottleGroup;
}

function createFullRack(x, y, z) {
    const rack = createRackGroup();
    rack.position.set(x, y, z);
    scene.add(rack);
    furniture.push(rack);

    const bottles = createBottleGroup();
    bottles.position.set(x, y + 0.2, z); // lift slightly so bottles sit inside
    scene.add(bottles);
}

// Three racks
createFullRack(18, 0, 0);
createFullRack(18, 0, 2);
createFullRack(18, 0, 4);


//////////// SAFE /////////////
function createSafe(x = 19, y = -1, z = 16) {
    const safeGroup = new THREE.Group();

    // --- Safe Body ---
    const bodyGeometry = new THREE.BoxGeometry(4, 4, 4);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x444444,
        metalness: 0.8,
        roughness: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    safeGroup.add(body);

    // --- Door Pivot (acts as hinge) ---
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-2, 0, 2); // left edge of safe front
    safeGroup.add(doorPivot);

    // --- Door Mesh ---
    const doorGeometry = new THREE.BoxGeometry(4, 4, 0.3);
    const doorMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555,
        metalness: 0.9,
        roughness: 0.25
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.castShadow = true;
    door.receiveShadow = true;

    // Offset door so its left edge aligns with pivot
    door.position.set(2, 0, 0);

    doorPivot.add(door);

    // Store references for animation
    safeGroup.doorPivot = doorPivot;
    safeGroup.door = door;
    safeGroup.doorOpen = false;
    safeGroup.doorAngle = 0;

    // --- Dial ---
    const dialGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 32);
    const dialMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        metalness: 0.9,
        roughness: 0.4
    });
    const dial = new THREE.Mesh(dialGeometry, dialMaterial);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(0, 0, 0.2);
    door.add(dial); // attach to door so it swings with it

    // --- Handle ---
    const handleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 12);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        metalness: 0.8,
        roughness: 0.3
    });

    const handleH = new THREE.Mesh(handleGeometry, handleMaterial);
    handleH.rotation.z = Math.PI / 2;
    handleH.position.set(0, -1, 0.2);

    const handleV = new THREE.Mesh(handleGeometry, handleMaterial);
    handleV.position.set(0, -1, 0.2);

    door.add(handleH, handleV);

    // --- Bolts (fixed to body, not door) ---
    const boltGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8);
    const boltMaterial = new THREE.MeshStandardMaterial({
        color: 0xbbbbbb,
        metalness: 0.7,
        roughness: 0.5
    });
    for (let i = -1; i <= 1; i++) {
        const bolt = new THREE.Mesh(boltGeometry, boltMaterial);
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(1.9, i, 1.8);
        safeGroup.add(bolt);
    }

    // --- Position and Scale Safe ---
    safeGroup.position.set(x, y + 2, z);
    safeGroup.scale.set(0.5, 0.5, 0.5);
    safeGroup.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI);

    scene.add(safeGroup);
    furniture.push(safeGroup);

    return safeGroup;
}

const safe = createSafe();

// Dustbin

function createDustbin(x = 0, y = 0, z = 0) {
    const binGroup = new THREE.Group();

    // --- Bin Body ---
    const bodyGeometry = new THREE.CylinderGeometry(1, 1, 2, 32, 1, false);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x777777,
        metalness: 0.7,
        roughness: 0.3
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    binGroup.add(body);

    // --- Rim (slightly wider top ring) ---
    const rimGeometry = new THREE.TorusGeometry(1.05, 0.05, 16, 50);
    const rimMaterial = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        metalness: 0.8,
        roughness: 0.25
    });
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1; // top of bin
    binGroup.add(rim);

    // --- Lid Pivot (for opening) ---
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 1, 0); // pivot at top center
    binGroup.add(lidPivot);

    // --- Lid ---
    const lidGeometry = new THREE.CylinderGeometry(1.05, 1.05, 0.15, 32);
    const lidMaterial = new THREE.MeshStandardMaterial({
        color: 0x666666,
        metalness: 0.85,
        roughness: 0.2
    });
    const lid = new THREE.Mesh(lidGeometry, lidMaterial);
    lid.position.set(0, 0.1, 0);
    lid.castShadow = true;
    lid.receiveShadow = true;
    lidPivot.add(lid);

    // ✅ Make the lid slightly open by default
    lidPivot.rotation.z = THREE.MathUtils.degToRad(-20); // tilt backward ~20 degrees


    // Store references for later animation
    binGroup.lidPivot = lidPivot;
    binGroup.lid = lid;
    binGroup.lidOpen = false;
    binGroup.lidAngle = 0;

    // --- Pedal (front foot pedal to open lid) ---
    const pedalGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.2);
    const pedalMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.5,
        roughness: 0.6
    });
    const pedal = new THREE.Mesh(pedalGeometry, pedalMaterial);
    pedal.position.set(0, -1, 0.9); // front bottom
    pedal.castShadow = true;
    binGroup.add(pedal);

    // --- Handle (on lid) ---
    const handleGeometry = new THREE.TorusGeometry(0.2, 0.05, 12, 24);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        metalness: 0.9,
        roughness: 0.3
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0.15, -0.3);
    lid.add(handle);

    // --- Position and Scale Dustbin ---
    binGroup.position.set(x, y + 1, z); // lift so bottom sits on ground
    binGroup.scale.set(1, 1, 1);

    scene.add(binGroup);
    furniture.push(binGroup);

    return binGroup;
}

createDustbin(20.5, 0, 8);

// --- Safe Light (inside safe) ---
const safeLight = new THREE.PointLight(0xffffff, 0, 4); // start off (intensity=0)
safeLight.position.set(19, 1, 16); // place near safe
scene.add(safeLight);

function animateSafeLight(time) {
    if (safeUnlocked) {
        safeLight.intensity = 1.5 + Math.sin(time * 0.005) * 0.5;
    }
}

let safeUnlocked = false;
let safeOpen = false;
let enteredCode = [];
const safeCode = [3, 2, 5]; // valid digits, any order

const safeInteractDistance = 2.5;
let isNearSafe = false;

function checkSafeProximity() {
    const playerPos = stickmanGroup.position.clone();
    const safePos = new THREE.Vector3();
    safe.getWorldPosition(safePos);

    const distance = playerPos.distanceTo(safePos);

    if (distance < safeInteractDistance) {
        if (!isNearSafe) {
            showInteractionPopup(true);
            isNearSafe = true;
        }
    } else {
        if (isNearSafe) {
            showInteractionPopup(false);
            isNearSafe = false;
            hideSafeInput();
        }
    }
}

function showSafeInput() {
    document.getElementById("safeInputUI").style.display = "block";
    document.getElementById("enteredDigits").innerText = "";
}

function hideSafeInput() {
    document.getElementById("safeInputUI").style.display = "none";
    enteredCode = [];
}

function animateSafeDoor() {
    if (safeUnlocked && safe.doorAngle > -Math.PI / 2) {
        safe.doorAngle -= 0.02; // swing open smoothly
    }
    safe.doorPivot.rotation.y = safe.doorAngle;
}



// Bar Stools for island
for (let i = 0; i < 4; i++) {
    const stoolGroup = new THREE.Group();
    
    // Stool seat
    const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1), tableMaterial);
    stoolSeat.position.y = 1.8;
    stoolGroup.add(stoolSeat);
    
    // Stool leg
    const stoolLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8), new THREE.MeshLambertMaterial({ color: 0x000000 }));
    stoolLeg.position.y = 0.9;
    stoolGroup.add(stoolLeg);
    
    // Footrest
    const footrest = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 16), new THREE.MeshLambertMaterial({ color: 0x000000 }));
    footrest.position.y = 0.6;
    footrest.rotation.x = Math.PI / 2;
    stoolGroup.add(footrest);
    
    stoolGroup.position.set(-4 + i * 2.5, 0, 4);
    stoolGroup.children.forEach(child => child.castShadow = true);
    scene.add(stoolGroup);
    furniture.push(stoolGroup);
}

// --- Coffee Station Group ---
const coffeeGroup = new THREE.Group();
coffeeGroup.position.set(0, 0, 0); // base position, can adjust later

// Coffee counter
const coffeeCounterGeometry = new THREE.BoxGeometry(4, counterHeight, 2);
const coffeeCounter = new THREE.Mesh(coffeeCounterGeometry, counterMaterial);
coffeeCounter.position.set(0, counterHeight / 2, 0); // relative to group
coffeeCounter.castShadow = true;
coffeeGroup.add(coffeeCounter);

// Coffee machine
const coffeeGeometry = new THREE.BoxGeometry(1.5, 1.2, 1);
const coffeeMachine = new THREE.Mesh(coffeeGeometry, new THREE.MeshLambertMaterial({ color: 0x000000 }));
coffeeMachine.position.set(0, counterHeight + 0.6, 0); // relative to counter
coffeeMachine.castShadow = true;
coffeeGroup.add(coffeeMachine);

// Toaster
const toasterGeometry = new THREE.BoxGeometry(1, 0.8, 0.8);
const toaster = new THREE.Mesh(toasterGeometry, applianceMaterial);
toaster.position.set(1, counterHeight + 0.4, 1); // relative to group
toaster.castShadow = true;
coffeeGroup.add(toaster);

// Position the whole station in the room
coffeeGroup.position.set(-16, 3, -16.8);
scene.add(coffeeGroup);
furniture.push(coffeeGroup);

/// Create stickman character (will be replaced by model)
const stickmanGroup = new THREE.Group();
stickmanGroup.position.set(-8, 0, 8);
scene.add(stickmanGroup);

// Load the Blender model
const loader = new GLTFLoader();
let mixer; // Add this variable to store the animation mixer
let walkAction; // Add this to store the walk animation

loader.load('maybeModel4.glb', (gltf) => {
    const model = gltf.scene;
    
    model.traverse((child) => {
        if (child.isMesh) {
            // Check if this mesh is a floor/ground plane
            // Common names: "Plane", "Ground", "Floor", etc.
            const name = child.name.toLowerCase();
            if (name.includes('plane') || name.includes('ground') || name.includes('floor')) {
                child.visible = false; // Hide it
                // Or remove it completely:
                // child.parent.remove(child);
            } else {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        }
    });
    
    // Adjust scale/position if needed
    model.scale.set(1, 1, 1);
    model.position.y = -1;
    
    stickmanGroup.add(model);
    
    // Setup animations
    if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        
        // Find the walking animation (adjust the index or name as needed)
        walkAction = mixer.clipAction(gltf.animations[0]); // Use index 0 or find by name
        // If you know the animation name, use: 
        // const walkClip = THREE.AnimationClip.findByName(gltf.animations, 'Walk');
        // walkAction = mixer.clipAction(walkClip);
    }
}, undefined, (error) => {
    console.error('Error loading model:', error);
});

// --- Flashlight for stickman ---
const flashlight = new THREE.SpotLight(0xffffff, 5, 25, Math.PI / 4, 0.5, 1);
flashlight.castShadow = true;
flashlight.shadow.mapSize.width = 2048;
flashlight.shadow.mapSize.height = 2048;
flashlight.shadow.camera.near = 0.5;
flashlight.shadow.camera.far = 30;
flashlight.shadow.bias = -0.0001;
flashlight.shadow.focus = 1;

// Position flashlight at head level
flashlight.position.set(0, 1.6, 0);
stickmanGroup.add(flashlight);

// Create flashlight target
const flashlightTarget = new THREE.Object3D();
scene.add(flashlightTarget); // Add to scene, NOT stickmanGroup
flashlight.target = flashlightTarget;

// Initially off
flashlight.visible = false;

window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "f") {
        console.log("Toggling flashlight");
        flashlight.visible = !flashlight.visible;
    }
});

function updateFlashlight() {
    if (!flashlight.visible) return;
    
    // Get camera direction
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // Calculate target position 10 units in front of camera
    const targetPosition = new THREE.Vector3();
    camera.getWorldPosition(targetPosition);
    targetPosition.add(cameraDirection.multiplyScalar(10));
    
    // Update flashlight target position
    flashlightTarget.position.copy(targetPosition);
}

// --- Ambient light (faint but enough to see) ---
const ambientLight = new THREE.AmbientLight(0x444455, 1.0); 
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 0.9);
mainLight.position.set(15, 20, 15);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 4096;
mainLight.shadow.mapSize.height = 4096;
mainLight.shadow.camera.near = 0.1;
mainLight.shadow.camera.far = 80;
mainLight.shadow.camera.left = -30;
mainLight.shadow.camera.right = 30;
mainLight.shadow.camera.top = 30;
mainLight.shadow.camera.bottom = -30;
scene.add(mainLight);

// --- Main room light (ceiling bulb) ---
const bulbLight = new THREE.PointLight(0xfff2e6, 1.0, 60, 2); 
bulbLight.position.set(0, wallHeight - 1, 0); // center ceiling
bulbLight.castShadow = true;
bulbLight.shadow.mapSize.width = 2048;
bulbLight.shadow.mapSize.height = 2048;
scene.add(bulbLight);

// --- Accent light (over the door/puzzle area) ---
const doorLight = new THREE.SpotLight(0xff6666, 0.6, 50, Math.PI / 6, 0.3, 2);
doorLight.position.set(10, wallHeight - 2, 10); 
doorLight.target.position.set(10, 0, 10); 
doorLight.castShadow = true;
scene.add(doorLight);
scene.add(doorLight.target);

// --- Subtle directional fill (like moonlight) ---
const moonLight = new THREE.DirectionalLight(0x8888aa, 0.3);
moonLight.position.set(-15, 20, -10);
moonLight.castShadow = false;
scene.add(moonLight);

// helper to create a hanging lamp with a point light
function createHangingLight(x, y, z, intensity = 0.6, distance = 40) {
    const lampGroup = new THREE.Group();

    // cord (thin cylinder from ceiling down)
    const cordGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2, 8);
    const cordMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const cord = new THREE.Mesh(cordGeometry, cordMaterial);
    cord.position.y = -1; // hang down a bit
    cord.castShadow = true;
    cord.receiveShadow = true;
    lampGroup.add(cord);

    // lampshade (inverted cone)
    const shadeGeometry = new THREE.ConeGeometry(1.2, 1.5, 16, 1, true);
    const shadeMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        metalness: 0.3,
        roughness: 0.6
    });
    const shade = new THREE.Mesh(shadeGeometry, shadeMaterial);
    shade.position.y = -2.5;
    shade.castShadow = true;
    shade.receiveShadow = true;
    //lampGroup.add(shade);

    // bulb (small sphere, emissive)
    const bulbGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const bulbMaterial = new THREE.MeshStandardMaterial({
        emissive: 0xffffbb,
        emissiveIntensity: 1,
        color: 0xffffff
    });
    const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
    bulb.position.y = -2.5;
    bulb.castShadow = true;
    bulb.receiveShadow = true;
    lampGroup.add(bulb);

    // point light (actual illumination)
    const light = new THREE.PointLight(0xffffff, intensity, distance);
    light.castShadow = true;
    light.position.set(0, -2.5, 0); // inside bulb

    // Optimize shadows (important with multiple point lights)
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    light.shadow.bias = -0.0005;
    light.shadow.radius = 2;

    lampGroup.add(light);

    // position whole lamp group in the scene
    lampGroup.position.set(x, y, z);

    scene.add(lampGroup);
    return lampGroup;
}

// Kitchen lights
const kitchenLight1 = createHangingLight(0, 12, 0, 0.6, 40);
const kitchenLight2 = createHangingLight(-15, 12, -8, 0.5, 35);
const kitchenLight3 = createHangingLight(15, 12, -8, 0.5, 35);

scene.add(kitchenLight1);
scene.add(kitchenLight2);
scene.add(kitchenLight3);


// Under-cabinet lighting
const underLight1 = new THREE.PointLight(0xFFFFE0, 0.3, 15);
underLight1.position.set(-12, counterHeight + 0.5, -16.8);
scene.add(underLight1);

const underLight2 = new THREE.PointLight(0xFFFFE0, 0.3, 15);
underLight2.position.set(12, counterHeight + 0.5, -16.8);
scene.add(underLight2);

// Position camera for third person view (adjusted for bigger space)
camera.position.set(0, 15, 20);
camera.lookAt(stickmanGroup.position);

// Animation variables
let walkCycle = 0;
const walkSpeed = 3;
let isWalking = false;

// Mouse controls for camera
let mouseX = 0;
let mouseY = 0;
let isMouseDown = false;

// global: the player's last movement intent in world space (unit vector)
let lastPlayerIntent = new THREE.Vector3();



document.addEventListener('mousedown', () => {
    isMouseDown = true;
});

document.addEventListener('mouseup', () => {
    isMouseDown = false;
});

document.addEventListener('mousemove', (event) => {
    if (!isMouseDown) return;
    
    mouseX += event.movementX * 0.01;
    mouseY += event.movementY * 0.01;
    
    mouseY = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, mouseY));
});

// Keyboard controls
document.addEventListener('keydown', (event) => {
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
            event.preventDefault(); // Prevent page scroll
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

// Collision detection for vertical surfaces (landing on objects)
function checkCollisions(position, playerY) {
    let highestSurface = 0; // Ground level
    
    // Check all furniture pieces
    furniture.forEach(item => {
        const box = new THREE.Box3().setFromObject(item);
        
        // Check if player is within the horizontal bounds of the object (with some tolerance)
        if (position.x >= box.min.x - 0.3 && position.x <= box.max.x + 0.3 &&
            position.z >= box.min.z - 0.3 && position.z <= box.max.z + 0.3) {
            
            // If this object's top surface is higher than current highest, use it
            if (box.max.y > highestSurface) {
                // Only land on it if player is close enough to the surface
                if (Math.abs(playerY - box.max.y) < 1.0) {
                    highestSurface = box.max.y;
                }
            }
        }
    });
    
    return highestSurface;
}

function checkHorizontalCollisions(newPosition, playerY, { ignorePushables = true } = {}) {
    const playerRadius = 0.4;
    const epsilon = 0.05;

    for (let item of furniture) {
        if (ignorePushables && item.userData && item.userData.pushable) continue;

        const box = new THREE.Box3().setFromObject(item);

        // Special handling for counters - check if player is underneath
        if (item === backCounter) {
            // Counter dimensions and position
            const counterBottom = box.min.y;
            const counterTop = box.max.y;
            const playerHead = playerY + 1.8; // approximate player height

            // If player can fit underneath the counter, don't block horizontal movement
            if (playerHead < counterBottom) {
                continue; // Player can walk underneath
            }
        }

        const expandedBox = new THREE.Box3(
            new THREE.Vector3(box.min.x - playerRadius, box.min.y, box.min.z - playerRadius),
            new THREE.Vector3(box.max.x + playerRadius, box.max.y, box.max.z + playerRadius)
        );

        if (newPosition.x >= expandedBox.min.x && newPosition.x <= expandedBox.max.x &&
            newPosition.z >= expandedBox.min.z && newPosition.z <= expandedBox.max.z) {

            if (playerY >= expandedBox.max.y - epsilon) {
                continue; // Player can walk on top
            }

            if (playerY <= expandedBox.max.y) {
                return false; // Collision detected
            }
        }
    }

    return true;
}


// Movement and physics function
function updateStickman() {
    const direction = new THREE.Vector3();
    
    // Get the stickman's current facing direction
    const stickmanForward = new THREE.Vector3(0, 0, 1);
    const stickmanRight = new THREE.Vector3(-1, 0, 0);
    
    // Apply the stickman's rotation to get world-space directions
    stickmanForward.applyQuaternion(stickmanGroup.quaternion);
    stickmanRight.applyQuaternion(stickmanGroup.quaternion);
    
    // Build movement direction relative to stickman's orientation
    if (keys.w) direction.add(stickmanForward);  // Forward relative to stickman
    if (keys.s) direction.sub(stickmanForward);  // Backward relative to stickman
    if (keys.a) direction.sub(stickmanRight);    // Left relative to stickman
    if (keys.d) direction.add(stickmanRight);    // Right relative to stickman
    
    isWalking = direction.length() > 0;

    // record player's movement intent in world-space (used for cart pushing)
    if (direction.lengthSq() > 1e-6) {
        lastPlayerIntent.copy(direction).normalize();
    } else {
        lastPlayerIntent.set(0, 0, 0);
    }

    // Jumping
    if (keys.space && isGrounded) {
        velocityY = jumpPower;
        isGrounded = false;
    }
    
    // Apply gravity
    velocityY -= gravity;
    stickmanGroup.position.y += velocityY;
    
    // Always check what surface we should be on FIRST
    const currentGroundLevel = checkCollisions(stickmanGroup.position, stickmanGroup.position.y);
    
    // If we're below or at the surface level, snap to it
    if (stickmanGroup.position.y <= currentGroundLevel + 0.1) {
        stickmanGroup.position.y = currentGroundLevel;
        velocityY = 0;
        isGrounded = true;
    } else {
        isGrounded = false;
    }
    
    // NOW handle horizontal movement with the UPDATED vertical position
    if (isWalking) {
        if (walkAction && !walkAction.isRunning()) {
            walkAction.play();
        }
        direction.normalize();
        direction.multiplyScalar(moveSpeed);
        
        const newPosition = stickmanGroup.position.clone();
        newPosition.x += direction.x;
        newPosition.z += direction.z;
        
        // Room bounds collision
        const halfWidth = roomWidth / 2 - 0.5;
        const halfDepth = roomDepth / 2 - 0.5;
        newPosition.x = Math.max(-halfWidth, Math.min(halfWidth, newPosition.x));
        newPosition.z = Math.max(-halfDepth, Math.min(halfDepth, newPosition.z));
        
        // Check horizontal collisions with the CURRENT (updated) Y position
        // Allow movement while ignoring pushable objects so the player can push them
        if (checkHorizontalCollisions(newPosition, stickmanGroup.position.y, { ignorePushables: true })) {
            stickmanGroup.position.x = newPosition.x;
            stickmanGroup.position.z = newPosition.z;
        }


        
        // Face movement direction (only rotate when moving)
        // Make stickman face the same direction as the camera
        stickmanGroup.rotation.y = mouseX + Math.PI;
        
        // Walking animation (rest of animation code stays the same)
        // walkCycle += walkSpeed * 0.05;
        
        // leftLeg.rotation.x = Math.sin(walkCycle) * 0.3;
        // rightLeg.rotation.x = -Math.sin(walkCycle) * 0.3;
        
        // leftArm.rotation.x = -Math.sin(walkCycle) * 0.15;
        // rightArm.rotation.x = Math.sin(walkCycle) * 0.15;
        
        // body.position.y = 1.0 + Math.abs(Math.sin(walkCycle * 2)) * 0.02;
        // head.position.y = 1.6 + Math.abs(Math.sin(walkCycle * 2)) * 0.02;
        // leftEye.position.y = 1.65 + Math.abs(Math.sin(walkCycle * 2)) * 0.02;
        // rightEye.position.y = 1.65 + Math.abs(Math.sin(walkCycle * 2)) * 0.02;
    } else {
        // Reset to idle pose
        // leftLeg.rotation.x = 0;
        // rightLeg.rotation.x = 0;
        // leftArm.rotation.x = 0;
        // rightArm.rotation.x = 0;
        // body.position.y = 1.0;
        // head.position.y = 1.6;
        // leftEye.position.y = 1.65;
        // rightEye.position.y = 1.65;
        if (walkAction && walkAction.isRunning()) {
            walkAction.stop();
        }
    }
    
    // Update camera to follow stickman (adjusted for bigger space)
    // Third-person: camera behind and above
    const distance = 20;
    const height = 15;
    const targetCameraX = stickmanGroup.position.x + distance * Math.sin(mouseX);
    const targetCameraZ = stickmanGroup.position.z + distance * Math.cos(mouseX);
    const targetCameraY = stickmanGroup.position.y + height + mouseY * 8;
    
    camera.position.x += (targetCameraX - camera.position.x) * 0.1;
    camera.position.z += (targetCameraZ - camera.position.z) * 0.1;
    camera.position.y += (targetCameraY - camera.position.y) * 0.1;
    
    camera.lookAt(new THREE.Vector3(
        stickmanGroup.position.x,
        stickmanGroup.position.y + 1.5,
        stickmanGroup.position.z
    ));
}

// Render loop
let isGameOver = false;

function animate() {
    requestAnimationFrame(animate); // Always request next frame
    
    if (isGameOver) return; // stop everything if game over
    
    if (isPaused) {
        // Still render the scene when paused, just don't update game logic
        renderer.render(scene, camera);
        return;
    }

    // Update animation mixer
    if (mixer) {
        const delta = clock.getDelta();
        mixer.update(delta);
    }


    updateFlashlight();
    
    // Normal game updates
    updateStickman();

    // Cart physics
    checkStickmanCartCollision(stickmanGroup.position);
    updateCartPhysics();
    resolveStickmanCartOverlap();

    // Cabinet
    animateCabinetDoor();
    const time = performance.now();
    animateCabinetLight(time);
    checkCabinetProximity();
    checkButtonProximity();

    // Safe
    animateSafeDoor();
    animateSafeLight(time);
    checkSafeProximity();

    // Door
    checkDoorProximity();
    animateDoor(myDoor);

    // Island light
    animateIslandLight(time);
    checkIslandLightProximity();

    // Dishwasher light
    animateDishwasherLight(time);
    checkDishwasherLightProximity();

    // Stove light
    animateStoveLight(time);
    checkStoveLightProximity();

    // Make flashlight target follow camera direction
    if (flashlight.visible) {
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        flashlightTarget.position.copy(stickmanGroup.position)
            .add(cameraDirection.multiplyScalar(5)); // 5 units in front of player
    }

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add instructions to the page
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
    <strong>Controls:</strong><br>
    WASD - Move around<br>
    SPACEBAR - Jump<br>
    F - Toggle flashlight<br>
    ESC - Pause game<br>
    Click and drag - Rotate camera<br><br>

    OBJECTIVES:<br>
    Unlock the hidden cabinet<br>
    Find and unlock the safe<br>
    Unlock the door<br><br>
    Interact with the fragments for more clues!
`;
document.body.appendChild(instructions);

// Add this after the instructions element creation
const victoryScreen = document.createElement('div');
victoryScreen.id = 'victoryScreen';
victoryScreen.style.cssText = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    z-index: 1000;
    justify-content: center;
    align-items: center;
    flex-direction: column;
`;
victoryScreen.innerHTML = `
    <h1 style="color: #4CAF50; font-size: 48px; margin-bottom: 20px;">Level Complete!</h1>
    <p style="color: white; font-size: 24px; margin-bottom: 30px;">You escaped the kitchen!</p>
    <button id="nextLevelBtn" style="padding: 15px 30px; font-size: 18px; cursor: pointer; margin: 10px;">Next Level</button>
    <button id="menuBtn" style="padding: 15px 30px; font-size: 18px; cursor: pointer; margin: 10px;">Level-select Menu</button>
`;
document.body.appendChild(victoryScreen);

document.getElementById('nextLevelBtn').addEventListener('click', () => {
    localStorage.removeItem('gameEndTime');
    // Change this to your next level's HTML file
    window.location.href = 'livingRoom.html'; // or wherever your next level is
});

document.getElementById('menuBtn').addEventListener('click', () => {
    localStorage.removeItem('gameEndTime');
    window.location.href = 'level-select.html'; // or your main menu
});

// --- Timer + Game Over ---


const timerEl = document.getElementById("timer");
const gameOverEl = document.getElementById("gameOver");
const restartBtn = document.getElementById("restartBtn");

const TOTAL_TIME = 300; // 5 minutes

// Check if we're resuming from a pause or starting fresh
const storedEndTime = localStorage.getItem("gameEndTime");
const wasJustPaused = sessionStorage.getItem("gamePaused");

let endTime;
if (storedEndTime && wasJustPaused === "true") {
    // Resuming from pause - use stored time
    endTime = parseInt(storedEndTime, 10);
} else {
    // Fresh start - create new timer
    endTime = Date.now() + TOTAL_TIME * 1000;
}

localStorage.setItem("gameEndTime", endTime);
sessionStorage.setItem("gamePaused", "false");

function updateTimer() {
  if (isGameOver) return;

  const now = Date.now();
  const remaining = Math.max(0, Math.floor((endTime - now) / 1000));

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  timerEl.textContent = `${minutes}:${seconds}`;

  if (remaining <= 0) {
    clearInterval(timerInterval);
    timerEl.style.display = "none";
    gameOverEl.style.display = "block";
    isGameOver = true;
  }
}

let timerInterval = setInterval(updateTimer, 1000);
updateTimer();

let pausedTimeRemaining = null; // Add this with your other timer variables

function pauseGame() {
    isPaused = true;
    clearInterval(timerInterval);
    
    // Store how much time is left
    const now = Date.now();
    pausedTimeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
    
    document.getElementById("pauseMenu").style.display = "block";
}

function resumeGame() {
    isPaused = false;
    
    // Create new end time based on paused remaining time FIRST
    if (pausedTimeRemaining !== null) {
        endTime = Date.now() + pausedTimeRemaining * 1000;
        localStorage.setItem("gameEndTime", endTime);
        pausedTimeRemaining = null;
    }
    
    // THEN update the display and restart the interval
    updateTimer(); // Update display with new endTime
    timerInterval = setInterval(updateTimer, 1000);
    
    document.getElementById("pauseMenu").style.display = "none";
}

// Restart button
restartBtn.addEventListener("click", () => {
  localStorage.removeItem("gameEndTime");
  location.reload();
});

// Start the animation loop
animate();

// Pause menu buttons (must be after HTML is loaded)
document.getElementById("resumeBtn").addEventListener("click", () => {
    resumeGame();
});

document.getElementById("quitBtn").addEventListener("click", () => {
    localStorage.removeItem("gameEndTime");
    window.location.href = "level-select.html";
});

document.getElementById("restartBtnPause").addEventListener("click", () => {
    localStorage.removeItem("gameEndTime");
    location.reload();
});

// Also update the game over restart button
restartBtn.addEventListener("click", () => {
    localStorage.removeItem("gameEndTime");
    location.reload();
})