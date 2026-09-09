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
    let visible = true;
    let dots: Dot[] = [];
    const pointer = { x: -1000, y: -1000 };
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = width * ratio; canvas.height = height * ratio;
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      dots = Array.from({ length: Math.min(58, Math.max(24, Math.floor(width * height / 32000))) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: reducedMotion.matches ? 0 : (Math.random() - .5) * .18,
        vy: reducedMotion.matches ? 0 : (Math.random() - .5) * .18,
        r: .8 + Math.random() * 1.35,
      }));
    };
    const move = (event: PointerEvent) => { pointer.x = event.clientX; pointer.y = event.clientY; };
    const leave = () => { pointer.x = -1000; pointer.y = -1000; };
    const draw = () => {
      if (!visible) return;
      context.clearRect(0, 0, width, height);
      dots.forEach((dot, index) => {
        const dx = pointer.x - dot.x; const dy = pointer.y - dot.y; const distance = Math.hypot(dx, dy) || 1;
        if (!reducedMotion.matches && finePointer.matches && distance < 125) {
          const force = (1 - distance / 125) * .024;
          dot.vx -= dx / distance * force;
          dot.vy -= dy / distance * force;
        }
        if (!reducedMotion.matches) {
          dot.x += dot.vx; dot.y += dot.vy; dot.vx *= .992; dot.vy *= .992;
        }
        if (dot.x < 0 || dot.x > width) dot.vx *= -1;
        if (dot.y < 0 || dot.y > height) dot.vy *= -1;
        context.fillStyle = index % 3 === 0 ? 'rgba(251,191,36,.42)' : index % 2 ? 'rgba(105,183,245,.46)' : 'rgba(153,69,255,.44)';
        context.beginPath(); context.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2); context.fill();
      });
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
    };
    const visibility = () => {
      visible = !document.hidden;
      if (visible) {
        cancelAnimationFrame(frame);
        draw();
      }
    };
    resize(); draw();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true"><div className="crypto-night absolute inset-0" /><div className="orb orb-a" /><div className="orb orb-b" /><div className="orb orb-c" /><div className="dot-matrix absolute inset-0" /><canvas ref={canvasRef} className="absolute inset-0 opacity-80" /><div className="crypto-frost absolute inset-0" /></div>;
}
