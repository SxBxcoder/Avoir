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
  amber: { line: '#F59E0B', fill: 'rgba(245, 158, 11, 0.08)', glow: 'rgba(245, 158, 11, 0.4)', text: 'text-neon-amber' },
  cyan: { line: '#06B6D4', fill: 'rgba(6, 182, 212, 0.08)', glow: 'rgba(6, 182, 212, 0.4)', text: 'text-neon-cyan' },
  green: { line: '#22C55E', fill: 'rgba(34, 197, 94, 0.08)', glow: 'rgba(34, 197, 94, 0.4)', text: 'text-neon-green' },
  red: { line: '#EF4444', fill: 'rgba(239, 68, 68, 0.08)', glow: 'rgba(239, 68, 68, 0.4)', text: 'text-neon-red' },
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
  const containerRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<number[]>([]);
  const [currentValue, setCurrentValue] = useState(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'flat'>('flat');
  const [changePercent, setChangePercent] = useState(0);
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const colors = COLOR_MAP[color];

  const generateNextValue = useCallback(() => {
    const data = dataRef.current;
    if (data.length === 0) return (min + max) / 2;
    const last = data[data.length - 1];
    const volatility = (max - min) * 0.08;
    const drift = (Math.random() - 0.48) * volatility;
    return Math.max(min, Math.min(max, last + drift));
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
    const padLeft = 35;
    const padRight = 4;
    const chartW = w - padLeft - padRight;

    ctx.clearRect(0, 0, w, h);

    // Y-axis labels + grid lines
    ctx.font = '7px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      const val = max - (i / 4) * (max - min);

      // Grid line
      ctx.strokeStyle = '#151515';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#444';
      ctx.fillText(val.toFixed(0), padLeft - 4, y + 3);
    }

    if (data.length < 2) return;

    // Calculate points
    const step = chartW / (dataPoints - 1);
    const points: [number, number][] = data.map((val, idx) => {
      const x = padLeft + idx * step;
      const normalized = (val - min) / (max - min);
      const y = h - normalized * h;
      return [x, y];
    });

    // Find high/low
    let highIdx = 0, lowIdx = 0;
    data.forEach((v, i) => {
      if (v > data[highIdx]) highIdx = i;
      if (v < data[lowIdx]) lowIdx = i;
    });

    // Fill under line
    ctx.beginPath();
    ctx.moveTo(points[0][0], h);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(points[points.length - 1][0], h);
    ctx.closePath();
    ctx.fillStyle = colors.fill;
    ctx.fill();

    // Glow line (wider, blurred)
    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Crisp line on top
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    ctx.stroke();

    // High marker (triangle)
    const [hx, hy] = points[highIdx];
    ctx.beginPath();
    ctx.moveTo(hx, hy - 6);
    ctx.lineTo(hx - 3, hy - 1);
    ctx.lineTo(hx + 3, hy - 1);
    ctx.closePath();
    ctx.fillStyle = colors.line;
    ctx.fill();

    // Low marker (inverted triangle)
    const [lx, ly] = points[lowIdx];
    ctx.beginPath();
    ctx.moveTo(lx, ly + 6);
    ctx.lineTo(lx - 3, ly + 1);
    ctx.lineTo(lx + 3, ly + 1);
    ctx.closePath();
    ctx.fillStyle = '#EF4444';
    ctx.fill();

    // Last point glow
    const lastPoint = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(lastPoint[0], lastPoint[1], 4, 0, Math.PI * 2);
    ctx.fillStyle = colors.glow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastPoint[0], lastPoint[1], 2, 0, Math.PI * 2);
    ctx.fillStyle = colors.line;
    ctx.fill();

    // Reference line (median)
    const median = (min + max) / 2;
    const medianY = h - ((median - min) / (max - min)) * h;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, medianY);
    ctx.lineTo(w - padRight, medianY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crosshair on hover
    if (mouseX !== null && mouseX >= padLeft && mouseX <= w - padRight) {
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(mouseX, 0);
      ctx.lineTo(mouseX, h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Find nearest data point
      const idx = Math.round((mouseX - padLeft) / step);
      if (idx >= 0 && idx < data.length) {
        const val = data[idx];
        const py = h - ((val - min) / (max - min)) * h;

        // Horizontal line
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.moveTo(padLeft, py);
        ctx.lineTo(w - padRight, py);
        ctx.stroke();
        ctx.setLineDash([]);

        // Value tooltip
        ctx.fillStyle = '#222';
        ctx.fillRect(w - padRight - 32, py - 8, 30, 14);
        ctx.fillStyle = colors.line;
        ctx.font = '8px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(val.toFixed(1), w - padRight - 4, py + 3);
      }
    }
  }, [dataPoints, min, max, colors, mouseX]);

  useEffect(() => {
    dataRef.current = Array.from({ length: dataPoints }, () =>
      min + Math.random() * (max - min)
    );

    const interval = setInterval(() => {
      const next = generateNextValue();
      dataRef.current = [...dataRef.current.slice(1), next];
      setCurrentValue(next);

      const prev = dataRef.current[dataRef.current.length - 2];
      setTrend(next > prev ? 'up' : next < prev ? 'down' : 'flat');

      // Change from first data point
      const first = dataRef.current[0];
      setChangePercent(((next - first) / first) * 100);

      draw();
    }, speed);

    draw();
    return () => clearInterval(interval);
  }, [dataPoints, min, max, speed, generateNextValue, draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouseX(e.clientX - rect.left);
    draw();
  };

  const handleMouseLeave = () => {
    setMouseX(null);
    draw();
  };

  const trendColor = trend === 'up' ? 'text-neon-green' : trend === 'down' ? 'text-neon-red' : 'text-zinc-500';
  const changeColor = changePercent >= 0 ? 'text-neon-green' : 'text-neon-red';

  return (
    <div className={`border border-terminal-border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-terminal-border bg-terminal-surface">
        <span className="text-[8px] font-bold text-zinc-600 tracking-[0.2em]">{title}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[8px] ${changeColor} font-bold`}>
            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
          </span>
          <span className={`text-[9px] font-bold ${trendColor}`}>
            {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}
          </span>
          <span className={`text-[9px] font-bold ${colors.text}`}>
            {currentValue.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-[100px] bg-black cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>
    </div>
  );
}
