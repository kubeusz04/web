

(function () {
'use strict';

const THREE = window.THREE;
if (!THREE) throw new Error('Three.js missing');
const OrbitControls = THREE.OrbitControls;
if (!OrbitControls) throw new Error('OrbitControls missing');

const C = window.COSMOS;
if (!C) throw new Error('COSMOS data missing');

const TEX = ''; 
const MUSIC = window.COSMOS_MUSIC || { playlists: [], trackCount: 0, intro: '' };

const PLANETS = window.GIFT_PLANETS || [];
const DREAM_FILL = []; 


function buildCatalog() {
  const list = [];
  const seen = new Set();

  function add(item) {
    const key = item.id || (item.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    list.push(item);
  }

  (C.stars || []).forEach(function (s) {
    add({
      id:s.id, title: s.name,
      when: s.when || 'Our year',
      body: s.body,
      done: true,
      kind: 'memory', portraits:s.portraits||null, audio:s.audio||null
    });
  });

  (C.bucket || []).forEach(function (b) {
    const title = (b.text || b.name || '').trim();
    if (!title) return;
    add({
      title: title,
      when: b.done ? 'We did this' : 'We plan to do this',
      body: b.done
        ? (b.note && b.note.indexOf('waiting') === -1 ? b.note : 'Checked off together - one of our real stars.')
        : (b.note && b.note.indexOf('waiting') === -1
          ? b.note
          : 'On our list. Not a maybe - something we want with each other.'),
      done: !!b.done,
      kind: 'bucket'
    });
  });

  return list;
}

const catalog = buildCatalog();
let catalogCursor = 0;
function nextStory() {
  if (!catalog.length) {
    return {
      title: 'Us',
      when: 'Always',
      body: 'Everything we love belongs in this sky.',
      done: true,
      kind: 'memory'
    };
  }
  const s = catalog[catalogCursor % catalog.length];
  catalogCursor++;
  return s;
}


const canvas = document.getElementById('c3d');
const intro = document.getElementById('skyIntro');
const enter = document.getElementById('skyEnter');
const panel = document.getElementById('panel');
const hint = document.getElementById('skyHint');
const countEl = document.getElementById('discoverCount');
const discovered = new Set();
const visitedPlanets = new Set();
const PLANET_NAMES = new Set(PLANETS.map(function (p) { return p.id; }));
try {
  const saved = JSON.parse(sessionStorage.getItem(window.GIFT_KEY+'cosmosPlanets_v1') || '[]');
  if (Array.isArray(saved)) {
    saved.forEach(function (n) {
      if (PLANET_NAMES.has(n)) visitedPlanets.add(n);
    });
  }
  
  sessionStorage.setItem(window.GIFT_KEY+'cosmosPlanets_v1', JSON.stringify(Array.from(visitedPlanets)));
} catch (e) {}

const panelMusic = document.getElementById('panelMusic');
const panelPortraits = document.getElementById('panelPortraits');
const panelAudio = document.getElementById('panelAudio');
const panelAudioEl = document.getElementById('panelAudioEl');
const panelAudioBtn = document.getElementById('panelAudioBtn');
const panelAudioIcon = document.getElementById('panelAudioIcon');
const panelAudioLabel = document.getElementById('panelAudioLabel');
const skyMusic = document.getElementById('skyMusic');
const muteBtn = document.getElementById('skyMute');
let skyMusicMuted = false;
let skyMusicPausedForPanel = false;
const fxRoot = document.getElementById('skyFx');
const fxBurst = [];
const camTween = {
  active: false, t: 0, dur: 0,
  from: null, to: null, lookFrom: null, lookTo: null
};
const planetFollow = {
  mesh: null,
  active: false,
  preferredDist: 10,
  offset: new THREE.Vector3()
};
const _followPos = new THREE.Vector3();

function clearPlanetFollow() {
  planetFollow.mesh = null;
  planetFollow.active = false;
}

function beginPlanetFollow(mesh) {
  if (!mesh) return;
  const p = mesh.userData.planet;
  mesh.getWorldPosition(_followPos);
  const preferred = Math.max(7.5, 5.5 + (p && p.r ? p.r : 0.5) * 9);
  planetFollow.offset.copy(camera.position).sub(_followPos);
  if (planetFollow.offset.lengthSq() < 1) {
    const outward = _followPos.lengthSq() > 0.25
      ? _followPos.clone().normalize()
      : new THREE.Vector3(0.2, 0.5, 1).normalize();
    planetFollow.offset.copy(outward).multiplyScalar(preferred);
    planetFollow.offset.y += preferred * 0.2;
  }
  planetFollow.preferredDist = preferred;
  planetFollow.mesh = mesh;
  planetFollow.active = true;
  camTween.active = false;
  controls.autoRotate = false;
}

function saveVisitedPlanets() {
  try {
    const clean = Array.from(visitedPlanets).filter(function (n) { return PLANET_NAMES.has(n); });
    sessionStorage.setItem(window.GIFT_KEY+'cosmosPlanets_v1', JSON.stringify(clean));
  } catch (e) {}
}

function updateDiscoverCount() {
  let planetHits = 0;
  visitedPlanets.forEach(function (n) {
    if (PLANET_NAMES.has(n)) planetHits++;
  });
  const objects = discovered.size;
  const planetsPart = planetHits + '/' + PLANETS.length;
  countEl.dataset.objects = String(objects);
  countEl.dataset.planets = planetsPart;
  const full = countEl.querySelector('.count-full');
  const short = countEl.querySelector('.count-short');
  if (full && short) {
    full.textContent = objects + ' objects discovered · ' + planetsPart + ' planets';
    short.textContent = objects + ' · ' + planetsPart;
  } else {
    countEl.textContent = objects + ' objects discovered · ' + planetsPart + ' planets';
  }
}
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMusicPanel() {
  const lists = MUSIC.playlists || [];
  let html = '';
  for (let i = 0; i < lists.length; i++) {
    const pl = lists[i];
    const tracks = pl.tracks || [];
    html += '<section class="music-pl"><h3 class="music-pl__name">' +
      escapeHtml(pl.name) +
      '<span class="music-pl__count">' + tracks.length + '</span></h3>';
    for (let j = 0; j < tracks.length; j++) {
      const tr = tracks[j];
      const href = tr.v ? ('https://www.youtube.com/watch?v=' + encodeURIComponent(tr.v)) : '';
      const title = escapeHtml(tr.t || 'Untitled');
      const channel = escapeHtml(tr.c || '');
      html += '<div class="music-track"><span class="music-track__n">' + (j + 1) +
        '</span><div><p class="music-track__t">' +
        (href ? ('<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + title + '</a>') : title) +
        '</p>' +
        (channel ? ('<p class="music-track__c">' + channel + '</p>') : '') +
        '</div></div>';
    }
    html += '</section>';
  }
  panelMusic.innerHTML = html || '<p class="panel__body">No shared playlists found.</p>';
}

function renderPortraits(list) {
  if (!panelPortraits) return;
  portraitGallery = list.slice();
  let html = '';
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    html += '<button type="button" class="panel__portrait" data-portrait-i="' + i + '" aria-label="Preview ' + escapeHtml(p.label || 'portrait') + '">' +
      '<img src="' + escapeHtml(p.src) + '" alt="' + escapeHtml(p.label || 'Portrait') + '" loading="lazy">' +
      '<span class="panel__portrait-cap">' + escapeHtml(p.label || '') + '</span>' +
      '</button>';
  }
  panelPortraits.innerHTML = html;
}

let portraitGallery = [];
let portraitIndex = 0;
const portraitLite = document.getElementById('portraitLite');
const portraitLiteImg = document.getElementById('portraitLiteImg');
const portraitLiteCap = document.getElementById('portraitLiteCap');

function showPortraitLite(i) {
  if (!portraitLite || !portraitGallery.length) return;
  portraitIndex = ((i % portraitGallery.length) + portraitGallery.length) % portraitGallery.length;
  const p = portraitGallery[portraitIndex];
  portraitLiteImg.src = p.src;
  portraitLiteImg.alt = p.label || 'Portrait';
  portraitLiteCap.textContent = p.label || '';
  portraitLite.hidden = false;
}

function hidePortraitLite() {
  if (!portraitLite) return;
  portraitLite.hidden = true;
  portraitLiteImg.removeAttribute('src');
}

if (panelPortraits) {
  panelPortraits.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-portrait-i]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    showPortraitLite(parseInt(btn.getAttribute('data-portrait-i'), 10) || 0);
  });
}

if (portraitLite) {
  document.getElementById('portraitLiteClose').addEventListener('click', function (e) {
    e.stopPropagation();
    hidePortraitLite();
  });
  document.getElementById('portraitLitePrev').addEventListener('click', function (e) {
    e.stopPropagation();
    showPortraitLite(portraitIndex - 1);
  });
  document.getElementById('portraitLiteNext').addEventListener('click', function (e) {
    e.stopPropagation();
    showPortraitLite(portraitIndex + 1);
  });
  portraitLite.addEventListener('click', function (e) {
    if (e.target === portraitLite) hidePortraitLite();
  });
}

document.addEventListener('keydown', function (e) {
  if (!portraitLite || portraitLite.hidden) return;
  if (e.key === 'Escape') {
    hidePortraitLite();
  } else if (e.key === 'ArrowLeft') {
    showPortraitLite(portraitIndex - 1);
  } else if (e.key === 'ArrowRight') {
    showPortraitLite(portraitIndex + 1);
  }
});

function syncAudioButton() {
  if (!panelAudioBtn || !panelAudioEl) return;
  const playing = !panelAudioEl.paused && !panelAudioEl.ended;
  panelAudioBtn.classList.toggle('is-playing', playing);
  if (panelAudioIcon) panelAudioIcon.textContent = playing ? '❚❚' : '▶';
  if (panelAudioLabel) {
    const title = panelAudioBtn.dataset.title || 'Track';
    panelAudioLabel.textContent = playing ? ('Playing · ' + title) : ('Play · ' + title);
  }
}

function syncMuteButton() {
  if (!muteBtn) return;
  muteBtn.setAttribute('aria-pressed', skyMusicMuted ? 'true' : 'false');
  muteBtn.title = skyMusicMuted ? 'Unmute music' : 'Mute music';
  muteBtn.setAttribute('aria-label', muteBtn.title);
  muteBtn.textContent = skyMusicMuted ? '♪̸' : '♪';
  muteBtn.classList.toggle('is-muted', skyMusicMuted);
}

function playSkyMusic() {
  if (!skyMusic || skyMusicMuted || skyMusicPausedForPanel) return;
  const p = skyMusic.play();
  if (p && typeof p.catch === 'function') p.catch(function () {});
}

function pauseSkyMusicForPanel() {
  if (!skyMusic) return;
  if (!skyMusic.paused) {
    skyMusicPausedForPanel = true;
    skyMusic.pause();
  }
}

function resumeSkyMusicAfterPanel() {
  if (!skyMusicPausedForPanel) return;
  skyMusicPausedForPanel = false;
  playSkyMusic();
}

function stopPanelAudio() {
  if (!panelAudioEl) return;
  panelAudioEl.pause();
  try { panelAudioEl.currentTime = 0; } catch (e) {}
  syncAudioButton();
  resumeSkyMusicAfterPanel();
}

function setupPanelAudio(audio) {
  if (!panelAudio || !panelAudioEl) return;
  if (!audio || !audio.src) {
    stopPanelAudio();
    panelAudio.hidden = true;
    return;
  }
  const nextSrc = audio.src;
  const abs = new URL(nextSrc, window.location.href).href;
  if (panelAudioEl.src !== abs) {
    stopPanelAudio();
    panelAudioEl.src = nextSrc;
  }
  panelAudioBtn.dataset.title = audio.title || 'Track';
  panelAudio.hidden = false;
  syncAudioButton();
}

if (panelAudioBtn && panelAudioEl) {
  panelAudioBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (panelAudioEl.paused) {
      pauseSkyMusicForPanel();
      const playPromise = panelAudioEl.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () { syncAudioButton(); });
      }
    } else {
      panelAudioEl.pause();
      resumeSkyMusicAfterPanel();
    }
    syncAudioButton();
  });
  panelAudioEl.addEventListener('play', function () {
    pauseSkyMusicForPanel();
    syncAudioButton();
  });
  panelAudioEl.addEventListener('pause', function () {
    syncAudioButton();
    if (panelAudioEl.ended || panelAudioEl.paused) resumeSkyMusicAfterPanel();
  });
  panelAudioEl.addEventListener('ended', function () {
    syncAudioButton();
    resumeSkyMusicAfterPanel();
  });
}

if (muteBtn) {
  muteBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    skyMusicMuted = !skyMusicMuted;
    if (skyMusic) skyMusic.muted = skyMusicMuted;
    if (skyMusicMuted && skyMusic) skyMusic.pause();
    else playSkyMusic();
    syncMuteButton();
  });
  syncMuteButton();
}

function openPanel(story) {
  panel.hidden = false;
  panel.classList.toggle('is-future', !story.done);
  panel.classList.toggle('is-music', !!story.music);
  panel.classList.toggle('is-planet', !!story.planet);
  panel.classList.toggle('is-child', !!story.child);
  panel.classList.toggle('is-visited', !!story.visited);
  panel.classList.toggle('is-dream', story.kind === 'dream');
  panel.classList.toggle('has-portraits', !!(story.portraits && story.portraits.length));
  panel.style.animation = 'none';
  void panel.offsetWidth;
  panel.style.animation = '';
  document.getElementById('panelWhen').textContent = story.when;
  document.getElementById('panelName').textContent = story.title;
  const bodyEl = document.getElementById('panelBody');
  bodyEl.textContent = story.body || '';
  bodyEl.hidden = !story.body;
  if (story.music) {
    panelMusic.hidden = false;
    if (!panelMusic.dataset.ready) {
      renderMusicPanel();
      panelMusic.dataset.ready = '1';
    }
    if (panelPortraits) panelPortraits.hidden = true;
    setupPanelAudio(story.audio || null);
    document.getElementById('panelMeta').textContent =
      (MUSIC.trackCount || 0) + ' songs · ' + (MUSIC.playlists || []).length +
      ' playlists · from Jam, with you';
  } else {
    panelMusic.hidden = true;
    if (panelPortraits) {
      if (story.portraits && story.portraits.length) {
        renderPortraits(story.portraits);
        panelPortraits.hidden = false;
      } else {
        panelPortraits.hidden = true;
        panelPortraits.innerHTML = '';
      }
    }
    setupPanelAudio(story.audio || null);
    const meta = document.getElementById('panelMeta');
    if (!story.done && !story.planet && !story.child) {
      meta.textContent = 'We will do that one day';
      meta.hidden = false;
    } else {
      meta.textContent = '';
      meta.hidden = true;
    }
  }
  if (hint) hint.classList.add('dim');
}

document.getElementById('panelClose').addEventListener('click', function () {
  hidePortraitLite();
  stopPanelAudio();
  clearPlanetFollow();
  panel.hidden = true;
  if (hint) hint.classList.remove('dim');
});


const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
} else if ('outputEncoding' in renderer && THREE.sRGBEncoding) {
  renderer.outputEncoding = THREE.sRGBEncoding;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000008);
scene.fog = new THREE.FogExp2(0x000008, 0.0022);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 4000);
camera.position.set(0, 28, 55);
camTween.from = new THREE.Vector3();
camTween.to = new THREE.Vector3();
camTween.lookFrom = new THREE.Vector3();
camTween.lookTo = new THREE.Vector3();

function screenFxAt(clientX, clientY, kind) {
  if (!fxRoot) return;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const flash = document.createElement('div');
  flash.className = 'sky-fx__flash';
  flash.style.setProperty('--fx-x', x + 'px');
  flash.style.setProperty('--fx-y', y + 'px');
  fxRoot.appendChild(flash);
  setTimeout(function () { flash.remove(); }, 480);

  const ring = document.createElement('div');
  ring.className = 'sky-fx__ring' + (kind === 'music' ? ' sky-fx__ring--violet' : kind === 'visited' ? ' sky-fx__ring--gold' : '');
  ring.style.left = x + 'px';
  ring.style.top = y + 'px';
  fxRoot.appendChild(ring);
  setTimeout(function () { ring.remove(); }, 950);

  for (let i = 0; i < 18; i++) {
    const sp = document.createElement('div');
    sp.className = 'sky-fx__spark';
    const ang = (Math.PI * 2 * i) / 18 + Math.random() * 0.3;
    const dist = 40 + Math.random() * 90;
    sp.style.left = x + 'px';
    sp.style.top = y + 'px';
    sp.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
    sp.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    if (kind === 'music') sp.style.background = 'radial-gradient(circle,#fff 0%,#c084fc 55%,transparent 70%)';
    if (kind === 'visited') sp.style.background = 'radial-gradient(circle,#fff 0%,#facc15 55%,transparent 70%)';
    fxRoot.appendChild(sp);
    setTimeout(function () { sp.remove(); }, 800);
  }
}

function spawnWorldBurst(origin, colorHex, count) {
  const col = new THREE.Color(colorHex);
  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.06 + Math.random() * 0.1, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: col.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.2),
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);
    const dir = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();
    mesh.userData.vel = dir.multiplyScalar(4 + Math.random() * 10);
    mesh.userData.life = 0.7 + Math.random() * 0.55;
    mesh.userData.age = 0;
    scene.add(mesh);
    fxBurst.push(mesh);
  }
}

function spawnShockwave(origin, colorHex, radius) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.28, 48),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  ring.position.copy(origin);
  ring.lookAt(camera.position);
  ring.userData.shock = true;
  ring.userData.life = 0.85;
  ring.userData.age = 0;
  ring.userData.grow = radius || 8;
  scene.add(ring);
  fxBurst.push(ring);
}

function gildMesh(mesh, keepAura) {
  if (!mesh || mesh.userData.gilded) return;
  mesh.userData.gilded = true;
  
  if (mesh.userData.shapeIndex != null) {
    styleStarDiscovered(mesh);
    return;
  }
  const gold = new THREE.Color(0xf5c542);
  const goldEm = new THREE.Color(0xffd56a);
  if (mesh.material) {
    if (!mesh.userData.preGold) {
      mesh.userData.preGold = {
        color: mesh.material.color ? mesh.material.color.clone() : null,
        emissive: mesh.material.emissive ? mesh.material.emissive.clone() : null,
        emissiveIntensity: mesh.material.emissiveIntensity
      };
    }
    if (mesh.material.color) mesh.material.color.copy(gold);
    if (mesh.material.emissive) {
      mesh.material.emissive.copy(goldEm);
      mesh.material.emissiveIntensity = 1.85;
    }
    mesh.userData.baseEmissive = goldEm.clone();
    mesh.userData.baseEmissiveIntensity = 1.85;
  }
  if (mesh.userData.qMark) {
    mesh.remove(mesh.userData.qMark);
    mesh.userData.qMark = null;
  }
  if (mesh.userData.halo) {
    mesh.remove(mesh.userData.halo);
    mesh.userData.halo = null;
  }
  if (!keepAura) {
    mesh.children.forEach(function (ch) {
      if (ch.material && ch.material.color && ch.material.opacity < 0.5) {
        ch.material.color.copy(gold);
      }
    });
  }
}

function markPlanetVisited(mesh) {
  const p = mesh.userData.planet;
  if (!p || mesh.userData.visitedMark) return;
  mesh.userData.visitedMark = true;
  mesh.userData.blinkLight = true;
  mesh.userData.blinkPhase = Math.random() * Math.PI * 2;
  if (mesh.material && mesh.material.emissive) {
    if (!mesh.userData.baseEmissive) {
      mesh.userData.baseEmissive = mesh.material.emissive.clone();
      mesh.userData.baseEmissiveIntensity = mesh.material.emissiveIntensity || 1;
    }
  }
  
  if (!mesh.userData.blinkLamp) {
    const lamp = new THREE.PointLight(p.color || 0xffffff, 0, p.r * 18 + 8, 2);
    lamp.position.set(0, 0, 0);
    mesh.add(lamp);
    mesh.userData.blinkLamp = lamp;
  }
}

function celebratePlanet(mesh, clientX, clientY) {
  const p = mesh.userData.planet;
  const first = !visitedPlanets.has(p.id);
  const kind = p.kind === 'music' ? 'music' : p.kind === 'child' ? 'child' : (first ? 'new' : 'visited');
  const burstColor = p.kind === 'music'
    ? 0xc084fc
    : p.kind === 'child'
      ? (p.color || 0xfb7185)
      : (first ? 0xfb7185 : 0xfacc15);

  screenFxAt(clientX, clientY, kind === 'new' ? null : (kind === 'child' ? 'visited' : kind));
  const worldPos = new THREE.Vector3();
  mesh.getWorldPosition(worldPos);
  spawnShockwave(worldPos.clone(), burstColor, 6 + p.r * 4);
  spawnShockwave(worldPos.clone(), 0xffffff, 3 + p.r * 2);
  spawnWorldBurst(worldPos.clone(), burstColor, p.kind === 'music' ? 36 : 26);

  mesh.userData.clickSpin = (mesh.userData.clickSpin || 0) + 3.2;
  mesh.userData.bounce = 1;
  mesh.userData.bounceAmp = 0.32;
  if (mesh.material && mesh.material.emissive) {
    mesh.userData.pulseEmissive = 1;
    if (!mesh.userData.baseEmissive) {
      mesh.userData.baseEmissive = mesh.material.emissive.clone();
      mesh.userData.baseEmissiveIntensity = mesh.material.emissiveIntensity || 0;
    }
  }

  beginPlanetFollow(mesh);

  if (first) {
    visitedPlanets.add(p.id);
    saveVisitedPlanets();
    markPlanetVisited(mesh);
    const key = 'planet|' + p.id;
    if (!discovered.has(key)) discovered.add(key);
    updateDiscoverCount();
  }
}

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 6;
controls.maxDistance = 220;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.18;
controls.target.set(0, 0, 0);
if (window.matchMedia('(hover: none), (pointer: coarse)').matches) {
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.6;
  controls.enablePan = true;
  if (hint) hint.textContent = 'Drag to explore · tap a star or planet';
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
}

scene.add(new THREE.AmbientLight(0xffffff, 1.1));
const sunLight = new THREE.PointLight(0xfff2dd, 120, 0, 0);
scene.add(sunLight);
const fill = new THREE.DirectionalLight(0xaaccff, 1.4);
fill.position.set(-40, 20, -30);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffc9a8, 0.7);
rim.position.set(50, -10, 40);
scene.add(rim);

const loader = new THREE.TextureLoader();
function loadTex() { return Promise.resolve(null); }
function makeStarField(count, radius) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.55 + Math.random() * 0.45);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
    const warm = Math.random();
    col[i * 3] = 0.85 + warm * 0.15;
    col[i * 3 + 1] = 0.75 + warm * 0.2;
    col[i * 3 + 2] = 0.9 + (1 - warm) * 0.1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.55,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });
  return new THREE.Points(geo, mat);
}

scene.add(makeStarField(12000, 900));
scene.add(makeStarField(8000, 1400));


const sunGroup = new THREE.Group();
scene.add(sunGroup);


const planetMeshes = [];
const memoryStars = [];

const HEART_EDGES = function (n) {
  const e = [];
  for (let i = 0; i < n; i++) e.push([i, (i + 1) % n]);
  return e;
};


function makeHeartPts(n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = Math.PI - (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([x / 17, y / 17]);
  }
  return pts;
}

const CAT_BIG_PTS = [
  [-0.42, 0.42], [-0.28, 0.92], [-0.08, 0.48],
  [0.08, 0.48], [0.28, 0.92], [0.42, 0.42],
  [-0.48, 0.22], [0.48, 0.22], [0.38, -0.12], [-0.38, -0.12],
  [-0.52, -0.18], [0.52, -0.18], [0.55, -0.72], [-0.55, -0.72],
  [0.55, -0.35], [0.88, -0.05], [1.05, 0.42],
  [-0.18, 0.18], [0.18, 0.18],
  [-0.25, -0.72], [0.25, -0.72]
];
const CAT_BIG_EDGES = [
  [0, 1], [1, 2], [2, 0],
  [3, 4], [4, 5], [5, 3],
  [0, 6], [5, 7], [6, 9], [7, 8], [8, 9],
  [6, 10], [7, 11], [10, 13], [11, 12], [12, 13],
  [11, 14], [14, 15], [15, 16],
  [17, 6], [18, 7],
  [13, 19], [12, 20]
];

const CAT_SMALL_PTS = [
  [-0.35, 0.5], [-0.2, 0.88], [-0.02, 0.52],
  [0.02, 0.52], [0.2, 0.88], [0.35, 0.5],
  [-0.4, 0.25], [0.4, 0.25], [0.32, -0.15], [-0.32, -0.15],
  [-0.28, -0.2], [0.28, -0.2], [0.35, -0.65], [-0.35, -0.65],
  [0.35, -0.4], [0.72, -0.15], [0.82, 0.28]
];
const CAT_SMALL_EDGES = [
  [0, 1], [1, 2], [2, 0],
  [3, 4], [4, 5], [5, 3],
  [0, 6], [5, 7], [6, 9], [7, 8], [8, 9],
  [9, 10], [8, 11], [10, 13], [11, 12], [12, 13],
  [11, 14], [14, 15], [15, 16]
];


const SHAPE_LAYOUTS = [
  { kind: 'heart', name: 'heart-tiny-a', color: 0xffc0cb, origin: [-52, 42, -28], scale: 5.5, yaw: 0.35, n: 8 },
  { kind: 'heart', name: 'heart-small-a', color: 0xff8fab, origin: [48, 38, -40], scale: 8, yaw: -0.6, n: 10 },
  { kind: 'heart', name: 'heart-med-a', color: 0xfb7185, origin: [-22, 52, 36], scale: 13, yaw: 2.0, n: 12 },
  { kind: 'heart', name: 'heart-large-a', color: 0xf9a8d4, origin: [18, 58, -48], scale: 20, yaw: 0.15, n: 14 },
  { kind: 'heart', name: 'heart-huge', color: 0xff6b8a, origin: [-38, -8, -55], scale: 28, yaw: 0.45, n: 16 },
  { kind: 'heart', name: 'heart-tiny-b', color: 0xfda4af, origin: [58, 22, 18], scale: 4.5, yaw: 1.4, n: 8 },
  { kind: 'heart', name: 'heart-small-b', color: 0xff8fab, origin: [-58, 18, 22], scale: 7, yaw: -1.7, n: 10 },
  { kind: 'heart', name: 'heart-med-b', color: 0xf472b6, origin: [8, 44, 58], scale: 12, yaw: -2.4, n: 12 },
  { kind: 'heart', name: 'heart-large-b', color: 0xffb4c4, origin: [55, 48, -8], scale: 18, yaw: -2.1, n: 14 },
  { kind: 'heart', name: 'heart-med-c', color: 0xfb7185, origin: [-45, 55, 8], scale: 11, yaw: 1.1, n: 12 },
  { kind: 'heart', name: 'heart-small-c', color: 0xffc0cb, origin: [32, -18, 52], scale: 6.5, yaw: 2.7, n: 10 },
  { kind: 'heart', name: 'heart-med-d', color: 0xf9a8d4, origin: [-12, 28, -62], scale: 15, yaw: 0.7, n: 12 },
  {
    kind: 'cat', name: 'cat-big', color: 0xfde68a,
    origin: [42, 28, -22], scale: 24, yaw: -0.55,
    pts: CAT_BIG_PTS, edges: CAT_BIG_EDGES
  },
  {
    kind: 'cat', name: 'cat-small', color: 0xa5f3fc,
    origin: [-28, 12, 48], scale: 10, yaw: 0.85,
    pts: CAT_SMALL_PTS, edges: CAT_SMALL_EDGES
  }
];

const MEMORY_SLOTS = SHAPE_LAYOUTS.reduce((sum,shape)=>sum+(shape.n||shape.pts.length),0);
let memorySlot = 0;
const shapeWorld = [];
let constelLine = null;
let redStringLine = null;
const STRING_SAMPLES = 32;
const _lerpA = new THREE.Vector3();
const _lerpB = new THREE.Vector3();
const _sunPos = new THREE.Vector3(0, 0, 0);
const _ctrl = new THREE.Vector3();

function localToWorld(ox, oy, oz, scale, yaw, lx, ly) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const x = lx * scale;
  const y = ly * scale;
  return new THREE.Vector3(ox + x * c, oy + y, oz - x * s);
}

function closestPointToSun(pts) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = pts[i].lengthSq();
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}


function buildMemoryConstellations() {
  shapeWorld.length = 0;
  memoryStars.length = 0; memorySlot = 0;

  const starGeo = new THREE.SphereGeometry(0.32, 14, 14);

  for (let s = 0; s < SHAPE_LAYOUTS.length; s++) {
    const layout = SHAPE_LAYOUTS[s];
    const o = layout.origin;
    let localPts;
    let edgesIdx;
    if (layout.kind === 'heart') {
      localPts = makeHeartPts(layout.n);
      edgesIdx = HEART_EDGES(layout.n);
    } else {
      localPts = layout.pts;
      edgesIdx = layout.edges;
    }
    const pts = localPts.map(function (p) {
      return localToWorld(o[0], o[1], o[2], layout.scale, layout.yaw, p[0], p[1]);
    });
    const stars = [];
    for (let i = 0; i < pts.length; i++) {
      
      const mat = new THREE.MeshStandardMaterial({
        color: 0xf5f5f7,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.55,
        metalness: 0.05
      });
      const mesh = new THREE.Mesh(starGeo, mat);
      mesh.position.copy(pts[i]);
      mesh.scale.setScalar(0.85 + (layout.kind === 'cat' ? 0.12 : 0));
      mesh.userData.shapeIndex = s;
      mesh.userData.localIndex = i;
      mesh.userData.discoveredStar = false;
      mesh.userData.baseEmissiveIntensity = 0;
      scene.add(mesh);
      stars.push(mesh);
      const bound = Math.floor((memorySlot+1)*catalog.length/MEMORY_SLOTS)>Math.floor(memorySlot*catalog.length/MEMORY_SLOTS);
      memorySlot++;
      mesh.userData.decorative = !bound;
      if(bound) memoryStars.push(mesh); else mesh.userData.discoveredStar = true;
    }
    const edges = edgesIdx.map(function (e) {
      return { i: e[0], j: e[1], draw: 0, target: 0 };
    });
    shapeWorld.push({
      name: layout.name,
      kind: layout.kind,
      color: layout.color,
      pts: pts,
      stars: stars,
      edges: edges,
      sunLink: {
        anchor: closestPointToSun(pts),
        progress: 0,
        target: 0,
        celebrated: false,
        arrived: false
      }
    });
  }

  
  for (let i = 0; i < memoryStars.length; i++) {
    assignStoryToStar(memoryStars[i]);
  }

  ensureConstellationLine();
  ensureRedStringLine();
}

function assignStoryToStar(mesh) {
  const story = nextStory();
  mesh.userData.story = story;
  mesh.userData.id = story.id;
  if (mesh.userData.qMark) {
    mesh.remove(mesh.userData.qMark);
    mesh.userData.qMark = null;
  }
  if (!mesh.userData.discoveredStar) {
    mesh.material.color.setHex(0xf5f5f7);
    mesh.material.emissive.setHex(0x000000);
    mesh.material.emissiveIntensity = 0;
    mesh.userData.baseEmissiveIntensity = 0;
  }
}

function styleStarDiscovered(mesh) {
  if (!mesh || !mesh.material) return;
  const gold = new THREE.Color(0xf5c542);
  const goldEm = new THREE.Color(0xffe08a);
  mesh.material.color.copy(gold);
  mesh.material.emissive.copy(goldEm);
  mesh.material.emissiveIntensity = 2.4;
  mesh.material.roughness = 0.22;
  mesh.userData.baseEmissive = goldEm.clone();
  mesh.userData.baseEmissiveIntensity = 2.4;
  mesh.scale.setScalar(1.25);

  if (!mesh.userData.goldGlow) {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffd56a,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false
      })
    );
    mesh.add(glow);
    mesh.userData.goldGlow = glow;

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 14, 14),
      new THREE.MeshBasicMaterial({
        color: 0xfff1c1,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false
      })
    );
    mesh.add(halo);
    mesh.userData.goldHalo = halo;
  }
}

function ensureConstellationLine() {
  if (constelLine) return constelLine;
  let segs = 0;
  for (let i = 0; i < shapeWorld.length; i++) segs += shapeWorld[i].edges.length;
  segs = Math.max(segs, 128);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(segs * 2 * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.LineBasicMaterial({
    color: 0xffd6e0,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  constelLine = new THREE.LineSegments(geo, mat);
  constelLine.frustumCulled = false;
  scene.add(constelLine);
  return constelLine;
}

function ensureRedStringLine() {
  const needLinks = Math.max(shapeWorld.length, 1) + Math.max(planetMeshes.length, PLANETS.length) + 2;
  const needFloats = needLinks * STRING_SAMPLES * 2 * 3;
  if (redStringLine) {
    const attr = redStringLine.geometry.getAttribute('position');
    if (attr && attr.array.length >= needFloats) return redStringLine;
    
    scene.remove(redStringLine);
    if (redStringLine.userData.glow) scene.remove(redStringLine.userData.glow);
    redStringLine.geometry.dispose();
    redStringLine.material.dispose();
    if (redStringLine.userData.glow) {
      redStringLine.userData.glow.geometry.dispose();
      redStringLine.userData.glow.material.dispose();
    }
    redStringLine = null;
  }
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(needFloats);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.LineBasicMaterial({
    color: 0xe11d48,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  redStringLine = new THREE.LineSegments(geo, mat);
  redStringLine.frustumCulled = false;
  scene.add(redStringLine);

  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(pos.slice(0), 3));
  const glow = new THREE.LineSegments(glowGeo, new THREE.LineBasicMaterial({
    color: 0xff4d6d,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  glow.frustumCulled = false;
  redStringLine.userData.glow = glow;
  scene.add(glow);
  return redStringLine;
}

function appendSaggingRedString(arr, n, maxSeg, from, sway) {
  if (n >= maxSeg) return n;
  _ctrl.copy(from).multiplyScalar(0.42);
  _ctrl.y -= Math.max(2, from.length() * 0.12);
  _ctrl.x += sway;
  const endT = 1;
  const steps = STRING_SAMPLES;
  for (let i = 0; i < steps; i++) {
    if (n >= maxSeg) break;
    const t0 = i / STRING_SAMPLES;
    const t1 = Math.min(endT, (i + 1) / STRING_SAMPLES);
    if (t0 >= endT) break;
    quadBezier(_lerpA, from, _ctrl, _sunPos, t0);
    quadBezier(_lerpB, from, _ctrl, _sunPos, t1);
    const o = n * 6;
    arr[o] = _lerpA.x; arr[o + 1] = _lerpA.y; arr[o + 2] = _lerpA.z;
    arr[o + 3] = _lerpB.x; arr[o + 4] = _lerpB.y; arr[o + 5] = _lerpB.z;
    n++;
  }
  return n;
}

function shapeIsComplete(shape) {
  for (let e = 0; e < shape.edges.length; e++) {
    if (shape.edges[e].target < 1) return false;
  }
  return shape.edges.length > 0;
}

function beginSunString(shape, instant) {
  if (!shape || shape.sunLink.target >= 1) return;
  shape.sunLink.target = 1;
  if (instant) {
    shape.sunLink.progress = 1;
    shape.sunLink.celebrated = true;
    shape.sunLink.arrived = true;
    return;
  }
  if (!shape.sunLink.celebrated) {
    shape.sunLink.celebrated = true;
    const from = shape.stars[shape.sunLink.anchor].position;
    spawnWorldBurst(from.clone(), 0xe11d48, 16);
    spawnWorldBurst(_sunPos.clone(), 0xff4d6d, 12);
    spawnShockwave(from.clone(), 0xe11d48, 10);
  }
}


function onConstellationStarFound(mesh, instant) {
  if (!mesh || mesh.userData.shapeIndex == null) return;
  const shape = shapeWorld[mesh.userData.shapeIndex];
  if (!shape) return;
  const li = mesh.userData.localIndex;
  const already = !!mesh.userData.discoveredStar;
  mesh.userData.discoveredStar = true;
  mesh.userData.pulse = 1;
  styleStarDiscovered(mesh);

  for (let e = 0; e < shape.edges.length; e++) {
    const ed = shape.edges[e];
    if (ed.i !== li && ed.j !== li) continue;
    const a = shape.stars[ed.i];
    const b = shape.stars[ed.j];
    if (a.userData.discoveredStar && b.userData.discoveredStar && ed.target < 1) {
      ed.target = 1;
      if (instant) ed.draw = 1;
      a.userData.pulse = 1;
      b.userData.pulse = 1;
    }
  }
  if (shapeIsComplete(shape)) beginSunString(shape, !!instant);
  return !already;
}

function pruneConstellationFor(mesh) {
  
  mesh.userData.inConstel = false;
}

function quadBezier(out, p0, p1, p2, t) {
  const u = 1 - t;
  out.set(
    u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z
  );
  return out;
}

function updateConstellationGeometry() {
  if (!shapeWorld.length) return;
  const line = ensureConstellationLine();
  const attr = line.geometry.getAttribute('position');
  const arr = attr.array;
  let n = 0;
  const max = Math.floor(arr.length / 6);
  for (let s = 0; s < shapeWorld.length; s++) {
    const sh = shapeWorld[s];
    for (let e = 0; e < sh.edges.length; e++) {
      if (n >= max) break;
      const ed = sh.edges[e];
      if (ed.draw <= 0.001) continue;
      const t = ed.draw * ed.draw * (3 - 2 * ed.draw);
      const a = sh.stars[ed.i].position;
      const b = sh.stars[ed.j].position;
      _lerpA.copy(a);
      _lerpB.copy(a).lerp(b, t);
      const o = n * 6;
      arr[o] = _lerpA.x; arr[o + 1] = _lerpA.y; arr[o + 2] = _lerpA.z;
      arr[o + 3] = _lerpB.x; arr[o + 4] = _lerpB.y; arr[o + 5] = _lerpB.z;
      n++;
    }
  }
  attr.needsUpdate = true;
  line.geometry.setDrawRange(0, n * 2);
  if (constelLine && constelLine.material) {
    constelLine.material.opacity = 0.55 + Math.min(0.4, n * 0.015);
  }
}

function updateRedStringGeometry() {
  const line = ensureRedStringLine();
  const attr = line.geometry.getAttribute('position');
  const arr = attr.array;
  const glow = line.userData.glow;
  const glowAttr = glow ? glow.geometry.getAttribute('position') : null;
  let n = 0;
  const maxSeg = Math.floor(arr.length / 6);

  
  for (let p = 0; p < planetMeshes.length; p++) {
    const mesh = planetMeshes[p];
    if (!mesh) continue;
    const from = mesh.position;
    const sway = (p % 2 === 0 ? 1 : -1) * Math.max(1.2, from.length() * 0.04);
    n = appendSaggingRedString(arr, n, maxSeg, from, sway);
  }

  
  for (let s = 0; s < shapeWorld.length; s++) {
    const link = shapeWorld[s].sunLink;
    if (!link || link.progress <= 0.001) continue;
    const from = shapeWorld[s].stars[link.anchor].position;
    const ease = link.progress * link.progress * (3 - 2 * link.progress);
    if (ease >= 0.999) {
      const sway = (s % 2 === 0 ? 1 : -1) * from.length() * 0.06;
      n = appendSaggingRedString(arr, n, maxSeg, from, sway);
    } else {
      _ctrl.copy(from).multiplyScalar(0.45);
      _ctrl.y -= from.length() * 0.18;
      _ctrl.x += (s % 2 === 0 ? 1 : -1) * from.length() * 0.06;
      const endT = Math.max(0.02, ease);
      const steps = Math.max(2, Math.ceil(STRING_SAMPLES * endT));
      for (let i = 0; i < steps; i++) {
        if (n >= maxSeg) break;
        const t0 = i / STRING_SAMPLES;
        const t1 = Math.min(endT, (i + 1) / STRING_SAMPLES);
        if (t0 >= endT) break;
        quadBezier(_lerpA, from, _ctrl, _sunPos, t0);
        quadBezier(_lerpB, from, _ctrl, _sunPos, t1);
        const o = n * 6;
        arr[o] = _lerpA.x; arr[o + 1] = _lerpA.y; arr[o + 2] = _lerpA.z;
        arr[o + 3] = _lerpB.x; arr[o + 4] = _lerpB.y; arr[o + 5] = _lerpB.z;
        n++;
      }
    }
  }

  attr.needsUpdate = true;
  line.geometry.setDrawRange(0, n * 2);
  if (glowAttr) {
    glowAttr.array.set(arr);
    glowAttr.needsUpdate = true;
    glow.geometry.setDrawRange(0, n * 2);
    glow.material.opacity = 0.2 + 0.14 * Math.sin(performance.now() * 0.003);
  }
  if (line.material) {
    line.material.opacity = 0.7 + 0.18 * Math.sin(performance.now() * 0.004);
  }
}

function tickConstellationDraw(dt) {
  for (let s = 0; s < shapeWorld.length; s++) {
    const sh = shapeWorld[s];
    for (let e = 0; e < sh.edges.length; e++) {
      const ed = sh.edges[e];
      if (ed.draw < ed.target) {
        ed.draw = Math.min(ed.target, ed.draw + dt * (1.0 + (e % 3) * 0.2));
      }
    }
    for (let i = 0; i < sh.stars.length; i++) {
      const st = sh.stars[i];
      if (st.userData.pulse) {
        st.userData.pulse = Math.max(0, st.userData.pulse - dt * 2.2);
        st.scale.setScalar(1.15 + st.userData.pulse * 0.55);
      }
      if (st.userData.discoveredStar) {
        const tw = 0.82 + 0.18 * Math.sin(performance.now() * 0.004 + i + s);
        st.material.emissiveIntensity = (st.userData.baseEmissiveIntensity || 2.4) * tw;
        if (st.userData.goldGlow) {
          st.userData.goldGlow.material.opacity = 0.4 + 0.25 * tw;
        }
        if (st.userData.goldHalo) {
          st.userData.goldHalo.material.opacity = 0.14 + 0.12 * tw;
        }
      } else {
        st.material.emissiveIntensity = 0;
      }
    }
    const link = sh.sunLink;
    if (link && link.progress < link.target) {
      link.progress = Math.min(link.target, link.progress + dt * 0.55);
      if (link.progress < 1) {
        const from = sh.stars[link.anchor].position;
        _ctrl.copy(from).multiplyScalar(0.45);
        _ctrl.y -= from.length() * 0.18;
        quadBezier(_lerpA, from, _ctrl, _sunPos, link.progress);
        if (Math.random() < 0.08) spawnWorldBurst(_lerpA.clone(), 0xff4d6d, 1);
      } else if (!link.arrived) {
        link.arrived = true;
        spawnWorldBurst(_sunPos.clone(), 0xe11d48, 20);
        spawnShockwave(_sunPos.clone(), 0xff4d6d, 7);
      }
    }
  }
  updateConstellationGeometry();
  updateRedStringGeometry();
}

const MEMORY_COUNT = 0; 
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
window.OPEN_GIFT_MEMORY = function(story){
  const planet=planetMeshes.find(mesh=>mesh.userData.planet&&mesh.userData.planet.id===story.id);
  if(planet)celebratePlanet(planet,innerWidth/2,innerHeight/2);
  const star=memoryStars.find(mesh=>mesh.userData.story&&mesh.userData.story.id===story.id);
  if(star){clearPlanetFollow();discovered.add(star.userData.id);gildMesh(star,false);onConstellationStarFound(star,false);updateDiscoverCount();}
  openPanel(story);
};
let active = false;

let qMarkTex = null;
function getQuestionMarkTexture() {
  if (qMarkTex) return qMarkTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(255, 180, 196, 0.15)';
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 92px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe4ec';
  ctx.shadowColor = 'rgba(251,113,133,0.95)';
  ctx.shadowBlur = 18;
  ctx.fillText('?', 64, 70);
  qMarkTex = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace) qMarkTex.colorSpace = THREE.SRGBColorSpace;
  qMarkTex.needsUpdate = true;
  return qMarkTex;
}

function placeMemoryStar(mesh, nearCam) {
  
  assignStoryToStar(mesh);
}

let sunVideo = null;
let sunVideoTex = null;
let sunMesh = null;
let sunVideoDisc = null;
let sunLive = false;

function getSunVideoEl() {
  let video = document.getElementById('sunVid');
  if (!video) {
    video = document.createElement('video');
    video.id = 'sunVid';
    video.className = 'sun-vid';
    document.body.appendChild(video);
  }
  const want = TEX + 'sun.mp4';
  const abs = (function () {
    try { return new URL(want, location.href).href; } catch (e) { return want; }
  })();
  
  if (!video.getAttribute('src') || video.currentSrc.indexOf('sun.mp4') === -1) {
    while (video.firstChild) video.removeChild(video.firstChild);
    video.setAttribute('src', want);
    video.src = abs;
  }
  video.removeAttribute('crossorigin');
  try { delete video.crossOrigin; } catch (e) { try { video.crossOrigin = null; } catch (e2) {} }
  video.muted = true;
  video.defaultMuted = true;
  video.volume = 0;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('muted', '');
  video.preload = 'auto';
  video.autoplay = true;
  
  video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:0;';
  return video;
}

function makeSunVideoTexture(video) {
  if (sunVideoTex) {
    sunVideoTex.needsUpdate = true;
    return sunVideoTex;
  }
  const tex = new THREE.VideoTexture(video);
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  else if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  sunVideoTex = tex;
  return tex;
}

function applySunVideoMap() {
  if (!sunVideoTex) return false;
  sunLive = true;
  if (sunMesh && sunMesh.material) {
    sunMesh.material.map = sunVideoTex;
    sunMesh.material.color.setHex(0xffffff);
    sunMesh.material.transparent = false;
    sunMesh.material.opacity = 1;
    sunMesh.material.needsUpdate = true;
    sunMesh.visible = true;
  }
  if (sunVideoDisc && sunVideoDisc.material) {
    sunVideoDisc.material.map = sunVideoTex;
    sunVideoDisc.material.color.setHex(0xffffff);
    sunVideoDisc.material.opacity = 1;
    sunVideoDisc.material.transparent = false;
    sunVideoDisc.material.needsUpdate = true;
    sunVideoDisc.visible = true;
  }
  return true;
}

function playSunVideo() {
  const video = sunVideo || getSunVideoEl();
  sunVideo = video;
  video.muted = true;
  video.defaultMuted = true;
  video.volume = 0;
  if (video.readyState >= 2) makeSunVideoTexture(video);
  const kick = function () {
    if (video.readyState >= 2 && video.videoWidth >= 2) {
      makeSunVideoTexture(video);
      applySunVideoMap();
    }
  };
  const p = video.play();
  if (p && typeof p.then === 'function') {
    p.then(kick).catch(function () {
      setTimeout(function () {
        video.muted = true;
        video.play().then(kick).catch(function () {});
      }, 200);
    });
  } else {
    kick();
  }
}

function loadSunVideo() {
  return new Promise(function (resolve) {
    const video = getSunVideoEl();
    sunVideo = video;
    let settled = false;

    function succeed() {
      if (settled) return;
      if (video.videoWidth < 2) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      makeSunVideoTexture(video);
      /* No unlicensed sun movie. Use the original procedural fallback. */
      applySunVideoMap();
      resolve(sunVideoTex);
    }
    function fail() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(null);
    }
    function cleanup() {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('canplaythrough', onReady);
      video.removeEventListener('playing', onReady);
      video.removeEventListener('error', onFail);
    }
    function onReady() { succeed(); }
    function onFail() { fail(); }

    const timer = setTimeout(function () {
      if (video.readyState >= 2 && video.videoWidth >= 2) succeed();
      else fail();
    }, 20000);

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('canplaythrough', onReady);
    video.addEventListener('playing', onReady);
    video.addEventListener('error', onFail);

    
    if (video.readyState >= 2 && video.videoWidth >= 2) {
      succeed();
      return;
    }
    /* Procedural sun; no source movie is bundled. */
  });
}

async function buildWorld() {
  
  const sunVidTex = null;
  const still = sunVidTex ? null : await loadTex('2k_sun.jpg');
  const sunMap = sunVidTex || still;

  
  sunMesh = new THREE.Mesh(
    new THREE.CircleGeometry(5.0, 64),
    new THREE.MeshBasicMaterial({
      map: sunMap || undefined,
      color: sunMap ? 0xffffff : 0xffcc66,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
      depthWrite: true
    })
  );
  sunMesh.userData.billboard = true;
  sunMesh.renderOrder = 2;
  scene.add(sunMesh); 
  sunVideoDisc = sunMesh;
  if (sunVidTex) sunLive = true;

  
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(5.55, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff8844,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false
    })
  );
  sunGroup.add(glow);

  const corona = new THREE.Mesh(
    new THREE.SphereGeometry(6.4, 28, 28),
    new THREE.MeshBasicMaterial({
      color: 0xffaa55,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false
    })
  );
  sunGroup.add(corona);
  sunLight.position.set(0, 0, 0);

  /* Procedural sun; no source movie is bundled. */

  for (let i = 0; i < PLANETS.length; i++) {
    const p = PLANETS[i];
    const geo = new THREE.SphereGeometry(p.r, 64, 64);
    const col = new THREE.Color(p.color || 0xffffff);
    const em = new THREE.Color(p.emissive || p.color || 0xffffff);
    let mat;
    if (p.kind === 'music' || p.kind === 'child' || p.kind === 'ours') {
      
      mat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.28,
        metalness: 0.08,
        emissive: em,
        emissiveIntensity: 1.35
      });
    } else {
      const tex = p.file ? await loadTex(p.file) : null;
      mat = new THREE.MeshStandardMaterial({
        map: tex || undefined,
        color: tex ? 0xffffff : 0x8899aa,
        roughness: 0.72,
        metalness: 0.08,
        emissive: new THREE.Color(0x000000)
      });
    }
    const mesh = new THREE.Mesh(geo, mat);
    
    const ang = (i / PLANETS.length) * Math.PI * 2 + 0.35;
    mesh.position.set(Math.cos(ang) * p.d, 0, Math.sin(ang) * p.d);
    mesh.userData.planet = p;
    
    mesh.userData.orbit = {
      d: p.d,
      ang: ang,
      speed: 0.22 / Math.sqrt(p.d),
      y: 0
    };
    scene.add(mesh);
    planetMeshes.push(mesh);

    
    const orbitPath = new THREE.Mesh(
      new THREE.RingGeometry(p.d - 0.07, p.d + 0.07, 160),
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    orbitPath.rotation.x = -Math.PI / 2;
    orbitPath.userData.isOrbit = true;
    scene.add(orbitPath);

    
    if (p.kind === 'music' || p.kind === 'child' || p.kind === 'ours') {
      const aura = new THREE.Mesh(
        new THREE.SphereGeometry(p.r * 1.38, 28, 28),
        new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          depthWrite: false
        })
      );
      mesh.add(aura);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(p.r * 1.7, 20, 20),
        new THREE.MeshBasicMaterial({
          color: em,
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          depthWrite: false
        })
      );
      mesh.add(halo);
    }

    if (p.rings === 'saturn') {
      
      const beltCols = [0xf5e6c8, 0xd4a574, 0xffe8a3, 0xc4a882];
      const belts = [
        [1.35, 1.55],
        [1.62, 1.95],
        [2.05, 2.45],
        [2.55, 2.85]
      ];
      for (let b = 0; b < belts.length; b++) {
        const belt = new THREE.Mesh(
          new THREE.RingGeometry(p.r * belts[b][0], p.r * belts[b][1], 128),
          new THREE.MeshBasicMaterial({
            color: beltCols[b],
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.55 - b * 0.06,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        belt.rotation.x = Math.PI / 2.15;
        mesh.add(belt);
      }
    } else if (p.name === 'Family' || p.name === 'Books' || p.name === 'Games' || p.name === 'Sea' || p.name === 'Cosmos' || p.name === 'Movies' || p.kind === 'legacy-jokes' || p.name === 'Food' || p.name === 'Drawing' || p.name === 'Singing') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(p.r * 1.35, p.r * 2.15, 96),
        new THREE.MeshBasicMaterial({
          color: col,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2.3;
      mesh.add(ring);
    }

    if (p.kind === 'music') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(p.r * 1.25, p.r * 2.05, 96),
        new THREE.MeshBasicMaterial({
          color: 0xf0abfc,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2.15;
      mesh.add(ring);
      const ring2 = new THREE.Mesh(
        new THREE.RingGeometry(p.r * 2.15, p.r * 2.55, 96),
        new THREE.MeshBasicMaterial({
          color: 0xe879f9,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring2.rotation.x = Math.PI / 2.4;
      mesh.add(ring2);
    }

    if (p.kind === 'child') {
      const softRing = new THREE.Mesh(
        new THREE.RingGeometry(p.r * 1.55, p.r * 1.95, 64),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      softRing.rotation.x = Math.PI / 2.25;
      mesh.add(softRing);
    }

    
    if (p.moons && p.moons.length) {
      mesh.userData.moonMeshes = [];
      for (let mi = 0; mi < p.moons.length; mi++) {
        const moon = p.moons[mi];
        const mCol = new THREE.Color(moon.color || 0xffffff);
        const mEm = new THREE.Color(moon.emissive || moon.color || 0xffffff);
        const moonMesh = new THREE.Mesh(
          new THREE.SphereGeometry(moon.r, 24, 24),
          new THREE.MeshStandardMaterial({
            color: mCol,
            roughness: 0.32,
            metalness: 0.06,
            emissive: mEm,
            emissiveIntensity: 1.15
          })
        );
        const mang = (mi / p.moons.length) * Math.PI * 2;
        moonMesh.position.set(Math.cos(mang) * moon.d, 0, Math.sin(mang) * moon.d);
        moonMesh.userData.moon = moon;
        moonMesh.userData.parentPlanet = p.name;
        moonMesh.userData.moonOrbit = {
          d: moon.d,
          ang: mang,
          speed: 0.55 + mi * 0.12
        };
        const mAura = new THREE.Mesh(
          new THREE.SphereGeometry(moon.r * 1.45, 16, 16),
          new THREE.MeshBasicMaterial({
            color: mCol,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            depthWrite: false
          })
        );
        moonMesh.add(mAura);
        if (moon.rings === 'saturn') {
          const beltCols = [0xf5e6c8, 0xd4a574, 0xffe8a3, 0xc4a882];
          const belts = [
            [1.35, 1.55],
            [1.62, 1.95],
            [2.05, 2.45],
            [2.55, 2.85]
          ];
          for (let b = 0; b < belts.length; b++) {
            const belt = new THREE.Mesh(
              new THREE.RingGeometry(moon.r * belts[b][0], moon.r * belts[b][1], 96),
              new THREE.MeshBasicMaterial({
                color: beltCols[b],
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.55 - b * 0.06,
                blending: THREE.AdditiveBlending,
                depthWrite: false
              })
            );
            belt.rotation.x = Math.PI / 2.15;
            moonMesh.add(belt);
          }
        }
        
        const mPath = new THREE.Mesh(
          new THREE.RingGeometry(moon.d - 0.025, moon.d + 0.025, 64),
          new THREE.MeshBasicMaterial({
            color: mCol,
            transparent: true,
            opacity: 0.28,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
          })
        );
        mPath.rotation.x = -Math.PI / 2;
        mesh.add(mPath);
        mesh.add(moonMesh);
        mesh.userData.moonMeshes.push(moonMesh);
      }
    }
  }

  buildMemoryConstellations();

  
  for (let i = 0; i < planetMeshes.length; i++) {
    const m = planetMeshes[i];
    if (m.userData.planet && visitedPlanets.has(m.userData.planet.id)) {
      markPlanetVisited(m);
      discovered.add('planet|' + m.userData.planet.id);
    }
  }
  updateDiscoverCount();
}

function recycleFarStars() {
  
}

function onPointer(e) {
  if (!active) return;
  if (portraitLite && !portraitLite.hidden) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  pointer.x = x * 2 - 1;
  pointer.y = -(y * 2 - 1);
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(memoryStars.concat(planetMeshes), true);
  if (!hits.length) return;

  let obj = hits[0].object;
  while (obj && !obj.userData.planet && !obj.userData.story && !obj.userData.moon) {
    obj = obj.parent;
  }
  if (!obj) return;
  controls.autoRotate = false;

  if (obj.userData.moon) {
    const moon = obj.userData.moon;
    const key = 'moon|' + (moon.id||moon.name);
    const first = !discovered.has(key);
    if (first) {
      discovered.add(key);
      updateDiscoverCount();
    }
    obj.userData.bounce = 1;
    obj.userData.bounceAmp = 0.35;
    spawnWorldBurst(new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld), moon.color || 0xf472b6, first ? 16 : 8);
    screenFxAt(e.clientX, e.clientY, first ? null : 'visited');
    openPanel({
      title: moon.name,
      when: (obj.userData.parentPlanet || 'Planet') + ' · moon',
      body: moon.note,
      done: true,
      planet: true,
      visited: true,
      audio: moon.audio || null
    });
    return;
  }

  if (obj.userData.planet) {
    const p = obj.userData.planet;
    celebratePlanet(obj, e.clientX, e.clientY);
    const inHeart = visitedPlanets.has(p.id);
    if (p.kind === 'music') {
      openPanel({
        title: 'Planet of Music',
        when: 'Jam · ours',
        body: p.note,
        done: true,
        music: true,
        planet: true,
        visited: inHeart,
        audio: p.audio || null, portraits:p.portraits||null
      });
    } else if (p.kind === 'child') {
      openPanel({
        title: p.name,
        when: 'Someday · our children',
        body: p.note,
        done: false,
        planet: true,
        child: true,
        visited: inHeart,
        portraits: p.portraits || null
      });
    } else if (p.kind === 'legacy-jokes') {
      openPanel({
        title: p.name,
        when: 'Our private language',
        body: p.note,
        done: true,
        planet: true,
        visited: inHeart
      });
    } else {
      openPanel({
        title: p.name,
        when: p.when || 'Things we love',
        body: p.note,
        done: true,
        planet: true,
        visited: inHeart,
        audio: p.audio || null, portraits:p.portraits||null
      });
    }
    return;
  }

  if (obj.userData.story) {
    clearPlanetFollow();
    const story = obj.userData.story;
    openPanel(story);
    const key = obj.userData.id;
    const first = !discovered.has(key);
    if (first) {
      discovered.add(key);
      updateDiscoverCount();
      try { sessionStorage.setItem(window.GIFT_KEY+'cosmosVisited_v1', '1'); } catch (err) {}
    }
    gildMesh(obj, false);
    onConstellationStarFound(obj, false);
    obj.userData.bounce = 1;
    obj.userData.bounceAmp = 0.45;
    spawnWorldBurst(obj.position.clone(), 0xf5c542, first ? 18 : 10);
    screenFxAt(e.clientX, e.clientY, 'visited');
  }
}

canvas.addEventListener('pointerdown', function () {
  
});
canvas.addEventListener('click', onPointer);
controls.addEventListener('start', function () { controls.autoRotate = false; });

window.addEventListener('resize', function () {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
let recycleTimer = 0;

let animationFrame = 0;
function animate() {
  animationFrame = requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  sunGroup.rotation.y += dt * 0.04;
  if (sunMesh && sunMesh.userData.billboard) {
    sunMesh.quaternion.copy(camera.quaternion);
  }
  if (sunVideo) {
    if (sunVideo.paused) { /* no autoplay source */ }
    if (sunVideoTex) sunVideoTex.needsUpdate = true;
    if (!sunLive && sunVideo.readyState >= 2) applySunVideoMap();
  }

  if (camTween.active) {
    camTween.t += dt;
    const k = Math.min(1, camTween.t / camTween.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    camera.position.lerpVectors(camTween.from, camTween.to, e);
    controls.target.lerpVectors(camTween.lookFrom, camTween.lookTo, e);
    if (k >= 1) camTween.active = false;
  }

  for (let i = 0; i < planetMeshes.length; i++) {
    const m = planetMeshes[i];
    const p = m.userData.planet;
    let spin = 0.35;
    if (m.userData.clickSpin) {
      spin += m.userData.clickSpin;
      m.userData.clickSpin *= Math.pow(0.92, dt * 60);
      if (m.userData.clickSpin < 0.02) m.userData.clickSpin = 0;
    }
    const o = m.userData.orbit;
    if (o) {
      o.ang += o.speed * dt;
      m.position.x = Math.cos(o.ang) * o.d;
      m.position.z = Math.sin(o.ang) * o.d;
      m.position.y = o.y || 0;
    }
    m.rotation.y += dt * spin;

    
    if (m.userData.moonMeshes) {
      for (let mi = 0; mi < m.userData.moonMeshes.length; mi++) {
        const moonMesh = m.userData.moonMeshes[mi];
        const mo = moonMesh.userData.moonOrbit;
        if (!mo) continue;
        mo.ang += mo.speed * dt;
        moonMesh.position.x = Math.cos(mo.ang) * mo.d;
        moonMesh.position.z = Math.sin(mo.ang) * mo.d;
        moonMesh.position.y = Math.sin(mo.ang * 2) * 0.08;
        moonMesh.rotation.y += dt * 0.8;
        let mScale = 1;
        if (moonMesh.userData.bounce) {
          moonMesh.userData.bounce = Math.max(0, moonMesh.userData.bounce - dt * 1.8);
          mScale = 1 + Math.sin((1 - moonMesh.userData.bounce) * Math.PI) * (moonMesh.userData.bounceAmp || 0.35);
        }
        moonMesh.scale.setScalar(mScale);
      }
    }

    let scale = 1;
    if (m.userData.bounce) {
      m.userData.bounce = Math.max(0, m.userData.bounce - dt * 1.6);
      scale = 1 + Math.sin((1 - m.userData.bounce) * Math.PI) * (m.userData.bounceAmp || 0.25);
    }
    m.scale.setScalar(scale);

    if (m.userData.halo) {
      m.userData.halo.rotation.z += dt * (m.userData.halo.userData.haloSpin || 0.6);
      m.userData.halo.material.opacity = 0.55 + Math.sin(t * 3 + i) * 0.2;
    }

    if (m.userData.blinkLight && m.material && m.material.emissive) {
      const phase = (m.userData.blinkPhase || 0) + t * 3.2;
      
      const wave = Math.pow(0.5 + 0.5 * Math.sin(phase), 3);
      const flash = wave > 0.72 ? 1 : wave;
      const base = m.userData.baseEmissiveIntensity || 1.2;
      m.material.emissiveIntensity = base * (0.55 + flash * 1.6);
      if (m.userData.blinkLamp) {
        m.userData.blinkLamp.intensity = 4 + flash * 28;
      }
      
      m.children.forEach(function (ch) {
        if (ch.isLight) return;
        if (ch.material && typeof ch.material.opacity === 'number' && ch.material.opacity <= 0.45) {
          if (ch.userData.baseOpacity == null) ch.userData.baseOpacity = ch.material.opacity;
          ch.material.opacity = ch.userData.baseOpacity * (0.7 + flash * 1.1);
        }
      });
    } else if (m.userData.pulseEmissive && m.material && m.material.emissive) {
      m.userData.pulseEmissive = Math.max(0, m.userData.pulseEmissive - dt * 1.4);
      const pulse = m.userData.pulseEmissive;
      const base = m.userData.baseEmissive || new THREE.Color(0x000000);
      m.material.emissive.copy(base).lerp(new THREE.Color(0xfff1c1), pulse);
      m.material.emissiveIntensity = (m.userData.baseEmissiveIntensity || 0) + pulse * 1.8;
    }
  }

  if (!camTween.active && planetFollow.active && planetFollow.mesh) {
    planetFollow.mesh.getWorldPosition(_followPos);
    const curLen = planetFollow.offset.length();
    if (curLen > 0.001) {
      const nextLen = curLen + (planetFollow.preferredDist - curLen) * (1 - Math.exp(-dt * 2.4));
      planetFollow.offset.multiplyScalar(nextLen / curLen);
    }
    camera.position.copy(_followPos).add(planetFollow.offset);
    controls.target.copy(_followPos);
  }

  tickConstellationDraw(dt);

  for (let i = 0; i < memoryStars.length; i++) {
    const m = memoryStars[i];
    let base = (m.userData.story && m.userData.story.done ? 1.15 : 1);
    if (m.userData.bounce) {
      m.userData.bounce = Math.max(0, m.userData.bounce - dt * 2);
      base *= 1 + Math.sin((1 - m.userData.bounce) * Math.PI) * (m.userData.bounceAmp || 0.4);
    }
    const pulse = 1 + Math.sin(t * 2 + i) * 0.08;
    m.scale.setScalar(base * pulse);
    if (m.userData.qMark) {
      m.userData.qMark.position.y = 0.55 + Math.sin(t * 2.4 + i) * 0.08;
      const qs = 0.75 + Math.sin(t * 3 + i) * 0.12;
      m.userData.qMark.scale.set(qs, qs, 1);
      m.userData.qMark.material.opacity = 0.75 + Math.sin(t * 2.2 + i) * 0.2;
    }
  }

  for (let i = fxBurst.length - 1; i >= 0; i--) {
    const f = fxBurst[i];
    f.userData.age += dt;
    const life = f.userData.life || 0.8;
    const k = f.userData.age / life;
    if (f.userData.shock) {
      const s = 1 + k * (f.userData.grow || 8);
      f.scale.set(s, s, s);
      f.lookAt(camera.position);
      f.material.opacity = Math.max(0, 0.85 * (1 - k));
    } else if (f.userData.vel) {
      f.position.addScaledVector(f.userData.vel, dt);
      f.userData.vel.multiplyScalar(Math.pow(0.96, dt * 60));
      f.material.opacity = Math.max(0, 1 - k);
      f.scale.setScalar(1 + k * 0.8);
    }
    if (k >= 1) {
      scene.remove(f);
      if (f.geometry) f.geometry.dispose();
      if (f.material) f.material.dispose();
      fxBurst.splice(i, 1);
    }
  }

  recycleTimer += dt;
  if (recycleTimer > 2.5) {
    recycleTimer = 0;
    recycleFarStars();
  }

  controls.update();
  if (planetFollow.active && planetFollow.mesh && !camTween.active) {
    planetFollow.mesh.getWorldPosition(_followPos);
    planetFollow.offset.copy(camera.position).sub(_followPos);
  }
  renderer.render(scene, camera);
}

function enterSky() {
  document.body.classList.remove('pre-sky');
  intro.classList.add('out');
  active = true;
  /* Procedural sun; no source movie is bundled. */
  playSkyMusic();
  setTimeout(function () {
    /* Procedural sun; no source movie is bundled. */
    applySunVideoMap();
  }, 50);
  setTimeout(function () {
    /* Procedural sun; no source movie is bundled. */
    applySunVideoMap();
  }, 400);
  setTimeout(function () { intro.hidden = true; }, 800);
  try { sessionStorage.setItem(window.GIFT_KEY+'cosmosVisited_v1', '1'); } catch (e) {}
  try { sessionStorage.setItem(window.GIFT_KEY+'cosmosOpen_v1', '1'); } catch (e) {}
}

function returnToCenter() {
  clearPlanetFollow();
  camTween.from.copy(camera.position);
  camTween.lookFrom.copy(controls.target);
  camTween.to.set(0, 28, 55);
  camTween.lookTo.set(0, 0, 0);
  camTween.t = 0;
  camTween.dur = 1.15;
  camTween.active = true;
  controls.autoRotate = false;
  /* Procedural sun; no source movie is bundled. */
}

function styleStarUndiscovered(mesh) {
  if (!mesh || !mesh.material) return;
  mesh.userData.discoveredStar = false;
  mesh.userData.gilded = false;
  mesh.userData.pulse = 0;
  mesh.material.color.setHex(0xf5f5f7);
  mesh.material.emissive.setHex(0x000000);
  mesh.material.emissiveIntensity = 0;
  mesh.material.roughness = 0.55;
  mesh.userData.baseEmissiveIntensity = 0;
  mesh.scale.setScalar(0.85);
  if (mesh.userData.goldGlow) {
    mesh.remove(mesh.userData.goldGlow);
    mesh.userData.goldGlow.geometry.dispose();
    mesh.userData.goldGlow.material.dispose();
    mesh.userData.goldGlow = null;
  }
  if (mesh.userData.goldHalo) {
    mesh.remove(mesh.userData.goldHalo);
    mesh.userData.goldHalo.geometry.dispose();
    mesh.userData.goldHalo.material.dispose();
    mesh.userData.goldHalo = null;
  }
}

function resetDiscoveryProgress() {
  if (!window.confirm('Reset all discovery progress? Stars, planets, and constellation lines will clear.')) {
    return;
  }

  discovered.clear();
  visitedPlanets.clear();
  try {
    sessionStorage.removeItem(window.GIFT_KEY+'cosmosPlanets_v1');
  } catch (e) {}

  
  for (let s = 0; s < shapeWorld.length; s++) {
    const sh = shapeWorld[s];
    for (let e = 0; e < sh.edges.length; e++) {
      sh.edges[e].draw = 0;
      sh.edges[e].target = 0;
    }
    if (sh.sunLink) {
      sh.sunLink.progress = 0;
      sh.sunLink.target = 0;
      sh.sunLink.celebrated = false;
      sh.sunLink.arrived = false;
    }
    for (let i = 0; i < sh.stars.length; i++) {
      styleStarUndiscovered(sh.stars[i]);
      if(sh.stars[i].userData.decorative)sh.stars[i].userData.discoveredStar=true;
    }
  }
  updateConstellationGeometry();
  updateRedStringGeometry();

  
  for (let i = 0; i < planetMeshes.length; i++) {
    const m = planetMeshes[i];
    m.userData.visitedMark = false;
    m.userData.blinkLight = false;
    m.userData.clickSpin = 0;
    m.userData.bounce = 0;
    m.userData.pulseEmissive = 0;
    if (m.userData.blinkLamp) {
      m.remove(m.userData.blinkLamp);
      m.userData.blinkLamp = null;
    }
    const p = m.userData.planet;
    if (p && m.material) {
      if (m.material.color && p.color != null) m.material.color.setHex(p.color);
      if (m.material.emissive) {
        m.material.emissive.setHex(p.emissive || p.color || 0xffffff);
        m.material.emissiveIntensity = 1.35;
      }
      m.userData.baseEmissive = m.material.emissive ? m.material.emissive.clone() : null;
      m.userData.baseEmissiveIntensity = 1.35;
    }
    m.children.forEach(function (ch) {
      if (ch.userData && ch.userData.baseOpacity != null && ch.material) {
        ch.material.opacity = ch.userData.baseOpacity;
      }
    });
  }

  if (panel) panel.hidden = true;
  if (hint) hint.classList.remove('dim');
  updateDiscoverCount();
}

const homeBtn = document.getElementById('skyHome');
if (homeBtn) homeBtn.addEventListener('click', returnToCenter);

const resetBtn = document.getElementById('skyReset');
if (resetBtn) resetBtn.addEventListener('click', resetDiscoveryProgress);

enter.addEventListener('click', enterSky);

buildWorld().then(function () {
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) controls.autoRotate=false;
  animate();
  try {
    if (sessionStorage.getItem(window.GIFT_KEY+'cosmosOpen_v1') === '1') enterSky();
  } catch (e) {}
});

window.addEventListener('pagehide',function(){cancelAnimationFrame(animationFrame);controls.dispose();scene.traverse(function(object){if(object.geometry)object.geometry.dispose();const mats=Array.isArray(object.material)?object.material:[object.material];mats.filter(Boolean).forEach(function(material){Object.values(material).forEach(function(value){if(value&&value.isTexture)value.dispose();});material.dispose();});});renderer.dispose();renderer.forceContextLoss();});
})();
