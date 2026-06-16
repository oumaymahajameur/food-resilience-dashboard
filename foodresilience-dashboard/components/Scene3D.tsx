// components/Scene3D.tsx
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Scene3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a2a);
    scene.fog = new THREE.FogExp2(0x0a0a2a, 0.002);

    // Camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 8);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);

    const backLight = new THREE.PointLight(0x00e5c8, 0.5);
    backLight.position.set(-2, 1, -3);
    scene.add(backLight);

    const fillLight = new THREE.PointLight(0x4466ff, 0.3);
    fillLight.position.set(2, 3, 4);
    scene.add(fillLight);

    // Create particles system
    const particleCount = 2000;
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesPositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      particlesPositions[i * 3] = (Math.random() - 0.5) * 200;
      particlesPositions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      particlesPositions[i * 3 + 2] = (Math.random() - 0.5) * 100 - 50;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlesPositions, 3));

    const particlesMaterial = new THREE.PointsMaterial({
      color: 0x00e5c8,
      size: 0.1,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    // Create floating spheres (data nodes)
    const sphereGroup = new THREE.Group();
    const colors = [0x00e5c8, 0x44ffaa, 0x88ffdd, 0x00b89e];
    const positions = [
      [-2, 1, -1], [2, -0.5, -1.5], [0, 1.5, -2], [-1.5, -1, -1], [1.5, 0.5, -2.5],
      [0, -1.2, -1], [2.5, 1.2, -0.5], [-2.3, -0.8, -1.8], [0.8, 2, -1.2], [-0.5, -1.8, -2]
    ];

    positions.forEach((pos, i) => {
      const geometry = new THREE.SphereGeometry(0.15 + Math.random() * 0.1, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        emissive: colors[i % colors.length],
        emissiveIntensity: 0.3,
        metalness: 0.8,
        roughness: 0.2,
      });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(pos[0], pos[1], pos[2]);
      sphere.userData = {
        originalY: pos[1],
        speed: 0.5 + Math.random() * 0.5,
        offset: Math.random() * Math.PI * 2,
      };
      sphereGroup.add(sphere);
    });
    scene.add(sphereGroup);

    // Create connecting lines between spheres
    const linePositions = [];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dist = Math.hypot(
          positions[i][0] - positions[j][0],
          positions[i][1] - positions[j][1],
          positions[i][2] - positions[j][2]
        );
        if (dist < 3) {
          linePositions.push(positions[i][0], positions[i][1], positions[i][2]);
          linePositions.push(positions[j][0], positions[j][1], positions[j][2]);
        }
      }
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00e5c8, transparent: true, opacity: 0.2 });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    // Create a central glowing ring
    const ringGeometry = new THREE.TorusGeometry(1.2, 0.03, 64, 200);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x00e5c8,
      emissive: 0x00e5c8,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.1,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    scene.add(ring);

    const ring2Geometry = new THREE.TorusGeometry(1.5, 0.02, 64, 200);
    const ring2 = new THREE.Mesh(ring2Geometry, ringMaterial);
    scene.add(ring2);

    // Create floating particles around ring
    const ringParticlesCount = 300;
    const ringParticlesGeometry = new THREE.BufferGeometry();
    const ringParticlesPositions = new Float32Array(ringParticlesCount * 3);

    for (let i = 0; i < ringParticlesCount; i++) {
      const angle = (i / ringParticlesCount) * Math.PI * 2;
      const radius = 1.8;
      ringParticlesPositions[i * 3] = Math.cos(angle) * radius;
      ringParticlesPositions[i * 3 + 1] = Math.sin(angle) * radius * 0.3;
      ringParticlesPositions[i * 3 + 2] = Math.sin(angle) * radius;
    }

    ringParticlesGeometry.setAttribute('position', new THREE.BufferAttribute(ringParticlesPositions, 3));
    const ringParticlesMaterial = new THREE.PointsMaterial({
      color: 0x44ffaa,
      size: 0.05,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    const ringParticles = new THREE.Points(ringParticlesGeometry, ringParticlesMaterial);
    scene.add(ringParticles);

    // Animation variables
    let time = 0;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.01;

      // Rotate particles
      particles.rotation.y = time * 0.05;
      particles.rotation.x = Math.sin(time * 0.1) * 0.1;

      // Float spheres
      sphereGroup.children.forEach((sphere, idx) => {
        sphere.position.y = sphere.userData.originalY + Math.sin(time * sphere.userData.speed + sphere.userData.offset) * 0.1;
      });

      // Rotate rings
      ring.rotation.x = Math.sin(time * 0.5) * 0.3;
      ring.rotation.z = time * 0.5;
      ring2.rotation.x = Math.cos(time * 0.5) * 0.3;
      ring2.rotation.z = time * 0.3;

      // Rotate ring particles
      ringParticles.rotation.y = time * 0.2;
      ringParticles.rotation.x = Math.sin(time * 0.3) * 0.1;

      // Camera slight movement
      camera.position.x = Math.sin(time * 0.1) * 0.2;
      camera.position.y = 2 + Math.sin(time * 0.2) * 0.1;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}