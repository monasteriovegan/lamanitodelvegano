'use client';

import { useEffect, useRef } from 'react';

export function FloatingEffects() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Limpiar previo por si acaso
    container.innerHTML = '';

    // 1. Spawning Green Leaves
    const leafCount = 8;
    for (let i = 0; i < leafCount; i++) {
      const leaf = document.createElement('div');
      leaf.className = 'leaf';
      leaf.style.left = (Math.random() * 100) + 'vw';
      
      const duration = (Math.random() * 15 + 12);
      const delay = (Math.random() * -20);
      leaf.style.animationDuration = duration + 's';
      leaf.style.animationDelay = delay + 's';
      
      const size = (Math.random() * 12 + 10);
      leaf.style.width = size + 'px';
      leaf.style.height = size + 'px';
      
      const scale = (Math.random() * 0.6 + 0.4);
      leaf.style.transform = `scale(${scale})`;
      
      const drift = (Math.random() * 160 - 80);
      const rotX = (Math.random() * 540 + 180);
      const rotY = (Math.random() * 540 + 180);
      const rotZ = (Math.random() * 720 + 360);
      const initRot = (Math.random() * 360);
      
      leaf.style.setProperty('--x-drift', drift + 'px');
      leaf.style.setProperty('--rot-x', rotX + 'deg');
      leaf.style.setProperty('--rot-y', rotY + 'deg');
      leaf.style.setProperty('--rot-z', rotZ + 'deg');
      leaf.style.setProperty('--init-rot', initRot + 'deg');
      
      container.appendChild(leaf);
    }

    // 2. Spawning Chamomile Petals
    const petalCount = 6;
    for (let i = 0; i < petalCount; i++) {
      const petal = document.createElement('div');
      petal.className = 'petal';
      petal.style.left = (Math.random() * 100) + 'vw';
      
      const duration = (Math.random() * 12 + 10);
      const delay = (Math.random() * -20);
      petal.style.animationDuration = duration + 's';
      petal.style.animationDelay = delay + 's';
      
      const size = (Math.random() * 8 + 8);
      petal.style.width = size + 'px';
      petal.style.height = size + 'px';
      
      const scale = (Math.random() * 0.5 + 0.5);
      petal.style.transform = `scale(${scale})`;
      
      const drift = (Math.random() * 120 - 60);
      const rotX = (Math.random() * 360 + 180);
      const rotY = (Math.random() * 360 + 180);
      const rotZ = (Math.random() * 360 + 360);
      const initRot = (Math.random() * 360);
      
      petal.style.setProperty('--x-drift', drift + 'px');
      petal.style.setProperty('--rot-x', rotX + 'deg');
      petal.style.setProperty('--rot-y', rotY + 'deg');
      petal.style.setProperty('--rot-z', rotZ + 'deg');
      petal.style.setProperty('--init-rot', initRot + 'deg');
      
      container.appendChild(petal);
    }

    // 3. Spawning Warm Golden Sparkles
    const sparkleCount = 6;
    for (let i = 0; i < sparkleCount; i++) {
      const sparkle = document.createElement('div');
      sparkle.className = 'sparkle';
      sparkle.style.left = (Math.random() * 100) + 'vw';
      
      const duration = (Math.random() * 18 + 14);
      const delay = (Math.random() * -30);
      sparkle.style.animationDuration = duration + 's';
      sparkle.style.animationDelay = delay + 's';
      
      const size = (Math.random() * 25 + 15);
      sparkle.style.width = size + 'px';
      sparkle.style.height = size + 'px';
      
      const drift = (Math.random() * 80 - 40);
      sparkle.style.setProperty('--x-drift', drift + 'px');
      
      container.appendChild(sparkle);
    }

    // Parallax effect on mouse move
    let leafParallaxX = 0;
    let targetX = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const width = window.innerWidth;
      const normalizedX = (e.clientX / width) - 0.5; // -0.5 to 0.5
      targetX = normalizedX * 50; // Max 25px drift
    };

    const updateParallax = () => {
      // Lerp
      leafParallaxX += (targetX - leafParallaxX) * 0.05;
      if (container) {
        container.style.transform = `translateX(${leafParallaxX}px)`;
      }
      requestAnimationFrame(updateParallax);
    };

    window.addEventListener('mousemove', handleMouseMove);
    const animationFrameId = requestAnimationFrame(updateParallax);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <div id="leaves-container" ref={containerRef} className="fixed top-0 left-0 w-full h-full pointer-events-none z-[50] overflow-hidden" style={{ perspective: '1000px' }} />;
}
