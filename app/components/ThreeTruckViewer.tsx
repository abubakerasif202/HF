"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface Hotspot {
  id: string;
  title: string;
  desc: string;
  position: [number, number, number];
}

const HOTSPOTS: Hotspot[] = [
  {
    id: "cargo",
    title: "Secure Cargo Bay (25–60m³)",
    desc: "Equipped with internal tie-down rails, ratchet straps, and complimentary quilted moving blankets.",
    position: [0, 1.4, -0.4],
  },
  {
    id: "tailgate",
    title: "Hydraulic Tailgate Lift",
    desc: "Safe loading for heavy appliances, double fridges, marble tables, and upright pianos.",
    position: [0, 0.4, -2.4],
  },
  {
    id: "cab",
    title: "Adelaide Direct GPS Dispatch",
    desc: "Full transit tracking for local Adelaide metro routes and direct interstate departures.",
    position: [0, 1.2, 1.9],
  },
  {
    id: "protection",
    title: "$1M Transit Insurance",
    desc: "Every load is fully covered under verified commercial transit and public liability insurance.",
    position: [1.2, 1.3, -0.5],
  },
];

const TRUCK_MODES = [
  { id: "medium", name: "25–35m³ Truck", capacity: "1–2 Bedroom / Apartment", scaleZ: 0.85, price: "From $74/30m" },
  { id: "large", name: "40–50m³ Pantech", capacity: "3–4 Bedroom Family Home", scaleZ: 1.15, price: "From $89/30m" },
  { id: "interstate", name: "60+m³ Interstate", capacity: "5+ Bed / Interstate Relocation", scaleZ: 1.45, price: "From $135/m³" },
];

export function ThreeTruckViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<string>("large");
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(HOTSPOTS[0]);
  const [isRotating, setIsRotating] = useState(true);
  const [webglSupported, setWebglSupported] = useState(true);
  const [loading, setLoading] = useState(true);

  const truckGroupRef = useRef<THREE.Group | null>(null);
  const cargoMeshRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // WebGL support check
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
      if (!gl) {
        setWebglSupported(false);
        setLoading(false);
        return;
      }
    } catch {
      setWebglSupported(false);
      setLoading(false);
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(4.8, 3.2, 5.2);
    camera.lookAt(0, 0.8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xfff7e6, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff0d0, 2.8);
    dirLight.position.set(6, 10, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x10b981, 1.2);
    fillLight.position.set(-6, 4, -4);
    scene.add(fillLight);

    const goldRimLight = new THREE.PointLight(0xdfb75c, 2.5, 12);
    goldRimLight.position.set(0, 2.5, -3.5);
    scene.add(goldRimLight);

    // Floor Reflection & Shadow Plane
    const floorGeo = new THREE.PlaneGeometry(16, 16);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor Grid Ring
    const gridHelper = new THREE.GridHelper(10, 20, 0xdfb75c, 0x0b3525);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Build Procedural 3D HF Moving Truck
    const truckGroup = new THREE.Group();
    truckGroupRef.current = truckGroup;

    // Materials
    const emeraldCabMat = new THREE.MeshStandardMaterial({
      color: 0x06271d,
      roughness: 0.25,
      metalness: 0.6,
    });

    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xdfb75c,
      roughness: 0.2,
      metalness: 0.85,
    });

    const cargoMat = new THREE.MeshStandardMaterial({
      color: 0x093828,
      roughness: 0.35,
      metalness: 0.4,
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x11221b,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.75,
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.8,
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xdfb75c,
      metalness: 0.9,
      roughness: 0.15,
    });

    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.6,
    });

    // 1. Chassis
    const chassisGeo = new THREE.BoxGeometry(1.9, 0.25, 5.0);
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.set(0, 0.45, 0);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    truckGroup.add(chassis);

    // 2. Cab (Driver section)
    const cabGeo = new THREE.BoxGeometry(1.85, 1.4, 1.4);
    const cab = new THREE.Mesh(cabGeo, emeraldCabMat);
    cab.position.set(0, 1.25, 1.7);
    cab.castShadow = true;
    cab.receiveShadow = true;
    truckGroup.add(cab);

    // Windshield & Side Windows
    const windshieldGeo = new THREE.BoxGeometry(1.7, 0.6, 0.1);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, 1.45, 2.41);
    truckGroup.add(windshield);

    const sideWindowGeo = new THREE.BoxGeometry(0.1, 0.55, 0.8);
    const leftWindow = new THREE.Mesh(sideWindowGeo, glassMat);
    leftWindow.position.set(-0.93, 1.45, 1.8);
    const rightWindow = leftWindow.clone();
    rightWindow.position.set(0.93, 1.45, 1.8);
    truckGroup.add(leftWindow, rightWindow);

    // Front Bumper & Gold Grille
    const bumperGeo = new THREE.BoxGeometry(1.9, 0.35, 0.3);
    const bumper = new THREE.Mesh(bumperGeo, goldTrimMat);
    bumper.position.set(0, 0.45, 2.45);
    bumper.castShadow = true;
    truckGroup.add(bumper);

    // Headlights (LED glow)
    const lightGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    const leftLight = new THREE.Mesh(lightGeo, lightMat);
    leftLight.rotation.x = Math.PI / 2;
    leftLight.position.set(-0.65, 0.6, 2.42);
    const rightLight = leftLight.clone();
    rightLight.position.set(0.65, 0.6, 2.42);
    truckGroup.add(leftLight, rightLight);

    // 3. Cargo Container Box
    const cargoGeo = new THREE.BoxGeometry(2.05, 1.9, 3.2);
    const cargoMesh = new THREE.Mesh(cargoGeo, cargoMat);
    cargoMesh.position.set(0, 1.55, -0.6);
    cargoMesh.castShadow = true;
    cargoMesh.receiveShadow = true;
    cargoMeshRef.current = cargoMesh;
    truckGroup.add(cargoMesh);

    // Gold Top Rails & Livery Stripes
    const railGeo = new THREE.BoxGeometry(2.1, 0.08, 3.25);
    const topRail = new THREE.Mesh(railGeo, goldTrimMat);
    topRail.position.set(0, 2.52, -0.6);
    truckGroup.add(topRail);

    const stripeGeo = new THREE.BoxGeometry(2.07, 0.18, 3.22);
    const stripe = new THREE.Mesh(stripeGeo, goldTrimMat);
    stripe.position.set(0, 1.55, -0.6);
    truckGroup.add(stripe);

    // 4. Hydraulic Tailgate (Back)
    const tailgateGeo = new THREE.BoxGeometry(1.9, 1.7, 0.12);
    const tailgate = new THREE.Mesh(tailgateGeo, goldTrimMat);
    tailgate.position.set(0, 1.45, -2.25);
    tailgate.castShadow = true;
    truckGroup.add(tailgate);

    // 5. Wheels (6-wheel heavy axle setup)
    const wheelPositions: [number, number, number][] = [
      [-0.95, 0.38, 1.8],
      [0.95, 0.38, 1.8],
      [-0.95, 0.38, -0.8],
      [0.95, 0.38, -0.8],
      [-0.95, 0.38, -1.8],
      [0.95, 0.38, -1.8],
    ];

    const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 24);
    const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.29, 16);

    wheelPositions.forEach(([x, y, z]) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, y, z);

      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;

      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;

      wheelGroup.add(tire, rim);
      truckGroup.add(wheelGroup);
    });

    scene.add(truckGroup);
    setLoading(false);

    // User Interaction (Mouse / Touch Drag Rotation)
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      setIsRotating(false);
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      prevMouseX = clientX;
      prevMouseY = clientY;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !truckGroupRef.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - prevMouseX;
      const deltaY = clientY - prevMouseY;

      truckGroupRef.current.rotation.y += deltaX * 0.008;
      camera.position.y = Math.max(1.5, Math.min(5.5, camera.position.y - deltaY * 0.008));
      camera.lookAt(0, 0.8, 0);

      prevMouseX = clientX;
      prevMouseY = clientY;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener("mousedown", onPointerDown);
    dom.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchend", onPointerUp);

    // Visibility Observer (Freeze rendering when not on screen)
    let isVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(container);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isVisible) return;

      if (isRotating && truckGroupRef.current) {
        truckGroupRef.current.rotation.y += 0.004;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animId);
      dom.removeEventListener("mousedown", onPointerDown);
      dom.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchend", onPointerUp);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (dom.parentNode) dom.parentNode.removeChild(dom);
    };
  }, [isRotating]);

  // Adjust 3D truck scale on capacity toggle
  const handleModeChange = (modeId: string) => {
    setActiveTab(modeId);
    const mode = TRUCK_MODES.find((m) => m.id === modeId);
    if (mode && cargoMeshRef.current) {
      cargoMeshRef.current.scale.z = mode.scaleZ;
    }
  };

  return (
    <section className="section three-section" aria-labelledby="three-title">
      <div className="container">
        <div className="three-header">
          <div className="section-heading">
            <p className="eyebrow">Interactive 3D Fleet Explorer</p>
            <h2 id="three-title">
              Explore Our Moving Fleet in <em>Interactive 3D</em>
            </h2>
            <p>
              Drag and rotate our custom heavy-duty removal vehicle. Inspect cargo space, hydraulic equipment, and tailored vehicle configurations for your move.
            </p>
          </div>
          <div className="three-controls-top">
            <div className="three-mode-tabs" role="tablist" aria-label="Vehicle Size Selector">
              {TRUCK_MODES.map((mode) => (
                <button
                  key={mode.id}
                  role="tab"
                  aria-selected={activeTab === mode.id}
                  className={`three-tab-btn ${activeTab === mode.id ? "is-active" : ""}`}
                  onClick={() => handleModeChange(mode.id)}
                >
                  <strong>{mode.name}</strong>
                  <span>{mode.capacity}</span>
                  <small>{mode.price}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="three-viewport-wrap">
          <div className="three-viewport" ref={containerRef}>
            {loading && (
              <div className="three-loader" aria-live="polite">
                <div className="three-spinner" />
                <span>Loading 3D Fleet Visualizer...</span>
              </div>
            )}
            {!webglSupported && (
              <div className="three-fallback">
                <img src="/images/hf-hero-truck-1024.webp" alt="HF Removals Moving Truck" width="1024" height="512" />
                <div className="three-fallback-badge">
                  <strong>HF Heavy Duty Fleet</strong>
                  <span>25–60m³ Capacity with Hydraulic Tailgate</span>
                </div>
              </div>
            )}
          </div>

          <div className="three-overlay-card">
            <div className="overlay-badge">
              <span className="badge-pulse" />
              <span>360° Interactive View</span>
            </div>
            <div className="hotspot-list">
              <span className="hotspot-label">Vehicle Features & Standards:</span>
              {HOTSPOTS.map((spot) => (
                <button
                  key={spot.id}
                  type="button"
                  className={`hotspot-btn ${activeHotspot?.id === spot.id ? "is-active" : ""}`}
                  onClick={() => {
                    setActiveHotspot(spot);
                    setIsRotating(false);
                  }}
                >
                  <span className="hotspot-dot" />
                  <strong>{spot.title}</strong>
                </button>
              ))}
            </div>

            {activeHotspot && (
              <div className="hotspot-details">
                <strong>{activeHotspot.title}</strong>
                <p>{activeHotspot.desc}</p>
              </div>
            )}

            <div className="three-cta-row">
              <button
                type="button"
                className="button-icon-toggle"
                onClick={() => setIsRotating(!isRotating)}
                aria-label={isRotating ? "Pause 3D rotation" : "Start 3D rotation"}
              >
                {isRotating ? "⏸ Pause Auto-Spin" : "▶ Resume Auto-Spin"}
              </button>
              <a className="button button-gold" href="/#quote">
                Book This Truck <span>→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
