"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { strategyLabel } from "@/lib/labels";
import type { Parcel, SiteOption } from "@/lib/types";

function bounds(parcel?: Parcel | null, option?: SiteOption | null) {
  const points = [...(parcel?.boundary || []), ...(option?.buildings || []).flatMap((building) => building.footprint)];
  if (!points.length) return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, depth: 100 };
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: Math.max(1, maxX - minX), depth: Math.max(1, maxY - minY) };
}

function center(points: [number, number][]) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] as const;
}

function size(points: [number, number][]) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return [Math.max(1, Math.max(...xs) - Math.min(...xs)), Math.max(1, Math.max(...ys) - Math.min(...ys))] as const;
}

export function OptionScene3D({ parcel, option }: { parcel?: Parcel | null; option?: SiteOption | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f3f7f9");
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    const world = bounds(parcel, option);
    const scale = 42 / Math.max(world.width, world.depth);
    camera.position.set(36, 38, 42);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight("#ffffff", 1.4));
    const sun = new THREE.DirectionalLight("#ffffff", 2.2);
    sun.position.set(20, 42, 18);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(world.width * scale * 1.16, world.depth * scale * 1.16),
      new THREE.MeshStandardMaterial({ color: "#e8eef3", roughness: 0.85 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const parcelShape = new THREE.Shape();
    (parcel?.boundary || []).forEach((point, index) => {
      const x = (point[0] - (world.minX + world.width / 2)) * scale;
      const y = (point[1] - (world.minY + world.depth / 2)) * scale;
      if (index === 0) parcelShape.moveTo(x, y);
      else parcelShape.lineTo(x, y);
    });
    if (parcel?.boundary?.length) {
      const parcelLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(parcelShape.getPoints().map((point) => new THREE.Vector3(point.x, 0.04, point.y))),
        new THREE.LineBasicMaterial({ color: "#be123c" })
      );
      scene.add(parcelLine);
    }

    (option?.buildings || []).forEach((building, index) => {
      const [cx, cy] = center(building.footprint);
      const [width, depth] = size(building.footprint);
      const height = Math.max(1, building.height_m * scale * 0.35);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width * scale, height, depth * scale),
        new THREE.MeshStandardMaterial({
          color: index % 3 === 0 ? "#0f766e" : index % 3 === 1 ? "#2563eb" : "#b7791f",
          roughness: 0.48,
          metalness: 0.08,
          transparent: true,
          opacity: 0.88
        })
      );
      mesh.position.set((cx - (world.minX + world.width / 2)) * scale, height / 2, (cy - (world.minY + world.depth / 2)) * scale);
      mesh.rotation.y = THREE.MathUtils.degToRad(building.rotation_deg || 0);
      scene.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 }));
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      scene.add(edges);
    });

    const resize = () => {
      const width = canvas.clientWidth || 900;
      const height = canvas.clientHeight || 420;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    let raf = 0;
    const animate = () => {
      scene.rotation.y += 0.0018;
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };
    resize();
    animate();
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      renderer.dispose();
    };
  }, [parcel, option]);

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line bg-field/70 px-4 py-3">
        <div>
          <h2 className="section-title">三维体块</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">{option ? `${option.buildings.length} 栋 · ${strategyLabel(option.strategy)}` : "等待方案"}</p>
        </div>
      </div>
      <canvas ref={canvasRef} className="h-[420px] w-full bg-field" aria-label="3D 方案体块" />
    </div>
  );
}
