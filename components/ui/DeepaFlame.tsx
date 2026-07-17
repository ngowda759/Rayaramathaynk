"use client";

import { useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface DeepaFlameProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  enableSparks?: boolean;
  glowIntensity?: "low" | "medium" | "high";
}

const sizeConfig = {
  sm: { flame: 24, base: 32, glow: 60 },
  md: { flame: 40, base: 48, glow: 100 },
  lg: { flame: 56, base: 72, glow: 140 },
  xl: { flame: 80, base: 96, glow: 200 },
};

export function DeepaFlame({
  size = "lg",
  className = "",
  enableSparks = true,
  glowIntensity = "medium",
}: DeepaFlameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    opacity: number;
  }>>([]);

  const config = sizeConfig[size];

  const glowOpacity = useMemo(() => {
    switch (glowIntensity) {
      case "low": return 0.3;
      case "medium": return 0.5;
      case "high": return 0.7;
      default: return 0.5;
    }
  }, [glowIntensity]);

  // Generate random flicker parameters
  const flickerParams = useMemo(() => ({
    baseY: config.flame * 0.3,
    amplitude: config.flame * 0.15,
    speed: 0.08 + Math.random() * 0.04,
    offset: Math.random() * Math.PI * 2,
  }), [config.flame]);

  useEffect(() => {
    if (reducedMotion || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = config.glow;
    const canvasHeight = config.glow;
    
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(dpr, dpr);

    let time = 0;

    const createSpark = (canvasW: number, canvasH: number) => {
      const centerX = canvasW / 2;
      const centerY = canvasH / 2 - config.flame * 0.3;
      
      return {
        x: centerX + (Math.random() - 0.5) * 10,
        y: centerY,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2 - 1,
        life: 0,
        maxLife: 30 + Math.random() * 30,
        size: 1 + Math.random() * 2,
        opacity: 1,
      };
    };

    const animate = () => {
      time += flickerParams.speed;

      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      // Calculate flicker
      const flicker = Math.sin(time) * flickerParams.amplitude +
                      Math.sin(time * 2.3 + flickerParams.offset) * (flickerParams.amplitude * 0.5) +
                      Math.sin(time * 3.7 + flickerParams.offset * 0.7) * (flickerParams.amplitude * 0.3);

      const flameHeight = config.flame + flicker;

      // Draw outer glow
      const outerGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, config.glow * 0.5
      );
      outerGlow.addColorStop(0, `rgba(255, 180, 50, ${glowOpacity * 0.8})`);
      outerGlow.addColorStop(0.3, `rgba(255, 150, 30, ${glowOpacity * 0.4})`);
      outerGlow.addColorStop(0.6, `rgba(255, 120, 0, ${glowOpacity * 0.15})`);
      outerGlow.addColorStop(1, "rgba(255, 100, 0, 0)");

      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, config.glow * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw flame
      const flameGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, flameHeight
      );
      flameGradient.addColorStop(0, "rgba(255, 255, 200, 1)");
      flameGradient.addColorStop(0.1, "rgba(255, 220, 100, 1)");
      flameGradient.addColorStop(0.3, "rgba(255, 180, 50, 1)");
      flameGradient.addColorStop(0.6, "rgba(255, 120, 20, 0.9)");
      flameGradient.addColorStop(0.8, "rgba(255, 80, 0, 0.6)");
      flameGradient.addColorStop(1, "rgba(255, 50, 0, 0)");

      // Draw flame shape (teardrop)
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      
      // Left curve
      ctx.bezierCurveTo(
        centerX - flameHeight * 0.4, centerY - flameHeight * 0.5,
        centerX - flameHeight * 0.3, centerY - flameHeight * 0.8,
        centerX, centerY - flameHeight
      );
      
      // Right curve
      ctx.bezierCurveTo(
        centerX + flameHeight * 0.3, centerY - flameHeight * 0.8,
        centerX + flameHeight * 0.4, centerY - flameHeight * 0.5,
        centerX, centerY
      );
      
      ctx.fillStyle = flameGradient;
      ctx.fill();

      // Inner bright core
      const coreGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, config.flame * 0.4
      );
      coreGradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      coreGradient.addColorStop(0.5, "rgba(255, 240, 180, 0.8)");
      coreGradient.addColorStop(1, "rgba(255, 200, 100, 0)");

      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY - config.flame * 0.1, config.flame * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Generate and draw sparks
      if (enableSparks && Math.random() < 0.15) {
        particlesRef.current.push(createSpark(canvasWidth, canvasHeight));
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // Slight gravity
        p.opacity = 1 - (p.life / p.maxLife);

        if (p.life >= p.maxLife || p.opacity <= 0) return false;

        // Draw spark
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 220, 100, ${p.opacity})`;
        ctx.fill();

        return true;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [reducedMotion, config, flickerParams, enableSparks, glowOpacity]);

  // Reduced motion fallback - static glowing flame
  if (reducedMotion) {
    return (
      <div className={`relative ${className}`} style={{ width: config.glow, height: config.glow }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(255,180,50,${glowOpacity}) 0%, rgba(255,120,0,${glowOpacity * 0.5}) 40%, transparent 70%)`,
            transform: "scale(1.2)",
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: config.flame * 0.8,
            height: config.flame * 0.8,
            top: "50%",
            transform: "translate(-50%, -70%)",
            background: "radial-gradient(circle, rgba(255,255,200,1) 0%, rgba(255,220,100,0.8) 50%, rgba(255,150,50,0) 100%)",
          }}
        />
      </div>
    );
  }

  return (
    <motion.div
      className={`relative ${className}`}
      style={{ width: config.glow, height: config.glow }}
      animate={{
        y: [-1, 2, -1],
        opacity: [0.9, 1, 0.9],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: config.glow, height: config.glow }}
      />
    </motion.div>
  );
}
