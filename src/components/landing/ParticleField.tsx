"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Canvas de particulas de la landing. Dos modos:
 *
 * - `formas`: UN solo campo fijo detras de la pagina que arma una figura por
 *             seccion: el isotipo en el hero, despues un cono, una pelota, una
 *             de rugby, una copa, un silbato. Cada <section data-forma="..."> dice
 *             que figura va mientras cruza el centro de la pantalla; al cambiar,
 *             las MISMAS particulas viajan y se rearman. El mouse las empuja y
 *             la patada del cursor-pelota las desparrama.
 * - `stars`:  un cielo que sube despacio y titila, fijo detras de toda la pagina.
 *
 * Atributos de cada seccion (todos opcionales salvo data-forma):
 *   data-forma="cono"      una clave de FORMAS
 *   data-forma-x="0.75"    centro horizontal en desktop (0 = izquierda, 1 = derecha)
 *   data-forma-y="0.4"     centro vertical en desktop (subirla si abajo hay tarjetas)
 *   data-forma-op="0.5"    opacidad en desktop; baja donde la figura va detras de texto
 * En mobile la figura va siempre centrada y tenue, detras del texto.
 *
 * Es un canvas 2D con arrays tipados y sin librerias: con ~2.800 particulas
 * alcanza de sobra y no suma dependencias. Se pausa solo cuando la pestana no
 * esta visible, y con `prefers-reduced-motion` dibuja cuadros quietos.
 */

type Mode = "formas" | "stars";

/** Evento que dispara el cursor-pelota al hacer clic: empuja las particulas. */
export const KICK_EVENT = "tn:kick";

/* ── Figuras ────────────────────────────────────────────────────────────── */

/** Colores: 0-2 verde de marca (fuerte → tenue), 3-4 blanco (fuerte → tenue). */
const BUCKETS = 5;

type Pesos = readonly (readonly [number, number])[];

/**
 * Cada figura se dibuja en SVG (viewBox 32×32) separada en partes que se
 * muestrean POR SEPARADO: asi cada parte tiene su densidad y su color (contorno
 * verde y denso, detalles blancos, relleno ralo) y el ojo las distingue. Con la
 * figura entera todo salia igual de denso y se leia como una mancha.
 */
type Parte = { svg: string; max: number; colores: Pesos; tam: readonly [number, number] };
type Forma = { partes: Parte[]; ajusteY?: number };

const FUERTE: Pesos = [[0, 0.62], [1, 0.26], [3, 0.12]];
const BLANCO: Pesos = [[3, 0.78], [0, 0.22]];
const MEDIO: Pesos = [[0, 0.3], [1, 0.45], [2, 0.25]];
const TENUE: Pesos = [[1, 0.3], [2, 0.45], [4, 0.25]];
const T_FUERTE = [1.3, 2.8] as const;
const T_TENUE = [0.9, 1.8] as const;

type P = readonly [number, number];
const pt = (cx: number, cy: number, r: number, deg: number): P => {
  const a = (deg * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
};
const lista = (vs: readonly P[]) => vs.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function pelota(): Forma {
  // Vista de frente: pentagono central, cinco pentagonos cortados por el borde
  // y las costuras que los unen.
  const centro = Array.from({ length: 5 }, (_, k) => pt(16, 16, 3.8, -90 + 72 * k));
  const externos = Array.from({ length: 5 }, (_, k) => {
    const a = -54 + 72 * k;
    const [x, y] = pt(16, 16, 10.4, a);
    return Array.from({ length: 5 }, (_, j) => pt(x, y, 3.1, a + 180 + 72 * j));
  });
  let costuras = "";
  centro.forEach((v, k) => {
    const e = pt(16, 16, 6.9, -90 + 72 * k);
    costuras += `<path d="M${lista([v])}L${lista([e])}"/>`;
    for (const j of [k, (k + 4) % 5]) {
      const cerca = externos[j].reduce((m, p) => (dist(p, e) < dist(m, e) ? p : m));
      costuras += `<path d="M${lista([e])}L${lista([cerca])}"/>`;
    }
  });
  return {
    partes: [
      { svg: '<circle cx="16" cy="16" r="12.4" stroke-width="1.5"/>', max: 1100, colores: FUERTE, tam: T_FUERTE },
      {
        svg:
          '<defs><clipPath id="b"><circle cx="16" cy="16" r="12.4"/></clipPath></defs>' +
          `<g clip-path="url(#b)" fill="#fff" stroke="none"><polygon points="${lista(centro)}"/>` +
          externos.map((p) => `<polygon points="${lista(p)}"/>`).join("") +
          "</g>",
        max: 1000,
        colores: BLANCO,
        tam: T_FUERTE,
      },
      { svg: `<g stroke-width="0.6">${costuras}</g>`, max: 450, colores: TENUE, tam: T_TENUE },
    ],
  };
}

function cono(): Forma {
  // Cuerpo en franjas verdes y blancas alternadas, sobre una base.
  const xl = (y: number) => 13.2 - ((y - 5) * 5.4) / 19;
  const franja = (y0: number, y1: number) =>
    `<polygon points="${lista([[xl(y0), y0], [32 - xl(y0), y0], [32 - xl(y1), y1], [xl(y1), y1]])}"/>`;
  return {
    partes: [
      {
        svg: `<g fill="#fff" stroke="none">${franja(5, 10)}${franja(12.6, 16.4)}${franja(19, 24)}</g>`,
        max: 1300,
        colores: MEDIO,
        tam: [1.1, 2.4],
      },
      {
        svg: `<g fill="#fff" stroke="none">${franja(10, 12.6)}${franja(16.4, 19)}</g>`,
        max: 650,
        colores: BLANCO,
        tam: T_FUERTE,
      },
      {
        svg: '<rect x="5" y="24" width="22" height="2.6" rx="1" fill="#fff" stroke="none"/>',
        max: 700,
        colores: FUERTE,
        tam: T_FUERTE,
      },
    ],
  };
}

function rugby(): Forma {
  const g = (sw: number, d: string) => `<g transform="rotate(-35 16 16)" stroke-width="${sw}">${d}</g>`;
  const puntadas = [11.5, 13.5, 15.5, 17.5, 19.5].map((x) => `<path d="M${x} 14.7v2.6"/>`).join("");
  return {
    partes: [
      { svg: g(1.5, '<ellipse cx="16" cy="16" rx="13" ry="7.6"/>'), max: 1300, colores: FUERTE, tam: T_FUERTE },
      { svg: g(0.9, `<path d="M10.5 16H21.5"/>${puntadas}`), max: 700, colores: BLANCO, tam: T_FUERTE },
      {
        svg: g(0.6, '<path d="M3.2 16Q16 10.2 28.8 16M3.2 16Q16 21.8 28.8 16"/>'),
        max: 500,
        colores: TENUE,
        tam: T_TENUE,
      },
    ],
  };
}

function copa(): Forma {
  const cuenco = "M9.5 5H22.5V10.5A6.5 6.5 0 0 1 9.5 10.5Z";
  const estrella = Array.from({ length: 10 }, (_, k) => pt(16, 10, k % 2 ? 1 : 2.4, -90 + 36 * k));
  return {
    partes: [
      {
        svg:
          '<g stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">' +
          `<path d="${cuenco}"/><path d="M9.5 7H6.5A3 3 0 0 0 9.8 13"/><path d="M22.5 7H25.5A3 3 0 0 1 22.2 13"/>` +
          '<path d="M16 17V21"/><path d="M12.5 21H19.5V25.5H12.5Z"/><path d="M10.5 27H21.5"/></g>',
        max: 1400,
        colores: FUERTE,
        tam: T_FUERTE,
      },
      {
        svg: `<polygon points="${lista(estrella)}" fill="#fff" stroke="none"/>`,
        max: 350,
        colores: BLANCO,
        tam: T_FUERTE,
      },
      { svg: `<path d="${cuenco}" fill="#fff" stroke="none"/>`, max: 500, colores: TENUE, tam: T_TENUE },
    ],
  };
}

function silbato(): Forma {
  return {
    partes: [
      {
        svg: '<g stroke-width="1.5" stroke-linejoin="round"><path d="M17.5 12.5H27V17.5H20.2"/><circle cx="13" cy="18.5" r="7"/></g>',
        max: 1400,
        colores: FUERTE,
        tam: T_FUERTE,
      },
      {
        svg: '<circle cx="13" cy="18.5" r="2.6" fill="#fff" stroke="none"/>',
        max: 450,
        colores: BLANCO,
        tam: T_FUERTE,
      },
      {
        svg: '<g stroke-width="0.8"><circle cx="7.5" cy="11.5" r="1.8"/><path d="M6.2 10.2Q3 6 7 3.5"/></g>',
        max: 350,
        colores: TENUE,
        tam: T_TENUE,
      },
    ],
  };
}

/**
 * El isotipo: misma geometria que <GoalMark> (src/components/Logo.tsx). Si el
 * isotipo cambia, cambia aca tambien.
 */
const logo: Forma = {
  ajusteY: 0.51, // el dibujo esta un poco corrido hacia abajo en su viewBox
  partes: [
    {
      svg: '<g stroke-width="3" stroke-linecap="round"><path d="M6 8.5h20"/><path d="M6.5 9.5v14M25.5 9.5v14"/></g>',
      max: 1300,
      colores: FUERTE,
      tam: T_FUERTE,
    },
    {
      svg: '<circle cx="16" cy="19.5" r="4.5" fill="#fff" stroke="none"/>',
      max: 650,
      colores: BLANCO,
      tam: [1.3, 2.7],
    },
    {
      svg: '<g stroke-width="0.7"><path d="M11.5 8.5v15M16 8.5v15M20.5 8.5v15"/><path d="M6 13.5h20M6 18.5h20"/></g>',
      max: 800,
      colores: TENUE,
      tam: T_TENUE,
    },
  ],
};

const FORMAS: Record<string, Forma> = {
  logo,
  pelota: pelota(),
  cono: cono(),
  rugby: rugby(),
  copa: copa(),
  silbato: silbato(),
};

/* ── Muestreo ───────────────────────────────────────────────────────────── */

function svgDe(parte: string, size: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" fill="none" stroke="#fff">${parte}</svg>`;
}

/** Rasteriza una parte y devuelve puntos donde hay tinta. */
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

type Semilla = { tx: number; ty: number; c: number; s: number };

function pick(weights: Pesos): number {
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

type Destino = { forma: string; x: number; y: number; op: number };

async function semillasForma(d: Destino, w: number, h: number, n: number): Promise<Semilla[]> {
  const forma = FORMAS[d.forma] ?? logo;
  const desktop = w >= 1024;
  const size = Math.round(desktop ? Math.min(w * 0.4, h * 0.78, 580) : Math.min(w * 0.9, h * 0.55, 420));
  const cx = desktop ? w * d.x : w / 2;
  const cy = desktop ? h * d.y : h * 0.55;
  const f = desktop ? 1 : 0.45;
  const ox = cx - size / 2;
  const oy = cy - size * (forma.ajusteY ?? 0.5);

  const out: Semilla[] = [];
  const muestras = await Promise.all(forma.partes.map((p) => samplePart(p.svg, size, Math.round(p.max * f))));
  muestras.forEach((pts, k) => {
    const { colores, tam } = forma.partes[k];
    for (let i = 0; i < pts.length; i += 2) {
      out.push({
        tx: ox + pts[i],
        ty: oy + pts[i + 1],
        c: pick(colores),
        s: tam[0] + Math.random() * (tam[1] - tam[0]),
      });
    }
  });

  // Polvo alrededor: la textura de nube de la referencia. Poco y cerca, para
  // que no le borre el contorno a la figura.
  const dust = Math.round(out.length * 0.18);
  for (let i = 0; i < dust; i++) {
    out.push({
      tx: cx + gauss() * size * 0.26,
      ty: cy + gauss() * size * 0.2,
      c: pick([[2, 0.6], [4, 0.4]]),
      s: 0.7 + Math.random() * 1,
    });
  }

  // Siempre exactamente n: son las mismas particulas las que se rearman.
  for (let i = out.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > n) out.length = n;
  const base = out.length;
  while (out.length < n && base) {
    const s = out[(Math.random() * base) | 0];
    out.push({ ...s, tx: s.tx + (Math.random() - 0.5) * 3, ty: s.ty + (Math.random() - 0.5) * 3 });
  }
  return out.sort((a, b) => a.c - b.c);
}

function semillasStars(w: number, h: number): Semilla[] {
  const n = Math.round(Math.min(340, Math.max(90, (w * h) / 6500)));
  return Array.from({ length: n }, () => ({
    tx: Math.random() * w,
    ty: Math.random() * h,
    c: pick([[1, 0.22], [3, 0.3], [4, 0.48]]),
    s: 0.7 + Math.random() * 1.3,
  })).sort((a, b) => a.c - b.c);
}

/* ── Componente ─────────────────────────────────────────────────────────── */

export default function ParticleField({ mode, className }: { mode: Mode; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stars = mode === "stars";

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
    // Particulas ordenadas por color: se cambia fillStyle 5 veces por cuadro, no 2.800.
    let rangos: number[] = [];

    const mouse = { cx: -1e4, cy: -1e4 };
    let kick: { cx: number; cy: number } | null = null;
    let raf = 0;
    let buildId = 0;
    let lastWidth = -1;
    let destino: Destino = { forma: "logo", x: 0.72, y: 0.53, op: 1 };

    /** Ajusta los arrays a `cant` particulas, conservando las posiciones que ya hay. */
    function redimensionar(cant: number) {
      if (cant === n) return;
      const px = x;
      const py = y;
      x = new Float32Array(cant);
      y = new Float32Array(cant);
      vx = new Float32Array(cant);
      vy = new Float32Array(cant);
      tx = new Float32Array(cant);
      ty = new Float32Array(cant);
      sz = new Float32Array(cant);
      ph = new Float32Array(cant);
      for (let i = 0; i < cant; i++) {
        ph[i] = Math.random() * Math.PI * 2;
        // Primera carga: arrancan desparramadas y se arman solas.
        x[i] = i < n ? px[i] : Math.random() * w;
        y[i] = i < n ? py[i] : Math.random() * h;
      }
      n = cant;
    }

    /** Nuevos destinos: las particulas viajan solas desde donde estan. */
    async function build() {
      const id = ++buildId;
      const cant = w >= 1024 ? 2800 : 1200;
      const seeds = stars ? semillasStars(w, h) : await semillasForma(destino, w, h, cant);
      if (id !== buildId) return; // cambio la forma o el tamaño mientras se rasterizaba

      redimensionar(seeds.length);
      rangos = new Array(BUCKETS + 1).fill(n);
      for (let i = 0; i < n; i++) {
        const s = seeds[i];
        tx[i] = s.tx;
        ty[i] = s.ty;
        sz[i] = s.s;
        if (rangos[s.c] === n) rangos[s.c] = i;
        if (reduce || stars) {
          x[i] = s.tx;
          y[i] = s.ty;
        }
      }
      // Un color sin particulas hereda el inicio del siguiente.
      for (let b = BUCKETS - 1; b >= 0; b--) rangos[b] = Math.min(rangos[b], rangos[b + 1]);

      if (!stars) canvas!.style.opacity = String(w >= 1024 ? destino.op : destino.op * 0.4);
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

      // En mobile, la barra del navegador cambia el alto al scrollear. Solo
      // importa el ancho: rearmar en cada scroll haria saltar las figuras.
      if (w === lastWidth) {
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
      if (stars) {
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
      if (document.hidden) return;
      step(t);
      draw(t);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      if (reduce || raf || document.hidden) return;
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

    // La seccion que cruza la franja central de la pantalla elige la figura.
    const secciones = stars
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              const el = e.target as HTMLElement;
              const d: Destino = {
                forma: el.dataset.forma ?? "logo",
                x: Number(el.dataset.formaX ?? 0.5),
                y: Number(el.dataset.formaY ?? 0.53),
                op: Number(el.dataset.formaOp ?? 0.5),
              };
              if (d.forma === destino.forma && d.x === destino.x && d.y === destino.y && d.op === destino.op) continue;
              destino = d;
              void build();
            }
          },
          { rootMargin: "-49% 0px -49% 0px" },
        );
    if (secciones) document.querySelectorAll("[data-forma]").forEach((el) => secciones.observe(el));

    resize();
    ro.observe(canvas);
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
      secciones?.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerout", onOut);
      window.removeEventListener(KICK_EVENT, onKick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode]);

  return <canvas ref={ref} aria-hidden="true" className={cn("pointer-events-none", className)} />;
}
