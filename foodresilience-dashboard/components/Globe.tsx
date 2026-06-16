"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function Earth() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.y += 0.002;
    }
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[2, 64, 64]} />
      <meshStandardMaterial
        color="#00ffff"
        emissive="#00ffff"
        emissiveIntensity={0.6}
      />
    </mesh>
  );
}

function Glow() {
  return (
    <mesh>
      <sphereGeometry args={[2.3, 64, 64]} />
      <meshBasicMaterial
        color="#00ffff"
        transparent
        opacity={0.08}
      />
    </mesh>
  );
}

function Rings() {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.z += 0.002;
    }
  });

  return (
    <group ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.5, 2.55, 64]} />
        <meshBasicMaterial color="#00ffff" />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0.5, 0]}>
        <ringGeometry args={[2.8, 2.85, 64]} />
        <meshBasicMaterial color="#00ffff" />
      </mesh>
    </group>
  );
}

function Points() {
  return (
    <>
      {[...Array(20)].map((_, i) => (
        <mesh
          key={i}
          position={[
            Math.random() * 3 - 1.5,
            Math.random() * 3 - 1.5,
            Math.random() * 3 - 1.5,
          ]}
        >
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial color="#00ffff" />
        </mesh>
      ))}
    </>
  );
}

export default function Globe() {
  return (
    <div style={{ height: "100vh", background: "#020617" }}>
      <Canvas camera={{ position: [0, 0, 6] }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[5, 5, 5]} />

        <Earth />
        <Glow />
        <Rings />
        <Points />

        <OrbitControls enableZoom={false} />
      </Canvas>
    </div>
  );
}