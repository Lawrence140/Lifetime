import * as THREE from './three/build/three.module.js';
import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js';

// -------------------- Basic scene, camera, renderer --------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f0f10);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// -------------------- Character loader defs (unchanged) --------------------
let playerModelRoot = null;
const gltfLoader = new GLTFLoader();
const MODEL_PATH = './maybeModel_LivingRoom4.glb';

// -------------------- Animation state (unchanged) --------------------
let mixer = null;
let idleAction = null;
let walkAction = null;
let holdFlashAction = null;
let currentAction = null;
let wasMoving = false;

// -------------------- Clock --------------------
const clock = new THREE.Clock();

// -------------------- Character scale --------------------
const BASE_CHARACTER_HEIGHT = 1.8;
const CHARACTER_TARGET_HEIGHT = 1.5;
const CHARACTER_SCALE = CHARACTER_TARGET_HEIGHT / BASE_CHARACTER_HEIGHT;

// -------------------- Movement & controls --------------------
const keys = { w: false, a: false, s: false, d: false, space: false };
let isPulling = false;
let pulledObj = null;
const CRATE_PULL_SPEED = 0.045;     // base meters per frame at 60fps; scaled by dt
const CRATE_SLIDE_FACTOR = 0.2;
const PULL_TURN_SMOOTH = 0.08;
let pullForward = new THREE.Vector3(0, 0, 1);
let isPaused = false;
let thirdPerson = true;
let introPlaying = false; // when true, player input/interaction is blocked during intro text

const moveSpeed = 0.05;
const jumpPower = 0.25;
const gravity = 0.015;
let velocityY = 0;
let isGrounded = false;
// Collision tuning
const playerRadius = 0.55; // increased for better collision
const stepHeight = 0.35; // reduced to more realistic step height to prevent walking through furniture
const skin = 0.05;

// -------------------- Room dims --------------------
const roomWidth = 20;
const roomDepth = 16;
const wallHeight = 8;

// -------------------- Materials & lights --------------------
const floorMat = new THREE.MeshLambertMaterial({ color: 0x2b1d0e });
const wallMat = new THREE.MeshLambertMaterial({ color: 0x242424 });
const ceilMat = new THREE.MeshLambertMaterial({ color: 0x171717 });

const hemi = new THREE.HemisphereLight(0x1a1a1a, 0x050505, 0.15);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0x4a4a52, 0.2);
dir.position.set(10, 20, 10);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
scene.add(dir);

// -------------------- Floor / walls --------------------
const floorGeo = new THREE.PlaneGeometry(roomWidth, roomDepth);
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const ceiling = new THREE.Mesh(floorGeo, ceilMat);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = wallHeight;
scene.add(ceiling);

const wallThickness = 0.4;
const northWall = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, wallHeight, wallThickness), wallMat);
northWall.position.set(0, wallHeight / 2, -roomDepth / 2 + wallThickness / 2);
northWall.receiveShadow = true;
scene.add(northWall);

const southWall = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, wallHeight, wallThickness), wallMat);
southWall.position.set(0, wallHeight / 2, roomDepth / 2 - wallThickness / 2);
southWall.receiveShadow = true;
scene.add(southWall);

const eastWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, roomDepth), wallMat);
eastWall.position.set(roomWidth / 2 - wallThickness / 2, wallHeight / 2, 0);
eastWall.receiveShadow = true;
scene.add(eastWall);

const westWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, roomDepth), wallMat);
westWall.position.set(-roomWidth / 2 + wallThickness / 2, wallHeight / 2, 0);
westWall.receiveShadow = true;
scene.add(westWall);

// -------------------- Colliders, furniture containers --------------------
const furniture = [];
const staticColliders = [northWall, southWall, eastWall, westWall];
const pushables = [];
const allColliders = () => staticColliders.concat(pushables);
// -------------------- Push/pull state --------------------
let isPushing = false;
let pushedObj = null;

// -------------------- Interaction elements --------------------
const interactionPopup = document.getElementById('interactionPopup');
const textPanel = document.getElementById('textPanel');
function showInteractionPopup(show) {
	if (!interactionPopup) return;
	interactionPopup.style.display = show ? 'block' : 'none';
}
function showMessage(msg = '', ms = 3000) {
	if (!textPanel) return;
	textPanel.innerHTML = msg;
	textPanel.style.display = 'block';
	if (ms > 0) setTimeout(() => (textPanel.style.display = 'none'), ms);
}

// -------------------- Pause menu (unified) --------------------
const pauseMenu = document.getElementById('pauseMenu');
const resumeBtn = document.getElementById('resumeBtn');
const restartBtnPause = document.getElementById('restartBtnPause');
const quitBtn = document.getElementById('quitBtn');
resumeBtn?.addEventListener('click', () => resumeGame());
restartBtnPause?.addEventListener('click', () => { localStorage.removeItem('gameEndTime'); location.reload(); });
quitBtn?.addEventListener('click', () => { localStorage.removeItem('gameEndTime'); window.location.href = './level-select.html'; });
function pauseGame() {
	isPaused = true;
	if (pauseMenu) pauseMenu.style.display = 'block';
}
function resumeGame() {
	isPaused = false;
	if (pauseMenu) pauseMenu.style.display = 'none';
}

// -------------------- Mouse look --------------------
let yaw = 0;
let pitch = 0;
const maxPitch = THREE.MathUtils.degToRad(80);

renderer.domElement.addEventListener('click', () => {
	if (!document.pointerLockElement) renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {});
document.addEventListener('mousemove', (e) => {
	if (!document.pointerLockElement) return;
	const sensitivity = 0.0025;
	yaw -= e.movementX * sensitivity;
	pitch -= e.movementY * sensitivity;
	pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
});

// -------------------- Player group --------------------
const player = new THREE.Group();
player.position.set(0, 0, 0);
scene.add(player);

// -------------------- Flashlight (spotlight) --------------------
const flashlight = new THREE.SpotLight(0xffffff, 0, 25, Math.PI / 4, 0.5, 1);
flashlight.castShadow = true;
flashlight.shadow.mapSize.width = 2048;
flashlight.shadow.mapSize.height = 2048;
flashlight.shadow.camera.near = 0.5;
flashlight.shadow.camera.far = 30;
flashlight.shadow.bias = -0.0001;
flashlight.shadow.focus = 1;
const flashlightTarget = new THREE.Object3D();
scene.add(flashlightTarget);
flashlight.target = flashlightTarget;
flashlight.visible = false;
scene.add(flashlight);

// Flashlight pickup proxy and ownership
let flashlightPickup = null;
let hasFlashlight = false;
let handFlashlightModel = null;

// -------------------- Battery & flicker vars --------------------
const MAX_BATTERY = 240.0; // seconds
let battery = MAX_BATTERY;
let flickerTimer = 0;
let blackoutTimer = 0;
let inBlackout = false;
let blackoutDuration = 0;

// -------------------- Battery UI --------------------
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

// Helper to create pickup model
function createFlashlightPickup(pos = new THREE.Vector3(-7.2, 0.2, 2)) {
	const g = new THREE.Group();
	const body = new THREE.Mesh(
		new THREE.CylinderGeometry(0.06, 0.06, 0.28, 12),
		new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.4 })
	);
	body.rotation.z = Math.PI / 2;
	body.position.set(0, 0, 0);
	body.castShadow = true; body.receiveShadow = true;
	g.add(body);

	const head = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.4, roughness: 0.5 }));
	head.position.set(0.18, 0, 0);
	head.rotation.z = Math.PI / 2;
	head.castShadow = true;
	g.add(head);

	g.position.copy(pos);
	scene.add(g);
	flashlightPickup = g;
}
createFlashlightPickup(new THREE.Vector3(-7.5, 0.2, 2.2));

// -------------------- Update flashlight each frame --------------------
function updateFlashlight(dt) {
	if (!hasFlashlight) return;

	// Simple battery drain + gentle deterministic flicker based on time and battery level.
	if (flashlight.visible && battery > 0) {
		const drainRate = thirdPerson ? 1.0 : 1.2;
		battery = Math.max(0, battery - dt * drainRate);

		const batteryFrac = battery / MAX_BATTERY; // 1..0
		const now = performance.now() / 1000;

		// Base intensity depends on camera mode
		const base = thirdPerson ? thirdPersonFlashlightIntensity : firstPersonFlashlightIntensity;

		// Smooth, time-based flicker that increases as battery drops
		const flickerFreq = 6 + (1 - batteryFrac) * 18; // faster when low
		const flickerAmp = 0.06 + (1 - batteryFrac) * 0.28; // stronger when low
		const sine = Math.sin(now * flickerFreq) * flickerAmp;

		// Occasional short dip (random) more likely when battery is low
		const dip = (Math.random() < 0.015 * (1 - batteryFrac)) ? -0.8 * (1 - batteryFrac) : 0;

		const intensity = Math.max(0, base * (0.35 + 0.65 * batteryFrac) * (1 + sine + dip));
		flashlight.intensity = intensity;

		// Slight cone widening when battery is healthy, narrow when low
		flashlight.angle = THREE.MathUtils.clamp((Math.PI / 4) * (0.9 + 0.22 * batteryFrac), Math.PI / 18, Math.PI / 1.5);

		// Update battery UI
		batteryBar.style.display = 'block';
		const pct = Math.round(batteryFrac * 100);
		batteryLabel.textContent = `${pct}%`;
		const widthPct = Math.max(0, Math.min(100, pct));
		batteryFill.style.width = `${widthPct}%`;
		if (widthPct > 55) batteryFill.style.background = '#a6ffb3';
		else if (widthPct > 25) batteryFill.style.background = '#ffd76b';
		else batteryFill.style.background = '#ff6b6b';

		if (battery <= 0) {
			flashlight.visible = false;
			showMessage("Your flashlight dies. It won't come back on.", 3000);
			batteryBar.style.display = 'none';
			updateAnimationState();
			return;
		}
	}

	// Position flashlight: hand in third-person if available, otherwise head/camera
	if (thirdPerson && playerModelRoot && handFlashlightModel) {
		handFlashlightModel.visible = flashlight.visible;
		const handWorldPos = new THREE.Vector3();
		handFlashlightModel.getWorldPosition(handWorldPos);
		flashlight.position.copy(handWorldPos);
		const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
		const targetPos = handWorldPos.clone().add(forward.multiplyScalar(10));
		flashlightTarget.position.copy(targetPos);
	} else {
		if (handFlashlightModel) handFlashlightModel.visible = false;
		const headPos = new THREE.Vector3(player.position.x, player.position.y + 1.6, player.position.z);
		flashlight.position.copy(headPos);
		const cameraDirection = new THREE.Vector3();
		camera.getWorldDirection(cameraDirection);
		const targetPosition = headPos.clone().add(cameraDirection.multiplyScalar(10));
		flashlightTarget.position.copy(targetPosition);
	}
}
const thirdPersonFixedY = 1.8 * CHARACTER_SCALE;
const thirdPersonDistance = 2.0;
const cameraOffsetY = 1.65 * CHARACTER_SCALE;

const CAMERA_LERP_SPEED_TP = 0.15;
const CAMERA_LERP_SPEED_FP = 0.5;


// -------------------- Raycasters --------------------
const cameraRaycaster = new THREE.Raycaster();
const interactionRay = new THREE.Vector3(); // for crate pulling

// -------------------- Camera Update --------------------
function updateCamera() {
    // Forward and right vectors based on yaw
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Apply model rotation (always sync with yaw)
    if (playerModelRoot) playerModelRoot.rotation.y = yaw;

    if (thirdPerson) {
        // Third-person position
        const desired = player.position.clone()
            .add(new THREE.Vector3(0, thirdPersonFixedY, 0))
            .add(forward.clone().multiplyScalar(-thirdPersonDistance));
        camera.position.lerp(desired, CAMERA_LERP_SPEED_TP);

        const lookTarget = new THREE.Vector3(player.position.x, player.position.y + cameraOffsetY, player.position.z);
        camera.lookAt(lookTarget);
    } else {
        // First-person position (teleport on switch to avoid snap)
        const fpPos = player.position.clone().add(new THREE.Vector3(0, cameraOffsetY, 0));
        camera.position.lerp(fpPos, CAMERA_LERP_SPEED_FP);

        const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);

    }

    // Update interaction forward vector for pulling / inspecting
    if (thirdPerson) {
        interactionRay.copy(forward);
    } else {
        camera.getWorldDirection(interactionRay);
        interactionRay.y = 0;
        interactionRay.normalize();
    }
}

// -------------------- Camera Switch --------------------
function switchCamera() {
    thirdPerson = !thirdPerson;

    if (!thirdPerson) {
		// Sync yaw/pitch from camera orientation on FP switch. Use quaternion->Euler to avoid a 180deg flip
		const camEuler = new THREE.Euler();
		camEuler.setFromQuaternion(camera.quaternion, 'YXZ');
		// Euler order Y (yaw), X (pitch)
		yaw = camEuler.y;
		pitch = camEuler.x;
		// Teleport camera to exact FP position to avoid snap and set its orientation
		const fpPos = player.position.clone().add(new THREE.Vector3(0, cameraOffsetY, 0));
		camera.position.copy(fpPos);
		const fpEuler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
		camera.quaternion.setFromEuler(fpEuler);
    }

	// When switching to third-person, snap the camera behind the model so it doesn't start looking the wrong way.
	else {
		// Derive yaw from the current camera orientation (this handles switching from FP -> TP)
		// Use quaternion -> Euler to avoid the 180deg ambiguity that getWorldDirection can introduce
	const camEuler = new THREE.Euler();
	camEuler.setFromQuaternion(camera.quaternion, 'YXZ');
	// camera.quaternion->Euler.y gives the camera's yaw (theta). The player's forward
	// (used by third-person framing) is opposite the camera's forward, so add PI
	// to align model-forward with camera-facing direction.
	yaw = camEuler.y + Math.PI;
		// sync model rotation immediately so the character faces the same way as the camera
		if (playerModelRoot) playerModelRoot.rotation.y = yaw;
		// reset pitch for third person framing
		pitch = 0;

		// compute a behind-the-player position matching updateCamera's logic
		const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
		const desired = player.position.clone()
			.add(new THREE.Vector3(0, thirdPersonFixedY, 0))
			.add(forward.clone().multiplyScalar(-thirdPersonDistance));

		// place camera immediately to avoid briefly looking the wrong way
		camera.position.copy(desired);

		// orient camera to look at the player
		const lookTarget = new THREE.Vector3(player.position.x, player.position.y + cameraOffsetY, player.position.z);
		camera.lookAt(lookTarget);
	}
}

// Creates a small flashlight mesh and parents it to the model so it follows hand motion
function createHandFlashlight() {
	if (!playerModelRoot) return;
	if (handFlashlightModel) return;
	handFlashlightModel = new THREE.Group();
	const body = new THREE.Mesh(
		new THREE.CylinderGeometry(0.04, 0.04, 0.26, 12),
		new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.4 })
	);
	body.rotation.z = Math.PI / 2;
	body.position.set(0, 0, 0);
	body.castShadow = true; body.receiveShadow = true;
	handFlashlightModel.add(body);

	const head = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0x666666 }));
	head.position.set(0.14, 0, 0);
	head.rotation.z = Math.PI / 2;
	head.castShadow = true; handFlashlightModel.add(head);

	// approximate local offset to the left-hand (when looking at model from behind)
	// This places the flashlight near the character's left hand; adjust if your model's rig differs.
	handFlashlightModel.position.set(-0.25, 0.95 * CHARACTER_SCALE, 0.12);
	// rotate slightly so the cone points forward when held in the left hand
	handFlashlightModel.rotation.y = -Math.PI * 0.12;
	handFlashlightModel.visible = false;
	playerModelRoot.add(handFlashlightModel);
}

function setModelVisibility(v) {
	if (!playerModelRoot) return;
	playerModelRoot.visible = v;
}

// -------------------- Collision helpers (unchanged mostly) --------------------
function checkHorizontalCollisions(newPos) {
	// Robust vertical-aware collision: treat player footprint as a circle (radius) and check vertical overlap
	for (let item of allColliders()) {
		const box = new THREE.Box3().setFromObject(item);
		if (!isFinite(box.min.x) || !isFinite(box.max.x)) continue;

		const playerBottom = newPos.y;
		const playerTop = newPos.y + playerHeight;

		// If player is entirely below object's bottom, ignore
		if (playerTop <= box.min.y + 0.04) continue;

		// If player is entirely above the object's top enough to step onto it, allow (stepping)
		if (playerBottom >= box.max.y - 0.04) continue;

		// There is vertical overlap -> check horizontal circle-box intersection on XZ plane
		const closestX = THREE.MathUtils.clamp(newPos.x, box.min.x, box.max.x);
		const closestZ = THREE.MathUtils.clamp(newPos.z, box.min.z, box.max.z);
		const dx = newPos.x - closestX;
		const dz = newPos.z - closestZ;
		const distSq = dx * dx + dz * dz;
		if (distSq < (playerRadius * playerRadius)) {
			return false;
		}
	}
	return true;
}

function getHorizontalCollisionObject(newPos) {
	// Similar vertical-aware collision test as checkHorizontalCollisions but return the object collided with
	for (let item of allColliders()) {
		const box = new THREE.Box3().setFromObject(item);
		if (!isFinite(box.min.x) || !isFinite(box.max.x)) continue;

		const playerBottom = newPos.y;
		const playerTop = newPos.y + playerHeight;

		if (playerTop <= box.min.y + 0.04) continue;
		if (playerBottom >= box.max.y - 0.04) continue;

		const closestX = THREE.MathUtils.clamp(newPos.x, box.min.x, box.max.x);
		const closestZ = THREE.MathUtils.clamp(newPos.z, box.min.z, box.max.z);
		const dx = newPos.x - closestX;
		const dz = newPos.z - closestZ;
		const distSq = dx * dx + dz * dz;
		if (distSq < (playerRadius * playerRadius)) {
			return item;
		}
	}
	return null;
}

// This canMoveObjectBy supports an option to allow player overlap while pulling
function canMoveObjectBy(obj, delta, options = { allowPlayerOverlap: false }) {
	const original = obj.position.clone();
	obj.position.add(delta);
	obj.updateWorldMatrix(true, false);
	const movedBox = new THREE.Box3().setFromObject(obj).expandByScalar(0.02);
	obj.position.copy(original);
	obj.updateWorldMatrix(true, false);

	// Bounds check
	const margin = 0.4;
	const halfW = roomWidth / 2 - margin;
	const halfD = roomDepth / 2 - margin;
	if (movedBox.min.x < -halfW || movedBox.max.x > halfW || movedBox.min.z < -halfD || movedBox.max.z > halfD) return false;

	// Player collision: allow if option set
	const closestX = THREE.MathUtils.clamp(player.position.x, movedBox.min.x, movedBox.max.x);
	const closestZ = THREE.MathUtils.clamp(player.position.z, movedBox.min.z, movedBox.max.z);
	const dx = player.position.x - closestX;
	const dz = player.position.z - closestZ;
	const distSq = dx*dx + dz*dz;
	const playerPadding = playerRadius + 0.05;
	if (!options.allowPlayerOverlap && distSq < playerPadding * playerPadding) return false;

	// corner guard
	const centerX = (movedBox.min.x + movedBox.max.x) * 0.5;
	const centerZ = (movedBox.min.z + movedBox.max.z) * 0.5;
	const cornerClear = 0.8;
	const nearXEdge = Math.abs(centerX) > (halfW - cornerClear);
	const nearZEdge = Math.abs(centerZ) > (halfD - cornerClear);
	if (nearXEdge && nearZEdge) return false;

	for (const other of allColliders()) {
		if (other === obj) continue;
		const otherBox = new THREE.Box3().setFromObject(other).expandByScalar(0.01);
		if (movedBox.intersectsBox(otherBox)) return false;
	}
	return true;
}

// -------------------- Pushing helper --------------------
function tryPushPushable(pushObj, intent, playerMoveVec) {
	const dir = intent.clone();
	if (Math.abs(dir.x) >= Math.abs(dir.z)) dir.z = 0; else dir.x = 0;
	if (dir.lengthSq() === 0) return false;
	dir.normalize();
	const pushDistance = playerMoveVec.length() * 0.9;
	const delta = dir.multiplyScalar(pushDistance);
	if (!isFinite(delta.x) || !isFinite(delta.z)) return false;
	if (canMoveObjectBy(pushObj, delta)) {
		pushObj.position.add(delta);
		return true;
	}
	const slide = new THREE.Vector3(0, 0, 0);
	if (Math.abs(intent.x) > Math.abs(intent.z)) {
		slide.z = Math.sign(intent.z || 1) * pushDistance * 0.6;
	} else {
		slide.x = Math.sign(intent.x || 1) * pushDistance * 0.6;
	}
	if (slide.lengthSq() > 0 && canMoveObjectBy(pushObj, slide)) {
		pushObj.position.add(slide);
		return true;
	}
	return false;
}

// -------------------- Pull / helper functions --------------------
function getNearestPushable(maxDist = 2.4) {
	let best = null; let bestD = Infinity;
	for (const p of pushables) {
		const d = p.position.distanceTo(player.position);
		if (d < bestD && d <= maxDist && !isPlayerStandingOn(p)) { best = p; bestD = d; }
	}
	return best;
}

function isPlayerStandingOn(obj) {
	const box = new THREE.Box3().setFromObject(obj);
	const margin = playerRadius * 0.6;
	const withinX = player.position.x >= box.min.x - margin && player.position.x <= box.max.x + margin;
	const withinZ = player.position.z >= box.min.z - margin && player.position.z <= box.max.z + margin;
	if (!withinX || !withinZ) return false;
	const topY = box.max.y;
	return Math.abs(player.position.y - topY) < 0.35;
}

// NEW: robust dt-scaled pulling function
function updatePulling(dt) {
	if (!isPulling || !pulledObj) return;
	if (!scene.children.includes(pulledObj)) { isPulling = false; pulledObj = null; return; }

	const crate = pulledObj;

	// crate half extents
	const cBox = new THREE.Box3().setFromObject(crate);
	const cSize = new THREE.Vector3(); cBox.getSize(cSize);
	const crateHalfXZ = 0.5 * Math.max(cSize.x, cSize.z);

	// If player stands on crate -> release
	if (isPlayerStandingOn(crate)) {
		isPulling = false; pulledObj = null; showMessage('Released (standing on crate).', 1200); return;
	}

	// Only update pullForward if not already pulling (prevents crate from teleporting behind player every frame)
	if (!updatePulling._pullStarted) {
		const desiredForward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
		pullForward.copy(desiredForward.negate());
		updatePulling._pullStarted = true;
	}

	// leash anchor behind player
	const leashSlack = 0.35;
	const leashDist = playerRadius + crateHalfXZ + leashSlack;
	const anchor = player.position.clone().sub(pullForward.clone().multiplyScalar(leashDist));
	anchor.y = crate.position.y; // keep crate's Y so we don't teleport vertical

	// compute delta toward anchor
	const toAnchor = anchor.clone().sub(crate.position);
	const dist = toAnchor.length();
	if (dist <= 0.001) return;

	const dir = toAnchor.normalize();
	// scale speed by dt to be frame independent (base CRATE_PULL_SPEED at 60fps)
	const frameScale = Math.min(4, dt * 60); // clamp to avoid huge leaps if dt large
	const effectiveSpeed = CRATE_PULL_SPEED * frameScale * (lastIntent.lengthSq() > 0.0001 ? 0.85 : 1.0);
	const step = Math.min(effectiveSpeed, dist);
	const delta = dir.clone().multiplyScalar(step);

	// If crate is very close to player, allow overlap (so it can come up to player's feet)
	const fromPlayer = crate.position.clone().setY(0).sub(player.position.clone().setY(0));
	const closeToPlayer = fromPlayer.length() < (playerRadius + crateHalfXZ + 0.05);

	// Try moving with relaxed player overlap rule while pulling to avoid constant blocking
	if (canMoveObjectBy(crate, delta, { allowPlayerOverlap: true })) {
		crate.position.add(delta);
		return;
	}

	// If cannot move directly, try small nudge along perpendicular to slide
	const perp = new THREE.Vector3(-dir.z, 0, dir.x);
	const slideAmt = step * CRATE_SLIDE_FACTOR;
	const deltaA = perp.clone().multiplyScalar(slideAmt);
	const deltaB = perp.clone().multiplyScalar(-slideAmt);
	if (canMoveObjectBy(crate, deltaA, { allowPlayerOverlap: true })) { crate.position.add(deltaA); return; }
	if (canMoveObjectBy(crate, deltaB, { allowPlayerOverlap: true })) { crate.position.add(deltaB); return; }

	// As a last resort, if crate is intersecting or jammed, attempt a tiny jitter push away from player
	if (closeToPlayer) {
		const pushBack = fromPlayer.length() > 0 ? fromPlayer.normalize().multiplyScalar(step * 0.6) : new THREE.Vector3(0,0.01,0);
		if (canMoveObjectBy(crate, pushBack, { allowPlayerOverlap: true })) { crate.position.add(pushBack); return; }
	}
}

// -------------------- Assets (bed, crate, table, shelf, page, stairs, door) --------------------
let bedObj, tableObj, lampObj, pageObj;
const interactState = {
	nearLamp: false,
	nearBed: false,
	nearTable: false,
	nearPage: false,
	nearDoor: false,
	nearCrate: false,
	nearFlashlight: false,
};

function checkProximity() {
	const p = player.position;
	function near(obj, dist = 2.2) {
		if (!obj) return false;
		const pos = new THREE.Vector3(); obj.getWorldPosition(pos);
		return pos.distanceTo(p) < dist;
	}
	const nLamp = near(lampObj, 2.6);
	const nBed = near(bedObj, 2.6);
	const nTable = near(tableObj, 2.6);
	const nPage = near(pageObj, 2.2);
	const nDoor = near(window.doorObj, 2.5);
	const nCrate = pushables.some(pp => near(pp, 2.2));
	const nFlash = flashlightPickup ? near(flashlightPickup, 1.5) : false;

	const any = nLamp || nBed || nTable || nPage || nDoor || nCrate || nFlash;
	showInteractionPopup(any);
	interactState.nearLamp = nLamp;
	interactState.nearBed = nBed;
	interactState.nearTable = nTable;
	interactState.nearPage = nPage;
	interactState.nearDoor = nDoor;
	interactState.nearCrate = nCrate;
	interactState.nearFlashlight = nFlash;
}

function completeLevel(levelName) {
    // Mark level as completed
    localStorage.setItem(`level_${levelName}_completed`, 'true');
    
    // Also store completion timestamp if needed
    localStorage.setItem(`level_${levelName}_completed_time`, new Date().toISOString());
    
    // Optional: Track progress
    const completedLevels = getCompletedLevels();
    console.log(`Completed levels: ${completedLevels.join(', ')}`);
}

// Helper function to get all completed levels
function getCompletedLevels() {
    const levels = ['bedroom', 'kitchen', 'living-room', 'secret-room'];
    return levels.filter(level => localStorage.getItem(`level_${level}_completed`) === 'true');
}

function handleInteract() {
	if (interactState.nearDoor) {
		showMessage('Freedom... finally. You escape into the unknown.', 5000);
		completeLevel('bedroom'); // Add this line
		setTimeout(() => {
			document.getElementById('victoryScreen').style.display = 'flex';
		}, 5000);
	} else if (interactState.nearFlashlight && flashlightPickup && !hasFlashlight) {
		hasFlashlight = true;
		if (flashlightPickup) scene.remove(flashlightPickup);
		flashlightPickup = null;
		showMessage('Picked up flashlight. Press F to toggle it on/off.', 6000);
		// initial quick blink so player recognizes it
		flashlight.visible = true;
		flashlight.intensity = thirdPersonFlashlightIntensity;
		setTimeout(() => {
			flashlight.visible = false;
			updateAnimationState();
		}, 900);
		return;
	} else if (interactState.nearLamp) {
		showMessage('The single bulb flickers weakly. Its dim light barely pushes back the darkness.', 3500);
	} else if (interactState.nearBed) {
		showMessage('A filthy mattress on the floor. How many nights have you spent trapped in this nightmare?', 3500);
	} else if (interactState.nearTable) {
		showMessage('An old wooden table, barely holding together. Everything here feels broken, forgotten.', 3500);
	} else if (interactState.nearPage) {
		showMessage('"Day ??... I\'ve lost count. The stairs are broken. They won\'t find me here. I have to find another way out. I have to expose him. The door... it\'s so close but unreachable. Unless..."', 6000);
	} else if (interactState.nearCrate) {
		showMessage('Press E to pull/release the crate. Drag it into place to reach the stairs.', 3500);
	}
}

function fitToFloor(obj) {
	const box = new THREE.Box3().setFromObject(obj);
	const minY = box.min.y;
	if (isFinite(minY)) obj.position.y += -minY;
}

function createBedroomAssets() {
	const furnitureScale = 2.0;

	// Bed
	const bed = new THREE.Group();
	const bedBaseHeight = 0.15 * furnitureScale;
	const mattressHeight = 0.25 * furnitureScale;
	const bedBase = new THREE.Mesh(
		new THREE.BoxGeometry(1.8 * furnitureScale, bedBaseHeight, 1.4 * furnitureScale), 
		new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.9 })
	);
	bedBase.position.y = bedBaseHeight / 2;
	bedBase.castShadow = true; bedBase.receiveShadow = true; bed.add(bedBase);
	const mattress = new THREE.Mesh(
		new THREE.BoxGeometry(1.8 * furnitureScale, mattressHeight, 1.4 * furnitureScale), 
		new THREE.MeshStandardMaterial({ color: 0x5a5a4a, roughness: 0.95 })
	);
	mattress.position.y = bedBaseHeight + mattressHeight / 2;
	mattress.castShadow = true; mattress.receiveShadow = true; bed.add(mattress);
	bed.position.set(-7, 0, -5);
	scene.add(bed); furniture.push(bed); staticColliders.push(bed);
	bedObj = bed;

	// Suspicious stains (two)
	const stainMat = new THREE.MeshStandardMaterial({
		color: 0x3b0f0f,
		transparent: true,
		opacity: 0.9,
		roughness: 1.0,
		side: THREE.DoubleSide
	});
	const stain1 = new THREE.Mesh(new THREE.PlaneGeometry(0.6 * furnitureScale, 0.45 * furnitureScale), stainMat);
	stain1.rotation.x = -Math.PI / 2;
	stain1.position.set(-0.25 * furnitureScale, mattress.position.y + 0.01, 0.2 * furnitureScale);
	stain1.rotation.z = THREE.MathUtils.degToRad(12);
	stain1.receiveShadow = false;
	bed.add(stain1);
	const stain2 = new THREE.Mesh(new THREE.PlaneGeometry(0.45 * furnitureScale, 0.35 * furnitureScale), stainMat);
	stain2.rotation.x = -Math.PI / 2;
	stain2.position.set(0.35 * furnitureScale, mattress.position.y + 0.01, -0.1 * furnitureScale);
	stain2.rotation.z = THREE.MathUtils.degToRad(-18);
	stain2.receiveShadow = false;
	bed.add(stain2);

	// Crate 1 (pushable, for stairs, now taller)
	const crate = new THREE.Group();
	const crateSize = 1.0 * furnitureScale;
	const crateHeight = 1.2 * furnitureScale; // increased height
	const crateBox = new THREE.Mesh(
		new THREE.BoxGeometry(crateSize, crateHeight, crateSize),
		new THREE.MeshStandardMaterial({ color: 0x684a2f, roughness: 0.95 })
	);
	crateBox.position.y = crateHeight / 2;
	crateBox.castShadow = true; crateBox.receiveShadow = true; crate.add(crateBox);
	// Move crate under the stairs, away from corners
	crate.position.set(5, 0, 0);
	scene.add(crate); furniture.push(crate); pushables.push(crate);

	// Crate 2 (taller, for shelf access)
	const crate2 = new THREE.Group();
	const crate2Size = 1.0 * furnitureScale;
	const crate2Height = 1.0 * furnitureScale; // taller
	const crate2Box = new THREE.Mesh(
		new THREE.BoxGeometry(crate2Size, crate2Height, crate2Size),
		new THREE.MeshStandardMaterial({ color: 0x8a6a3f, roughness: 0.92 })
	);
	crate2Box.position.y = crate2Height / 2;
	crate2Box.castShadow = true; crate2Box.receiveShadow = true; crate2.add(crate2Box);
	// Place crate2 near the table, but not blocking
	crate2.position.set(2.5, 0, 2.5);
	scene.add(crate2); furniture.push(crate2); pushables.push(crate2);

	// Table (moved further from stairs)
	const table = new THREE.Group();
	const tableHeight = 1.0 * furnitureScale;
	const top = new THREE.Mesh(
		new THREE.BoxGeometry(1.2 * furnitureScale, 0.06 * furnitureScale, 0.9 * furnitureScale), 
		new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 })
	);
	top.position.y = tableHeight; top.castShadow = true; top.receiveShadow = true; table.add(top);
	const legGeo = new THREE.CylinderGeometry(0.04 * furnitureScale, 0.04 * furnitureScale, tableHeight - 0.06 * furnitureScale, 8);
	const legMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.95 });
	const legOffsets = [
		[-0.52 * furnitureScale, 0, -0.38 * furnitureScale],
		[ 0.52 * furnitureScale, 0, -0.38 * furnitureScale],
		[-0.52 * furnitureScale, 0,  0.38 * furnitureScale],
		[ 0.52 * furnitureScale, 0,  0.38 * furnitureScale],
	];
	for (const [lx, , lz] of legOffsets) {
		const leg = new THREE.Mesh(legGeo, legMat);
		leg.position.set(lx, (tableHeight - 0.06 * furnitureScale) / 2, lz);
		leg.castShadow = true; leg.receiveShadow = true; table.add(leg);
	}
	// Move table further from stairs to make jump harder
	table.position.set(-2.5, 0, 2.5);
	scene.add(table); furniture.push(table); staticColliders.push(table);
	tableObj = table;

	// Shelf + bulb + page + stairs + door (same as before)
	const shelf = new THREE.Group();
	const shelfHeight = 1.8 * furnitureScale;
	const shelfWidth = 1.0 * furnitureScale;
	const shelfDepth = 0.5 * furnitureScale;
	const shelfFrameMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.3, roughness: 0.8 });
	const postGeo = new THREE.BoxGeometry(0.05 * furnitureScale, shelfHeight, 0.05 * furnitureScale);
	const posts = [
		[-shelfWidth/2, shelfHeight/2, -shelfDepth/2],
		[shelfWidth/2, shelfHeight/2, -shelfDepth/2],
		[-shelfWidth/2, shelfHeight/2, shelfDepth/2],
		[shelfWidth/2, shelfHeight/2, shelfDepth/2],
	];
	posts.forEach(([x, y, z]) => {
		const post = new THREE.Mesh(postGeo, shelfFrameMat);
		post.position.set(x, y, z);
		post.castShadow = true; post.receiveShadow = true;
		shelf.add(post);
	});
	const shelfPlateGeo = new THREE.BoxGeometry(shelfWidth, 0.03 * furnitureScale, shelfDepth);
	const shelfPlateMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
	for (let i = 0; i < 3; i++) {
		const shelfPlate = new THREE.Mesh(shelfPlateGeo, shelfPlateMat);
		shelfPlate.position.y = (i + 1) * (shelfHeight / 3);
		shelfPlate.castShadow = true; shelfPlate.receiveShadow = true;
		shelf.add(shelfPlate);
	}
	shelf.position.set(1, 0, 7);
	scene.add(shelf); furniture.push(shelf); staticColliders.push(shelf);

	// bulb
	const bulbGroup = new THREE.Group();
	const bulbGeo = new THREE.SphereGeometry(0.08, 16, 16);
	const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffcc77, emissive: 0xffaa44, emissiveIntensity: 0.8 });
	const bulb = new THREE.Mesh(bulbGeo, bulbMat);
	bulb.position.y = 0; bulb.castShadow = false; bulbGroup.add(bulb);
	const bulbLight = new THREE.PointLight(0xffaa55, 0.4, 6);
	bulbLight.castShadow = true; bulbLight.position.y = 0; bulbGroup.add(bulbLight);
	const wireGeo = new THREE.CylinderGeometry(0.005, 0.005, 1.5, 8);
	const wireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
	const wire = new THREE.Mesh(wireGeo, wireMat);
	wire.position.y = 0.75; bulbGroup.add(wire);
	bulbGroup.position.set(-2, wallHeight - 2.5, 1);
	scene.add(bulbGroup); lampObj = bulbGroup;

	// page
	const page = new THREE.Mesh(new THREE.PlaneGeometry(0.21 * furnitureScale, 0.297 * furnitureScale), new THREE.MeshStandardMaterial({ color: 0xd5d5c5, side: THREE.DoubleSide, roughness: 0.9 }));
	page.rotation.x = -Math.PI / 2; page.position.y = 0.002; page.castShadow = false; page.receiveShadow = true;
	const pageGroup = new THREE.Group(); pageGroup.add(page); fitToFloor(pageGroup);
	pageGroup.position.set(-8, 0, 2); scene.add(pageGroup); pageObj = pageGroup;

	// stairs / door (kept similar to prior)
	const staircase = new THREE.Group();
	const stepWidth = 2.0, stepDepth = 0.4, stepHeight = 0.3;
	const totalSteps = 12, brokenSteps = 6;
	const stepMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
	const stairYOffset = 1.0; // raise stairs higher
	for (let i = brokenSteps; i < totalSteps; i++) {
		const step = new THREE.Mesh(new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth), stepMat);
		step.position.set(0, i * stepHeight + stepHeight / 2 + stairYOffset, i * stepDepth);
		step.castShadow = true; step.receiveShadow = true; staircase.add(step);
	}
	staircase.position.set(5, 0, roomDepth / 2 - totalSteps * stepDepth - 0.5);
	scene.add(staircase); furniture.push(staircase); staticColliders.push(staircase);

	// door
	const doorGroup = new THREE.Group();
	const doorWidth = 1.2, doorHeight = 2.2, doorThickness = 0.1;
	const frameMat2 = new THREE.MeshStandardMaterial({ color: 0x2a1a0a });
	const frameThickness = 0.15;
	const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, doorHeight + frameThickness, frameThickness), frameMat2);
	leftFrame.position.set(-doorWidth / 2 - frameThickness / 2, doorHeight / 2, 0); leftFrame.castShadow = true; leftFrame.receiveShadow = true; doorGroup.add(leftFrame);
	const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(frameThickness, doorHeight + frameThickness, frameThickness), frameMat2);
	rightFrame.position.set(doorWidth / 2 + frameThickness / 2, doorHeight / 2, 0); rightFrame.castShadow = true; rightFrame.receiveShadow = true; doorGroup.add(rightFrame);
	const topFrame = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + frameThickness * 2, frameThickness, frameThickness), frameMat2);
	topFrame.position.set(0, doorHeight + frameThickness / 2, 0); topFrame.castShadow = true; topFrame.receiveShadow = true; doorGroup.add(topFrame);
	const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness), new THREE.MeshStandardMaterial({ color: 0x5a3a1a }));
	door.position.set(0, doorHeight / 2, -doorThickness / 2); door.castShadow = true; door.receiveShadow = true; doorGroup.add(door);
	const handle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), new THREE.MeshStandardMaterial({ color: 0xccaa44, metalness: 0.8, roughness: 0.2 }));
	handle.position.set(doorWidth / 2 - 0.2, doorHeight / 2, doorThickness / 2 + 0.05); handle.castShadow = true; doorGroup.add(handle);
	const doorY = (totalSteps - 1) * stepHeight + stepHeight + stairYOffset; // raise door higher
	const doorZ = roomDepth / 2 - 0.5;
	doorGroup.position.set(5, doorY, doorZ);
	scene.add(doorGroup);
	window.doorObj = doorGroup;
	window.staircaseObj = staircase;
}

// -------------------- Minimap (updated to match kitchen) --------------------
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

function ensureMinimapSize() {
    if (!minimapCanvas) return false;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(64, minimapCanvas.clientWidth);
    const h = Math.max(64, minimapCanvas.clientHeight);
    if (minimapCanvas.width !== Math.floor(w * dpr) || minimapCanvas.height !== Math.floor(h * dpr)) {
        minimapCanvas.width = Math.floor(w * dpr);
        minimapCanvas.height = Math.floor(h * dpr);
        minimapCanvas.style.width = w + 'px';
        minimapCanvas.style.height = h + 'px';
        if (minimapCtx) minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return !!minimapCtx;
}

function drawMinimap() {
    if (!ensureMinimapSize() || !minimapCanvas || !minimapCtx) return;
    
    const ctx = minimapCtx;
    const scale = 0.1; // Adjust this to zoom in/out on the map
    const centerX = minimapCanvas.width / 2;
    const centerY = minimapCanvas.height / 2;
    
    // Clear canvas
    ctx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    // Draw room bounds
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        centerX - (roomWidth / 2) / scale,
        centerY - (roomDepth / 2) / scale,
        roomWidth / scale,
        roomDepth / scale
    );
    
    // Draw furniture as small rectangles
    ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
    furniture.forEach(item => {
        const box = new THREE.Box3().setFromObject(item);
        const itemWidth = (box.max.x - box.min.x) / scale;
        const itemDepth = (box.max.z - box.min.z) / scale;
        const itemX = centerX + (item.position.x - player.position.x) / scale - itemWidth / 2;
        const itemZ = centerY + (item.position.z - player.position.z) / scale - itemDepth / 2;
        
        ctx.fillRect(itemX, itemZ, itemWidth, itemDepth);
    });
    
    // Draw door
    if (window.doorObj) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        const doorPos = new THREE.Vector3();
        window.doorObj.getWorldPosition(doorPos);
        const doorX = centerX + (doorPos.x - player.position.x) / scale;
        const doorZ = centerY + (doorPos.z - player.position.z) / scale;
        ctx.fillRect(doorX - 2, doorZ - 2, 4, 8);
    }
    
    // Draw flashlight pickup if it exists
    if (flashlightPickup && !hasFlashlight) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
        const flashX = centerX + (flashlightPickup.position.x - player.position.x) / scale;
        const flashZ = centerY + (flashlightPickup.position.z - player.position.z) / scale;
        ctx.fillRect(flashX - 2, flashZ - 2, 4, 4);
    }
    
    // Draw player as triangle (pointing in camera direction)
    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-yaw + Math.PI / 2); // Use yaw instead of mouseX
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-5, 5);
    ctx.lineTo(5, 5);
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

// -------------------- Resize --------------------
window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

// -------------------- Animation helpers (unchanged) --------------------
function actionEnable(a) {
	if (!a) return;
	a.enabled = true;
	a.clampWhenFinished = false;
	a.setEffectiveTimeScale(1);
	a.setEffectiveWeight(1);
}
function switchTo(next, duration = 0.25) {
	if (!mixer || !next) return;
	if (currentAction === next) return;
	next.reset(); actionEnable(next); next.play();
	if (currentAction) currentAction.crossFadeTo(next, duration, false);
	currentAction = next;
}
function updateAnimationState(initial = false) {
	if (!mixer) return;
	const moving = lastIntent.lengthSq() > 0.0001;
	if (initial || moving !== wasMoving) {
		wasMoving = moving;
		if (moving && walkAction) switchTo(walkAction, 0.2);
		else if (!moving && idleAction) switchTo(idleAction, 0.2);
	}
	if (holdFlashAction) {
		holdFlashAction.enabled = true;
		holdFlashAction.play();
		const target = (hasFlashlight && flashlight.visible) ? 1.0 : 0.0;
		holdFlashAction.setEffectiveWeight(target);
	}
}

// -------------------- Load character (unchanged) --------------------
async function loadCharacter() {
	return new Promise((resolve, reject) => {
		gltfLoader.load(MODEL_PATH, (gltf) => {
			try {
				const root = gltf.scene;
				if (!root) throw new Error('No GLTF scene');

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

				try {
					let rig = root.getObjectByName('metarig') || model;
					if (!rig) {
						root.traverse(o => { if (!rig && o.name && o.name.toLowerCase() === 'metarig') rig = o; });
					}
					const mainFullNodes = [];
					root.traverse(o => { if (o.name && o.name.toLowerCase() === 'main_full') mainFullNodes.push(o); });
					mainFullNodes.forEach(n => {
						if (n.parent !== rig) rig.attach(n);
						n.traverse(c => { if (c.isMesh) { c.visible = true; c.castShadow = true; c.receiveShadow = true; } });
					});
				} catch (e) {
					console.warn('Failed to attach main_full to metarig in bedroom model:', e);
				}

				const isUnderNamedAncestor = (node, ancestorLowerName) => {
					let p = node;
					const target = (ancestorLowerName || '').toLowerCase();
					while (p) {
						if ((p.name || '').toLowerCase() === target) return true;
						p = p.parent;
					}
					return false;
				};

				model.traverse((child) => {
					if (child.isMesh) {
						const name = (child.name || '').toLowerCase();
						const underRig = isUnderNamedAncestor(child, 'metarig');
						const isGroundLikeName = name.includes('plane') || name.includes('ground') || name.includes('floor');
						if (isGroundLikeName && !child.isSkinnedMesh && !underRig) {
							child.visible = false;
						} else {
							child.visible = true;
							child.castShadow = true;
							child.receiveShadow = true;
						}
					}
				});

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
					const targetHeight = CHARACTER_TARGET_HEIGHT;
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
				} else {
					console.warn('No mesh geometry found under model; skipping center/scale to avoid NaN transforms.');
				}

				player.add(model);
				playerModelRoot = model;
				// create a small flashlight mesh attached to the model's hand (approximate)
				if (!handFlashlightModel) createHandFlashlight();

				// animations
				const clips = gltf.animations || [];
				if (clips.length > 0) {
					mixer = new THREE.AnimationMixer(model);
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
					const holdFlashClip = findClip(['Hold_Flash.004-metarig.001', 'hold_flash', 'flash', 'torch']);

					if (idleClip) { idleAction = mixer.clipAction(idleClip); idleAction.setLoop(THREE.LoopRepeat, Infinity); actionEnable(idleAction); }
					if (walkClip) { walkAction = mixer.clipAction(walkClip); walkAction.setLoop(THREE.LoopRepeat, Infinity); actionEnable(walkAction); walkAction.setEffectiveWeight(0.0); }
					if (holdFlashClip) { holdFlashAction = mixer.clipAction(holdFlashClip); holdFlashAction.setLoop(THREE.LoopRepeat, Infinity); actionEnable(holdFlashAction); holdFlashAction.setEffectiveWeight(0.0); }

					currentAction = idleAction || walkAction || null;
					if (currentAction) { currentAction.setEffectiveWeight(1.0); currentAction.play(); }
				}

				updateAnimationState(true);
				resolve();
			} catch (err) { reject(err); }
		}, undefined, (err) => reject(err));
	});
}

// -------------------- Input handling --------------------
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') {
		isPaused ? resumeGame() : pauseGame();
		return;
	}
	if (e.key.toLowerCase() === 'c') switchCamera();
	if (e.key.toLowerCase() === 'f') {
		if (hasFlashlight && battery > 0) {
			flashlight.visible = !flashlight.visible;
			if (!flashlight.visible) showMessage('Flashlight off.', 900);
			else showMessage('Flashlight on.', 900);
			updateAnimationState();
		} else if (!hasFlashlight) {
			showMessage('You do not have a flashlight yet.', 1000);
		} else if (battery <= 0) {
			showMessage('The flashlight battery is dead.', 1500);
		}
	}

	// Block movement/interaction during pause or intro text
	if (isPaused || introPlaying) return;
	switch (e.code) {
		case 'KeyW': keys.w = true; break;
		case 'KeyA': keys.a = true; break;
		case 'KeyS': keys.s = true; break;
		case 'KeyD': keys.d = true; break;
		case 'Space': keys.space = true; e.preventDefault(); break;
		case 'KeyE': {
			// If flashlight pickup is nearby and not owned, pick it up
			if (interactState.nearFlashlight && flashlightPickup && !hasFlashlight) {
				handleInteract(); return;
			}
			// Pull / release toggle
			if (!isPulling) {
				const nearest = getNearestPushable(2.4);
				if (nearest) {
					const toObj = nearest.position.clone().sub(player.position).setY(0).normalize();
					const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
					const pullDir = forward.clone().negate(); // Pulling: crate should be behind player
					if (!thirdPerson) {
						// In first person, always allow pulling if close enough
						isPulling = true;
						pulledObj = nearest;
						// Set pullForward so crate stays behind player (pulling direction)
						pullForward.copy(pullDir);
						showMessage('Pulling crate — press E to release.', 2000);
					} else {
						const facingDot = forward.dot(toObj);
						if (facingDot > 0.2) {
							isPulling = true;
							pulledObj = nearest;
							pullForward.copy(pullDir);
							showMessage('Pulling crate — press E to release.', 2000);
						} else {
							showMessage('Face the crate to start pulling it.', 1200);
						}
					}
				} else {
					handleInteract();
				}
			} else {
				isPulling = false;
				pulledObj = null;
				showMessage('Released.', 1200);
			}
			break;
		}
	}
});
document.addEventListener('keyup', (e) => {
	switch (e.code) {
		case 'KeyW': keys.w = false; break;
		case 'KeyA': keys.a = false; break;
		case 'KeyS': keys.s = false; break;
		case 'KeyD': keys.d = false; break;
		case 'Space': keys.space = false; break;
	}
});

// -------------------- Movement & physics (dt-aware) --------------------
let lastIntent = new THREE.Vector3();
const playerHeight = CHARACTER_TARGET_HEIGHT;

function updateMovement(dt) {
	let forward, right;
	if (thirdPerson) {
		forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
		right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
	} else {
		forward = new THREE.Vector3();
		camera.getWorldDirection(forward);
		forward.y = 0; forward.normalize();
		right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
	}

	let intent = new THREE.Vector3();
	if (keys.w) intent.add(forward);
	if (keys.s) intent.add(forward.clone().multiplyScalar(-1));
	if (keys.a) intent.add(right.clone().multiplyScalar(-1));
	if (keys.d) intent.add(right);
	if (intent.lengthSq() > 0) intent.normalize();

	const frameScale = Math.min(4, dt * 60);
	const effectiveMoveSpeed = (isPulling ? moveSpeed * 0.75 : moveSpeed) * frameScale;
	if (intent.lengthSq() > 0) {
    const move = intent.clone().multiplyScalar(effectiveMoveSpeed);
    const newPos = player.position.clone().add(move);
    newPos.y = player.position.y;
    
    // Check if new position collides
    if (checkHorizontalCollisions(newPos)) {
        player.position.x = newPos.x; 
        player.position.z = newPos.z;
    } else {
        // Blocked by collision - try pushing if we hit a pushable
        const hitObj = getHorizontalCollisionObject(newPos);
        if (hitObj && pushables.includes(hitObj)) {
            // Try to push the object
            if (tryPushPushable(hitObj, intent, move)) {
                // Push succeeded - player can move a bit
                const nudge = move.clone().multiplyScalar(0.3);
                const nudgedPos = player.position.clone().add(nudge);
                if (checkHorizontalCollisions(nudgedPos)) {
                    player.position.x = nudgedPos.x;
                    player.position.z = nudgedPos.z;
                }
            }
        }
        // If pulling, also try to nudge crate
        if (isPulling && pulledObj) {
            tryPushPushable(pulledObj, intent, move);
        }
    }
}

	// Jump
	if (keys.space && isGrounded) { velocityY = jumpPower; isGrounded = false; }

	// Gravity
	velocityY -= gravity;
	player.position.y += velocityY;

	// Vertical snapping to highest top under player XZ
	let highestTop = -Infinity;
	for (let item of allColliders()) {
		const box = new THREE.Box3().setFromObject(item);
		if (player.position.x >= box.min.x - playerRadius && player.position.x <= box.max.x + playerRadius &&
			player.position.z >= box.min.z - playerRadius && player.position.z <= box.max.z + playerRadius) {
			if (player.position.y >= box.max.y - 0.5 || Math.abs(player.position.y - box.max.y) < 0.5) {
				if (box.max.y > highestTop) highestTop = box.max.y;
			}
		}
	}

	if (highestTop > -Infinity) {
		const snapThreshold = 0.5;
		if (velocityY <= 0 && player.position.y <= highestTop + snapThreshold && player.position.y >= highestTop - 0.2) {
			player.position.y = highestTop; velocityY = 0; isGrounded = true;
		}
	}

	if (player.position.y <= 0) { player.position.y = 0; velocityY = 0; isGrounded = true; }

	// Clamp inside room
	const margin = 0.6;
	const halfW = roomWidth / 2 - margin;
	const halfD = roomDepth / 2 - margin;
	player.position.x = THREE.MathUtils.clamp(player.position.x, -halfW, halfW);
	player.position.z = THREE.MathUtils.clamp(player.position.z, -halfD, halfD);

	lastIntent.copy(intent);
}

// -------------------- Main loop --------------------
function animate() {
	requestAnimationFrame(animate);
	const dt = clock.getDelta();
	if (!isPaused) {
		updateMovement(dt);
		if (isPulling && pulledObj) {
			updatePulling(dt);
		} else {
			// Reset pull start flag when not pulling
			if (updatePulling._pullStarted) updatePulling._pullStarted = false;
		}
		updateAnimationState();
		updateCamera();
		checkProximity();
	}
	updateFlashlight(dt);
	drawMinimap();
	setModelVisibility(thirdPerson);
	if (mixer) mixer.update(dt);
	renderer.render(scene, camera);
}

// -------------------- Init --------------------
(async function init() {
	// Start near the note
	player.position.set(-8, 0, 2);
	yaw = 0; pitch = 0;

	// Play mystery music and optionally pause ambience
	const mysteryMusic = document.getElementById('mysteryMusic');
	const bgAudio = document.getElementById('bgAudio');
	if (mysteryMusic) {
		mysteryMusic.currentTime = 0;
		mysteryMusic.volume = 0.7;
		mysteryMusic.play().catch(() => {});
	}
	if (bgAudio) {
		bgAudio.pause();
	}

	await loadCharacter();
	createBedroomAssets();

	// position camera
	camera.position.set(0, thirdPersonFixedY, thirdPersonDistance);
	camera.lookAt(player.position);

	// opening message
	introPlaying = true;
	setTimeout(() => {
		showMessage('You wake up. Today is different. You were never safe, but today you need to leave.', 5000);
		setTimeout(() => {
			showMessage('Press E to interact with objects. Press F for flashlight. Press C to toggle camera.', 6000);
			// clear introPlaying after the final text finishes
			setTimeout(() => { introPlaying = false; }, 6000);
		}, 5500);
	}, 1000);

	// create a small visible flashlight mesh attached to the model's hand (created after model loads)
	if (playerModelRoot) createHandFlashlight();

	animate();
})();

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
    localStorage.removeItem('kitchenBattery'); // ✅ Clear battery
    window.location.href = './kitchen.html';
});

document.getElementById('menuBtn').addEventListener('click', () => {
    localStorage.removeItem('kitchenBattery'); // ✅ Clear battery
    window.location.href = './level-select.html';
});

// -------------------- Constants used earlier (kept) --------------------
const firstPersonFlashlightIntensity = 6;
const thirdPersonFlashlightIntensity = 50;
