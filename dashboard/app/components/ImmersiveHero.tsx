"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Points, PointMaterial } from "@react-three/drei";
import { motion, useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";

function ParticleField() {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const values = new Float32Array(420 * 3);
    for (let index = 0; index < 420; index += 1) {
      const angle = index * 2.39996;
      const radius = 2.1 + ((index * 29) % 100) / 100 * 3.9;
      values[index * 3] = Math.cos(angle) * radius;
      values[index * 3 + 1] = Math.sin(angle * 1.27) * 2.8;
      values[index * 3 + 2] = Math.sin(angle) * radius - 1.4;
    }
    return values;
  }, []);

  useFrame((state, delta) => {
    if (points.current) points.current.rotation.y += delta * 0.012;
    if (points.current) points.current.rotation.x = THREE.MathUtils.lerp(points.current.rotation.x, state.pointer.y * 0.035, delta);
  });

  return <Points ref={points} positions={positions} stride={3} frustumCulled>
    <PointMaterial transparent color="#d7e4f3" size={0.018} sizeAttenuation depthWrite={false} opacity={0.58} />
  </Points>;
}

function FlameTelemetryCore() {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.045;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, state.pointer.y * 0.07, delta * 1.5);
  });
  return <group ref={group}>
    <Float speed={0.7} rotationIntensity={0.08} floatIntensity={0.18}>
      <mesh>
        <icosahedronGeometry args={[1.14, 2]} />
        <meshBasicMaterial color="#ff5722" wireframe transparent opacity={0.55} />
      </mesh>
      <mesh scale={0.68}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ff713f" transparent opacity={0.12} />
      </mesh>
    </Float>
    <mesh rotation={[Math.PI / 2.15, 0.2, 0.1]} scale={1.62}>
      <torusGeometry args={[1.05, 0.006, 6, 80]} />
      <meshBasicMaterial color="#f4f4f4" transparent opacity={0.34} />
    </mesh>
    <mesh rotation={[0.3, Math.PI / 2.1, 0.3]} scale={1.34}>
      <torusGeometry args={[1.05, 0.005, 6, 80]} />
      <meshBasicMaterial color="#ff5722" transparent opacity={0.72} />
    </mesh>
  </group>;
}

export default function ImmersiveHero() {
  const reduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = heroRef.current;
    if (!element || !("IntersectionObserver" in window)) { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "80px 0px", threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <section ref={heroRef} className="immersive-hero" id="about" aria-labelledby="page-title">
    {reduceMotion ? <div className="hero-canvas reduced-canvas" aria-hidden="true" /> : <div className="hero-canvas" aria-hidden="true">
      {inView && <Canvas dpr={1.15} frameloop="always" camera={{ position: [0, 0, 7], fov: 43 }} gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}>
        <ParticleField />
        <FlameTelemetryCore />
      </Canvas>}
    </div>}
    <div className="hero-grid-overlay" aria-hidden="true" />
    <motion.div className="hero-copy" initial={reduceMotion ? false : { opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
      <p className="eyebrow"><span className="signal-dot" /> MICROGRAVITY COMBUSTION / RESEARCH INDEX</p>
      <h1 id="page-title"><span className="hero-actions-line">Explore <i>•</i> Research <i>•</i> Present <i>•</i> Share <i>•</i> Teach</span><span className="hero-title-tail">a Universe of Data</span></h1>
      <p className="hero-description">Turn NASA’s microgravity fire experiments into clear, source-linked evidence. Compare reported conditions, inspect missing measurements, and explore what the data can—and cannot—support for spacecraft fire safety.</p>
      <div className="hero-actions">
        <a className="tactical-button tactical-button-primary" href="#catalog">EXPLORE FIRE DATA <ArrowDown size={15} aria-hidden="true" /></a>
        <a className="tactical-button" href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-69" target="_blank" rel="noreferrer">OPEN NASA PSI <ArrowUpRight size={15} aria-hidden="true" /></a>
      </div>
      <div className="hero-source-ribbon" id="sources">
        <span className="ribbon-label">NASA DATA SOURCES</span>
        <div className="source-emblems" aria-label="NASA Physical Sciences Informatics, NASA Technical Reports Server, and ISS combustion experiments">
          <span><b>PSI</b><small>PHYSICAL SCIENCES<br />INFORMATICS</small></span>
          <span><b>NTRS</b><small>NASA TECHNICAL<br />REPORTS SERVER</small></span>
          <span><b>ISS / CIR</b><small>COMBUSTION<br />INTEGRATED RACK</small></span>
        </div>
      </div>
    </motion.div>
    <div className="hero-readout" aria-hidden="true"><span>MISSION / FIRE SAFETY</span><b>0G</b><small>MEASURE · TRACE · REVIEW</small></div>
  </section>;
}
