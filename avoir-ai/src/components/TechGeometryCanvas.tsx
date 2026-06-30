'use client';

import { useEffect, useRef } from 'react';

export default function TechGeometryCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationFrameId: number;

    // Camera / Center
    let cx = width / 2;
    let cy = height / 2;

    // Interaction states
    let scrollYOffset = 0;
    let mouseXOffset = 0;
    let mouseYOffset = 0;
    
    // Constant slow rotation over time
    let timeRotation = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      cx = width / 2;
      cy = height / 2;
    };

    // ============================================================================
    // 3D Point Engine
    // ============================================================================
    class Point3D {
      id: number;
      origX: number;
      origY: number;
      origZ: number;
      type: 'sphere' | 'ring';
      hue: number;

      constructor(id: number, x: number, y: number, z: number, type: 'sphere' | 'ring', hue: number) {
        this.id = id;
        this.origX = x;
        this.origY = y;
        this.origZ = z;
        this.type = type;
        this.hue = hue;
      }
    }

    const points: Point3D[] = [];
    const lines: { p1: number, p2: number, alpha: number }[] = [];

    const initGeometry = () => {
      points.length = 0;
      lines.length = 0;
      const isMobile = width < 768;
      // Keep it absolutely massive
      const sphereRadius = isMobile ? width * 0.6 : width * 0.35; 
      // Optimized density for 60FPS
      const sphereCount = isMobile ? 400 : 1200;
      const ringCount = isMobile ? 300 : 900;
      
      let currentId = 0;

      // 1. Data Sphere
      for (let i = 0; i < sphereCount; i++) {
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(Math.random() * 2 - 1);
        const x = sphereRadius * Math.sin(phi) * Math.cos(theta);
        const y = sphereRadius * Math.sin(phi) * Math.sin(theta);
        const z = sphereRadius * Math.cos(phi);
        const hue = Math.random() > 0.5 ? 250 : 190;
        points.push(new Point3D(currentId++, x, y, z, 'sphere', hue));
      }

      // 2. Massive Orbital Crisp Rings
      const rings = [
        { radius: sphereRadius * 1.6, variance: 60, hue: 280 }, // Outer
        { radius: sphereRadius * 1.25, variance: 30, hue: 190 }, // Inner
      ];

      rings.forEach(ring => {
        for (let i = 0; i < ringCount; i++) {
          const angle = Math.random() * 2 * Math.PI;
          const r = ring.radius + (Math.random() * ring.variance - ring.variance / 2);
          const x = r * Math.cos(angle);
          const y = (Math.random() - 0.5) * 15;
          const z = r * Math.sin(angle);
          points.push(new Point3D(currentId++, x, y, z, 'ring', ring.hue));
        }
      });

      // Pre-calculate line connections for O(1) rendering performance
      // This eliminates the O(N^2) lag during the animation frame
      for (let i = 0; i < points.length; i++) {
        let connections = 0;
        for (let j = i + 1; j < points.length && connections < 3; j++) {
          if (points[i].type !== points[j].type) continue;
          
          const dx = points[i].origX - points[j].origX;
          const dy = points[i].origY - points[j].origY;
          const dz = points[i].origZ - points[j].origZ;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          
          if (dist < 60) {
            // Store the connection
            lines.push({ p1: i, p2: j, alpha: 1 - (dist / 60) });
            connections++;
          }
        }
      }
    };

    // 3D Math Helper
    const rotate3D = (x: number, y: number, z: number, pitch: number, yaw: number, roll: number) => {
      // Roll (Z axis)
      let x1 = x * Math.cos(roll) - y * Math.sin(roll);
      let y1 = x * Math.sin(roll) + y * Math.cos(roll);
      let z1 = z;

      // Pitch (X axis)
      let y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch);
      let z2 = y1 * Math.sin(pitch) + z1 * Math.cos(pitch);
      let x2 = x1;

      // Yaw (Y axis)
      let x3 = x2 * Math.cos(yaw) + z2 * Math.sin(yaw);
      let z3 = -x2 * Math.sin(yaw) + z2 * Math.cos(yaw);
      let y3 = y2;

      return { x: x3, y: y3, z: z3 };
    };

    const animate = () => {
      // Clear with sharp opacity for clean tech look (no trailing blurry mess)
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      ctx.fillRect(0, 0, width, height);

      timeRotation += 0.002;

      // Interpolate smooth scroll
      const targetScroll = window.scrollY;
      scrollYOffset += (targetScroll - scrollYOffset) * 0.08;

      // Calculate final rotation angles
      // Time provides continuous slow spin
      // Scroll provides strong geometric tilt & rotation
      // Mouse provides subtle parallax tilt
      const pitch = timeRotation * 0.5 + (mouseYOffset * 0.05) + (scrollYOffset * 0.001);
      const yaw = timeRotation + (mouseXOffset * 0.05) - (scrollYOffset * 0.002);
      const roll = (scrollYOffset * 0.0005); // Twist as you scroll down

      // Projection mapping
      const fov = 400; // Focal length
      // Bring it closer as you scroll down
      const cameraZ = 800 - (scrollYOffset * 0.2); 

      // Transform points and keep original ID reference for lines
      const transformedPoints = points.map(p => {
        let preRotY = p.origY;
        let preRotZ = p.origZ;
        if (p.type === 'ring') {
          const ringTilt = 0.5;
          preRotY = p.origY * Math.cos(ringTilt) - p.origZ * Math.sin(ringTilt);
          preRotZ = p.origY * Math.sin(ringTilt) + p.origZ * Math.cos(ringTilt);
        }

        const rotated = rotate3D(p.origX, preRotY, preRotZ, pitch, yaw, roll);
        
        const scale = fov / (fov + rotated.z + cameraZ);
        const screenX = cx + rotated.x * scale;
        const screenY = cy + rotated.y * scale - (scrollYOffset * 0.1); 

        return { id: p.id, screenX, screenY, scale, z: rotated.z, type: p.type, hue: p.hue };
      });

      // Draw wireframe connections first
      ctx.lineWidth = 1.0;
      for (let i = 0; i < lines.length; i++) {
        const p1 = transformedPoints[lines[i].p1];
        const p2 = transformedPoints[lines[i].p2];
        
        // Don't draw if behind camera
        if (p1.scale < 0 || p2.scale < 0) continue; 
        
        // Average scale and base alpha for depth fade
        const avgScale = (p1.scale + p2.scale) / 2;
        const finalAlpha = lines[i].alpha * avgScale * 0.8;
        
        ctx.strokeStyle = `hsla(${p1.hue}, 100%, 75%, ${finalAlpha})`;
        ctx.beginPath();
        ctx.moveTo(p1.screenX, p1.screenY);
        ctx.lineTo(p2.screenX, p2.screenY);
        ctx.stroke();
      }

      // Sort points by Z for proper 3D rendering order
      transformedPoints.sort((a, b) => b.z - a.z);

      // Draw points
      for (let i = 0; i < transformedPoints.length; i++) {
        const p1 = transformedPoints[i];
        if (p1.scale < 0) continue; 

        // Crisp, sharp dots (No shadowBlur to ensure 60FPS)
        const size = p1.type === 'ring' ? 2.5 : 2.0;
        const pointAlpha = Math.min(1, Math.max(0.4, p1.scale * 2.0));
        
        ctx.fillStyle = `hsla(${p1.hue}, 100%, 85%, ${pointAlpha})`;
        ctx.beginPath();
        ctx.fillRect(p1.screenX - (size * p1.scale)/2, p1.screenY - (size * p1.scale)/2, size * p1.scale, size * p1.scale);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Normalized coordinates -1 to 1
      mouseXOffset = (e.clientX / width) * 2 - 1;
      mouseYOffset = (e.clientY / height) * 2 - 1;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);

    resize();
    initGeometry();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: -1 }} // Fixed background behind everything
    />
  );
}
