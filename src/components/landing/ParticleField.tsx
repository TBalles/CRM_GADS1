"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Canvas de particulas de la landing. Tres modos:
 *
 * - `logo`:  las particulas arman el isotipo (el arco) y vuelven a su lugar
 *            despues de que el mouse o una patada las desordenan.
 * - `halo`:  una nube circular, densa en el borde, detras de la vitrina de
 *            producto.
 * - `stars`: un cielo que sube despacio y titila, fijo detras de toda la pagina.
 *
 * Es un canvas 2D con arrays tipados y sin librerias: con ~2.500 particulas
 * alcanza de sobra y no suma dependencias. Se pausa solo cuando sale de
 * pantalla o cuando la pestana no esta visible, y con `prefers-reduced-motion`
 * dibuja un solo cuadro quieto.
 */

type Mode = "logo" | "halo" | "stars";

/** Evento que dispara el cursor-pelota al hacer clic: empuja las particulas. */
export const KICK_EVENT = "tn:kick";

/**
 * Misma geometria que <GoalMark> (src/components/Logo.tsx), separada en sus
 * tres partes. Si el isotipo cambia, cambia aca tambien.
 *
 * Se muestrean POR SEPARADO a proposito: con el logo entero, la red y el marco
 * salian con la misma densidad y el mismo color, y el arco se leia como una
 * mancha cuadrada. Asi cada parte tiene su propia densidad y su color — marco
 * verde y denso, pelota blanca, red rala y tenue — y el ojo las separa.
 */
const PARTES = {
  marco:
    '<g stroke-width="3" stroke-linecap="round"><path d="M6 8.5h20"/><path d="M6.5 9.5v14M25.5 9.5v14"/></g>',
  pelota: '<circle cx="16" cy="19.5" r="4.5" fill="#fff" stroke="none"/>',
  red: '<g stroke-width="0.7"><path d="M11.5 8.5v15M16 8.5v15M20.5 8.5v15"/><path d="M6 13.5h20M6 18.5h20"/></g>',
} as const;

function svgDe(parte: string, size: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" fill="none" stroke="#fff">${parte}</svg>`;
}

/** Rasteriza una parte del isotipo y devuelve puntos donde hay tinta. */
async function samplePart(parte: string, size: number, max: number): Promise<number[]> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDe(parte, size))}`;
  await img.decode();

  const off = document.createElement("canvas");
  off.width = off.height = size;
  const c = off.getContext("2d", { willReadFrequently: true });
  if (!c) return [];
  c.drawImage(img, 0, 0, size, size);
  const { data } = c.getImageData(0, 0, size, size);

  const step = Math.max(2, Math.round(size / 160));
  const pts: number[] = [];
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const a = data[(y * size + x) * 4 + 3];
      if (a > 16 && Math.random() < a / 255) {
        pts.push(x + (Math.random() - 0.5) * step, y + (Math.random() - 0.5) * step);
      }
    }
  }

  const count = pts.length / 2;
  if (count <= max) return pts;
  const keep = max / count;
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    if (Math.random() < keep) out.push(pts[i], pts[i + 1]);
  }
  return out;
}

/** Colores: 0-2 verde de marca (fuerte → tenue), 3-4 blanco (fuerte → tenue). */
const BUCKETS = 5;

type Semilla = { tx: number; ty: number; c: number; s: number };

function pick<T>(weights: readonly [T, number][]): T {
  let r = Math.random();
  for (const [v, w] of weights) {
    if ((r -= w) <= 0) return v;
  }
  return weights[weights.length - 1][0];
}

/** Gaussiana barata (Box-Muller). */
function gauss() {
  return Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());
}

async function semillas(mode: Mode, w: number, h: number): Promise<Semilla[]> {
  const out: Semilla[] = [];
  const desktop = w >= 1024;

  if (mode === "logo") {
    const size = Math.round(
      desktop ? Math.min(w * 0.4, h * 0.8, 580) : Math.min(w * 0.9, h * 0.55, 420),
    );
    const cx = desktop ? w * 0.72 : w / 2;
    const cy = desktop ? h / 2 : h * 0.58;
    const f = desktop ? 1 : 0.5;
    const [marco, pelota, red] = await Promise.all([
      samplePart(PARTES.marco, size, Math.round(1300 * f)),
      samplePart(PARTES.pelota, size, Math.round(650 * f)),
      samplePart(PARTES.red, size, Math.round(800 * f)),
    ]);
    const ox = cx - size / 2;
    const oy = cy - size * 0.51; // el dibujo esta un poco corrido hacia abajo en su viewBox

    const agregar = (pts: number[], color: () => number, tam: () => number) => {
      for (let i = 0; i < pts.length; i += 2) {
        out.push({ tx: ox + pts[i], ty: oy + pts[i + 1], c: color(), s: tam() });
      }
    };
    agregar(
      marco,
      () => pick([[0, 0.62], [1, 0.26], [3, 0.12]] as const),
      () => 1.3 + Math.random() * 1.5,
    );
    agregar(
      pelota,
      () => pick([[3, 0.78], [0, 0.22]] as const),
      () => 1.3 + Math.random() * 1.4,
    );
    agregar(
      red,
      () => pick([[1, 0.3], [2, 0.45], [4, 0.25]] as const),
      () => 0.9 + Math.random() * 0.9,
    );

    // Polvo alrededor del arco: la textura de nube de la referencia. Poco y
    // cerca, para que no le borre el contorno a la forma.
    const dust = Math.round(out.length * 0.18);
    for (let i = 0; i < dust; i++) {
      out.push({
        tx: cx + gauss() * size * 0.26,
        ty: cy + gauss() * size * 0.2,
        c: pick([[2, 0.6], [4, 0.4]] as const),
        s: 0.7 + Math.random() * 1,
      });
    }
    return out;
  }

  if (mode === "halo") {
    const n = desktop ? 1600 : 700;
    const r = Math.min(w, h) * (desktop ? 0.5 : 0.46);
    const cx = w / 2;
    const cy = h * 0.42;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      // Exponente < 1: la mayoria cae cerca del borde, como una esfera vista de frente.
      const rr = r * (0.3 + 0.7 * Math.pow(Math.random(), 0.3));
      out.push({
        tx: cx + Math.cos(a) * rr,
        ty: cy + Math.sin(a) * rr,
        c: pick([[0, 0.2], [1, 0.25], [2, 0.3], [3, 0.1], [4, 0.15]] as const),
        s: 0.9 + Math.random() * 1.4,
      });
    }
    return out;
  }

  const n = Math.round(Math.min(340, Math.max(90, (w * h) / 6500)));
  for (let i = 0; i < n; i++) {
    out.push({
      tx: Math.random() * w,
      ty: Math.random() * h,
      c: pick([[1, 0.22], [3, 0.3], [4, 0.48]] as const),
      s: 0.7 + Math.random() * 1.3,
    });
  }
  return out;
}

export default function ParticleField({ mode, className }: { mode: Mode; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // El verde sale del token --glow de la landing: el color de marca vive en
    // un solo lugar (globals.css), no duplicado en JS.
    const glow = getComputedStyle(canvas).getPropertyValue("--glow").trim() || "156 84% 58%";
    const styles = [
      `hsl(${glow} / 0.95)`,
      `hsl(${glow} / 0.6)`,
      `hsl(${glow} / 0.28)`,
      "rgba(255,255,255,0.9)",
      "rgba(255,255,255,0.4)",
    ];

    let w = 0;
    let h = 0;
    let n = 0;
    let x = new Float32Array(0);
    let y = new Float32Array(0);
    let vx = new Float32Array(0);
    let vy = new Float32Array(0);
    let tx = new Float32Array(0);
    let ty = new Float32Array(0);
    let sz = new Float32Array(0);
    let ph = new Float32Array(0);
    let col = new Uint8Array(0);
    // Particulas ordenadas por color: se cambia fillStyle 5 veces por cuadro, no 2.500.
    let rangos: number[] = [];

    const mouse = { cx: -1e4, cy: -1e4 };
    let kick: { cx: number; cy: number } | null = null;
    let raf = 0;
    let onScreen = true;
    let buildId = 0;
    let lastWidth = -1;

    async function build() {
      const id = ++buildId;
      const seeds = await semillas(mode, w, h);
      if (id !== buildId) return; // hubo otro resize mientras se rasterizaba el logo

      seeds.sort((a, b) => a.c - b.c);
      const prevN = n;
      const px = x;
      const py = y;

      n = seeds.length;
      x = new Float32Array(n);
      y = new Float32Array(n);
      vx = new Float32Array(n);
      vy = new Float32Array(n);
      tx = new Float32Array(n);
      ty = new Float32Array(n);
      sz = new Float32Array(n);
      ph = new Float32Array(n);
      col = new Uint8Array(n);
      rangos = new Array(BUCKETS + 1).fill(n);

      for (let i = 0; i < n; i++) {
        const s = seeds[i];
        tx[i] = s.tx;
        ty[i] = s.ty;
        sz[i] = s.s;
        col[i] = s.c;
        ph[i] = Math.random() * Math.PI * 2;
        if (rangos[s.c] === n) rangos[s.c] = i;

        if (reduce || mode === "stars") {
          x[i] = s.tx;
          y[i] = s.ty;
        } else if (i < prevN) {
          // En un resize, cada particula viaja desde donde estaba.
          x[i] = px[i];
          y[i] = py[i];
        } else {
          // Primera carga: arrancan desparramadas y se arman solas.
          x[i] = Math.random() * w;
          y[i] = Math.random() * h;
        }
      }
      // Un color sin particulas hereda el inicio del siguiente.
      for (let b = BUCKETS - 1; b >= 0; b--) rangos[b] = Math.min(rangos[b], rangos[b + 1]);

      if (reduce) draw(0);
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // En mobile, la barra del navegador cambia el alto al scrollear. Para el
      // cielo solo importa el ancho: rearmarlo en cada scroll lo haria parpadear.
      if (mode === "stars" && w === lastWidth) {
        if (reduce) draw(0);
        return;
      }
      lastWidth = w;
      void build();
    }

    function step(t: number) {
      const rect = canvas!.getBoundingClientRect();
      const mx = mouse.cx - rect.left;
      const my = mouse.cy - rect.top;
      const stars = mode === "stars";
      const R = stars ? 110 : 135;
      const R2 = R * R;
      const push = stars ? 1.4 : 3.4;
      const k = stars ? 0.012 : 0.05;

      let kx = 0;
      let ky = 0;
      const KR = 300;
      if (kick) {
        kx = kick.cx - rect.left;
        ky = kick.cy - rect.top;
      }

      for (let i = 0; i < n; i++) {
        if (stars) {
          // El cielo sube despacio y da la vuelta.
          ty[i] -= 0.06 + sz[i] * 0.03;
          if (ty[i] < -4) {
            ty[i] = h + 4;
            y[i] = ty[i];
            tx[i] = Math.random() * w;
            x[i] = tx[i];
          }
        }

        // Respiracion en reposo: nunca quedan del todo quietas.
        const bx = tx[i] + Math.sin(t * 0.0011 + ph[i]) * 1.3;
        const by = ty[i] + Math.cos(t * 0.0013 + ph[i]) * 1.3;
        let ax = (bx - x[i]) * k;
        let ay = (by - y[i]) * k;

        const dx = x[i] - mx;
        const dy = y[i] - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = (1 - d / R) * push;
          ax += (dx / d) * f;
          ay += (dy / d) * f;
        }

        if (kick) {
          const kdx = x[i] - kx;
          const kdy = y[i] - ky;
          const kd = Math.sqrt(kdx * kdx + kdy * kdy);
          if (kd < KR && kd > 0.01) {
            const f = (1 - kd / KR) * (stars ? 9 : 24);
            vx[i] += (kdx / kd) * f;
            vy[i] += (kdy / kd) * f;
          }
        }

        vx[i] = (vx[i] + ax) * 0.86;
        vy[i] = (vy[i] + ay) * 0.86;
        x[i] += vx[i];
        y[i] += vy[i];
      }
      kick = null;
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, w, h);
      if (mode === "stars") {
        // Titileo por particula: con ~300 estrellas el cambio de alfa es barato.
        for (let b = 0; b < BUCKETS; b++) {
          ctx!.fillStyle = styles[b];
          for (let i = rangos[b]; i < rangos[b + 1]; i++) {
            ctx!.globalAlpha = reduce ? 0.8 : 0.45 + 0.55 * Math.abs(Math.sin(t * 0.0009 + ph[i]));
            ctx!.fillRect(x[i], y[i], sz[i], sz[i]);
          }
        }
        ctx!.globalAlpha = 1;
        return;
      }
      for (let b = 0; b < BUCKETS; b++) {
        ctx!.fillStyle = styles[b];
        for (let i = rangos[b]; i < rangos[b + 1]; i++) {
          const s = sz[i];
          ctx!.fillRect(x[i] - s / 2, y[i] - s / 2, s, s);
        }
      }
    }

    function loop(t: number) {
      raf = 0;
      if (!onScreen || document.hidden) return;
      step(t);
      draw(t);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      if (reduce || raf || !onScreen || document.hidden) return;
      raf = requestAnimationFrame(loop);
    }

    const onMove = (e: PointerEvent) => {
      mouse.cx = e.clientX;
      mouse.cy = e.clientY;
    };
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) {
        mouse.cx = -1e4;
        mouse.cy = -1e4;
      }
    };
    const onKick = (e: Event) => {
      const d = (e as CustomEvent<{ x: number; y: number }>).detail;
      kick = { cx: d.x, cy: d.y };
    };
    const onVisibility = () => start();

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      start();
    });

    resize();
    ro.observe(canvas);
    io.observe(canvas);
    if (!reduce) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerout", onOut);
      window.addEventListener(KICK_EVENT, onKick);
      document.addEventListener("visibilitychange", onVisibility);
    }
    start();

    return () => {
      buildId++;
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onOut);
      window.removeEventListener(KICK_EVENT, onKick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode]);

  return <canvas ref={ref} aria-hidden="true" className={cn("pointer-events-none", className)} />;
}
