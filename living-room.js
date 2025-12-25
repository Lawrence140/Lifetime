import * as THREE from './three/build/three.module.js';
import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js';

// Scene + renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Shared audio context (lazy-init) to avoid creating a new AudioContext per fragment
let sharedAudioCtx = null;
function getAudioContext() {
    if (!sharedAudioCtx) {
        try {
            sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('AudioContext init failed', e);
            sharedAudioCtx = null;
        }
    }
    return sharedAudioCtx;
}

// Pre-create fragments modal to avoid DOM work during gameplay (created hidden)
function createFragmentsModal() {
    if (document.getElementById('fragmentsModal')) return;
    const fragModal = document.createElement('div');
    fragModal.id = 'fragmentsModal';
    fragModal.style.display = 'none';
    fragModal.innerHTML = `
        <div class="fragments-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;">
            <div class="fragments-panel" style="background:#0f0f10;color:#fff;padding:18px;border-radius:10px;max-width:520px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,0.6);font-family:Arial,Helvetica,sans-serif;text-align:center;">
                <div style="font-size:20px;font-weight:700;margin-bottom:8px;color:#88ff88;">✓ ALL FRAGMENTS COLLECTED!</div>
                <div style="margin-bottom:12px;color:#dcdcdc;">You have collected all fragments.</div>
                <div style="margin-bottom:12px;color:#ffd27a; font-weight:700;">Head to the door to exit.</div>
                <div style="display:flex;gap:12px;justify-content:center;margin-top:6px;">
                    <button id="fragmentsModalOk" style="padding:10px 14px;background:#27ae60;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;">Got it</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(fragModal);
    // hook up button and keyboard handler
    const okBtn = document.getElementById('fragmentsModalOk');
    function hideFragModal() {
        const m = document.getElementById('fragmentsModal');
        if (m) m.style.display = 'none';
        isPaused = false;
    }
    function fragModalKey(e) {
        const m = document.getElementById('fragmentsModal');
        if (!m || m.style.display === 'none') return;
        if (e.key === 'Escape' || e.key === 'Enter') { hideFragModal(); }
    }
    okBtn.addEventListener('click', hideFragModal);
    // attach key handler once (it will only act when modal is visible)
    document.addEventListener('keydown', fragModalKey);
}

// create fragments modal at startup to avoid runtime creation
createFragmentsModal();

// Audio listener (for TV hum and future SFX)
const listener = new THREE.AudioListener();
camera.add(listener);

// Room dims (increased by ~50%)
const roomW = 36, roomD = 27, wallH = 9;

// Materials
const floorMat = new THREE.MeshLambertMaterial({ color: 0x4a3928 });
const wallMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });

// Floor
const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), floorMat);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow = true;
scene.add(floor);

// Ceiling
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), new THREE.MeshLambertMaterial({ color: 0x111111 }));
ceiling.rotation.x = Math.PI/2; ceiling.position.y = wallH; scene.add(ceiling);

// Ceiling lights (chandelier-style fixture in center)
{
    const ceilingLight = new THREE.Group();
    ceilingLight.name = 'ceilingLight';
    
    // Chain/rod hanging from ceiling
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.7, roughness: 0.3 });
    const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 2.0, 8),
        chainMat
    );
    chain.position.y = wallH - 1.0;
    chain.castShadow = true;
    ceilingLight.add(chain);
    
    // Main fixture body (circular base)
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, metalness: 0.2, roughness: 0.6 });
    const fixtureBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.6, 0.3, 16),
        fixtureMat
    );
    fixtureBase.position.y = wallH - 2.2;
    fixtureBase.castShadow = true;
    ceilingLight.add(fixtureBase);
    
    // Light bulbs/globes around the fixture (4 bulbs)
    const bulbMat = new THREE.MeshStandardMaterial({ 
        color: 0xfff5e1, 
        emissive: 0xffdd88, 
        emissiveIntensity: 0.5,
        roughness: 0.3 
    });
    
    const numBulbs = 4;
    for (let i = 0; i < numBulbs; i++) {
        const angle = (i / numBulbs) * Math.PI * 2;
        const bulbRadius = 0.65;
        
        // Bulb globe
        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 16, 16),
            bulbMat
        );
        bulb.position.set(
            Math.cos(angle) * bulbRadius,
            wallH - 2.3,
            Math.sin(angle) * bulbRadius
        );
        ceilingLight.add(bulb);
        
        // Point light from each bulb
        const bulbLight = new THREE.PointLight(0xfff3cc, 0.8, 15);
        bulbLight.position.copy(bulb.position);
        bulbLight.castShadow = true;
        bulbLight.shadow.mapSize.width = 512;
        bulbLight.shadow.mapSize.height = 512;
        ceilingLight.add(bulbLight);
    }
    
    // Central main light (brighter)
    const mainCeilingLight = new THREE.PointLight(0xfff3cc, 1.2, 20);
    mainCeilingLight.position.set(0, wallH - 2.5, 0);
    mainCeilingLight.castShadow = true;
    mainCeilingLight.shadow.mapSize.width = 1024;
    mainCeilingLight.shadow.mapSize.height = 1024;
    ceilingLight.add(mainCeilingLight);
    
    scene.add(ceilingLight);
    // Duplicate the chandelier so there are two identical fixtures with the same design and light intensity.
    // Clone deeply (true) to copy meshes and lights, then translate the clone to a different X position.
    try {
        const ceilingLight2 = ceilingLight.clone(true);
        ceilingLight2.name = 'ceilingLight2';
        // Move the second chandelier to the east side of the room (same height preserved)
        ceilingLight2.position.set(8, 0, 0);
        scene.add(ceilingLight2);
    } catch (err) {
        console.warn('Failed to clone/add second chandelier:', err);
    }
}

// Simple walls (north, south, east & west)
const t = 0.5;
const north = new THREE.Mesh(new THREE.BoxGeometry(roomW, wallH, t), wallMat);
north.position.set(0, wallH/2, -roomD/2 + t/2);
scene.add(north);

const south = new THREE.Mesh(new THREE.BoxGeometry(roomW, wallH, t), wallMat);
south.position.set(0, wallH/2, roomD/2 - t/2);
scene.add(south);

const west = new THREE.Mesh(new THREE.BoxGeometry(t, wallH, roomD), wallMat);
west.position.set(-roomW/2 + t/2, wallH/2, 0);
scene.add(west);

const east = new THREE.Mesh(new THREE.BoxGeometry(t, wallH, roomD), wallMat);
east.position.set(roomW/2 - t/2, wallH/2, 0);
scene.add(east);

// Sofa (group)
const sofa = new THREE.Group();
sofa.userData.interactable = true;
const base = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 2.2), new THREE.MeshLambertMaterial({ color: 0x5a321f })); base.position.y = 0.55; sofa.add(base);
const back = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 0.5), new THREE.MeshLambertMaterial({ color: 0x432815 })); back.position.set(0,1.2,-0.85); sofa.add(back);
sofa.position.set(0,0,4); scene.add(sofa);

// Lamp
const lamp = new THREE.Group(); lamp.userData.interactable = true;
const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,2), new THREE.MeshLambertMaterial({ color: 0x111111 })); pole.position.y = 1; lamp.add(pole);
const shade = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1, 16), new THREE.MeshStandardMaterial({ color: 0xfff6d8 })); shade.position.y = 2; lamp.add(shade);
const lampLight = new THREE.PointLight(0xfff3cc, 1.0, 8); lampLight.position.set(0,2,0); lamp.add(lampLight);
lamp.position.set(-10,0,4); scene.add(lamp);

// --- TV + TV Stand ---
const tvStand = new THREE.Group();
const standMat = new THREE.MeshLambertMaterial({ color: 0x3b2b20 });
const stand = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 1.6), standMat);
stand.position.y = 0.6; tvStand.add(stand);
tvStand.name = 'tvStand';

// TV screen (thin)
const tvScreenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x000000 });
const tv = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.1, 0.06), tvScreenMat);
tv.position.set(0, 1.6, 0.7);
tvStand.add(tv);

// TV frame (wooden border) so the TV doesn’t look like it's floating
{
    const tvW = 3.6, tvH = 2.1;
    const border = 0.14; // frame thickness
    const depth = 0.08;  // frame depth
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, metalness: 0.1, roughness: 0.8 });
    const tvFrame = new THREE.Group();
    tvFrame.position.copy(tv.position);

    const topBar = new THREE.Mesh(new THREE.BoxGeometry(tvW + border * 2, border, depth), frameMat);
    topBar.position.set(0, tvH / 2 + border / 2, 0);
    const bottomBar = new THREE.Mesh(new THREE.BoxGeometry(tvW + border * 2, border, depth), frameMat);
    bottomBar.position.set(0, -tvH / 2 - border / 2, 0);
    const leftBar = new THREE.Mesh(new THREE.BoxGeometry(border, tvH + border * 2, depth), frameMat);
    leftBar.position.set(-tvW / 2 - border / 2, 0, 0);
    const rightBar = new THREE.Mesh(new THREE.BoxGeometry(border, tvH + border * 2, depth), frameMat);
    rightBar.position.set(tvW / 2 + border / 2, 0, 0);
    [topBar, bottomBar, leftBar, rightBar].forEach(b => { b.castShadow = true; b.receiveShadow = false; });

    tvFrame.add(topBar, bottomBar, leftBar, rightBar);
    tvStand.add(tvFrame);
}

// --- TV dynamic screen and glow ---
const TV_STATES = { OFF: 0, ON: 1, GLITCH: 2 };
let tvState = TV_STATES.ON; // start ON

// Canvas-based screen texture
const tvCanvas = document.createElement('canvas');
tvCanvas.width = 256; tvCanvas.height = 144;
const tvCtx = tvCanvas.getContext('2d');
const tvTexture = new THREE.CanvasTexture(tvCanvas);
if (THREE.SRGBColorSpace) tvTexture.colorSpace = THREE.SRGBColorSpace; else if (THREE.sRGBEncoding) tvTexture.encoding = THREE.sRGBEncoding;
tvTexture.minFilter = THREE.NearestFilter;
tvTexture.magFilter = THREE.NearestFilter;

// Make the screen emissive (self-lit)
tv.material = new THREE.MeshBasicMaterial({ map: tvTexture, toneMapped: false });

// Subtle glow in front of the TV when on
const tvGlow = new THREE.PointLight(0x88bbff, 0.9, 7);
tvGlow.position.set(0, 1.5, 1.1); // relative to tvStand
tvStand.add(tvGlow);

function drawTvFrame(timeMs, glitch = false) {
    const w = tvCanvas.width, h = tvCanvas.height;
    const img = tvCtx.createImageData(w, h);
    const data = img.data;
    const t = timeMs * 0.001;

    for (let y = 0; y < h; y++) {
        const scan = 0.75 + 0.25 * Math.sin((y + t * 120) * 0.05);
        const shift = glitch ? Math.floor(Math.sin(y * 0.15 + t * 8) * 3) : 0;
        // occasional white tear line in glitch mode
        const tear = glitch && Math.random() < 0.002;
        for (let x = 0; x < w; x++) {
            const idx = 4 * (y * w + ((x + shift + w) % w));
            let v = tear ? 255 : Math.random() * 255 * (0.55 + 0.35 * scan);
            data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; data[idx + 3] = 255;
        }
    }
    tvCtx.putImageData(img, 0, 0);
    // faint scanlines overlay
    tvCtx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let y = 0; y < h; y += 2) tvCtx.fillRect(0, y, w, 1);
}

// place TV stand against the south wall
tvStand.position.set(0, 0, roomD/2 - 1.6);
scene.add(tvStand);

// --- Soundbar under the TV and two controllers on the stand ---
{
    const topY = 1.2; // stand top
    const soundbarMat = new THREE.MeshStandardMaterial({ color: 0x111214, metalness: 0.2, roughness: 0.6 });
    const soundbar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.15, 0.35), soundbarMat);
    soundbar.castShadow = true; soundbar.receiveShadow = false;
    soundbar.position.set(0, topY + 0.075 + 0.02, 0.55);
    tvStand.add(soundbar);

    // Simple grill detail as a slightly darker inset strip
    const grill = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.05, 0.01), new THREE.MeshStandardMaterial({ color: 0x0c0d0f, metalness: 0.1, roughness: 0.7 }));
    grill.position.set(0, -0.02, 0.17);
    soundbar.add(grill);

    // Controllers (two small gamepads) on the stand top
    function makeController(color = 0x2a2f39) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.35), new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.6 }));
        body.castShadow = true; g.add(body);
        const stick1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x0e0e0e }));
        stick1.position.set(-0.15, 0.09, 0.02); g.add(stick1);
        const stick2 = stick1.clone(); stick2.position.set(0.15, 0.09, 0.02); g.add(stick2);
        const btn = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 10), new THREE.MeshStandardMaterial({ color: 0xff4444 }));
        btn.position.set(0.18, 0.07, -0.08); g.add(btn);
        return g;
    }
    const ctrlL = makeController(0x2a2f39); ctrlL.position.set(-1.1, topY + 0.06 + 0.02, 0.25); ctrlL.rotation.y = 0.15; tvStand.add(ctrlL);
    const ctrlR = makeController(0x39445a); ctrlR.position.set(1.05, topY + 0.06 + 0.02, 0.22); ctrlR.rotation.y = -0.2; tvStand.add(ctrlR);
}

// --- TV hum (optional): toggle with E when near the TV ---
let tvHum = null; // THREE.PositionalAudio
let tvHumOn = false;
function ensureTvHum() {
    if (tvHum) return tvHum;
    tvHum = new THREE.PositionalAudio(listener);
    // create a simple low-frequency hum using an OscillatorNode
    const ctx = listener.context;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 85; // Hz
    const humGain = ctx.createGain(); humGain.gain.value = 0.06; // gentle
    osc.connect(humGain).connect(tvHum.getOutput());
    osc.start();
    tvStand.add(tvHum);
    tvHum.position.set(0, 1.4, 0.7);
    tvHum.setRefDistance(2.5);
    tvHum.setDistanceModel('inverse');
    tvHumOn = true; // will be toggled by onInteract
    return tvHum;
}

// Add items on the TV stand top: console, remote, and books
{
    const topY = 1.2; // stand top
    const items = new THREE.Group();
    items.name = 'tvStandItems';

    // Game console unit (left)
    const consoleMat = new THREE.MeshStandardMaterial({ color: 0x22262a, metalness: 0.3, roughness: 0.5 });
    const consoleUnit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.9), consoleMat);
    consoleUnit.castShadow = true; consoleUnit.receiveShadow = false;
    consoleUnit.position.set(-2.6, topY + 0.125 + 0.02, 0.05);
    // power indicator
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 10), new THREE.MeshStandardMaterial({ color: 0x55ff88, emissive: 0x55ff88, emissiveIntensity: 0.7 }));
    led.position.set(0.7, 0.06, 0.42); consoleUnit.add(led);
    items.add(consoleUnit);

    // Remote control (center)
    const remoteMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.2, roughness: 0.8 });
    const remote = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.18), remoteMat);
    remote.castShadow = true; remote.rotation.y = 0.2;
    remote.position.set(0.4, topY + 0.04 + 0.02, 0.58);
    items.add(remote);

    // Books stack (right)
    function makeBook(w, h, d, color) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.9 }));
        m.castShadow = true; return m;
    }
    const books = new THREE.Group();
    const b1 = makeBook(1.0, 0.07, 0.65, 0x8b4513); b1.rotation.y = 0.08; b1.position.y = 0.035;
    const b2 = makeBook(0.95, 0.06, 0.6, 0x2f4858); b2.rotation.y = -0.05; b2.position.y = 0.035 + 0.06;
    const b3 = makeBook(1.02, 0.08, 0.68, 0xa77b45); b3.rotation.y = 0.12; b3.position.y = 0.035 + 0.06 + 0.08;
    books.add(b1, b2, b3);
    books.position.set(2.7, topY + 0.02, -0.15);
    items.add(books);

    tvStand.add(items);
    // Note: We keep these props as children of tvStand only; no separate camera/collision entries.
}

// --- Carpet between sofa and TV ---
// Place a floor carpet centered between the sofa (z≈4) and the TV stand (z≈roomD/2 - 1.6)
{
    const carpetWidth = 6; // X size
    const zGap = Math.abs(tvStand.position.z - sofa.position.z);
    const carpetLength = Math.max(4, zGap - 2); // leave margin from sofa and TV
    const carpetGeo = new THREE.PlaneGeometry(carpetWidth, carpetLength);
    const carpetMat = new THREE.MeshLambertMaterial({ color: 0x6b3a2f });
    const carpet = new THREE.Mesh(carpetGeo, carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(
        (sofa.position.x + tvStand.position.x) / 2,
        0.02, // slight lift to avoid z-fighting with floor
        (sofa.position.z + tvStand.position.z) / 2
    );
    carpet.receiveShadow = true;
    carpet.name = 'carpet';
    scene.add(carpet);
}

// --- Dining table (from kitchen) placed where coffee table was ---
// Adapted: lowered to coffee-table height and moved to living-room center area (z = -2.5)
// Increased height by 50% (table and chairs) per design request
const tableTopGeometry = new THREE.BoxGeometry(8, 0.2, 4);
const TABLE_LEG_BASE_HEIGHT = 1.8; // original base leg height
const tableLegHeight = TABLE_LEG_BASE_HEIGHT * 1.5; // 50% taller
const tableLegGeometry = new THREE.CylinderGeometry(0.1, 0.1, tableLegHeight); // taller legs
const tableMaterial = new THREE.MeshLambertMaterial({ color: 0xDEB887 });

const tableTop = new THREE.Mesh(tableTopGeometry, tableMaterial);
const tableCenterX = 0;
const tableCenterZ = -2.5; // place at previous coffee table spot
// Raise the table top 50% taller (from 1.3 to 1.95)
tableTop.position.set(tableCenterX, 1.3 * 1.5, tableCenterZ);
tableTop.castShadow = true;
tableTop.receiveShadow = true;
tableTop.name = 'diningTableTop';
scene.add(tableTop);

// Table legs (low coffee-table style)
const legPositions = [
    { x: -3.2, z:  1.6 },
    { x:  3.2, z:  1.6 },
    { x: -3.2, z: -1.6 },
    { x:  3.2, z: -1.6 }
];
const tableLegs = [];
for (let p of legPositions) {
    const leg = new THREE.Mesh(tableLegGeometry, tableMaterial);
    // Compute leg Y so the top of the leg meets the underside of the tabletop.
    // Table top thickness = 0.2 -> underside is tableTop.position.y - 0.1
    const tableUndersideY = tableTop.position.y - 0.1;
    const legY = tableUndersideY - (tableLegHeight / 2);
    leg.position.set(p.x, legY, p.z + tableCenterZ);
    leg.castShadow = true;
    leg.name = 'diningLeg';
    scene.add(leg);
    tableLegs.push(leg);
}

// Chairs (6 chairs for bigger table, scaled down for low table)
// Chairs: increase vertical dimensions by 50%
const chairSeatGeometry = new THREE.BoxGeometry(1, 0.1, 1);
const CHAIR_BACK_BASE_HEIGHT = 1.2;
const CHAIR_LEG_BASE_HEIGHT = 1.2;
const chairBackGeometry = new THREE.BoxGeometry(1, CHAIR_BACK_BASE_HEIGHT * 1.5, 0.1);
const chairLegHeight = CHAIR_LEG_BASE_HEIGHT * 1.5;
const chairLegGeometry = new THREE.CylinderGeometry(0.05, 0.05, chairLegHeight);
// seat Y we will position seats at the scaled height
const seatY = 0.8 * 1.5; // 0.8 originally -> 50% taller

const chairs = [];
for (let i = 0; i < 6; i++) {
    const chairGroup = new THREE.Group();
    // Chair legs
    const offsets = [
        {x: -0.4, z: -0.4},
        {x:  0.4, z: -0.4},
        {x: -0.4, z:  0.4},
        {x:  0.4, z:  0.4}
    ];
        for (let o of offsets) {
        const chairLeg = new THREE.Mesh(chairLegGeometry, tableMaterial);
        // Position chair legs so the top meets the underside of the seat.
        // Seat thickness = 0.1 -> underside at seatY - 0.05
        const seatUndersideY = seatY - 0.05;
        const chairLegY = seatUndersideY - (chairLegHeight / 2);
        chairLeg.position.set(o.x, chairLegY, o.z);
        chairLeg.castShadow = true;
        chairGroup.add(chairLeg);
    }
    // Chair seat
    const seat = new THREE.Mesh(chairSeatGeometry, tableMaterial);
    // seat height increased 50%: 0.8 -> 1.2
    seat.position.y = seatY;
    chairGroup.add(seat);

    // Chair back
    const back = new THREE.Mesh(chairBackGeometry, tableMaterial);
    // back vertical position increased proportionally (1.35 -> 1.35 * 1.5 = 2.025)
    back.position.set(0, 1.35 * 1.5, -0.42);
    chairGroup.add(back);

    // Position chairs around table
    if (i === 0) {
        chairGroup.position.set(tableCenterX - 2, 0, tableCenterZ + 2.5);
        chairGroup.rotation.y = Math.PI; // face table
    } else if (i === 1) {
        chairGroup.position.set(tableCenterX + 2, 0, tableCenterZ + 2.5);
        chairGroup.rotation.y = Math.PI;
    } else if (i === 2) {
        chairGroup.position.set(tableCenterX - 2, 0, tableCenterZ - 2.5);
        chairGroup.rotation.y = 0;
    } else if (i === 3) {
        chairGroup.position.set(tableCenterX + 2, 0, tableCenterZ - 2.5);
        chairGroup.rotation.y = 0;
    } else if (i === 4) {
        chairGroup.position.set(tableCenterX - 4.5, 0, tableCenterZ);
        chairGroup.rotation.y = Math.PI/2;
    } else if (i === 5) {
        chairGroup.position.set(tableCenterX + 4.5, 0, tableCenterZ);
        chairGroup.rotation.y = -Math.PI/2;
    }

    chairGroup.traverse(c => { if (c.isMesh) c.castShadow = true; });
    chairGroup.name = 'diningChair' + i;
    scene.add(chairGroup);
    chairs.push(chairGroup);
}

// --- Living room table decor: magazines, bowl with fruit, coasters ---
{
    const tableTopY = tableTop.position.y + 0.1; // top surface (table height 0.2)
    const decor = new THREE.Group();
    decor.name = 'livingTableDecor';

    // Helper for a magazine (thin box)
    function makeMagazine(w, h, d, color) {
        const m = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.9 })
        );
        m.castShadow = true; return m;
    }

    // Magazine stack near one edge
    const mags = new THREE.Group();
    const mag1 = makeMagazine(1.2, 0.02, 1.6, 0x9e9e9e); mag1.rotation.y = 0.08; mag1.position.y = 0.01;
    const mag2 = makeMagazine(1.15, 0.02, 1.5, 0x6b8aa5); mag2.rotation.y = -0.05; mag2.position.y = 0.03;
    const mag3 = makeMagazine(1.25, 0.02, 1.55, 0xc7b299); mag3.rotation.y = 0.12; mag3.position.y = 0.05;
    mags.add(mag1, mag2, mag3);
    mags.position.set(tableCenterX - 2.2, tableTopY + 0.005, tableCenterZ + 0.8);
    decor.add(mags);

    // Bowl with fruit (center-ish)
    const bowl = new THREE.Group();
    const bowlOuter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.65, 0.18, 20),
        new THREE.MeshStandardMaterial({ color: 0x8d6e63, metalness: 0.1, roughness: 0.8 })
    );
    bowlOuter.castShadow = true; bowlOuter.receiveShadow = true; bowlOuter.position.y = 0.09;
    const bowlInner = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.62, 0.16, 20),
        new THREE.MeshStandardMaterial({ color: 0x6d4c41, metalness: 0.05, roughness: 0.9 })
    );
    bowlInner.position.y = 0.09;
    bowl.add(bowlOuter);
    // Fruit (oranges/apples)
    function addFruit(x, y, z, color) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 12), new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.6 }));
        f.castShadow = true; f.position.set(x, y, z); bowl.add(f);
    }
    addFruit(-0.15, 0.2, 0.0, 0xffa726);
    addFruit(0.05, 0.19, 0.1, 0xffb74d);
    addFruit(0.12, 0.18, -0.08, 0xc62828);
    addFruit(-0.02, 0.21, -0.02, 0x2e7d32);
    bowl.position.set(tableCenterX + 0.2, tableTopY + 0.01, tableCenterZ + 0.15);
    decor.add(bowl);

    // Coasters (two near opposite sides)
    function makeCoaster(r = 0.18, h = 0.015, color = 0x9d7763) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.85 }));
        c.castShadow = true; return c;
    }
    const coaster1 = makeCoaster(); coaster1.position.set(tableCenterX + 2.3, tableTopY + 0.008, tableCenterZ - 0.9);
    const coaster2 = makeCoaster(0.18, 0.015, 0x7e665a); coaster2.position.set(tableCenterX - 1.6, tableTopY + 0.008, tableCenterZ - 1.1);
    decor.add(coaster1, coaster2);

    // Small decorative box
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: 0x4e342e, metalness: 0.08, roughness: 0.85 }));
    box.castShadow = true; box.position.set(tableCenterX + 1.6, tableTopY + 0.06 + 0.005, tableCenterZ + 1.0);
    decor.add(box);

    scene.add(decor);
}

// Lights
// Use very dim ambient light for dark escape room atmosphere
const hemi = new THREE.HemisphereLight(0x1a1a1a, 0x050505, 0.15); // Very dim ambient light
scene.add(hemi);

// Primary directional light - very weak and cold
const dir = new THREE.DirectionalLight(0x4a4a52, 0.2);
dir.position.set(10, 14, 8);
dir.castShadow = true;
dir.shadow.mapSize.width = 2048;
dir.shadow.mapSize.height = 2048;
dir.shadow.bias = -0.00025;
// fit shadow camera to the room size
dir.shadow.camera.left = -20;
dir.shadow.camera.right = 20;
dir.shadow.camera.top = 20;
dir.shadow.camera.bottom = -20;
dir.shadow.camera.near = 0.5;
dir.shadow.camera.far = 60;
scene.add(dir);

// Soft fill light from the opposite side - also very dim
const fill = new THREE.DirectionalLight(0x2a2a2a, 0.1);
fill.position.set(-12, 10, -10);
fill.castShadow = false; // fill should not cast shadows
scene.add(fill);

// --- Flashlight System (from kitchen) ---
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

// Create flashlight target
const flashlightTarget = new THREE.Object3D();
scene.add(flashlightTarget);
flashlight.target = flashlightTarget;

// Initially off
flashlight.visible = false;

// --- Battery System (from kitchen) ---
const MAX_BATTERY = 300.0;
let battery = MAX_BATTERY;
let hasFlashlight = true;
let flashlightOn = false;

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

// Flashlight toggle
function toggleFlashlight() {
    if (hasFlashlight && battery > 0) {
        flashlightOn = !flashlightOn;
        flashlight.visible = flashlightOn;
        
        // Show battery UI when flashlight is toggled
        batteryBar.style.display = flashlightOn ? 'block' : 'none';
        
        // Update animation state if needed
        if (mixer) updateAnimationState();
    } else if (battery <= 0) {
        console.log("Flashlight battery is dead!");
        flashlightOn = false;
        flashlight.visible = false;
        batteryBar.style.display = 'none';
    }
}

// Battery update function
function updateFlashlight() {
    if (!hasFlashlight) return;
    
    if (!isPaused && !isGameOver && battery > 0) {
        const drainRate = flashlightOn ? 1.0/30 : 0.0; // Increased drain rate
        battery = Math.max(0, battery - drainRate);
        
        // Save battery to localStorage
        localStorage.setItem("livingRoomBattery", battery.toString());
        
        // Update battery display
        updateBatteryDisplay();
        
        const batteryFrac = battery / MAX_BATTERY;
        
        if (flashlightOn) {
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
            flashlightOn = false;
            flashlight.visible = false;
            batteryBar.style.display = 'none';
            if (mixer) updateAnimationState();
            triggerGameOver();
            return;
        }
    }
    
    // Update flashlight direction
    if (flashlightOn) {
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        const targetPosition = new THREE.Vector3();
        camera.getWorldPosition(targetPosition);
        targetPosition.add(cameraDirection.multiplyScalar(10));
        flashlightTarget.position.copy(targetPosition);
    }
}

function updateBatteryDisplay() {
    if (isGameOver) return;
    
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

// Game over trigger
function triggerGameOver() {
    if (isGameOver) return;
    
    isGameOver = true;
    batteryBar.style.display = "none";
    
    const gameOverEl = document.getElementById("gameOver");
    if (gameOverEl) {
        gameOverEl.style.display = "block";
    }
    
    flashlightOn = false;
    flashlight.visible = false;
    if (mixer) updateAnimationState();
    
    console.log("Game Over - Battery depleted!");
}

function initializeBattery() {
    const savedBattery = localStorage.getItem("livingRoomBattery");
    if (savedBattery !== null) {
        battery = parseFloat(savedBattery);
        // If battery was depleted in previous session, start fresh
        if (battery <= 0) {
            battery = MAX_BATTERY;
            localStorage.setItem("livingRoomBattery", battery.toString());
        }
    } else {
        battery = MAX_BATTERY;
        localStorage.setItem("livingRoomBattery", battery.toString());
    }
    
    // Hide battery UI initially
    batteryBar.style.display = 'none';
}

// Raycaster and a list of objects that should block the camera (walls, large furniture)
const raycaster = new THREE.Raycaster();
let cameraBlockers = [ north, west, sofa ]; // we will extend this below when new furniture created

// Collidable objects for player movement (can be a subset of cameraBlockers)
let collidables = [ north, west, sofa ];

// chairs array is populated above during creation

// Now append the newly created furniture (south, east, tvStand, tableTop, tableLegs, chairs)
// collect table legs into array for blockers
const tableParts = [ tableTop ].concat(typeof tableLegs !== 'undefined' ? tableLegs : []);
cameraBlockers = cameraBlockers.concat([ south, east, tvStand ]).concat(tableParts).concat(chairs);
collidables = collidables.concat([ south, east, tvStand ]).concat(tableParts).concat(chairs);

// --- Wall art: framed pictures (thin boxes with a texture) ---
{
    const texLoader = new THREE.TextureLoader();

    function createFramedPicture(tex, width = 2.2, height = 1.6, border = 0.15, depth = 0.08) {
        const group = new THREE.Group();

        // Frame box (slightly larger than picture)
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, metalness: 0.1, roughness: 0.8 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(width + border * 2, height + border * 2, depth), frameMat);
        frame.castShadow = false; frame.receiveShadow = false;
        group.add(frame);

        // Picture plane (slightly in front of frame)
        const picMat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.0, roughness: 1.0 });
        const picture = new THREE.Mesh(new THREE.PlaneGeometry(width, height), picMat);
        picture.position.z = depth / 2 + 0.005;
        group.add(picture);

        return group;
    }

    // Place 3 pictures on the east wall near the sofa area
    const eastInnerX = roomW / 2 - t - 0.03; // tiny offset into the room so it doesn't z-fight
    const artY = 4.5; // eye-level center
    const centerZ = sofa.position.z; // align roughly with sofa depth
    const offsetsZ = [-3, 0, 3];

    texLoader.load('/bg.jpeg', (tex) => {
        // set sRGB color space if available
        if (THREE.SRGBColorSpace) {
            tex.colorSpace = THREE.SRGBColorSpace;
        } else if (THREE.sRGBEncoding) {
            tex.encoding = THREE.sRGBEncoding;
        }

        offsetsZ.forEach((dz, i) => {
            const art = createFramedPicture(tex, 2.3, 1.7, 0.18, 0.08);
            // Rotate to face into the room from the east wall
            art.rotation.y = Math.PI / 2;
            art.position.set(eastInnerX, artY, centerZ + dz);
            art.name = 'wallArt_' + i;
            if (i === 1) art.userData.hasSecret = true; // reserve middle one for future safe/keypad
            scene.add(art);
            cameraBlockers.push(art);
        });
    }, undefined, (err) => console.warn('Wall art texture failed to load', err));
}

// Player collision properties
const playerRadius = 0.35; // horizontal radius for collision checks
const stepHeight = 1.0; // max vertical step the player can climb onto (in scene units)

// --- Console under wall artwork: reuse the TV stand object (rotated) ---
{
    const artStand = new THREE.Group();
    artStand.name = 'artTvStyleStand';

    // Reuse same material/color as TV stand
    const mat = standMat || new THREE.MeshLambertMaterial({ color: 0x3b2b20 });

    // Same geometry as TV stand: 6 (length) x 1.2 (height) x 1.4 (depth)
    const standMesh = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 1.4), mat);
    standMesh.castShadow = true;
    standMesh.receiveShadow = true;

    // Rotate so the long edge runs along Z under the three pictures
    standMesh.rotation.y = Math.PI / 2;
    standMesh.position.y = 0.6; // sit on the floor
    artStand.add(standMesh);

    // Position against the east wall, centered under the art row
    const centerZ = sofa.position.z;
    artStand.position.set(roomW / 2 - 1.6, 0, centerZ);

    scene.add(artStand);
    cameraBlockers.push(artStand);
    collidables.push(artStand);

    // Decorative items on top of the console (books, vase, tray with candles)
    // Compute a convenient Y for the top surface (stand top is at ~1.2)
    const standTopY = 1.2 + 0.02; // tiny lift to avoid z-fighting

    // Helper to make a simple book mesh
    function makeBook(w = 0.5, h = 0.08, d = 0.8, color = 0x8b4513) {
        const m = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.9 })
        );
        m.castShadow = true;
        m.receiveShadow = false;
        return m;
    }

    // Left stack of books
    const leftStack = new THREE.Group();
    const bookA = makeBook(0.55, 0.08, 0.9, 0x7a3d1f); bookA.rotation.y = 0.05; bookA.position.y = 0.04;
    const bookB = makeBook(0.5, 0.09, 0.8, 0x2f4858); bookB.rotation.y = -0.06; bookB.position.y = 0.09 + 0.04;
    const bookC = makeBook(0.6, 0.07, 0.85, 0xa77b45); bookC.rotation.y = 0.12; bookC.position.y = 0.07 + 0.09 + 0.04;
    leftStack.add(bookA, bookB, bookC);
    leftStack.position.set(0.0, standTopY, -2.4);
    artStand.add(leftStack);

    // Middle vase
    const vaseGroup = new THREE.Group();
    const vaseBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 0.38, 16),
        new THREE.MeshStandardMaterial({ color: 0x7fc1ca, metalness: 0.2, roughness: 0.35 })
    );
    vaseBody.castShadow = true; vaseBody.receiveShadow = true;
    vaseBody.position.y = 0.19; // half height
    // small neck
    const vaseNeck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.12, 16),
        new THREE.MeshStandardMaterial({ color: 0x7fc1ca, metalness: 0.2, roughness: 0.35 })
    );
    vaseNeck.castShadow = true; vaseNeck.position.y = 0.38 + 0.06;
    vaseGroup.add(vaseBody, vaseNeck);
    vaseGroup.position.set(0.15, standTopY, 0.1);
    artStand.add(vaseGroup);

    // Right tray with two candles
    const tray = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.04, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x3b2b20, metalness: 0.05, roughness: 0.8 })
    );
    tray.castShadow = true; tray.receiveShadow = false;
    const candleMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.0, roughness: 1.0 });
    const candle1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 12), candleMat);
    const candle2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12), candleMat);
    candle1.castShadow = true; candle2.castShadow = true;
    candle1.position.set(-0.18, 0.08 + 0.02, 0.08);
    candle2.position.set(0.16, 0.06 + 0.02, -0.06);
    const flameMat = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffd060, emissiveIntensity: 0.6 });
    const flame1 = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 10), flameMat);
    const flame2 = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), flameMat);
    flame1.position.copy(candle1.position).add(new THREE.Vector3(0, 0.1, 0));
    flame2.position.copy(candle2.position).add(new THREE.Vector3(0, 0.08, 0));

    const rightGroup = new THREE.Group();
    rightGroup.add(tray, candle1, candle2, flame1, flame2);
    rightGroup.position.set(-0.05, standTopY, 2.45);
    artStand.add(rightGroup);

    // Note: We intentionally do NOT add these small props to cameraBlockers/collidables
    // to avoid jittery camera collisions and micro snagging on movement.
}

// --- Door (same procedural door used in kitchen) and corner plant ---
{
    function createDoor(x = 0, y = 0, z = 0) {
        const doorGroup = new THREE.Group();
        doorGroup.position.set(x, y, z);

        const doorWidth = 1.0;
        const doorHeight = 2.0;
        const frameThickness = 0.1;
        const frameDepth = 0.2;

        // Frame
        const frameGroup = new THREE.Group();
        const frameMat = new THREE.MeshLambertMaterial({ color: 0x4b3621 });
        const frameGeometryH = new THREE.BoxGeometry(doorWidth + frameThickness * 2, frameThickness, frameDepth);
        const frameGeometryV = new THREE.BoxGeometry(frameThickness, doorHeight + frameThickness * 2, frameDepth);
        const topFrame = new THREE.Mesh(frameGeometryH, frameMat);
        const bottomFrame = new THREE.Mesh(frameGeometryH, frameMat);
        const leftFrame = new THREE.Mesh(frameGeometryV, frameMat);
        const rightFrame = new THREE.Mesh(frameGeometryV, frameMat);
        topFrame.position.set(doorWidth / 2, doorHeight / 2 + frameThickness / 2, 0);
        bottomFrame.position.set(doorWidth / 2, -doorHeight / 2 - frameThickness / 2, 0);
        leftFrame.position.set(-frameThickness / 2, 0, 0);
        rightFrame.position.set(doorWidth + frameThickness / 2, 0, 0);
        [topFrame, bottomFrame, leftFrame, rightFrame].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
        frameGroup.add(topFrame, bottomFrame, leftFrame, rightFrame);
        doorGroup.add(frameGroup);

        // Black fill behind door
        const fillPanel = new THREE.Mesh(
            new THREE.PlaneGeometry(doorWidth, doorHeight),
            new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x000000 })
        );
        fillPanel.position.set(doorWidth / 2, 0, 0.05);
        fillPanel.receiveShadow = true;
        doorGroup.add(fillPanel);

        // Pivot (hinge at left edge)
        const doorPivot = new THREE.Group();
        doorPivot.position.set(0, 0, 0);
        doorGroup.add(doorPivot);

        // Door body
        const doorGeometry = new THREE.BoxGeometry(doorWidth, doorHeight, 0.1);
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x5d4037, metalness: 0.05, roughness: 0.7 });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.castShadow = true; door.receiveShadow = true;
        door.position.x = doorWidth / 2; // hinge from left

        // Panels
        const panelMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, metalness: 0.05, roughness: 0.8 });
        const topPanel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.02), panelMat);
        const bottomPanel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.02), panelMat);
        topPanel.position.set(0, 0.55, 0.055);
        bottomPanel.position.set(0, -0.55, 0.055);
        door.add(topPanel, bottomPanel);

        // Simple handle
        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 0.2, 10),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        handle.rotation.z = Math.PI / 2;
        handle.position.set(0.35, 0, 0.06);
        door.add(handle);

        doorPivot.add(door);
        // Expose properties similar to kitchen
        doorGroup.doorPivot = doorPivot;
        doorGroup.door = door;
        doorGroup.isOpen = false;
        doorGroup.openAngle = Math.PI / 2;
        doorGroup.currentAngle = 0;

        scene.add(doorGroup);
        return doorGroup;
    }

    // Place door on west wall, rotated to align with wall (same scale/rotation approach as kitchen)
    const lrDoor = createDoor(-roomW/2 + 0.35, 3, -6);
    lrDoor.rotation.y = Math.PI / 2;
    lrDoor.scale.set(3, 3, 3);
    lrDoor.name = 'exitDoor';
    lrDoor.userData.interactable = true;
    lrDoor.userData.unlocked = false; // Will be unlocked when all fragments collected
    // Nudge the door slightly inward from the wall to avoid z-fighting/glitching
    // Use half wall thickness plus a small epsilon
    const _doorWallOffset = (typeof t !== 'undefined' ? t / 2 + 0.05 : 0.3);
    if (lrDoor.position.x < 0) lrDoor.position.x += _doorWallOffset; else lrDoor.position.x -= _doorWallOffset;
    cameraBlockers.push(lrDoor);
    collidables.push(lrDoor);

    // Place plant at nearest corner to the door
    const corners = [
        new THREE.Vector3(-roomW/2 + 0.25, 0, -roomD/2 + 0.25), // NW
        new THREE.Vector3( roomW/2 - 0.25, 0, -roomD/2 + 0.25), // NE
        new THREE.Vector3(-roomW/2 + 0.25, 0,  roomD/2 - 0.25), // SW
        new THREE.Vector3( roomW/2 - 0.25, 0,  roomD/2 - 0.25)  // SE
    ];
    const doorPos = new THREE.Vector3();
    lrDoor.getWorldPosition(doorPos);
    let minIdx = 0, minDist = Infinity;
    for (let i = 0; i < corners.length; i++) {
        const d = doorPos.clone().setY(0).distanceTo(corners[i].clone().setY(0));
        if (d < minDist) { minDist = d; minIdx = i; }
    }
    const corner = corners[minIdx];
    const inward = 1.0; // pull in from both walls
    const plantX = corner.x < 0 ? corner.x + inward : corner.x - inward;
    const plantZ = corner.z < 0 ? corner.z + inward : corner.z - inward;

    const plant = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.6, 16), new THREE.MeshLambertMaterial({ color: 0x6d4c41 }));
    pot.position.y = 0.3; pot.castShadow = true; pot.receiveShadow = true; plant.add(pot);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 16), new THREE.MeshLambertMaterial({ color: 0x3e2723 }));
    soil.position.y = 0.6; soil.receiveShadow = true; plant.add(soil);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), new THREE.MeshLambertMaterial({ color: 0x2e7d32 }));
    stem.position.y = 1.2; stem.castShadow = true; plant.add(stem);
    for (let i = 0; i < 3; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 12), new THREE.MeshLambertMaterial({ color: 0x388e3c }));
        leaf.position.set(Math.cos(i*2*Math.PI/3)*0.25, 1.8, Math.sin(i*2*Math.PI/3)*0.25);
        leaf.rotation.x = -Math.PI/6; leaf.castShadow = true; plant.add(leaf);
    }
    plant.position.set(plantX, 0, plantZ);
    plant.name = 'cornerPlant';
    scene.add(plant);
    cameraBlockers.push(plant);
    collidables.push(plant);

    // --- Entry furniture: Shoe bench + coat rack near the door ---
    // Shoe bench: low bench placed beside the door
    const shoeBench = new THREE.Group();
    shoeBench.name = 'shoeBench';

    const benchMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, metalness: 0.1, roughness: 0.85 });
    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.5), benchMat);
    benchTop.position.y = 0.5; // bench seat height
    benchTop.castShadow = true; benchTop.receiveShadow = true;
    shoeBench.add(benchTop);

    // Bench legs (4 simple cylinders)
    const legMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, metalness: 0.05, roughness: 0.9 });
    const legRadius = 0.04, legHeight = 0.44;
    const legOffsetX = 0.5, legOffsetZ = 0.2;
    for (let lx of [-legOffsetX, legOffsetX]) {
        for (let lz of [-legOffsetZ, legOffsetZ]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(legRadius, legRadius, legHeight, 8), legMat);
            leg.position.set(lx, legHeight / 2, lz);
            leg.castShadow = true;
            shoeBench.add(leg);
        }
    }

    // Position the bench along the west wall, south of the door (clear of entrance)
    const benchX = lrDoor.position.x + 0.8; // slightly away from wall
    const benchZ = lrDoor.position.z + 5.0; // well south of door, not blocking
    shoeBench.position.set(benchX, 0, benchZ);
    scene.add(shoeBench);
    cameraBlockers.push(shoeBench);
    collidables.push(shoeBench);

    // Coat rack: tall stand with hooks, placed near the door
    const coatRack = new THREE.Group();
    coatRack.name = 'coatRack';

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, metalness: 0.2, roughness: 0.7 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 6.0, 12), poleMat);
    pole.position.y = 3.0;
    pole.castShadow = true;
    coatRack.add(pole);

    // Base disc (weight at bottom)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.15, 16), poleMat);
    base.position.y = 0.075;
    base.castShadow = true; base.receiveShadow = true;
    coatRack.add(base);

    // Hooks at various heights
    const hookMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, metalness: 0.4, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
        const hookHeight = 4.2 + i * 0.4;
        const angle = (i * Math.PI / 2) + 0.3; // distribute around pole
        const hookArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.04), hookMat);
        hookArm.position.set(Math.cos(angle) * 0.15, hookHeight, Math.sin(angle) * 0.15);
        hookArm.rotation.y = angle;
        hookArm.castShadow = true;
        coatRack.add(hookArm);
    }

    // Position coat rack along west wall, between door and bench (clear of door swing)
    const rackX = lrDoor.position.x + 0.6; // close to wall
    const rackZ = lrDoor.position.z + 2.5; // south of door but north of bench
    coatRack.position.set(rackX, 0, rackZ);
    scene.add(coatRack);
    cameraBlockers.push(coatRack);
    collidables.push(coatRack);

    // --- Ground props near entry furniture (shoes, bag, bottle, umbrella) ---
    const entryProps = new THREE.Group();
    entryProps.name = 'entryProps';

    // Pair of shoes near the bench
    function createShoe(color = 0x2c2c2c) {
        const shoe = new THREE.Group();
        // Sole
        const sole = new THREE.Mesh(
            new THREE.BoxGeometry(0.25, 0.04, 0.35),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 })
        );
        sole.position.y = 0.02;
        shoe.add(sole);
        // Upper
        const upper = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.12, 0.25),
            new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
        );
        upper.position.set(0, 0.08, -0.03);
        shoe.add(upper);
        sole.castShadow = true;
        upper.castShadow = true;
        return shoe;
    }

    const leftShoe = createShoe(0x3b3b3b);
    leftShoe.position.set(benchX - 0.4, 0, benchZ - 0.5);
    leftShoe.rotation.y = 0.2;
    entryProps.add(leftShoe);

    const rightShoe = createShoe(0x3b3b3b);
    rightShoe.position.set(benchX - 0.65, 0, benchZ - 0.45);
    rightShoe.rotation.y = -0.15;
    entryProps.add(rightShoe);

    // Backpack leaning against bench
    const backpack = new THREE.Group();
    const bagBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.5, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.85 })
    );
    bagBody.position.y = 0.25;
    bagBody.castShadow = true;
    backpack.add(bagBody);

    // Front pocket
    const pocket = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.18, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x2a4d7a, roughness: 0.8 })
    );
    pocket.position.set(0, 0.2, 0.14);
    pocket.castShadow = true;
    backpack.add(pocket);

    // Straps
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
    const strap1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.02), strapMat);
    strap1.position.set(-0.1, 0.3, -0.08);
    backpack.add(strap1);
    const strap2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.02), strapMat);
    strap2.position.set(0.1, 0.3, -0.08);
    backpack.add(strap2);

    backpack.position.set(benchX + 0.5, 0, benchZ + 0.3);
    backpack.rotation.z = 0.15; // slight lean
    entryProps.add(backpack);

    // Water bottle on the ground near coat rack
    const bottle = new THREE.Group();
    const bottleBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.24, 12),
        new THREE.MeshStandardMaterial({ 
            color: 0x4a90e2, 
            roughness: 0.2, 
            metalness: 0.3,
            transparent: true,
            opacity: 0.85
        })
    );
    bottleBody.position.y = 0.12;
    bottleBody.castShadow = true;
    bottle.add(bottleBody);

    const bottleCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12),
        new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.6 })
    );
    bottleCap.position.y = 0.255;
    bottleCap.castShadow = true;
    bottle.add(bottleCap);

    bottle.position.set(rackX + 0.4, 0, rackZ + 0.6);
    entryProps.add(bottle);

    // Umbrella leaning against coat rack base
    const umbrella = new THREE.Group();
    const umbrellaHandle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 })
    );
    umbrellaHandle.position.y = 0.4;
    umbrellaHandle.castShadow = true;
    umbrella.add(umbrellaHandle);

    const umbrellaTop = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.15, 8),
        new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.75 })
    );
    umbrellaTop.position.y = 0.875;
    umbrellaTop.castShadow = true;
    umbrella.add(umbrellaTop);

    umbrella.position.set(rackX - 0.25, 0, rackZ + 0.3);
    umbrella.rotation.z = 0.3; // leaning
    entryProps.add(umbrella);

    scene.add(entryProps);
    // Note: These are small decorative props, intentionally NOT added to collidables/cameraBlockers to avoid jitter
}

// --- Fireplace with mantle (on north wall, centered) ---
{
    const fireplace = new THREE.Group();
    fireplace.name = 'fireplace';
    
    // Fireplace base/hearth (stone-like)
    const hearthMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9, metalness: 0.1 });
    const hearth = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.3, 1.2), hearthMat);
    hearth.position.y = 0.15;
    hearth.castShadow = true;
    hearth.receiveShadow = true;
    fireplace.add(hearth);
    
    // Fireplace opening (dark interior)
    const openingMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0x000000 });
    const opening = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.0, 0.8), openingMat);
    opening.position.set(0, 1.3, -0.2);
    fireplace.add(opening);
    
    // Fire effect - glowing embers and flames
    const fireGroup = new THREE.Group();
    fireGroup.name = 'fireEffect';
    
    // Burning logs in the fireplace (glowing)
    const burningLogMat = new THREE.MeshStandardMaterial({ 
        color: 0x1a0a00, 
        emissive: 0xff4400, 
        emissiveIntensity: 0.8,
        roughness: 0.9 
    });
    const burningLog1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8),
        burningLogMat
    );
    burningLog1.rotation.z = Math.PI / 2;
    burningLog1.position.set(0, 0.7, -0.3);
    fireGroup.add(burningLog1);
    
    const burningLog2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8),
        burningLogMat
    );
    burningLog2.rotation.z = Math.PI / 2;
    burningLog2.rotation.y = 0.5;
    burningLog2.position.set(0, 0.85, -0.35);
    fireGroup.add(burningLog2);
    
    // Main fire light (orange glow)
    const fireLight = new THREE.PointLight(0xff6600, 2.5, 12);
    fireLight.position.set(0, 1.0, -0.2);
    fireLight.castShadow = true;
    fireLight.shadow.mapSize.width = 512;
    fireLight.shadow.mapSize.height = 512;
    fireGroup.add(fireLight);
    
    // Secondary fire light (yellow/white hot spot)
    const fireLight2 = new THREE.PointLight(0xffaa00, 1.5, 8);
    fireLight2.position.set(0, 0.8, -0.25);
    fireGroup.add(fireLight2);
    
    // Flame shapes (using stretched cones with emissive material)
    const flameMat = new THREE.MeshBasicMaterial({ 
        color: 0xff6600, 
        transparent: true, 
        opacity: 0.7,
        side: THREE.DoubleSide
    });
    
    // Create multiple flame sprites
    for (let i = 0; i < 5; i++) {
        const flame = new THREE.Mesh(
            new THREE.ConeGeometry(0.15 + Math.random() * 0.1, 0.5 + Math.random() * 0.3, 4),
            flameMat.clone()
        );
        flame.position.set(
            (Math.random() - 0.5) * 0.8,
            0.9 + Math.random() * 0.3,
            -0.3 + Math.random() * 0.1
        );
        flame.userData.flameOffset = Math.random() * Math.PI * 2;
        flame.userData.flameSpeed = 0.01 + Math.random() * 0.01;
        fireGroup.add(flame);
    }
    
    fireplace.add(fireGroup);
    fireplace.userData.fireGroup = fireGroup;
    
    // Fireplace surround (brick/stone)
    const surroundMat = new THREE.MeshStandardMaterial({ color: 0x5a4a42, roughness: 0.85 });
    const leftSide = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.6, 1.0), surroundMat);
    leftSide.position.set(-1.8, 1.3, 0);
    leftSide.castShadow = true;
    leftSide.receiveShadow = true;
    fireplace.add(leftSide);
    
    const rightSide = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.6, 1.0), surroundMat);
    rightSide.position.set(1.8, 1.3, 0);
    rightSide.castShadow = true;
    rightSide.receiveShadow = true;
    fireplace.add(rightSide);
    
    // Mantle (wooden shelf)
    const mantleMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.7, metalness: 0.1 });
    const mantle = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.25, 0.6), mantleMat);
    mantle.position.set(0, 2.6, 0.2);
    mantle.castShadow = true;
    mantle.receiveShadow = true;
    fireplace.add(mantle);
    
    // Decorative items on mantle
    // Small candle holder (left)
    const candleHolder1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.15, 12),
        new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.6, metalness: 0.3 })
    );
    candleHolder1.position.set(-1.5, 2.8, 0.2);
    candleHolder1.castShadow = true;
    fireplace.add(candleHolder1);
    
    // Small candle holder (right)
    const candleHolder2 = candleHolder1.clone();
    candleHolder2.position.set(1.5, 2.8, 0.2);
    candleHolder2.castShadow = true;
    fireplace.add(candleHolder2);
    
    // Decorative vase (center of mantle)
    const mantleVase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.12, 0.35, 16),
        new THREE.MeshStandardMaterial({ color: 0x2a4a3a, roughness: 0.5, metalness: 0.2 })
    );
    mantleVase.position.set(0, 2.9, 0.2);
    mantleVase.castShadow = true;
    fireplace.add(mantleVase);
    
    // Firewood logs beside the fireplace
    const logMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9, metalness: 0.0 });
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0f, roughness: 0.95, metalness: 0.0 });
    
    // Create a log function
    function createLog(length, radius) {
        const log = new THREE.Group();
        // Main log body
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(radius, radius * 0.95, length, 8),
            logMat
        );
        body.rotation.z = Math.PI / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        log.add(body);
        
        // End rings (bark texture)
        const endLeft = new THREE.Mesh(
            new THREE.CircleGeometry(radius, 8),
            barkMat
        );
        endLeft.position.x = -length / 2;
        endLeft.rotation.y = -Math.PI / 2;
        log.add(endLeft);
        
        const endRight = new THREE.Mesh(
            new THREE.CircleGeometry(radius, 8),
            barkMat
        );
        endRight.position.x = length / 2;
        endRight.rotation.y = Math.PI / 2;
        log.add(endRight);
        
        return log;
    }
    
    // Stack of logs on the left side of fireplace
    const logStack = new THREE.Group();
    
    // Bottom row (3 logs)
    const log1 = createLog(0.6, 0.08);
    log1.position.set(-2.6, 0.08, 0.3);
    logStack.add(log1);
    
    const log2 = createLog(0.65, 0.07);
    log2.position.set(-2.6, 0.08, 0.1);
    log2.rotation.y = 0.1;
    logStack.add(log2);
    
    const log3 = createLog(0.58, 0.09);
    log3.position.set(-2.6, 0.08, -0.1);
    log3.rotation.y = -0.15;
    logStack.add(log3);
    
    // Middle row (2 logs)
    const log4 = createLog(0.62, 0.08);
    log4.position.set(-2.6, 0.24, 0.15);
    log4.rotation.y = 0.2;
    logStack.add(log4);
    
    const log5 = createLog(0.6, 0.075);
    log5.position.set(-2.6, 0.24, -0.05);
    log5.rotation.y = -0.1;
    logStack.add(log5);
    
    // Top log
    const log6 = createLog(0.55, 0.07);
    log6.position.set(-2.6, 0.38, 0.05);
    log6.rotation.y = 0.05;
    logStack.add(log6);
    
    fireplace.add(logStack);
    
    // Scattered logs on the right side
    const log7 = createLog(0.7, 0.09);
    log7.position.set(2.5, 0.09, 0.2);
    log7.rotation.y = 0.3;
    log7.rotation.z = 0.1;
    fireplace.add(log7);
    
    const log8 = createLog(0.65, 0.08);
    log8.position.set(2.6, 0.08, -0.1);
    log8.rotation.y = -0.4;
    fireplace.add(log8);
    
    // Random scattered logs on the floor around fireplace
    const log9 = createLog(0.55, 0.07);
    log9.position.set(-1.2, 0.07, 0.8);
    log9.rotation.y = 1.2;
    log9.rotation.z = 0.15;
    fireplace.add(log9);
    
    const log10 = createLog(0.48, 0.065);
    log10.position.set(0.3, 0.065, 1.0);
    log10.rotation.y = -0.8;
    log10.rotation.z = -0.1;
    fireplace.add(log10);
    
    const log11 = createLog(0.6, 0.08);
    log11.position.set(1.5, 0.08, 0.7);
    log11.rotation.y = 2.1;
    log11.rotation.z = 0.2;
    fireplace.add(log11);
    
    const log12 = createLog(0.52, 0.075);
    log12.position.set(-0.8, 0.075, 0.9);
    log12.rotation.y = 0.5;
    fireplace.add(log12);
    
    const log13 = createLog(0.45, 0.06);
    log13.position.set(0.9, 0.06, 1.1);
    log13.rotation.y = -1.5;
    log13.rotation.z = -0.25;
    fireplace.add(log13);
    
    // Position fireplace on north wall, centered
    fireplace.position.set(0, 0, -roomD/2 + 0.6);
    scene.add(fireplace);
    cameraBlockers.push(fireplace);
    collidables.push(fireplace);
}

// --- Wall Clock (on east wall, visible from sofa area) ---
{
    const wallClock = new THREE.Group();
    wallClock.name = 'wallClock';
    
    // Clock frame (wooden circular frame)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.6, metalness: 0.1 });
    const frame = new THREE.Mesh(
        new THREE.TorusGeometry(0.6, 0.08, 16, 32),
        frameMat
    );
    frame.rotation.z = Math.PI / 2; // Rotate to face forward
    frame.castShadow = true;
    wallClock.add(frame);
    
    // Clock face (cream/beige)
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.7 });
    const face = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.52, 0.08, 32),
        faceMat
    );
    face.rotation.x = Math.PI / 2; // Rotate to face forward (along Z axis)
    face.receiveShadow = true;
    wallClock.add(face);
    
    // Clock numbers (simplified - just marks at 12, 3, 6, 9)
    const markMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
    const positions = [
        { x: 0, y: 0.42, z: -0.06 },      // 12
        { x: 0.42, y: 0, z: -0.06 },      // 3
        { x: 0, y: -0.42, z: -0.06 },     // 6
        { x: -0.42, y: 0, z: -0.06 }      // 9
    ];
    positions.forEach(pos => {
        const mark = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.08, 0.02),
            markMat
        );
        mark.position.set(pos.x, pos.y, pos.z);
        wallClock.add(mark);
    });
    
    // Hour hand (shorter, thicker)
    const hourHand = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.3, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.3, roughness: 0.6 })
    );
    hourHand.position.set(0, 0.15, -0.06);
    hourHand.rotation.z = Math.PI / 6; // 30 degrees (pointing at 1 o'clock)
    hourHand.castShadow = true;
    wallClock.add(hourHand);
    
    // Minute hand (longer, thinner)
    const minuteHand = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.42, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.3, roughness: 0.6 })
    );
    minuteHand.position.set(0, 0.21, -0.07);
    minuteHand.rotation.z = Math.PI / 3; // 60 degrees (pointing at 2 o'clock)
    minuteHand.castShadow = true;
    wallClock.add(minuteHand);
    
    // Center pin/bolt for clock hands
    const centerPin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.04, 16),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.4 })
    );
    centerPin.rotation.x = Math.PI / 2;
    centerPin.position.set(0, 0, -0.08);
    centerPin.castShadow = true;
    wallClock.add(centerPin);
    
    // Position clock directly above fireplace on north wall
    wallClock.position.set(0, 6.5, -roomD/2 + 1.0);
    wallClock.rotation.y = 0; // facing south into the room
    wallClock.scale.set(2, 2, 2); // Make clock twice as big
    scene.add(wallClock);
}

// --- Corner fillers: tall plant (SE), floor lamp (NE), small table with vase (SW) ---
{
    const margin = 0.25;
    const inward = 1.0;

    const posNE = new THREE.Vector3(
        roomW / 2 - margin - inward,
        0,
        -roomD / 2 + margin + inward
    );
    const posSE = new THREE.Vector3(
        roomW / 2 - margin - inward,
        0,
        roomD / 2 - margin - inward
    );
    const posSW = new THREE.Vector3(
        -roomW / 2 + margin + inward,
        0,
        roomD / 2 - margin - inward
    );

    // Floor lamp (NE corner)
    const cornerLampNE = new THREE.Group();
    const baseNE = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 0.06, 16),
        new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    baseNE.position.y = 0.03; baseNE.castShadow = true; cornerLampNE.add(baseNE);
    const poleNE = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2.4, 12),
        new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    poleNE.position.y = 1.2; poleNE.castShadow = true; cornerLampNE.add(poleNE);
    const shadeNE = new THREE.Mesh(
        new THREE.ConeGeometry(0.6, 0.9, 18),
        new THREE.MeshStandardMaterial({ color: 0xfff2d8, roughness: 0.7 })
    );
    shadeNE.position.y = 2.4; cornerLampNE.add(shadeNE);
    const lampLightNE = new THREE.PointLight(0xfff3cc, 0.6, 6);
    lampLightNE.position.set(0, 2.35, 0);
    lampLightNE.castShadow = false; // keep this inexpensive
    cornerLampNE.add(lampLightNE);
    cornerLampNE.position.copy(posSE);
    cornerLampNE.name = 'cornerLampNE';
    cornerLampNE.userData.interactable = true;
    scene.add(cornerLampNE);
    cameraBlockers.push(cornerLampNE);
    collidables.push(cornerLampNE);

    // Tall plant (SE corner)
    const tallPlantSE = new THREE.Group();
    const potSE = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.75, 0.7, 16),
        new THREE.MeshLambertMaterial({ color: 0x6d4c41 })
    );
    potSE.position.y = 0.35; potSE.castShadow = true; potSE.receiveShadow = true; tallPlantSE.add(potSE);
    const soilSE = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16),
        new THREE.MeshLambertMaterial({ color: 0x3e2723 })
    );
    soilSE.position.y = 0.7; soilSE.receiveShadow = true; tallPlantSE.add(soilSE);
    const trunkSE = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 2.2, 10),
        new THREE.MeshLambertMaterial({ color: 0x5d4037 })
    );
    trunkSE.position.y = 1.7; trunkSE.castShadow = true; tallPlantSE.add(trunkSE);
    for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(
            new THREE.ConeGeometry(0.45, 1.0, 14),
            new THREE.MeshLambertMaterial({ color: 0x2e7d32 })
        );
        const angle = (i / 6) * Math.PI * 2;
        leaf.position.set(Math.cos(angle) * 0.35, 2.5 + Math.random() * 0.15, Math.sin(angle) * 0.35);
        leaf.rotation.x = -Math.PI / 4;
        leaf.castShadow = true;
        tallPlantSE.add(leaf);
    }
    tallPlantSE.position.copy(posNE);
    tallPlantSE.name = 'tallPlantSE';
    scene.add(tallPlantSE);
    cameraBlockers.push(tallPlantSE);
    collidables.push(tallPlantSE);

    // Reposition the main lamp to this corner near the side table (avoid overlap)
    const lampOffset = new THREE.Vector3(0.95, 0, -0.6);
    lamp.position.copy(posSW.clone().add(lampOffset));
}

// --- Ghost Fragments (collectibles that reveal the story) ---
const fragments = [];
let fragmentsCollected = 0;
const totalFragments = 3;

function createFragment(name, position, modelType) {
    const fragment = new THREE.Group();
    fragment.name = name;
    fragment.userData.isFragment = true;
    fragment.userData.collected = false;
    fragment.userData.fragmentType = modelType;

    // Create visual representation based on type
    let visual;
    if (modelType === 'journal') {
        // Old journal page - worn paper
        visual = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.01, 0.2),
            new THREE.MeshStandardMaterial({ 
                color: 0xf4e8d0, 
                roughness: 0.9,
                emissive: 0x4a6fa5,
                emissiveIntensity: 0.15
            })
        );
        visual.rotation.x = -Math.PI / 2 + 0.1; // slightly tilted on surface
    } else if (modelType === 'photograph') {
        // Old photograph with frame
        const photoGroup = new THREE.Group();
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.16, 0.01),
            new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 })
        );
        photoGroup.add(frame);
        const photo = new THREE.Mesh(
            new THREE.PlaneGeometry(0.1, 0.14),
            new THREE.MeshStandardMaterial({ 
                color: 0x8b7355,
                roughness: 0.85,
                emissive: 0x6a89cc,
                emissiveIntensity: 0.12
            })
        );
        photo.position.z = 0.006;
        photoGroup.add(photo);
        visual = photoGroup;
    } else if (modelType === 'musicbox') {
        // Small ornate music box
        visual = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.08, 0.1),
            new THREE.MeshStandardMaterial({ 
                color: 0x8b4513,
                roughness: 0.6,
                metalness: 0.3,
                emissive: 0x9370db,
                emissiveIntensity: 0.2
            })
        );
    }

    visual.castShadow = true;
    fragment.add(visual);

    // Gentle pulsing glow (reduced intensity by 60%)
    const glow = new THREE.PointLight(0x9370db, 0.48, 4);
    glow.position.y = 0.15;
    fragment.add(glow);
    fragment.userData.glow = glow;

    fragment.position.copy(position);
    scene.add(fragment);
    fragments.push(fragment);

    return fragment;
}

// Fragment 1: Journal page hidden in the tall plant pot (other side of door)
const tallPlant = scene.getObjectByName('tallPlantSE');
createFragment(
    'fragment_journal',
    new THREE.Vector3(tallPlant.position.x, 0.65, tallPlant.position.z),
    'journal'
);

// Fragment 2: Photograph behind the under-art console
createFragment(
    'fragment_photo',
    new THREE.Vector3(roomW / 2 - 0.7, 0.3, sofa.position.z + 1.5),
    'photograph'
);

// Fragment 3: Music box under/beside the shoe bench
const shoeBenchObj = scene.getObjectByName('shoeBench');
createFragment(
    'fragment_musicbox',
    new THREE.Vector3(shoeBenchObj.position.x - 0.1, 0.15, shoeBenchObj.position.z),
    'musicbox'
);

// Hints about fragment locations (given by room objects)
const fragmentHints = {
    sofa: "Something feels hidden in the shadows... Check the corner where green leaves grow.",
    lamp: "The light flickers toward the elegant furniture beneath the artwork...",
    fireplace: "The flames dance and whisper... something waits near the entrance... where journeys begin and end.",
    painting: "The painting seems to whisper about the dining table... where stories are shared."
};

// Check proximity to fragments
let nearFragment = null;
function checkFragmentProximity() {
    nearFragment = null;
    for (let frag of fragments) {
        if (frag.userData.collected) continue;
        const dist = player.position.distanceTo(frag.position);
        if (dist < 2.0) {
            nearFragment = frag;
            break;
        }
    }
}

// Collect fragment function
function collectFragment(frag) {
    if (!frag || frag.userData.collected) return;
    
    frag.userData.collected = true;
    fragmentsCollected++;

    // Update objectives counter
    const fragmentCounter = document.getElementById('fragmentCounter');
    if (fragmentCounter) {
        fragmentCounter.textContent = `Fragments Collected: ${fragmentsCollected}/3`;
    }

    // Visual feedback - fade out
    frag.traverse(child => {
        if (child.isMesh && child.material) {
            const mat = child.material;
            if (mat.transparent !== undefined) {
                mat.transparent = true;
            }
        }
    });

    // Animate collection
    const startY = frag.position.y;
    const duration = 1500;
    const startTime = performance.now();

    function animateCollection() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        frag.position.y = startY + progress * 0.8;
        frag.rotation.y += 0.05;
        
        frag.traverse(child => {
            if (child.isMesh && child.material) {
                child.material.opacity = 1 - progress;
            }
        });

        if (progress < 1) {
            requestAnimationFrame(animateCollection);
        } else {
            scene.remove(frag);
        }
    }
    animateCollection();

    // Simple collection message (no story text)
    const textPanel = document.getElementById('textPanel');
    textPanel.innerHTML = `<div style='color: #ffd700; font-size: 24px; font-weight: bold;'>✨ Fragment Collected!</div><div style='margin-top: 10px;'>${fragmentsCollected}/3</div>`;
    textPanel.style.display = 'block';
    setTimeout(() => {
        textPanel.style.display = 'none';
        
        // Check if all fragments collected
        if (fragmentsCollected >= totalFragments) {
            // Unlock the door
            const exitDoor = scene.getObjectByName('exitDoor');
            if (exitDoor) {
                exitDoor.userData.unlocked = true;
                
                // Add a glowing effect to the door to indicate it's unlocked
                const doorGlow = new THREE.PointLight(0x88ff88, 1.5, 8);
                doorGlow.position.set(0, 1, 0.5);
                doorGlow.name = 'doorGlow';
                exitDoor.add(doorGlow);
                
                // Update objectives panel to show door is unlocked
                const objectivesPanel = document.getElementById('objectivesPanel');
                if (objectivesPanel) {
                    objectivesPanel.innerHTML = `
                        <div style="font-size: 20px; font-weight: bold; margin-bottom: 10px; color: #88ff88;">✓ OBJECTIVE COMPLETE</div>
                        <div style="margin-bottom: 8px; color: #88ff88;">All fragments collected!</div>
                        <div style="margin-top: 10px; font-size: 18px; color: #ffd700; font-weight: bold;">🚪 The door is unlocked!</div>
                        <div style="margin-top: 12px; font-size: 14px; color: #ffdd88; font-style: italic;">Head to the door to enter the secret room</div>
                    `;
                }
            }
            // If all fragments were just collected, automatically take player to the secret room
            if (fragmentsCollected >= totalFragments) {
                // pause briefly so the player sees the completion message, then show a modal
                // informing them to head to the door. We do NOT auto-redirect anymore.
                setTimeout(() => {
                    try {
                        let fragModal = document.getElementById('fragmentsModal');
                        if (!fragModal) {
                            fragModal = document.createElement('div');
                            fragModal.id = 'fragmentsModal';
                            fragModal.innerHTML = `
                                <div class="fragments-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;">
                                    <div class="fragments-panel" style="background:#0f0f10;color:#fff;padding:18px;border-radius:10px;max-width:520px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,0.6);font-family:Arial,Helvetica,sans-serif;text-align:center;">
                                        <div style="font-size:20px;font-weight:700;margin-bottom:8px;color:#88ff88;">✓ ALL FRAGMENTS COLLECTED!</div>
                                        <div style="margin-bottom:12px;color:#dcdcdc;">You have collected all fragments.</div>
                                        <div style="margin-bottom:12px;color:#ffd27a; font-weight:700;">Head to the door to exit.</div>
                                        <div style="display:flex;gap:12px;justify-content:center;margin-top:6px;">
                                            <button id="fragmentsModalOk" style="padding:10px 14px;background:#27ae60;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;">Got it</button>
                                        </div>
                                    </div>
                                </div>
                            `;
                            document.body.appendChild(fragModal);

                            const okBtn = document.getElementById('fragmentsModalOk');
                            function hideFragModal() {
                                const m = document.getElementById('fragmentsModal');
                                if (m) m.style.display = 'none';
                                isPaused = false;
                                document.removeEventListener('keydown', fragModalKey);
                            }
                            function fragModalKey(e) {
                                if (e.key === 'Escape' || e.key === 'Enter') { hideFragModal(); }
                            }
                            document.addEventListener('keydown', fragModalKey);
                            okBtn.addEventListener('click', hideFragModal);
                        } else {
                            fragModal.style.display = 'block';
                        }
                        // Pause game input while modal visible
                        isPaused = true;
                    } catch (e) {
                        console.warn('Show fragments modal failed', e);
                    }
                }, 3500);
            }
            
            // Note: UI modal will notify the player to head to the door. Avoid duplicate textPanel message here.
        }
    }, 3000);

    // Play collection sound (using shared web audio context)
    const audioCtx = getAudioContext();
    if (audioCtx) {
        try {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = 880;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.8);
        } catch (e) {
            console.warn('Failed to play collection sound', e);
        }
    }
}

// Check horizontal collisions: returns true if position is free to move to
function checkHorizontalCollisions(newPos) {
    // y is ignored for horizontal collision
    for (let item of collidables) {
        const box = new THREE.Box3().setFromObject(item);

        // expand the box by player radius on XZ
        const expandedBox = new THREE.Box3(
            new THREE.Vector3(box.min.x - playerRadius, box.min.y, box.min.z - playerRadius),
            new THREE.Vector3(box.max.x + playerRadius, box.max.y, box.max.z + playerRadius)
        );

        if (newPos.x >= expandedBox.min.x && newPos.x <= expandedBox.max.x &&
                newPos.z >= expandedBox.min.z && newPos.z <= expandedBox.max.z) {
                // Allow stepping onto tops if within stepHeight (so player can walk up onto furniture)
                if (newPos.y + stepHeight >= expandedBox.max.y) {
                    // treat as non-blocking horizontally (we will snap vertically after movement)
                    continue;
                }
                return false; // collision
            }
    }

    return true;
}

// Helper to show/hide the loaded model meshes (so we can hide the body in first person)
function setModelVisibility(visible) {
    player.traverse(c => {
        if (c.isMesh) c.visible = visible;
    });
}

// Player (stickmanGroup placeholder) - Start on the opposite side of the room
// Place player on the east side (mirror of the door entrance on the west)
const player = new THREE.Group(); 
player.position.set(roomW/2 - 4, 0, -6); // Opposite side from the door (east wall)
player.add(flashlight); // Add flashlight to player
scene.add(player);

// Camera start - looking into the room from the spawn position
camera.position.set(roomW/2 - 4, 4, -6); 
camera.lookAt(0, 1, 0); // Look toward center of room

// Pointer lock and mouse look
let mouseX = 0, mouseY = 0; const mouseSensitivity = 0.002;
renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
    // when pointer lock is lost we could pause input or show a menu; kept minimal here
});
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === renderer.domElement) {
        mouseX -= e.movementX * mouseSensitivity;
        mouseY -= e.movementY * mouseSensitivity;
        mouseY = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, mouseY));
    }
});

// Movement + physics variables
const keys = { w: false, a: false, s: false, d: false, space: false };
const moveSpeed = 0.12;
const jumpPower = 0.33;
const gravity = 0.016;
let velocityY = 0;
let isGrounded = true;
let thirdPerson = true;

// Animation actions (populated when model loads)
let mixer;
let idleAction = null;
let walkAction = null;
let characterRoot = null;

document.addEventListener('keydown', (e) => {
    // ESC key to pause/unpause
    if (e.key === 'Escape') {
        if (!isGameOver) {
            if (isPaused) {
                resumeGame();
            } else {
                pauseGame();
            }
        }
        return;
    }

    switch (e.code) {
        case 'KeyW': keys.w = true; break;
        case 'KeyA': keys.a = true; break;
        case 'KeyS': keys.s = true; break;
        case 'KeyD': keys.d = true; break;
        case 'Space': keys.space = true; e.preventDefault(); break;
    }

    // Toggle camera mode
    if (e.key.toLowerCase() === 'c') thirdPerson = !thirdPerson;

    // Interact
    if (e.key.toLowerCase() === 'e') onInteract();

    // TV toggle: T cycles OFF -> ON -> GLITCH
    if (e.key.toLowerCase() === 't') {
        tvState = (tvState + 1) % 3;
        // adjust glow
        if (tvState === 0) tvGlow.intensity = 0.0; // OFF
        else if (tvState === 1) tvGlow.intensity = 0.9; // ON
        else tvGlow.intensity = 1.1; // GLITCH
    }

    // Flashlight toggle (from kitchen)
    if (e.key.toLowerCase() === 'f') {
        toggleFlashlight();
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

// Interaction helpers
const interactionPopup = document.getElementById('interactionPopup');
function showInteraction(show){ interactionPopup.style.display = show ? 'block' : 'none'; }
function worldDistTo(obj){ const p = new THREE.Vector3(); obj.getWorldPosition(p); return player.position.distanceTo(p); }

let nearLamp = false, nearSofa = false, nearTV = false, nearDoor = false, nearFireplace = false;
function onInteract(){
    // Priority: fragments first
    if (nearFragment && !nearFragment.userData.collected) {
        collectFragment(nearFragment);
        return;
    }
    
    // Door interaction (when all fragments collected)
    if (nearDoor) {
        const exitDoor = scene.getObjectByName('exitDoor');
        if (exitDoor && exitDoor.userData.unlocked) {
            // Level complete - navigate to platforms (platforms.html loads platforms.js)
                sessionStorage.setItem("livingRoomPaused", "true");
                window.location.href = './platforms.html';
            return;
        } else {
            // Door is locked - show an in-game modal with two buttons: Exit (end game) or Continue searching
            let doorModal = document.getElementById('doorModal');
            if (!doorModal) {
                doorModal = document.createElement('div');
                doorModal.id = 'doorModal';
                // Backdrop + centered panel
                doorModal.innerHTML = `
                    <div class="door-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;">
                        <div class="door-panel" style="background:#0f0f10;color:#fff;padding:18px;border-radius:10px;max-width:520px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,0.6);font-family:Arial,Helvetica,sans-serif;text-align:center;">
                            <div style="font-size:20px;font-weight:700;margin-bottom:8px;color:#ffd27a;">🔒 The door is locked</div>
                            <div style="margin-bottom:12px;color:#dcdcdc;">This door is locked. Collect all fragments to unlock it — keep searching the room and interact with objects for hints.</div>
                            <div style="display:flex;gap:12px;justify-content:center;margin-top:6px;">
                                <button id="doorContinueBtn" style="padding:10px 14px;background:#27ae60;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;">Keep Searching</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(doorModal);

                // Wire up the single 'Keep Searching' button; exit option removed so players must collect fragments
                const continueBtn = document.getElementById('doorContinueBtn');

                function hideDoorModal() {
                    const m = document.getElementById('doorModal');
                    if (m) m.style.display = 'none';
                    isPaused = false;
                    // remove temporary key handler
                    document.removeEventListener('keydown', onModalKey);
                }

                function onModalKey(e) {
                    // Allow Esc or Enter to close the modal and continue searching
                    if (e.key === 'Escape' || e.key === 'Enter') { hideDoorModal(); }
                }
                // Attach keyboard handler so Esc/Enter work while modal is open
                document.addEventListener('keydown', onModalKey);

                continueBtn.addEventListener('click', () => {
                    hideDoorModal();
                    // show a friendly hint
                    const t = document.getElementById('textPanel');
                    if (t) {
                        t.innerHTML = '<div style="color: #ffdd88; font-size: 18px; font-weight: bold;">Keep searching...</div><div style="margin-top:8px;color:#ddd;">You can find fragments hidden around the room. Try interacting with objects for hints.</div>';
                        t.style.display = 'block';
                        setTimeout(() => t.style.display = 'none', 4500);
                    }
                });
            }

            // Show modal and pause the game input updates while modal is visible
            doorModal.style.display = 'block';
            isPaused = true;
            return;
        }
    }
    
    if(nearLamp){
        // Give hint about fragment location
        const t = document.getElementById('textPanel');
        t.innerHTML = `<div style='color: #ffd700; font-weight: bold; margin-bottom: 10px;'>💡 The lamp flickers...</div>\n\n<div style='font-style: italic;'>"${fragmentHints.lamp}"</div>`;
        t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 5000);
        
        // Also toggle lamp brightness
        lampLight.intensity = lampLight.intensity > 0.5 ? 0.08 : 1.6;
    } else if(nearSofa){
        // Give hint instead of showing paper
        const t = document.getElementById('textPanel');
        t.innerHTML = `<div style='color: #8b6f47; font-weight: bold; margin-bottom: 10px;'>🛋️ You search the sofa...</div>\n\n<div style='font-style: italic;'>"${fragmentHints.sofa}"</div>`;
        t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 5000);
    } else if(nearFireplace){
        // Give hint from the fireplace
        const t = document.getElementById('textPanel');
        t.innerHTML = `<div style='color: #ff6600; font-weight: bold; margin-bottom: 10px;'>� The fire crackles...</div>\n\n<div style='font-style: italic;'>"${fragmentHints.fireplace}"</div>`;
        t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 5000);
    } else if(nearTV){
        // Just toggle TV
        const snd = ensureTvHum();
        tvHumOn = !tvHumOn;
        snd.setVolume(tvHumOn ? 1.0 : 0.0);
        const t = document.getElementById('textPanel');
        t.innerHTML = tvHumOn ? '<div style="color: #6666ff;">TV turned on.</div>' : '<div style="color: #888;">TV turned off.</div>';
        t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 2000);
    }
}

// --- Character model load (kitchen-style robust logic) ---
const loader = new GLTFLoader();
const MODEL_PATH = './maybeModel_LivingRoom4.glb';
// Animation helpers
let holdFlashAction = null;
let currentAction = null;
const ANIM_FADE = 0.2;
function switchTo(action){ if (!action || action===currentAction) return; if (currentAction) currentAction.fadeOut(ANIM_FADE); action.reset().fadeIn(ANIM_FADE).play(); currentAction = action; }
function updateAnimationState(){
    if (!mixer) return;
    const isWalkingNow = (keys && (keys.w||keys.a||keys.s||keys.d));
    let base = isWalkingNow ? (walkAction||idleAction) : (idleAction||walkAction);
    switchTo(base);
    if (holdFlashAction) {
        holdFlashAction.enabled = true; holdFlashAction.play();
        holdFlashAction.setEffectiveWeight(flashlightOn ? 0.7 : 0.0);
    }
}

loader.load(MODEL_PATH, (gltf) => {
    const root = gltf.scene;
    // Choose only the character subtree (prefer metarig), not the whole GLTF scene
    let model = root.getObjectByName('metarig') || null;
    let firstSkinned = null;
    let firstMesh = null;
    root.traverse(o => { if (!firstSkinned && o.isSkinnedMesh) firstSkinned = o; if (!firstMesh && o.isMesh) firstMesh = o; });
    if (!model && firstSkinned) { model = firstSkinned; while (model.parent && model.parent !== root) model = model.parent; }
    if (!model && firstMesh) { model = firstMesh; while (model.parent && model.parent !== root) model = model.parent; }
    if (!model) model = root;
    // Ensure the body mesh 'main_full' is attached under 'metarig' so it follows the rig
    try {
        // Prefer to attach to the actual metarig if present under root
        let rig = root.getObjectByName('metarig') || model;
        if (!rig) { root.traverse(o => { if (!rig && o.name && o.name.toLowerCase() === 'metarig') rig = o; }); }
        const mainFullNodes = [];
        root.traverse(o => { if (o.name && o.name.toLowerCase() === 'main_full') mainFullNodes.push(o); });
        mainFullNodes.forEach(n => {
            if (n.parent !== rig) {
                rig.attach(n); // preserve world transform
            }
            n.traverse(c => { if (c.isMesh) { c.visible = true; c.castShadow = true; c.receiveShadow = true; } });
        });
    } catch (e) {
        console.warn('Failed to attach main_full to metarig:', e);
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

    // Ensure proper shadows and hide any embedded ground/floor planes (but never hide rigged body parts)
    model.traverse(c => {
        if (c.isMesh) {
            const name = (c.name || '').toLowerCase();
            const underRig = isUnderNamedAncestor(c, 'metarig');
            const isGroundLikeName = name.includes('plane') || name.includes('ground') || name.includes('floor');
            if (isGroundLikeName && !c.isSkinnedMesh && !underRig) {
                c.visible = false; // hide only non-rig ground helpers
            } else {
                c.visible = true;
                c.castShadow = true;
                c.receiveShadow = true;
            }
        }
    });
    
    console.log('GLTF loaded:', gltf); 
    if (gltf.animations) console.log('Animations:', gltf.animations.length, gltf.animations.map(a=>a.name));
    
    // Center and scale character to target height and align feet (use only the chosen model subtree)
    const unionBox = new THREE.Box3();
    let haveBox = false;
    model.updateMatrixWorld(true);
    model.traverse(o => {
        if (o.isMesh) {
            o.updateWorldMatrix(true, false);
            const b = new THREE.Box3().setFromObject(o);
            if (!haveBox) { unionBox.copy(b); haveBox = true; } else { unionBox.union(b); }
        }
    });
    if (haveBox) {
        const preSize = new THREE.Vector3(); unionBox.getSize(preSize);
        const targetHeight = 1.8;
        if (preSize.y > 0) {
            const s = targetHeight / preSize.y;
            model.scale.setScalar(s);
            model.updateMatrixWorld(true);
        }
        const scaledBox = new THREE.Box3(); let haveScaled = false;
        model.traverse(o => {
            if (o.isMesh) {
                o.updateWorldMatrix(true, false);
                const b = new THREE.Box3().setFromObject(o);
                if (!haveScaled) { scaledBox.copy(b); haveScaled = true; } else { scaledBox.union(b); }
            }
        });
        if (haveScaled) {
            const center = new THREE.Vector3(); const size = new THREE.Vector3();
            scaledBox.getCenter(center); scaledBox.getSize(size);
            model.position.sub(center);
            model.position.y += size.y/2;
        }
    }

    // Add only the character subtree to player group and keep a reference for first-person hiding
    player.add(model);
    characterRoot = model;

    // Setup animations using name-based matching
    if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
        const clips = gltf.animations;
        const findClip = (names) => {
            const lc = clips.map(c => ({ c, n: (c.name||'').toLowerCase() }));
            for (const desired of names) {
                const d = desired.toLowerCase();
                let hit = lc.find(x => x.n === d); if (hit) return hit.c;
                hit = lc.find(x => x.n.includes(d)); if (hit) return hit.c;
            }
            return null;
        };
        const idleClip = findClip(['idle_anim','idle']);
        const walkClip = findClip(['DefWalking','walking','walk']);
        const holdClip = findClip(['Hold_Flash.003','Hold_Flash','flash','torch']);
        if (idleClip) { idleAction = mixer.clipAction(idleClip); idleAction.setLoop(THREE.LoopRepeat, Infinity); }
        if (walkClip) { walkAction = mixer.clipAction(walkClip); walkAction.setLoop(THREE.LoopRepeat, Infinity); }
        if (holdClip) { holdFlashAction = mixer.clipAction(holdClip); holdFlashAction.setLoop(THREE.LoopRepeat, Infinity); holdFlashAction.enabled = true; holdFlashAction.play(); holdFlashAction.setEffectiveWeight(0.0); }
        currentAction = null; if (idleAction) switchTo(idleAction); updateAnimationState();
    }

}, undefined, (err) => {
    console.warn('model load failed', err);
});

// Simple movement & collision-less update
function updatePlayer() {
    const forward = new THREE.Vector3(Math.sin(mouseX), 0, Math.cos(mouseX));
    const right = new THREE.Vector3(Math.cos(mouseX), 0, -Math.sin(mouseX));
    const dir = new THREE.Vector3();
    if (keys.w) dir.add(forward);
    if (keys.s) dir.sub(forward);
    if (keys.a) dir.add(right);
    if (keys.d) dir.sub(right);

    const isWalking = dir.length() > 0;

    // horizontal movement
    if (isWalking) {
        dir.normalize();
        const moveVec = dir.clone().multiplyScalar(moveSpeed);
        const newPos = player.position.clone().add(moveVec);
        // Keep Y for ground checks
        newPos.y = player.position.y;
        if (checkHorizontalCollisions(newPos)) {
            player.position.copy(newPos);
        }
    }

    // Jump
    if (keys.space && isGrounded) {
        velocityY = jumpPower;
        isGrounded = false;
    }

    // Apply gravity
    velocityY -= gravity;
    player.position.y += velocityY;
    // Vertical collision / snapping: if player is above a collidable top surface and close enough, snap onto it
    // We'll find the highest collidable top under the player's XZ position
    let highestTop = -Infinity;
    let topObject = null;
    const probeY = player.position.y + 1.0; // start probing above player's head
    const probePos = new THREE.Vector3(player.position.x, probeY, player.position.z);
    for (let item of collidables) {
        const box = new THREE.Box3().setFromObject(item);
        // check if player's XZ is inside the expanded horizontal bounds
        if (player.position.x >= box.min.x - playerRadius && player.position.x <= box.max.x + playerRadius &&
            player.position.z >= box.min.z - playerRadius && player.position.z <= box.max.z + playerRadius) {
            // candidate top surface is box.max.y
            if (box.max.y > highestTop) {
                highestTop = box.max.y;
                topObject = item;
            }
        }
    }

    // If there's a top surface beneath and the player is falling onto it or standing near it, snap to it
    if (highestTop > -Infinity) {
        // if player is within a small vertical window above the top, snap
        const snapThreshold = 1.2; // how far above the top we'll snap down
        if (player.position.y <= highestTop + snapThreshold) {
            // If we're above the top, place player on top and zero vertical velocity
            if (player.position.y >= highestTop - 0.1) {
                player.position.y = highestTop;
                velocityY = 0;
                isGrounded = true;
            }
        }
    }

    // Floor collision (simple fallback)
    if (player.position.y <= 0) {
        player.position.y = 0;
        velocityY = 0;
        isGrounded = true;
    }

    // Animation switching + overlay (flashlight hold) blending
    if (mixer) {
        updateAnimationState();
    }
    // Rotate player to face mouse direction horizontally
    player.rotation.y = mouseX;

    // Camera modes with simple collision handling
    // Build desired camera target positions
    if (thirdPerson) {
        // Fixed camera position behind player - no obstacle avoidance
        const cameraDistance = 2.0; // consistent distance across all levels
        const cameraHeight = 1.8; // lower height
        const desired = new THREE.Vector3(
            player.position.x - Math.sin(mouseX) * cameraDistance,
            player.position.y + cameraHeight,
            player.position.z - Math.cos(mouseX) * cameraDistance
        );

        // Directly set camera position for consistent framing
        camera.position.lerp(desired, 0.15);
        camera.lookAt(player.position.x, player.position.y + 1.4, player.position.z);

        // Ensure model visible in third person
        setModelVisibility(true);
    } else {
        // first-person: position at (slightly forward) head to avoid clipping into model
        const headPos = new THREE.Vector3(player.position.x, player.position.y + 1.6, player.position.z);
        // put camera slightly forward along view direction
        const forward = new THREE.Vector3(Math.sin(mouseX) * Math.cos(mouseY), Math.sin(mouseY), Math.cos(mouseX) * Math.cos(mouseY)).normalize();
        const desiredFP = headPos.clone().add(forward.clone().multiplyScalar(0.35));

        // Raycast forward a small amount to prevent clipping into walls
    raycaster.set(headPos, forward);
    const fInter = raycaster.intersectObjects(cameraBlockers, true);
        let fpTarget = desiredFP;
        for (let i = 0; i < fInter.length; i++) {
            const it = fInter[i];
            // If the intersection is very close to head, move camera slightly back
            if (it.distance < 0.5) {
                fpTarget = headPos.clone().add(forward.clone().multiplyScalar(Math.max(it.distance - 0.08, 0.05)));
                break;
            }
        }

        camera.position.lerp(fpTarget, 0.6);
        camera.lookAt(camera.position.clone().add(forward));

        // hide model in first-person to avoid seeing model through camera
        setModelVisibility(false);
    }
}

// Animation loop
const clock = new THREE.Clock(); 
function animate(){ 
    requestAnimationFrame(animate); 
    const t = performance.now(); 
    if(mixer) mixer.update(clock.getDelta()); 
    
    // Corner lamp pulse
    const cornerLampGroup = scene.getObjectByName('cornerLampNE');
    if (cornerLampGroup) {
        const lampLightNE = cornerLampGroup.children.find(child => child.isLight);
        if (lampLightNE) {
            const pulse = 0.9 + Math.sin(t*0.002)*0.4;
            lampLightNE.intensity = THREE.MathUtils.lerp(lampLightNE.intensity, 0.6 * pulse, 0.02);
        }
    }
    
    // Fragment glow pulse (stronger pulsing)
    fragments.forEach(frag => {
        if (!frag.userData.collected && frag.userData.glow) {
            const glowPulse = 0.8 + Math.sin(t * 0.003) * 0.6;
            frag.userData.glow.intensity = glowPulse;
        }
    });
    
    // Get exitDoor and fireplace references once for use in multiple places
    const exitDoor = scene.getObjectByName('exitDoor');
    const fireplace = scene.getObjectByName('fireplace');
    
    // Door glow pulse (when unlocked)
    if (exitDoor && exitDoor.userData.unlocked) {
        const doorGlow = exitDoor.getObjectByName('doorGlow');
        if (doorGlow) {
            const doorPulse = 1.2 + Math.sin(t * 0.004) * 0.5;
            doorGlow.intensity = doorPulse;
        }
    }
    
    // Fire animation (flickering flames and lights)
    if (fireplace && fireplace.userData.fireGroup) {
        const fireGroup = fireplace.userData.fireGroup;
        
        // Flicker the fire lights
        fireGroup.children.forEach(child => {
            if (child.isLight) {
                const flicker = 0.85 + Math.sin(t * 0.008 + child.position.x) * 0.1 + Math.random() * 0.15;
                child.intensity = child.intensity * 0.9 + (child.userData.baseIntensity || child.intensity) * flicker * 0.1;
                if (!child.userData.baseIntensity) child.userData.baseIntensity = child.intensity;
            }
            
            // Animate flame meshes (scale and opacity flicker)
            if (child.isMesh && child.userData.flameOffset !== undefined) {
                const flameFlicker = Math.sin(t * child.userData.flameSpeed + child.userData.flameOffset);
                child.scale.y = 1.0 + flameFlicker * 0.3;
                child.material.opacity = 0.5 + flameFlicker * 0.2;
                child.position.y += Math.sin(t * 0.005 + child.userData.flameOffset) * 0.002;
            }
        });
    }

    // TV screen update
    if (tvState === 0) { // OFF
        tvCtx.fillStyle = '#000';
        tvCtx.fillRect(0,0,tvCanvas.width,tvCanvas.height);
        tvTexture.needsUpdate = true;
    } else if (tvState === 1) { // ON static
        drawTvFrame(t, false);
        tvTexture.needsUpdate = true;
    } else { // GLITCH
        drawTvFrame(t, true);
        tvTexture.needsUpdate = true;
        // glow flicker
        tvGlow.intensity = 0.9 + Math.sin(t*0.02) * 0.25 + (Math.random()*0.1);
    }
    
    checkFragmentProximity(); // check if near any fragments
    updatePlayer(); // proximity checks

    // Update unified flashlight behavior
    updateFlashlight();
    const cornerLamp = scene.getObjectByName('cornerLampNE');
    nearLamp = cornerLamp ? worldDistTo(cornerLamp) < 2.4 : false; nearSofa = worldDistTo(sofa) < 3.0; nearTV = worldDistTo(tvStand) < 3.0; 
    nearFireplace = fireplace ? worldDistTo(fireplace) < 3.5 : false;
    nearDoor = exitDoor ? worldDistTo(exitDoor) < 3.5 : false;
    const nearAnyFragment = nearFragment && !nearFragment.userData.collected;
    showInteraction(nearLamp || nearSofa || nearTV || nearAnyFragment || nearDoor || nearFireplace);
    
    // Draw minimap
    drawMinimap();
    
    renderer.render(scene, camera); 
}

window.addEventListener('resize', ()=>{ camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

// --- Game Over ---
const gameOverEl = document.getElementById("gameOver");
const restartBtn = document.getElementById("restartBtn");

let isGameOver = false;
let isPaused = false;
let pausedBattery = null;

// Pause and Resume functions
function pauseGame() {
    isPaused = true;
    pausedBattery = battery; // Store current battery level
    document.getElementById("pauseMenu").style.display = "block";
}

function resumeGame() {
    isPaused = false;
    if (pausedBattery !== null) {
        battery = pausedBattery;
        pausedBattery = null;
    }
    document.getElementById("pauseMenu").style.display = "none";
}

// Restart button functionality
restartBtn.addEventListener("click", () => {
    // Clear stored battery
    localStorage.removeItem("livingRoomBattery");
    sessionStorage.removeItem("livingRoomPaused");
    // Reload the page
    window.location.reload();
});

// Pause menu buttons
document.getElementById("resumeBtn").addEventListener("click", () => {
    resumeGame();
});

document.getElementById("quitBtn").addEventListener("click", () => {
    localStorage.removeItem("livingRoomBattery");
    sessionStorage.removeItem("livingRoomPaused");
    window.location.href = "./level-select.html";
});

document.getElementById("restartBtnPause").addEventListener("click", () => {
    localStorage.removeItem("livingRoomBattery");
    sessionStorage.removeItem("livingRoomPaused");
    location.reload();
});

// Add this to the living-room.js file, after the existing code

// --- Minimap Setup (from kitchen) ---
const minimapCanvas = document.createElement('canvas');
minimapCanvas.id = 'minimap';
minimapCanvas.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 200px;
    height: 200px;
    background: rgba(0, 0, 0, 0.7);
    border: 2px solid rgba(255, 255, 255, 0.5);
    border-radius: 10px;
    z-index: 1000;
`;
document.body.appendChild(minimapCanvas);

const minimapCtx = minimapCanvas.getContext('2d');
minimapCanvas.width = 200;
minimapCanvas.height = 200;

function drawMinimap() {
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
        centerX - (roomW / 2) / scale,
        centerY - (roomD / 2) / scale,
        roomW / scale,
        roomD / scale
    );
    
    // Draw furniture as small rectangles
    ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
    
    // Convert furniture array to include all major objects
    const minimapFurniture = [
        sofa, tvStand, tableTop, 
        scene.getObjectByName('artTvStyleStand'),
        scene.getObjectByName('shoeBench'),
        scene.getObjectByName('coatRack'),
        scene.getObjectByName('fireplace'),
        scene.getObjectByName('cornerPlant'),
        scene.getObjectByName('tallPlantSE'),
        lamp,
        scene.getObjectByName('cornerLampNE')
    ].filter(obj => obj !== null && obj !== undefined);
    
    minimapFurniture.forEach(item => {
        const box = new THREE.Box3().setFromObject(item);
        const itemWidth = (box.max.x - box.min.x) / scale;
        const itemDepth = (box.max.z - box.min.z) / scale;
        const itemX = centerX + (item.position.x - player.position.x) / scale - itemWidth / 2;
        const itemZ = centerY + (item.position.z - player.position.z) / scale - itemDepth / 2;
        
        ctx.fillRect(itemX, itemZ, itemWidth, itemDepth);
    });
    
    // Draw door
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    const exitDoor = scene.getObjectByName('exitDoor');
    if (exitDoor) {
        const doorX = centerX + (exitDoor.position.x - player.position.x) / scale;
        const doorZ = centerY + (exitDoor.position.z - player.position.z) / scale;
        ctx.fillRect(doorX - 2, doorZ - 2, 4, 8);
    }
    
    // Draw fragments
    ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
    fragments.forEach(frag => {
        if (!frag.userData.collected) {
            const fragX = centerX + (frag.position.x - player.position.x) / scale;
            const fragZ = centerY + (frag.position.z - player.position.z) / scale;
            ctx.beginPath();
            ctx.arc(fragX, fragZ, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    
    // Draw player as triangle (pointing in camera direction)
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
    
    // Draw cardinal directions
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', centerX, 15);
    ctx.fillText('S', centerX, minimapCanvas.height - 5);
    ctx.fillText('W', 10, centerY + 4);
    ctx.fillText('E', minimapCanvas.width - 10, centerY + 4);
}

// Update the animate function to include the minimap drawing
// Replace the existing animate function with this updated version:

// Initialize and start the game
initializeBattery();
animate();