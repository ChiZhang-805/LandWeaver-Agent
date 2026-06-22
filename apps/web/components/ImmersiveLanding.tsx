"use client";

import { ArrowRight, Boxes, Building2, FolderOpen, LandPlot, Loader2, Menu, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createProject } from "@/lib/api";
import { useProjectStore } from "@/store/projectStore";

type Chapter = {
  key: string;
  label: string;
  kicker: string;
  title: string;
  body: string;
  action: string;
  camera: THREE.Vector3;
  lookAt: THREE.Vector3;
  cubeScale: number;
  cityScale: number;
  roadOpacity: number;
};

const chapters: Chapter[] = [
  {
    key: "parcel",
    label: "红线",
    kicker: "LOCAL METER GRID",
    title: "LandWeaver Agent（地织）",
    body: "把一块地从红线、退界、产品到收益测算织成可比较的方案。",
    action: "创建强排项目",
    camera: new THREE.Vector3(8, 8, 14),
    lookAt: new THREE.Vector3(2, 1, -1.5),
    cubeScale: 0.65,
    cityScale: 0.55,
    roadOpacity: 0.7
  },
  {
    key: "network",
    label: "产品",
    kicker: "PROTOTYPE NETWORK",
    title: "用产品原型生成候选",
    body: "tower、slab 与经济假设进入同一个离散搜索空间，候选楼栋不靠猜。",
    action: "配置产品",
    camera: new THREE.Vector3(0, 9, 21),
    lookAt: new THREE.Vector3(0, 1.2, 0),
    cubeScale: 0.42,
    cityScale: 0.34,
    roadOpacity: 0.45
  },
  {
    key: "envelope",
    label: "退界",
    kicker: "BUILDABLE ENVELOPE",
    title: "先确定边界，再释放容量",
    body: "退界、限高、楼间距和密度被转译为本地可验证的几何范围。",
    action: "进入约束",
    camera: new THREE.Vector3(-8, 7, 16),
    lookAt: new THREE.Vector3(-0.8, 1.6, 0),
    cubeScale: 1.55,
    cityScale: 0.2,
    roadOpacity: 0.35
  },
  {
    key: "solver",
    label: "强排",
    kicker: "CP-SAT OPTION SPACE",
    title: "多策略强排，同屏比较",
    body: "收益优先、均衡和低风险策略在约束内选择楼栋组合，并暴露风险提示。",
    action: "生成方案",
    camera: new THREE.Vector3(-12, 8, 11),
    lookAt: new THREE.Vector3(0, 1.2, -2),
    cubeScale: 0.18,
    cityScale: 0.9,
    roadOpacity: 0.92
  },
  {
    key: "export",
    label: "导出",
    kicker: "MEASURED OUTPUT",
    title: "测算、解释、导出到同一张图",
    body: "GeoJSON、DXF、CSV 都来自同一套本地几何与指标，方便复核和交付。",
    action: "开始织地",
    camera: new THREE.Vector3(0, 10, 13),
    lookAt: new THREE.Vector3(0, 1.7, -3),
    cubeScale: 0.08,
    cityScale: 1.08,
    roadOpacity: 1
  }
];

function setObjectOpacity(object: THREE.Object3D, opacity: number) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        material.transparent = true;
        material.opacity = opacity;
      });
    }
  });
}

function makeBuilding(width: number, height: number, depth: number, accent: THREE.ColorRepresentation) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color: "#06162f",
      emissive: "#082c5c",
      emissiveIntensity: 0.5,
      roughness: 0.5,
      metalness: 0.25
    })
  );
  body.position.y = height / 2;
  group.add(body);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.72 })
  );
  edges.position.copy(body.position);
  group.add(edges);

  const windowMaterial = new THREE.MeshBasicMaterial({ color: "#9deeff", transparent: true, opacity: 0.92 });
  const rows = Math.max(2, Math.floor(height / 1.1));
  const cols = Math.max(1, Math.floor(width / 0.55));
  for (let side = 0; side < 2; side += 1) {
    for (let row = 1; row < rows; row += 2) {
      for (let col = 0; col < cols; col += 2) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.055), windowMaterial);
        win.position.set(-width / 2 + 0.35 + col * 0.42, row * 0.55, side === 0 ? depth / 2 + 0.011 : -depth / 2 - 0.011);
        if (side === 1) win.rotation.y = Math.PI;
        group.add(win);
      }
    }
  }
  return group;
}

function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#020713");
  scene.fog = new THREE.FogExp2("#031b37", 0.044);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160);
  camera.position.copy(chapters[0].camera);

  const ambient = new THREE.AmbientLight("#4bc7ff", 0.62);
  scene.add(ambient);
  const key = new THREE.DirectionalLight("#9eeeff", 2.1);
  key.position.set(-8, 12, 8);
  scene.add(key);
  const underGlow = new THREE.PointLight("#00e5ff", 55, 22);
  underGlow.position.set(0, 0.6, 0);
  scene.add(underGlow);
  const amber = new THREE.PointLight("#ffd27a", 18, 18);
  amber.position.set(-7, 2, -4);
  scene.add(amber);

  const horizon = new THREE.Mesh(
    new THREE.PlaneGeometry(72, 20, 40, 12),
    new THREE.MeshBasicMaterial({ color: "#061328", transparent: true, opacity: 0.62 })
  );
  horizon.rotation.x = -Math.PI / 2;
  horizon.position.set(0, -0.75, -18);
  scene.add(horizon);

  const terrain = new THREE.Group();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 42, 120, 72),
    new THREE.MeshStandardMaterial({
      color: "#031124",
      emissive: "#05264e",
      emissiveIntensity: 0.34,
      roughness: 0.78,
      metalness: 0.08,
      transparent: true,
      opacity: 0.94
    })
  );
  const positions = ground.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = Math.sin(x * 0.45) * 0.22 + Math.cos(y * 0.34) * 0.18 + Math.sin((x + y) * 0.18) * 0.16;
    positions.setZ(i, z);
  }
  positions.needsUpdate = true;
  ground.geometry.computeVertexNormals();
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.85;
  terrain.add(ground);

  const grid = new THREE.GridHelper(60, 42, "#1bd7ff", "#123c62");
  grid.position.y = -0.62;
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.2;
  terrain.add(grid);
  scene.add(terrain);

  const roads = new THREE.Group();
  const roadMaterial = new THREE.LineBasicMaterial({ color: "#54f0e2", transparent: true, opacity: 0.65 });
  for (let i = 0; i < 7; i += 1) {
    const points: THREE.Vector3[] = [];
    for (let j = 0; j < 90; j += 1) {
      const t = j / 89;
      points.push(new THREE.Vector3(-28 + t * 56, -0.42 + i * 0.006, -14 + i * 4 + Math.sin(t * Math.PI * 2 + i) * 1.8));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    roads.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(120)), roadMaterial.clone()));
  }
  scene.add(roads);

  const cubeGroup = new THREE.Group();
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(4.7, 4.7, 4.7, 12, 12, 12),
    new THREE.MeshStandardMaterial({
      color: "#0a77e8",
      emissive: "#10d9ff",
      emissiveIntensity: 1.1,
      roughness: 0.25,
      metalness: 0.18,
      transparent: true,
      opacity: 0.82
    })
  );
  cubeGroup.add(cube);
  const cubeGrid = new THREE.LineSegments(
    new THREE.EdgesGeometry(cube.geometry),
    new THREE.LineBasicMaterial({ color: "#b8fff6", transparent: true, opacity: 0.35 })
  );
  cubeGroup.add(cubeGrid);
  cubeGroup.position.set(0, 3.5, -0.2);
  cubeGroup.rotation.set(0.12, -0.46, 0.08);
  scene.add(cubeGroup);

  const city = new THREE.Group();
  const rng = (seed: number) => {
    let value = seed;
    return () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  };
  const random = rng(31);
  for (let i = 0; i < 86; i += 1) {
    const ring = i < 35 ? 1 : i < 65 ? 1.6 : 2.3;
    const x = (random() - 0.5) * 22 * ring;
    const z = -4 - random() * 17 + Math.sin(i * 0.8) * 1.4;
    const width = 0.65 + random() * 1.2;
    const depth = 0.65 + random() * 1.15;
    const height = 1.1 + Math.pow(random(), 1.8) * 8.2;
    const building = makeBuilding(width, height, depth, i % 8 === 0 ? "#fedb8b" : "#79ebff");
    building.position.set(x, -0.55, z);
    city.add(building);
  }
  city.scale.setScalar(0.08);
  city.position.set(0, 0, 2.8);
  setObjectOpacity(city, 0.35);
  scene.add(city);

  const stars = new THREE.BufferGeometry();
  const starPositions = new Float32Array(360 * 3);
  for (let i = 0; i < 360; i += 1) {
    starPositions[i * 3] = (random() - 0.5) * 70;
    starPositions[i * 3 + 1] = 5 + random() * 24;
    starPositions[i * 3 + 2] = -35 + random() * 28;
  }
  stars.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starCloud = new THREE.Points(
    stars,
    new THREE.PointsMaterial({ color: "#d6fcff", size: 0.035, transparent: true, opacity: 0.72 })
  );
  scene.add(starCloud);

  return { renderer, scene, camera, cubeGroup, city, roads, terrain, starCloud };
}

export function ImmersiveLanding() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<ReturnType<typeof createScene> | null>(null);
  const targetIndexRef = useRef(0);
  const wheelLockRef = useRef(false);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [title, setTitle] = useState("120m x 80m 住宅地块测算");
  const [city, setCity] = useState("Shanghai");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const setCurrentProjectId = useProjectStore((state) => state.setCurrentProjectId);
  const chapter = chapters[chapterIndex];
  const progress = useMemo(() => ((chapterIndex + 1) / chapters.length) * 100, [chapterIndex]);

  useEffect(() => {
    targetIndexRef.current = chapterIndex;
  }, [chapterIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const world = createScene(canvas);
    sceneRef.current = world;
    let frame = 0;
    let raf = 0;
    const targetCamera = new THREE.Vector3();
    const targetLookAt = new THREE.Vector3();
    const currentLookAt = chapters[0].lookAt.clone();

    const resize = () => {
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      world.renderer.setSize(width, height, false);
      world.camera.aspect = width / height;
      world.camera.updateProjectionMatrix();
    };

    const animate = () => {
      const next = chapters[targetIndexRef.current];
      targetCamera.copy(next.camera);
      targetLookAt.copy(next.lookAt);
      world.camera.position.lerp(targetCamera, 0.045);
      currentLookAt.lerp(targetLookAt, 0.055);
      world.camera.lookAt(currentLookAt);

      const time = frame / 60;
      world.cubeGroup.rotation.x += 0.0025;
      world.cubeGroup.rotation.y += 0.005;
      const cubePulse = 1 + Math.sin(time * 1.6) * 0.018;
      world.cubeGroup.scale.lerp(new THREE.Vector3(next.cubeScale * cubePulse, next.cubeScale * cubePulse, next.cubeScale * cubePulse), 0.052);
      world.city.scale.lerp(new THREE.Vector3(next.cityScale, next.cityScale, next.cityScale), 0.045);
      setObjectOpacity(world.city, Math.min(1, 0.22 + next.cityScale * 0.72));
      world.roads.children.forEach((child, index) => {
        const material = (child as THREE.Line).material as THREE.LineBasicMaterial;
        material.opacity = THREE.MathUtils.lerp(material.opacity, next.roadOpacity * (0.46 + index * 0.07), 0.035);
      });
      world.terrain.rotation.z = Math.sin(time * 0.16) * 0.012;
      world.starCloud.rotation.y += 0.00055;
      world.renderer.render(world.scene, world.camera);
      frame += 1;
      raf = window.requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      world.renderer.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 18 || wheelLockRef.current) return;
      wheelLockRef.current = true;
      setChapterIndex((current) => {
        const next = event.deltaY > 0 ? Math.min(chapters.length - 1, current + 1) : Math.max(0, current - 1);
        return next;
      });
      window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 720);
    };
    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  async function startProject() {
    try {
      setBusy(true);
      setError("");
      const project = await createProject({ title, city });
      setCurrentProjectId(project.id);
      router.push(`/projects/${project.id}/parcel`);
    } catch (event) {
      setError(event instanceof Error ? event.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative h-[100svh] min-h-0 overflow-hidden bg-[#020713] text-white">
      <canvas ref={canvasRef} className="fixed inset-0 h-full w-full" aria-label="LandWeaver immersive city scene" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(33,211,255,0.18),transparent_32%),linear-gradient(180deg,rgba(2,7,19,0.05),rgba(2,7,19,0.76))]" />
      <div className="pointer-events-none fixed inset-4 border border-cyan-100/[0.12]" />

      <header className="pointer-events-auto fixed left-0 right-0 top-0 z-20 flex min-w-0 items-center justify-between gap-3 px-4 py-4 md:px-9 md:py-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center border border-cyan-200/20 bg-cyan-200/[0.08] text-cyan-100">
            <LandPlot size={18} aria-hidden />
          </span>
          <div>
            <div className="text-sm font-semibold uppercase text-cyan-50">LandWeaver</div>
            <div className="text-xs text-cyan-100/55">Agent 地织</div>
          </div>
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 md:gap-2">
          <span className="hidden border border-cyan-100/[0.15] bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-50 backdrop-blur md:inline-flex">
            LOCAL ENGINE
          </span>
          <Link
            className="inline-flex min-h-9 items-center gap-2 border border-cyan-100/[0.15] bg-white/[0.08] px-2.5 py-2 text-xs font-semibold text-cyan-50 backdrop-blur hover:bg-white/[0.12] md:px-3"
            href="/projects"
          >
            <FolderOpen size={14} aria-hidden />
            <span className="hidden sm:inline">项目</span>
          </Link>
          <Link
            className="inline-flex min-h-9 items-center gap-2 border border-cyan-100/[0.15] bg-white/[0.08] px-2.5 py-2 text-xs font-semibold text-cyan-50 backdrop-blur hover:bg-white/[0.12] md:px-3"
            href="/settings"
          >
            <Settings size={14} aria-hidden />
            <span className="hidden sm:inline">设置</span>
          </Link>
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-2 border border-cyan-100/[0.15] bg-white/[0.08] px-2.5 py-2 text-xs font-semibold text-cyan-50 backdrop-blur hover:bg-white/[0.12] md:px-3"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu size={14} aria-hidden />
            <span className="hidden sm:inline">菜单</span>
          </button>
          {menuOpen ? (
            <div className="absolute right-6 top-16 grid w-40 border border-cyan-100/[0.14] bg-[#021124]/[0.88] p-2 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-md md:right-9">
              {chapters.map((item, index) => (
                <button
                  key={item.key}
                  className={`px-3 py-2 text-left text-xs font-semibold ${chapterIndex === index ? "bg-cyan-200/[0.12] text-cyan-50" : "text-cyan-100/[0.62] hover:bg-white/[0.08]"}`}
                  onClick={() => {
                    setChapterIndex(index);
                    setMenuOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <aside className="pointer-events-auto fixed left-6 top-1/2 z-20 hidden -translate-y-1/2 md:block">
        <nav className="grid gap-4">
          {chapters.map((item, index) => (
            <button
              key={item.key}
              className={`group flex items-center gap-3 text-left text-xs font-semibold uppercase transition ${
                chapterIndex === index ? "text-cyan-50" : "text-cyan-100/[0.28] hover:text-cyan-100/70"
              }`}
              onClick={() => setChapterIndex(index)}
            >
              <span className={`size-1.5 ${chapterIndex === index ? "bg-cyan-100" : "bg-cyan-100/[0.22] group-hover:bg-cyan-100/60"}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="relative z-10 flex h-full min-h-0 items-end justify-center px-5 pb-28 pt-24 md:items-center md:pb-20 md:pt-28">
        <div className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-[minmax(0,1fr)_360px] md:items-end md:gap-7">
          <div className="max-w-2xl text-center md:text-left">
            <div className="mb-3 text-xs font-semibold uppercase text-cyan-200/70">{chapter.kicker}</div>
            <h1 className="text-balance text-4xl font-black uppercase leading-[0.95] text-white drop-shadow-[0_0_22px_rgba(64,224,255,0.32)] sm:text-6xl md:text-7xl">
              {chapter.title}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-cyan-50/[0.62] md:mx-0 md:mt-5">{chapter.body}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:mt-7 md:justify-start">
              <button
                className="inline-flex min-h-11 items-center gap-2 border border-cyan-100/[0.24] bg-cyan-300/[0.12] px-5 py-3 text-sm font-bold text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,0.18)] backdrop-blur transition hover:bg-cyan-300/20"
                onClick={startProject}
                disabled={busy}
              >
                {busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <Sparkles size={17} aria-hidden />}
                <span>{chapter.action}</span>
                <ArrowRight size={16} aria-hidden />
              </button>
              {error ? <span className="text-sm font-semibold text-rose-200">{error}</span> : null}
            </div>
          </div>

          <div className="pointer-events-auto border border-cyan-100/[0.14] bg-[#021124]/[0.55] p-3 shadow-[0_20px_90px_rgba(0,0,0,0.28)] backdrop-blur-md sm:p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Building2 size={17} aria-hidden />
                <span>快速项目</span>
              </div>
              <span className="text-xs text-cyan-100/55">MVP</span>
            </div>
            <label className="grid gap-1 text-xs font-semibold text-cyan-50/[0.72]">
              <span>项目名称</span>
              <input
                className="h-10 border border-cyan-100/[0.12] bg-black/25 px-3 text-sm text-white outline-none focus:border-cyan-200/70"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="mt-3 grid gap-1 text-xs font-semibold text-cyan-50/[0.72]">
              <span>城市</span>
              <input
                className="h-10 border border-cyan-100/[0.12] bg-black/25 px-3 text-sm text-white outline-none focus:border-cyan-200/70"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </label>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-cyan-50/[0.68] sm:mt-4">
              <div className="border border-cyan-100/10 bg-white/5 p-2">
                <Boxes className="mx-auto mb-1" size={15} aria-hidden />
                几何
              </div>
              <div className="border border-cyan-100/10 bg-white/5 p-2">
                <Sparkles className="mx-auto mb-1" size={15} aria-hidden />
                强排
              </div>
              <div className="border border-cyan-100/10 bg-white/5 p-2">
                <ArrowRight className="mx-auto mb-1" size={15} aria-hidden />
                导出
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="pointer-events-auto fixed bottom-4 left-4 right-4 z-20 isolate overflow-hidden border border-cyan-100/[0.12] bg-[#020713]/[0.82] backdrop-blur-md">
        <div className="grid grid-cols-[220px_minmax(0,1fr)_90px] items-center text-xs text-cyan-50/[0.68] max-sm:grid-cols-1">
          <div className="hidden min-w-0 items-center gap-3 border-r border-cyan-100/[0.12] bg-[#020713]/[0.72] px-5 py-3 md:flex">
            <span className="flex h-8 w-10 shrink-0 items-center justify-center rounded-[6px] border border-cyan-100/[0.2] bg-[#041426] text-[11px] font-black text-cyan-50">
              N
            </span>
            <span className="min-w-0 whitespace-nowrap font-semibold text-cyan-50/[0.72]">ENGINE · READY</span>
          </div>
          <div className="px-4 py-4">
            <div className="h-1 overflow-hidden bg-white/10">
              <div className="h-full bg-gradient-to-r from-cyan-300 via-teal-200 to-amber-200 transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="hidden border-l border-cyan-100/[0.12] bg-[#020713]/[0.58] px-5 py-4 text-right md:block">
            {chapterIndex + 1}/{chapters.length}
          </div>
        </div>
      </footer>
    </main>
  );
}
