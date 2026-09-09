'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

const resetSceneVariables = (scene: HTMLDivElement) => {
  scene.style.setProperty('--hero-move-x', '0px');
  scene.style.setProperty('--hero-move-y', '0px');
  scene.style.setProperty('--hero-drift-x', '0px');
  scene.style.setProperty('--hero-drift-y', '0px');
  scene.style.setProperty('--hero-rotate-x', '0deg');
  scene.style.setProperty('--hero-rotate-y', '0deg');
};

export function HeroRewardScene() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const updateScene = (clientX: number, clientY: number) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const bounds = scene.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((clientX - bounds.left) / bounds.width - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, ((clientY - bounds.top) / bounds.height - 0.5) * 2));

    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(() => {
      scene.style.setProperty('--hero-move-x', `${(x * 10).toFixed(2)}px`);
      scene.style.setProperty('--hero-move-y', `${(y * 8).toFixed(2)}px`);
      scene.style.setProperty('--hero-drift-x', `${(x * -6).toFixed(2)}px`);
      scene.style.setProperty('--hero-drift-y', `${(y * -5).toFixed(2)}px`);
      scene.style.setProperty('--hero-rotate-x', `${(y * -3.5).toFixed(2)}deg`);
      scene.style.setProperty('--hero-rotate-y', `${(x * 4.5).toFixed(2)}deg`);
      animationFrameRef.current = null;
    });
  };

  const resetScene = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    resetSceneVariables(scene);
  };

  return (
    <figure
      ref={sceneRef}
      className="hero-reward-scene"
      onPointerMove={(event) => updateScene(event.clientX, event.clientY)}
      onPointerLeave={resetScene}
      aria-labelledby="hero-reward-caption"
    >
      <div className="hero-scene-grid" aria-hidden="true" />
      <div className="hero-scene-glow" aria-hidden="true" />
      <div className="hero-orbit hero-orbit-outer" aria-hidden="true" />
      <div className="hero-orbit hero-orbit-inner" aria-hidden="true" />

      <div className="hero-chest-layer" aria-hidden="true">
        <Image
          src="/assets/images/Chest.png"
          alt=""
          width={1254}
          height={1254}
          priority
          sizes="(max-width: 1023px) 82vw, 42vw"
          className="hero-chest-image"
        />
      </div>

      <div className="hero-coin-layer" aria-hidden="true">
        <Image
          src="/assets/images/Coin.png"
          alt=""
          width={2162}
          height={1984}
          sizes="(max-width: 640px) 22vw, 140px"
          className="h-full w-full object-contain"
        />
      </div>

      <div className="hero-diamond-layer" aria-hidden="true">
        <Image
          src="/assets/images/Diamond.png"
          alt=""
          width={2048}
          height={2048}
          sizes="(max-width: 640px) 22vw, 150px"
          className="h-full w-full object-contain"
        />
      </div>

      <div className="hero-status-chip hero-status-chip-top" aria-hidden="true">
        <span className="hero-status-dot" />
        Verified streak
      </div>
      <div className="hero-status-chip hero-status-chip-bottom" aria-hidden="true">
        5 cosmetic tiers
      </div>

      <figcaption id="hero-reward-caption" className="sr-only">
        SolStreak cosmetic reward chest with a floating SolStreak coin and diamond.
      </figcaption>
    </figure>
  );
}
