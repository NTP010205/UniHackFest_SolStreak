'use client';

import { useEffect, useRef } from 'react';

type Dot = { x: number; y: number; vx: number; vy: number; r: number };

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    let width = 0;
    let height = 0;
    let frame = 0;
    let dots: Dot[] = [];
    const pointer = { x: -1000, y: -1000 };
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = width * ratio; canvas.height = height * ratio;
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      dots = Array.from({ length: Math.min(90, Math.floor(width * height / 22000)) }, () => ({ x: Math.random() * width, y: Math.random() * height, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, r: 1 + Math.random() * 1.8 }));
    };
    const move = (event: PointerEvent) => { pointer.x = event.clientX; pointer.y = event.clientY; };
    const draw = () => {
      context.clearRect(0, 0, width, height);
      dots.forEach((dot, index) => {
        const dx = pointer.x - dot.x; const dy = pointer.y - dot.y; const distance = Math.hypot(dx, dy) || 1;
        if (distance < 150) { dot.vx -= dx / distance * .015; dot.vy -= dy / distance * .015; }
        dot.x += dot.vx; dot.y += dot.vy; dot.vx *= .995; dot.vy *= .995;
        if (dot.x < 0 || dot.x > width) dot.vx *= -1;
        if (dot.y < 0 || dot.y > height) dot.vy *= -1;
        context.fillStyle = index % 2 ? 'rgba(105,183,245,.58)' : 'rgba(153,69,255,.55)';
        context.beginPath(); context.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2); context.fill();
      });
      frame = requestAnimationFrame(draw);
    };
    resize(); draw();
    window.addEventListener('resize', resize); window.addEventListener('pointermove', move);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', move); };
  }, []);
  return <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true"><div className="crypto-night absolute inset-0" /><div className="orb orb-a" /><div className="orb orb-b" /><div className="orb orb-c" /><canvas ref={canvasRef} className="absolute inset-0" /><div className="crypto-frost absolute inset-0" /></div>;
}
