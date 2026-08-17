'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface TerminalChartProps {
  title: string;
  color?: 'amber' | 'cyan' | 'green' | 'red';
  min?: number;
  max?: number;
  dataPoints?: number;
  speed?: number;
  className?: string;
}

const COLOR_MAP = {
  amber: { line: '#F59E0B', fill: 'rgba(245, 158, 11, 0.1)', glow: 'rgba(245, 158, 11, 0.3)' },
  cyan: { line: '#06B6D4', fill: 'rgba(6, 182, 212, 0.1)', glow: 'rgba(6, 182, 212, 0.3)' },
  green: { line: '#22C55E', fill: 'rgba(34, 197, 94, 0.1)', glow: 'rgba(34, 197, 94, 0.3)' },
  red: { line: '#EF4444', fill: 'rgba(239, 68, 68, 0.1)', glow: 'rgba(239, 68, 68, 0.3)' },
};

export default function TerminalChart({
  title,
  color = 'amber',
  min = 0,
  max = 100,
  dataPoints = 60,
  speed = 1000,
  className = '',
}: TerminalChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<number[]>([]);
  const frameRef = useRef<number>(0);
  const [currentValue, setCurrentValue] = useState(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'flat'>('flat');

  const colors = COLOR_MAP[color];

  const generateNextValue = useCallback(() => {
    const data = dataRef.current;
    if (data.length === 0) {
      return (min + max) / 2;
    }
    const last = data[data.length - 1];
    const volatility = (max - min) * 0.08;
    const drift = (Math.random() - 0.48) * volatility; // slight upward bias
    const next = Math.max(min, Math.min(max, last + drift));
    return next;
  }, [min, max]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const data = dataRef.current;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (data.length < 2) return;

    // Calculate points
    const step = w / (dataPoints - 1);
    const points: [number, number][] = data.map((val, idx) => {
      const x = idx * step;
      const normalized = (val - min) / (max - min);
      const y = h - normalized * h;
      return [x, y];
    });

    // Fill under line
    ctx.beginPath();
    ctx.moveTo(points[0][0], h);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(points[points.length - 1][0], h);
    ctx.closePath();
    ctx.fillStyle = colors.fill;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      // Jagged line — straight segments, no smoothing
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Glow on last point
    const lastPoint = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(lastPoint[0], lastPoint[1], 3, 0, Math.PI * 2);
    ctx.fillStyle = colors.glow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastPoint[0], lastPoint[1], 1.5, 0, Math.PI * 2);
    ctx.fillStyle = colors.line;
    ctx.fill();

    // Value label on right
    ctx.fillStyle = colors.line;
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(data[data.length - 1].toFixed(1), w - 4, lastPoint[1] - 6);
  }, [dataPoints, min, max, colors]);

  useEffect(() => {
    // Initialize data
    dataRef.current = Array.from({ length: dataPoints }, () =>
      min + Math.random() * (max - min)
    );

    const interval = setInterval(() => {
      const next = generateNextValue();
      dataRef.current = [...dataRef.current.slice(1), next];
      setCurrentValue(next);

      const prev = dataRef.current[dataRef.current.length - 2];
      setTrend(next > prev ? 'up' : next < prev ? 'down' : 'flat');

      draw();
    }, speed);

    // Initial draw
    draw();

    return () => clearInterval(interval);
  }, [dataPoints, min, max, speed, generateNextValue, draw]);

  const trendColor = trend === 'up' ? 'text-neon-green' : trend === 'down' ? 'text-neon-red' : 'text-zinc-500';
  const trendArrow = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—';

  return (
    <div className={`border border-terminal-border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-surface">
        <span className="text-[8px] font-bold text-zinc-600 tracking-[0.2em]">{title}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-bold ${trendColor}`}>{trendArrow}</span>
          <span className={`text-[9px] font-bold ${COLOR_MAP[color].line === '#F59E0B' ? 'text-neon-amber' : COLOR_MAP[color].line === '#06B6D4' ? 'text-neon-cyan' : COLOR_MAP[color].line === '#22C55E' ? 'text-neon-green' : 'text-neon-red'}`}>
            {currentValue.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-[80px] bg-black"
      />
    </div>
  );
}
