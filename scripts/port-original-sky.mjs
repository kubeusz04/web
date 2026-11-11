// One-time source migration. Copies only renderer code, never original content or media.
import fs from 'node:fs';
let code=fs.readFileSync('../assets/js/cosmos.js','utf8');
const start=code.indexOf('const PLANETS = [');const end=code.indexOf('const DREAM_FILL =',start);
if(start<0||end<0)throw new Error('Original renderer markers changed.');
code=code.slice(0,start)+'const PLANETS = window.GIFT_PLANETS || [];\n'+code.slice(end);
code=code.replace(/\/\*[\s\S]*?\*\//g,'');
const texStart=code.indexOf('function loadTex(file) {'),texEnd=code.indexOf('function makeStarField',texStart);
code=code.slice(0,texStart)+'function loadTex() { return Promise.resolve(null); }\n'+code.slice(texEnd);
code=code.replace("const TEX = 'media/cosmos/';","const TEX = ''; ");
code=code.replace('const sunVidTex = await loadSunVideo();','const sunVidTex = null;');
code=code.replace('  playSunVideo();','  /* No unlicensed sun movie. Use the original procedural fallback. */');
code=code.replace('    if (sunVideo.paused) playSunVideo();','    if (sunVideo.paused) { /* no autoplay source */ }');
code=code.replaceAll('playSunVideo();','/* Procedural sun; no source movie is bundled. */');
const layoutStart=code.indexOf('const SHAPE_LAYOUTS = ['),layoutEnd=code.indexOf('const shapeWorld =',layoutStart);
if(layoutStart<0||layoutEnd<0)throw new Error('Constellation markers changed.');
// Keep the original hearts/cats and their positions. Bind customer memories
// evenly to those nodes; unused nodes are decorative, never duplicate stories.
code=code.slice(0,layoutEnd)+`const MEMORY_SLOTS = SHAPE_LAYOUTS.reduce((sum,shape)=>sum+(shape.n||shape.pts.length),0);\nlet memorySlot = 0;\n`+code.slice(layoutEnd);
code=code.replace('  memoryStars.length = 0;', '  memoryStars.length = 0; memorySlot = 0;');
code=code.replace('      memoryStars.push(mesh);', `      const bound = Math.floor((memorySlot+1)*catalog.length/MEMORY_SLOTS)>Math.floor(memorySlot*catalog.length/MEMORY_SLOTS);\n      memorySlot++;\n      mesh.userData.decorative = !bound;\n      if(bound) memoryStars.push(mesh); else mesh.userData.discoveredStar = true;`);
code=code.replace('      styleStarUndiscovered(sh.stars[i]);','      styleStarUndiscovered(sh.stars[i]);\n      if(sh.stars[i].userData.decorative)sh.stars[i].userData.discoveredStar=true;');
// All story-specific strings come from the validated document. No browser-global shared progress.
for(const name of ['cosmosPlanets_v1','cosmosVisited_v1','cosmosOpen_v1'])code=code.replaceAll("'"+name+"'","window.GIFT_KEY+'"+name+"'");
code=code.replace('      kind: \'memory\'','      kind: \'memory\', portraits:s.portraits||null, audio:s.audio||null');
code=code.replace('      title: s.name,','      id:s.id, title: s.name,');
code=code.replace("const key = (item.title || '').toLowerCase().replace(/\\s+/g, ' ').trim();","const key = item.id || (item.title || '').toLowerCase().replace(/\\s+/g, ' ').trim();");
code=code.replace("when: 'Things we love'","when: p.when || 'Things we love'");
code=code.replaceAll('audio: p.audio || null','audio: p.audio || null, portraits:p.portraits||null');
code=code.replaceAll("p.name === 'Inside jokes'", "p.kind === 'legacy-jokes'");
code=code.replaceAll('return p.name;','return p.id;').replaceAll('visitedPlanets.has(p.name)','visitedPlanets.has(p.id)').replaceAll('visitedPlanets.add(p.name)','visitedPlanets.add(p.id)').replaceAll("'planet|' + p.name","'planet|' + p.id").replaceAll('visitedPlanets.has(m.userData.planet.name)','visitedPlanets.has(m.userData.planet.id)').replaceAll("'planet|' + m.userData.planet.name","'planet|' + m.userData.planet.id").replaceAll("'moon|' + moon.name","'moon|' + (moon.id||moon.name)");
code=code.replace("mesh.userData.id = story.title + '|' + catalogCursor;", "mesh.userData.id = story.id;");
code=code.replace('let active = false;',`window.OPEN_GIFT_MEMORY = function(story){
  const planet=planetMeshes.find(mesh=>mesh.userData.planet&&mesh.userData.planet.id===story.id);
  if(planet)celebratePlanet(planet,innerWidth/2,innerHeight/2);
  const star=memoryStars.find(mesh=>mesh.userData.story&&mesh.userData.story.id===story.id);
  if(star){clearPlanetFollow();discovered.add(star.userData.id);gildMesh(star,false);onConstellationStarFound(star,false);updateDiscoverCount();}
  openPanel(story);
};\nlet active = false;`);
code=code.replace('  requestAnimationFrame(animate);','  animationFrame = requestAnimationFrame(animate);');
code=code.replace('function animate() {','let animationFrame = 0;\nfunction animate() {');
code=code.replace('  animate();',`  if(matchMedia('(prefers-reduced-motion: reduce)').matches) controls.autoRotate=false;\n  animate();`);
const close=code.lastIndexOf('})();');
code=code.slice(0,close)+`window.addEventListener('pagehide',function(){cancelAnimationFrame(animationFrame);controls.dispose();scene.traverse(function(object){if(object.geometry)object.geometry.dispose();const mats=Array.isArray(object.material)?object.material:[object.material];mats.filter(Boolean).forEach(function(material){Object.values(material).forEach(function(value){if(value&&value.isTexture)value.dispose();});material.dispose();});});renderer.dispose();renderer.forceContextLoss();});\n`+code.slice(close);
fs.writeFileSync('public/original/cosmos-engine.js',code);
for(const file of ['three.min.js','OrbitControls.js'])fs.copyFileSync('../assets/vendor/three/'+file,'public/original/'+file);
console.log('Original procedural sky renderer migrated; source content and media excluded.');
