'use client';

import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
  speed: number;
  phase: number;
}

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Generate stars
    const stars: Star[] = Array.from({ length: 200 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.3,
      opacity: Math.random() * 0.7 + 0.1,
      speed: Math.random() * 0.5 + 0.2,
      phase: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.005;

      stars.forEach((star) => {
        const pulse = 0.5 + 0.5 * Math.sin(t * star.speed + star.phase);
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148, 163, 255, ${star.opacity * pulse})`;
        ctx.fill();
      });

      // Occasional shooting star
      if (Math.random() < 0.002) {
        const sx = Math.random() * canvas.width;
        const sy = Math.random() * canvas.height * 0.4;
        const len = Math.random() * 80 + 40;
        const grad = ctx.createLinearGradient(sx, sy, sx + len, sy + len * 0.5);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(148,163,255,0.8)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + len, sy + len * 0.5);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
