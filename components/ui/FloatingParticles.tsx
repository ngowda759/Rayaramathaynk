"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface FloatingParticlesProps {
  count?: number;
  className?: string;
  color?: string;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  blur?: boolean;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  type: "circle" | "dot" | "star" | "petal";
}

export function FloatingParticles({
  count = 30,
  className = "",
  color = "rgba(251, 191, 36, 0.4)",
  minSize = 2,
  maxSize = 6,
  speed = 0.3,
  blur = false,
}: FloatingParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const animationRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Generate initial particles
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, () => ({
      x: Math.random() * dimensions.width,
      y: Math.random() * dimensions.height,
      size: minSize + Math.random() * (maxSize - minSize),
      speedX: (Math.random() - 0.5) * speed,
      speedY: (Math.random() - 0.5) * speed * 0.5,
      opacity: 0.2 + Math.random() * 0.6,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.02,
      type: ["circle", "dot", "star", "petal"][Math.floor(Math.random() * 4)] as Particle["type"],
    }));
  }, [count, dimensions.width, dimensions.height, minSize, maxSize, speed]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Set dimensions
    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    if (reducedMotion || !canvasRef.current || dimensions.width === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawParticle = (particle: Particle) => {
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.globalAlpha = particle.opacity;

      if (blur) {
        ctx.filter = "blur(1px)";
      }

      ctx.fillStyle = color;

      switch (particle.type) {
        case "circle":
          ctx.beginPath();
          ctx.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
          ctx.fill();
          break;

        case "dot":
          ctx.beginPath();
          ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
          ctx.fill();
          break;

        case "star":
          drawStar(ctx, 0, 0, 4, particle.size, particle.size / 2);
          break;

        case "petal":
          drawPetal(ctx, particle.size);
          break;
      }

      ctx.restore();
    };

    const drawStar = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      spikes: number,
      outerRadius: number,
      innerRadius: number
    ) => {
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);

      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(
          cx + Math.cos(rot) * outerRadius,
          cy + Math.sin(rot) * outerRadius
        );
        rot += step;
        ctx.lineTo(
          cx + Math.cos(rot) * innerRadius,
          cy + Math.sin(rot) * innerRadius
        );
        rot += step;
      }

      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fill();
    };

    const drawPetal = (ctx: CanvasRenderingContext2D, size: number) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, size / 2, size, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    const animate = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      particles.forEach((particle) => {
        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;
        particle.rotation += particle.rotationSpeed;

        // Wrap around edges
        if (particle.x < -particle.size) particle.x = dimensions.width + particle.size;
        if (particle.x > dimensions.width + particle.size) particle.x = -particle.size;
        if (particle.y < -particle.size) particle.y = dimensions.height + particle.size;
        if (particle.y > dimensions.height + particle.size) particle.y = -particle.size;

        // Subtle opacity variation
        particle.opacity += (Math.random() - 0.5) * 0.02;
        particle.opacity = Math.max(0.1, Math.min(0.8, particle.opacity));

        drawParticle(particle);
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [reducedMotion, dimensions, particles, color, blur]);

  if (reducedMotion) {
    return null; // No particles for reduced motion
  }

  return (
    <div ref={containerRef} className={`absolute inset-0 overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}

// Decorative floating element component
interface FloatingElementProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  yOffset?: number;
  xOffset?: number;
  rotation?: number;
}

export function FloatingElement({
  children,
  className = "",
  delay = 0,
  duration = 4,
  yOffset = 10,
  xOffset = 0,
  rotation = 0,
}: FloatingElementProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className}>
      <motion.div
        animate={{
          y: [-yOffset / 2, yOffset / 2, -yOffset / 2],
          x: [-xOffset / 2, xOffset / 2, -xOffset / 2],
          rotate: [-rotation / 2, rotation / 2, -rotation / 2],
        }}
        transition={{
          duration,
          delay,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// Simplified floating dots for backgrounds
interface FloatingDotsProps {
  count?: number;
  className?: string;
  size?: number;
  color?: string;
}

export function FloatingDots({
  count = 20,
  className = "",
  size = 4,
  color = "rgba(251, 191, 36, 0.3)",
}: FloatingDotsProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return null;
  }

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            backgroundColor: color,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            delay: Math.random() * 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
