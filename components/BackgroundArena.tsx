"use client";

// BackgroundArena.tsx — Full-screen living particle background.
//
// 120 slow-drifting star particles that:
// - Flee the cursor (magnetic repulsion on mouse move)
// - Are linked by thin lines when nearby
// - Stay ambient and non-distracting (speed 0.3–0.8)
//
// Uses @tsparticles/react + tsparticles-slim engine.

import { useCallback, useEffect, useState } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine } from "@tsparticles/engine";

export default function BackgroundArena() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine: Engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  const options = {
    fullScreen: { enable: false },
    fpsLimit: 60,
    particles: {
      number: { value: 120, density: { enable: true } },
      color: {
        value: ["#7C3AED", "#3B82F6", "#FFFFFF"],
      },
      opacity: {
        value: { min: 0.15, max: 0.55 },
        animation: { enable: true, speed: 0.6, sync: false },
      },
      size: {
        value: { min: 1, max: 3 },
        animation: { enable: false },
      },
      move: {
        enable: true,
        speed: { min: 0.3, max: 0.8 },
        direction: "none" as const,
        random: true,
        straight: false,
        outModes: { default: "bounce" as const },
      },
      links: {
        enable: true,
        distance: 100,
        color: "#FFFFFF",
        opacity: 0.15,
        width: 1,
      },
    },
    interactivity: {
      events: {
        onHover: {
          enable: true,
          mode: ["repulse", "grab"] as string[],
        },
        resize: { enable: true },
      },
      modes: {
        repulse: {
          distance: 90,
          duration: 0.4,
          factor: 8,
          speed: 1,
        },
        grab: {
          distance: 140,
          links: { opacity: 0.35 },
        },
      },
    },
    detectRetina: true,
  };

  if (!ready) return null;

  return (
    <Particles
      id="arena-bg"
      options={options}
      className="fixed inset-0 z-0 pointer-events-auto w-full h-full"
    />
  );
}
