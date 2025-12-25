import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Load a rigged character and prepare it for gameplay.
 * - Attaches `main_full` (body) under `metarig` so it follows the rig
 * - Hides ground/plane meshes from the GLB
 * - Scales to target height and aligns feet to y=0
 * - Sets up animations: idle, walk, optional holdFlash overlay
 *
 * @param {Object} opts
 * @param {string} opts.url - GLB/GLTF URL
 * @param {THREE.Group|THREE.Object3D} opts.parent - Parent group to attach to (e.g., player)
 * @param {number} [opts.targetHeight=1.8] - Desired character height
 * @param {boolean} [opts.attachMainFull=true] - Attach `main_full` under `metarig` if found
 * @param {boolean} [opts.removeGround=true] - Hide ground/floor meshes
 * @param {boolean} [opts.debug=false] - Log contents
 * @returns {Promise<{ modelRoot:THREE.Object3D, rig:THREE.Object3D|null, mixer:THREE.AnimationMixer|null, actions:{ idle?:THREE.AnimationAction, walk?:THREE.AnimationAction, holdFlash?:THREE.AnimationAction } }>} 
 */
export async function loadCharacter({ url, parent, targetHeight = 1.8, attachMainFull = true, removeGround = true, debug = false }) {
  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
  const root = gltf.scene;

  // Prefer the explicit 'metarig' if present
  let rig = root.getObjectByName('metarig') || null;
  let model = rig || root;

  // Fallback heuristics if metarig missing: choose top ancestor of first skinned mesh or first mesh
  if (!rig) {
    let firstSkinned = null, firstMesh = null;
    root.traverse(o => {
      if (!firstSkinned && o.isSkinnedMesh) firstSkinned = o;
      if (!firstMesh && o.isMesh) firstMesh = o;
    });
    if (!model && firstSkinned) {
      model = firstSkinned; while (model.parent && model.parent !== root) model = model.parent;
    }
    if (!model && firstMesh) {
      model = firstMesh; while (model.parent && model.parent !== root) model = model.parent;
    }
  }

  if (debug) {
    try {
      console.group(`GLTF Loaded: ${url}`);
      console.log('Root name:', root.name || '(root)');
      console.group(`Animations (${gltf.animations?.length || 0})`);
      (gltf.animations||[]).forEach((clip, i) => console.log(`#${i}`, clip.name, 'duration', clip.duration));
      console.groupEnd();
      let totals = { nodes: 0, meshes: 0, skinned: 0, bones: 0 };
      root.traverse(o => { totals.nodes++; if (o.isMesh) totals.meshes++; if (o.isSkinnedMesh) totals.skinned++; if (o.isBone) totals.bones++; });
      console.log('Totals:', totals);
      console.groupEnd();
    } catch {}
  }

  // Clean up unwanted ground/plane meshes and enable shadows
  root.traverse(child => {
    if (child.isMesh) {
      const nm = (child.name||'').toLowerCase();
      if (removeGround && (nm.includes('plane') || nm.includes('ground') || nm.includes('floor'))) {
        child.visible = false;
      } else {
        child.castShadow = true; child.receiveShadow = true;
      }
    }
  });

  // If requested, ensure main_full is a child of the rig so it follows animations
  if (attachMainFull) {
    try {
      let metarig = root.getObjectByName('metarig') || rig || null;
      if (!metarig) {
        root.traverse(o => { if (!metarig && o.name && o.name.toLowerCase() === 'metarig') metarig = o; });
      }
      if (metarig) {
        const mainFullNodes = [];
        root.traverse(o => { if (o.name && o.name.toLowerCase() === 'main_full') mainFullNodes.push(o); });
        mainFullNodes.forEach(n => {
          if (n.parent !== metarig) metarig.attach(n); // preserves world transform
          n.traverse(c => { if (c.isMesh) { c.visible = true; c.castShadow = true; c.receiveShadow = true; } });
        });
      }
    } catch (e) {
      console.warn('attach main_full failed', e);
    }
  }

  // Scale model to target height and align feet to ground
  const unionBox = new THREE.Box3(); let have = false;
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (o.isMesh) {
      o.updateWorldMatrix(true, false);
      const b = new THREE.Box3().setFromObject(o);
      if (!have) { unionBox.copy(b); have = true; } else { unionBox.union(b); }
    }
  });
  if (have) {
    const size = new THREE.Vector3(); unionBox.getSize(size);
    if (size.y > 0) {
      const s = targetHeight / size.y; model.scale.setScalar(s);
      model.updateMatrixWorld(true);
      // recompute and center
      const box2 = new THREE.Box3(); let have2 = false;
      root.traverse(o => {
        if (o.isMesh) {
          o.updateWorldMatrix(true, false);
          const b = new THREE.Box3().setFromObject(o);
          if (!have2) { box2.copy(b); have2 = true; } else { box2.union(b); }
        }
      });
      if (have2) {
        const center = new THREE.Vector3(); const size2 = new THREE.Vector3();
        box2.getCenter(center); box2.getSize(size2);
        model.position.sub(center); // center to origin
        model.position.y += size2.y/2; // feet to y=0
      }
    }
  }

  // Add to parent
  parent.add(model);

  // Setup animations
  let mixer = null; const actions = {};
  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    const clips = gltf.animations;
    const findClip = (names) => {
      const lc = clips.map(c => ({ c, n: (c.name||'').toLowerCase() }));
      for (const wanted of names) {
        const w = wanted.toLowerCase();
        let hit = lc.find(x => x.n === w); if (hit) return hit.c;
        hit = lc.find(x => x.n.includes(w)); if (hit) return hit.c;
      }
      return null;
    };
    const idleClip = findClip(['idle_anim','idle','Idle']);
    const walkClip = findClip(['DefWalking','walking','walk','Walk']);
    const holdFlashClip = findClip(['Hold_Flash.003','Hold_Flash','flash','torch']);

    if (idleClip) { actions.idle = mixer.clipAction(idleClip); actions.idle.setLoop(THREE.LoopRepeat, Infinity).play(); }
    if (walkClip) { actions.walk = mixer.clipAction(walkClip); actions.walk.setLoop(THREE.LoopRepeat, Infinity); }
    if (holdFlashClip) {
      actions.holdFlash = mixer.clipAction(holdFlashClip);
      actions.holdFlash.setLoop(THREE.LoopRepeat, Infinity);
      actions.holdFlash.enabled = true; actions.holdFlash.play(); actions.holdFlash.setEffectiveWeight(0.0);
    }
  }

  const api = {
    modelRoot: model,
    rig,
    mixer,
    actions,
    setVisible(v){ model.traverse(c => { if (c.isMesh) c.visible = v; }); },
  };
  return api;
}
