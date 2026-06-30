'use client';

import { useEffect, useRef } from 'react';

export default function InteractivePlasmaCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animationFrameId: number;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        width = parent.clientWidth;
        height = parent.clientHeight;
        canvas.width = width;
        canvas.height = height;
      } else {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
      }
    };

    window.addEventListener('resize', resize);
    resize();

    // Plasma configuration
    const numPoints = 80;
    const points: { x: number; y: number; vx: number; vy: number; radius: number; color: string; phase: number }[] = [];

    // Extremely subtle, muted colors to act purely as an atmospheric background
    const colors = [
      'rgba(99, 102, 241, 0.015)',  // Indigo 500
      'rgba(67, 56, 202, 0.02)',    // Indigo 700
      'rgba(45, 212, 191, 0.01)',   // Teal 400
      'rgba(168, 85, 247, 0.01)'    // Purple 500
    ];

    for (let i = 0; i < numPoints; i++) {
      points.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 250 + 100, // Large, soft orbs
        color: colors[Math.floor(Math.random() * colors.length)],
        phase: Math.random() * Math.PI * 2
      });
    }

    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetMouseX = e.clientX - rect.left;
      targetMouseY = e.clientY - rect.top;
    };

    window.addEventListener('mousemove', handleMouseMove);

    let time = 0;

    const render = () => {
      time += 0.005; // Very slow, luxurious movement
      
      // Clear with dark transparent background to create long, smooth trails
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; 
      ctx.fillRect(0, 0, width, height);

      // Smooth mouse interpolation
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      // REMOVED 'screen' blending to prevent it from getting overly bright when clustered

      for (let i = 0; i < numPoints; i++) {
        const p = points[i];

        // Organic, wave-like movement
        p.x += p.vx + Math.sin(time + p.phase) * 0.6;
        p.y += p.vy + Math.cos(time + p.phase) * 0.6;

        // Wrap around screen seamlessly
        if (p.x < -p.radius) p.x = width + p.radius;
        if (p.x > width + p.radius) p.x = -p.radius;
        if (p.y < -p.radius) p.y = height + p.radius;
        if (p.y > height + p.radius) p.y = -p.radius;

        // Extremely subtle mouse interaction (just a gentle nudge)
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Small interaction radius (250px) and very weak force
        if (dist < 250) {
          const force = (250 - dist) / 250;
          p.x += (dx / dist) * force * 0.3; // Barely noticeable pull
          p.y += (dy / dist) * force * 0.3;
        }

        // Draw soft flowing gradient
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Subtle edge vignette for text contrast */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.6)_100%)] pointer-events-none" />
    </div>
  );
}
