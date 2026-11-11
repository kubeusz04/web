"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { X } from "lucide-react";
import type { GiftSection, GiftItem } from "@/lib/schema";
import { ItemMedia } from "./experience";
export default function Cosmos({
  section,
  demo,
}: {
  section: GiftSection;
  demo: boolean;
}) {
  const mount = useRef<HTMLDivElement>(null),
    [selected, setSelected] = useState<GiftItem | null>(null),
    [failed, setFailed] = useState(false);
  const items = section.items.filter((i) => !i.hidden);
  useEffect(() => {
    if (!mount.current) return;
    const container = mount.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 5, 16);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    container.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 6;
    controls.maxDistance = 30;
    controls.enablePan = false;
    const geometries: THREE.BufferGeometry[] = [],
      materials: THREE.Material[] = [];
    const starGeo = new THREE.BufferGeometry(),
      positions = new Float32Array(900 * 3);
    for (let i = 0; i < positions.length; i++)
      positions[i] = Math.sin(i * 127.1 + 3.17) * 45;
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xc8d4ed, size: 0.045 });
    scene.add(new THREE.Points(starGeo, starMat));
    geometries.push(starGeo);
    materials.push(starMat);
    scene.add(new THREE.AmbientLight(0x9cafe3, 2));
    const light = new THREE.PointLight(0xffd9b1, 50);
    light.position.set(3, 4, 6);
    scene.add(light);
    const meshes: THREE.Mesh[] = [];
    items.forEach((item, i) => {
      const geo = new THREE.SphereGeometry(
          item.kind === "planet" ? 0.5 : 0.2,
          32,
          24,
        ),
        mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL((i * 0.19 + 0.06) % 1, 0.5, 0.65),
          emissive: item.kind === "star" ? 0xb88553 : 0x182239,
          emissiveIntensity: item.kind === "star" ? 1 : 0.3,
          roughness: 0.7,
        });
      const mesh = new THREE.Mesh(geo, mat),
        angle = (i / Math.max(items.length, 1)) * Math.PI * 2,
        radius = 2.8 + Math.floor(i / 9) * 1.2;
      mesh.position.set(
        Math.cos(angle) * radius,
        Math.sin(i * 2) * 1.1,
        Math.sin(angle) * radius,
      );
      mesh.userData.item = item;
      scene.add(mesh);
      meshes.push(mesh);
      geometries.push(geo);
      materials.push(mat);
      if (item.kind === "planet") {
        const ringGeo = new THREE.RingGeometry(0.65, 0.85, 64),
          ringMat = new THREE.MeshBasicMaterial({
            color: 0xeac8a4,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.45,
          });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = 1.1;
        mesh.add(ring);
        geometries.push(ringGeo);
        materials.push(ringMat);
      }
    });
    const observer = new ResizeObserver(() => {
      const w = container.clientWidth,
        h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    observer.observe(container);
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    const click = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const [hit] = ray.intersectObjects(meshes, false);
      if (hit) setSelected(hit.object.userData.item);
    };
    renderer.domElement.addEventListener("click", click);
    let frame = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function draw() {
      frame = requestAnimationFrame(draw);
      controls.update();
      if (!reduced)
        meshes.forEach((m) => {
          m.rotation.y += 0.002;
        });
      renderer.render(scene, camera);
    }
    draw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("click", click);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [section]);
  return (
    <div className="cosmos-view">
      <div className="cosmos-heading">
        <span>Your little constellations</span>
        <h2>{section.title}</h2>
        <p>Turn the sky. Choose a star. Return to a moment.</p>
      </div>
      {failed ? (
        <p className="cosmos-fallback">
          WebGL is unavailable. Open every memory using the list below.
        </p>
      ) : (
        <div ref={mount} className="cosmos-canvas" aria-hidden="true" />
      )}
      <div className="constellation-list" aria-label="Cosmos memories">
        {items.map((item) => (
          <button key={item.id} onClick={() => setSelected(item)}>
            <span>{item.kind === "planet" ? "◉" : "✦"}</span>
            {item.title}
          </button>
        ))}
      </div>
      {selected ? (
        <div
          className="cosmos-memory"
          role="dialog"
          aria-modal="false"
          aria-label={selected.title}
        >
          <button
            className="icon-button"
            aria-label="Close memory"
            onClick={() => setSelected(null)}
          >
            <X size={20} />
          </button>
          <small>
            {selected.date} · {selected.category}
          </small>
          <h3>{selected.title}</h3>
          <p>{selected.body}</p>
          {selected.mediaId ? <ItemMedia item={selected} demo={demo} /> : null}
        </div>
      ) : null}
    </div>
  );
}
