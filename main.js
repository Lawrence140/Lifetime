import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Movement variables
const moveSpeed = 0.1;
const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

// Create room geometry
const roomSize = 20;
const wallHeight = 8;

// Materials
const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x404040 });
const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
const ceilingMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });

// Floor
const floorGeometry = new THREE.PlaneGeometry(roomSize, roomSize);
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Ceiling
const ceiling = new THREE.Mesh(floorGeometry, ceilingMaterial);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = wallHeight;
scene.add(ceiling);

// Walls
const wallGeometry = new THREE.PlaneGeometry(roomSize, wallHeight);

// North wall
const northWall = new THREE.Mesh(wallGeometry, wallMaterial);
northWall.position.set(0, wallHeight / 2, -roomSize / 2);
northWall.receiveShadow = true;
scene.add(northWall);

// South wall
const southWall = new THREE.Mesh(wallGeometry, wallMaterial);
southWall.position.set(0, wallHeight / 2, roomSize / 2);
southWall.rotation.y = Math.PI;
southWall.receiveShadow = true;
scene.add(southWall);

// East wall
const eastWall = new THREE.Mesh(wallGeometry, wallMaterial);
eastWall.position.set(roomSize / 2, wallHeight / 2, 0);
eastWall.rotation.y = -Math.PI / 2;
eastWall.receiveShadow = true;
scene.add(eastWall);

// West wall
const westWall = new THREE.Mesh(wallGeometry, wallMaterial);
westWall.position.set(-roomSize / 2, wallHeight / 2, 0);
westWall.rotation.y = Math.PI / 2;
westWall.receiveShadow = true;
scene.add(westWall);

// Create stickman character
const stickmanGroup = new THREE.Group();
const stickMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });

// Head
const headGeometry = new THREE.SphereGeometry(0.2, 8, 8);
const head = new THREE.Mesh(headGeometry, stickMaterial);
head.position.y = 1.6;
head.castShadow = true;
stickmanGroup.add(head);

// Eyes
const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
const eyeGeometry = new THREE.SphereGeometry(0.03, 6, 6);

const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
leftEye.position.set(-0.06, 1.65, 0.18); // Left eye on the face
stickmanGroup.add(leftEye);

const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
rightEye.position.set(0.06, 1.65, 0.18); // Right eye on the face
stickmanGroup.add(rightEye);

// Body
const bodyGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8);
const body = new THREE.Mesh(bodyGeometry, stickMaterial);
body.position.y = 1.0;
body.castShadow = true;
stickmanGroup.add(body);

// Shoulders
const shoulderGeometry = new THREE.SphereGeometry(0.08, 8, 8);
const leftShoulder = new THREE.Mesh(shoulderGeometry, stickMaterial);
leftShoulder.position.set(-0.2, 1.3, 0);
leftShoulder.castShadow = true;
stickmanGroup.add(leftShoulder);

const rightShoulder = new THREE.Mesh(shoulderGeometry, stickMaterial);
rightShoulder.position.set(0.2, 1.3, 0);
rightShoulder.castShadow = true;
stickmanGroup.add(rightShoulder);

// Arms (positioned to connect to shoulders)
const armGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.6);
const leftArm = new THREE.Mesh(armGeometry, stickMaterial);
leftArm.position.set(-0.2, 1.0, 0); // Connected to left shoulder
leftArm.castShadow = true;
stickmanGroup.add(leftArm);

const rightArm = new THREE.Mesh(armGeometry, stickMaterial);
rightArm.position.set(0.2, 1.0, 0); // Connected to right shoulder
rightArm.castShadow = true;
stickmanGroup.add(rightArm);

// Legs (positioned so they rotate from the hip/top and connect body to ground)
const legGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.8);
const leftLeg = new THREE.Mesh(legGeometry, stickMaterial);
leftLeg.position.set(-0.1, 0.4, 0); // Position so leg connects body to ground
leftLeg.castShadow = true;
stickmanGroup.add(leftLeg);

const rightLeg = new THREE.Mesh(legGeometry, stickMaterial);
rightLeg.position.set(0.1, 0.4, 0); // Position so leg connects body to ground  
rightLeg.castShadow = true;
stickmanGroup.add(rightLeg);

// Position stickman in the center of the room
stickmanGroup.position.set(0, 0, 0);
scene.add(stickmanGroup);

// Add some basic lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Add a simple object in the room for reference
const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
const cubeMaterial = new THREE.MeshLambertMaterial({ color: 0xff6b6b });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.set(5, 1, 5);
cube.castShadow = true;
scene.add(cube);

// Position camera for third person view
camera.position.set(0, 8, 10);
camera.lookAt(stickmanGroup.position);

// Animation variables
let walkCycle = 0;
const walkSpeed = 3; // Slower animation speed
let isWalking = false;

// Mouse controls for camera
let mouseX = 0;
let mouseY = 0;
let isMouseDown = false;

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
    
    // Update camera position around the stickman
    const distance = 10;
    camera.position.x = stickmanGroup.position.x + distance * Math.sin(mouseX);
    camera.position.z = stickmanGroup.position.z + distance * Math.cos(mouseX);
    camera.position.y = stickmanGroup.position.y + 8 + mouseY * 5;
    
    camera.lookAt(stickmanGroup.position);
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
    }
});

// Movement and animation function
function updateStickman() {
    const direction = new THREE.Vector3();
    
    if (keys.w) direction.z -= 1;
    if (keys.s) direction.z += 1;
    if (keys.a) direction.x -= 1;
    if (keys.d) direction.x += 1;
    
    isWalking = direction.length() > 0;
    
    if (isWalking) {
        direction.normalize();
        direction.multiplyScalar(moveSpeed);
        
        const newPosition = stickmanGroup.position.clone().add(direction);
        
        // Simple collision detection with room bounds
        const halfRoom = roomSize / 2 - 0.5;
        newPosition.x = Math.max(-halfRoom, Math.min(halfRoom, newPosition.x));
        newPosition.z = Math.max(-halfRoom, Math.min(halfRoom, newPosition.z));
        
        stickmanGroup.position.copy(newPosition);
        
        // Make stickman face movement direction
        const angle = Math.atan2(direction.x, direction.z);
        stickmanGroup.rotation.y = angle;
        
        // Walking animation (slower and more natural)
        walkCycle += walkSpeed * 0.05; // Much slower increment
        
        // Animate legs (rotating from hip, smaller range)
        leftLeg.rotation.x = Math.sin(walkCycle) * 0.3; // Smaller rotation range
        rightLeg.rotation.x = -Math.sin(walkCycle) * 0.3;
        
        // Animate arms (subtle swing, opposite to legs)
        leftArm.rotation.x = -Math.sin(walkCycle) * 0.15; // Much smaller arm swing
        rightArm.rotation.x = Math.sin(walkCycle) * 0.15;
        
        // Slight body bob (more subtle)
        body.position.y = 1.0 + Math.abs(Math.sin(walkCycle * 2)) * 0.02;
        head.position.y = 1.6 + Math.abs(Math.sin(walkCycle * 2)) * 0.02;
    } else {
        // Reset to idle pose
        leftLeg.rotation.x = 0;
        rightLeg.rotation.x = 0;
        leftArm.rotation.x = 0;
        rightArm.rotation.x = 0;
        body.position.y = 1.0;
        head.position.y = 1.6;
    }
    
    // Update camera to follow stickman
    const distance = 10;
    const targetCameraX = stickmanGroup.position.x + distance * Math.sin(mouseX);
    const targetCameraZ = stickmanGroup.position.z + distance * Math.cos(mouseX);
    const targetCameraY = stickmanGroup.position.y + 8 + mouseY * 5;
    
    // Smooth camera follow
    camera.position.x += (targetCameraX - camera.position.x) * 0.1;
    camera.position.z += (targetCameraZ - camera.position.z) * 0.1;
    camera.position.y += (targetCameraY - camera.position.y) * 0.1;
    
    camera.lookAt(stickmanGroup.position);
}

// Render loop
function animate() {
    requestAnimationFrame(animate);
    
    updateStickman();
    
    // Rotate the cube for visual reference
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    
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
instructions.style.background = 'rgba(0,0,0,0.7)';
instructions.style.padding = '10px';
instructions.style.borderRadius = '5px';
instructions.innerHTML = `
    <strong>Controls:</strong><br>
    WASD - Move stickman<br>
    Click and drag - Rotate camera around stickman
`;
document.body.appendChild(instructions);

// Start the animation loop
animate();