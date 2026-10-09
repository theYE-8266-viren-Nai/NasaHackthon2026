"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial, Points, PointMaterial } from "@react-three/drei";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";
import { ArrowUpRight, Flame, Search, ShieldCheck } from "lucide-react";
import { Space, Typography } from "antd";

const { Title, Text, Paragraph, Link } = Typography;

function ParticleField() {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const values = new Float32Array(720 * 3);
    for (let index = 0; index < 720; index += 1) {
      const radius = 2.2 + ((index * 17) % 100) / 100 * 2.7;
      const angle = index * 2.39996;
      values[index * 3] = Math.cos(angle) * radius;
      values[index * 3 + 1] = Math.sin(angle * 1.13) * 1.7;
      values[index * 3 + 2] = Math.sin(angle) * radius - 1.5;
    }
    return values;
  }, []);

  useFrame((state, delta) => {
    if (!points.current) return;
    points.current.rotation.y = THREE.MathUtils.lerp(points.current.rotation.y, state.pointer.x * 0.18 + state.clock.elapsedTime * 0.035, delta * 2);
    points.current.rotation.x = THREE.MathUtils.lerp(points.current.rotation.x, state.pointer.y * 0.12, delta * 2);
  });

  return <Points ref={points} positions={positions} stride={3} frustumCulled>
    <PointMaterial transparent color="#a9d5e7" size={0.025} sizeAttenuation depthWrite={false} opacity={0.62} />
  </Points>;
}

function OrbitalFlame() {
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, state.pointer.y * 0.12, delta * 1.5);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, state.pointer.x * 0.2 + state.clock.elapsedTime * 0.08, delta * 1.5);
  });
  return <group ref={group}>
    <Float speed={1.25} rotationIntensity={0.35} floatIntensity={0.55}>
      <mesh>
        <icosahedronGeometry args={[1.25, 2]} />
        <MeshTransmissionMaterial backside thickness={0.25} roughness={0.16} chromaticAberration={0.08} anisotropy={0.25} color="#e8925d" transmission={0.88} />
      </mesh>
      <mesh scale={1.03}>
        <icosahedronGeometry args={[1.25, 2]} />
        <meshBasicMaterial color="#ffad73" transparent opacity={0.14} wireframe />
      </mesh>
    </Float>
    <mesh rotation={[Math.PI / 2.4, 0.2, 0.1]} scale={1.75}>
      <torusGeometry args={[1.05, 0.008, 8, 96]} />
      <meshBasicMaterial color="#d4ecf5" transparent opacity={0.42} />
    </mesh>
    <mesh rotation={[0.3, Math.PI / 2.1, 0.3]} scale={1.45}>
      <torusGeometry args={[1.05, 0.005, 8, 96]} />
      <meshBasicMaterial color="#ff9d5c" transparent opacity={0.5} />
    </mesh>
  </group>;
}

function MagneticButton({ children, href, primary = false }: { children: ReactNode; href: string; primary?: boolean }) {
  const handleMove = (event: MouseEvent<HTMLAnchorElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) * 0.12;
    const y = (event.clientY - rect.top - rect.height / 2) * 0.12;
    event.currentTarget.style.setProperty("--mag-x", x + "px");
    event.currentTarget.style.setProperty("--mag-y", y + "px");
  };
  return <a className={primary ? "magnetic-button primary" : "magnetic-button"} href={href} onMouseMove={handleMove} onMouseLeave={(event) => { event.currentTarget.style.setProperty("--mag-x", "0px"); event.currentTarget.style.setProperty("--mag-y", "0px"); }}>{children}</a>;
}

export default function ImmersiveHero() {
  const { scrollY } = useScroll();
  const titleY = useTransform(scrollY, [0, 650], [0, -50]);
  const reduceMotion = useReducedMotion();
  return <section className="immersive-hero" aria-labelledby="page-title">
    {reduceMotion ? <div className="hero-canvas reduced-canvas" aria-hidden="true" /> : <div className="hero-canvas" aria-hidden="true">
      <Canvas dpr={[1, 1.3]} camera={{ position: [0, 0, 7], fov: 40 }} gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[2, 1, 4]} color="#ffad73" intensity={9} distance={8} />
        <pointLight position={[-3, 1, 2]} color="#7dbbd5" intensity={7} distance={7} />
        <ParticleField />
        <OrbitalFlame />
      </Canvas>
    </div>}
    <motion.div className="hero-copy immersive-copy" style={{ y: titleY }}>
      <Text className="eyebrow">MICROGRAVITY COMBUSTION / RESEARCH INDEX</Text>
      <Title id="page-title">Fire behaves differently when buoyancy disappears.</Title>
      <Paragraph>Trace NASA’s experiments from raw conditions to defensible insight. Search the catalog, compare only what was measured, and keep uncertainty in view.</Paragraph>
      <Space className="hero-actions" wrap>
        <MagneticButton primary href="#catalog"><Search size={16} /> Explore the catalog</MagneticButton>
        <MagneticButton href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-98"><ArrowUpRight size={15} /> Open Saffire-I source</MagneticButton>
      </Space>
    </motion.div>
    <motion.aside className="hero-note immersive-note" initial={{ opacity: 0, x: 26 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35, duration: 0.8 }}>
      <div className="note-line"><ShieldCheck size={17} /><span>Evidence-led by design</span></div>
      <Title level={3}>No invented measurements.</Title>
      <Paragraph>Values shown here come from the curated NASA record. When a field is absent, the interface says so.</Paragraph>
      <Text className="source-caption">STARTING POINT</Text>
      <Link href="https://psi.nasa.gov/physci/repo/data/investigations/PSI-98" target="_blank">Saffire-I / PSI-98 <ArrowUpRight size={13} /></Link>
      <div className="hero-orbit-caption"><Flame size={14} /> interactive combustion field</div>
    </motion.aside>
  </section>;
}
