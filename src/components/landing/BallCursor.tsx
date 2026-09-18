"use client";

import { useEffect, useRef } from "react";
import { KICK_EVENT } from "./ParticleField";

/**
 * Cursor de la landing: una pelota de futbol que rueda con el movimiento.
 *
 * - Solo con mouse (`pointer: fine`). En touch no hay cursor que reemplazar y
 *   el componente no hace nada.
 * - El cursor nativo se oculta con una clase en <html> que se agrega RECIEN
 *   cuando la pelota ya esta montada: si el JS no carga, el usuario conserva
 *   su cursor normal en vez de quedarse sin ninguno.
 * - El hotspot es el centro de la pelota.
 * - Sobre algo clickeable crece; al hacer clic se aplasta y "patea" las
 *   particulas (evento KICK_EVENT, lo escucha ParticleField).
 * - Tambien alimenta el spotlight de las cards: escribe --mx/--my en la card
 *   con [data-spotlight] que esta debajo del puntero. Un solo listener para
 *   las dos cosas.
 */

const SIZE = 32;
const RADIO = SIZE / 2;

/** Pentagono regular como lista de puntos para <polygon>. */
function pentagono(cx: number, cy: number, r: number, rotDeg: number) {
  return Array.from({ length: 5 }, (_, i) => {
    const a = ((rotDeg + i * 72) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

// Geometria de la pelota (viewBox 32x32): un pentagono central, cinco parches
// en el borde (recortados por el circulo) y las costuras que los unen.
//
// Los parches son CHICOS a proposito: una pelota es blanca con pentagonos
// negros. Con parches grandes, a 32px el blanco que queda entre ellos se lee
// como una estrella y no como una pelota.
const CENTRO = pentagono(16, 16, 3.7, -90);
const PARCHES = Array.from({ length: 5 }, (_, k) => {
  const ang = -54 + k * 72; // a mitad de camino entre dos vertices del centro
  const rad = (ang * Math.PI) / 180;
  return pentagono(16 + 13.4 * Math.cos(rad), 16 + 13.4 * Math.sin(rad), 3.6, ang + 180);
});
const COSTURAS = Array.from({ length: 5 }, (_, k) => {
  const rad = ((-90 + k * 72) * Math.PI) / 180;
  return {
    x1: 16 + 3.7 * Math.cos(rad),
    y1: 16 + 3.7 * Math.sin(rad),
    x2: 16 + 10.6 * Math.cos(rad),
    y2: 16 + 10.6 * Math.sin(rad),
  };
});

export default function BallCursor() {
  const posRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const pos = posRef.current;
    const scale = scaleRef.current;
    const spin = spinRef.current;
    if (!pos || !scale || !spin) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    root.classList.add("ball-cursor");

    let x = -100;
    let y = -100;
    let lastX = x;
    let lastY = y;
    let angle = 0;
    let raf = 0;

    const frame = () => {
      raf = 0;
      if (!reduce) {
        // Rodar: el arco recorrido es radio × angulo, asi que angulo = distancia / radio.
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx, dy);
        const signo = dx + dy >= 0 ? 1 : -1;
        angle += ((dist / RADIO) * 180 * signo) / Math.PI;
      }
      lastX = x;
      lastY = y;
      pos.style.transform = `translate3d(${x - RADIO}px, ${y - RADIO}px, 0)`;
      spin.style.transform = `rotate(${angle}deg)`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (pos.dataset.visible !== "true") {
        // Primer movimiento: aparece donde esta el mouse, sin rodar desde (-100,-100).
        lastX = e.clientX;
        lastY = e.clientY;
        pos.dataset.visible = "true";
      }
      x = e.clientX;
      y = e.clientY;

      const target = e.target instanceof Element ? e.target : null;
      scale.dataset.hover = String(
        Boolean(target?.closest("a, button, summary, [role='button'], [tabindex='0']")),
      );

      const card = target?.closest<HTMLElement>("[data-spotlight]");
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${x - r.left}px`);
        card.style.setProperty("--my", `${y - r.top}px`);
      }
      schedule();
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      scale.dataset.down = "true";
      window.dispatchEvent(new CustomEvent(KICK_EVENT, { detail: { x: e.clientX, y: e.clientY } }));
    };
    const onUp = () => {
      scale.dataset.down = "false";
    };
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) pos.dataset.visible = "false";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointerout", onOut);

    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove("ball-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointerout", onOut);
    };
  }, []);

  // Tres capas: posicion (cada cuadro, sin transicion), escala (con transicion,
  // para que crecer y aplastarse se vea suave) y giro (cada cuadro).
  return (
    <div ref={posRef} aria-hidden="true" className="ball-cursor-el" data-visible="false">
      <div ref={scaleRef} className="ball-cursor-scale" data-hover="false" data-down="false">
        <div ref={spinRef}>
          <svg viewBox="0 0 32 32" width={SIZE} height={SIZE}>
            <defs>
              <clipPath id="tn-ball-clip">
                <circle cx="16" cy="16" r="14" />
              </clipPath>
              <radialGradient id="tn-ball-shade" cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="70%" stopColor="#e7ece9" />
                <stop offset="100%" stopColor="#b9c4bf" />
              </radialGradient>
            </defs>
            <circle cx="16" cy="16" r="14" fill="url(#tn-ball-shade)" />
            <g clipPath="url(#tn-ball-clip)" fill="#0c1411">
              <polygon points={CENTRO} />
              {PARCHES.map((p) => (
                <polygon key={p} points={p} />
              ))}
              <g stroke="#0c1411" strokeWidth="0.7" strokeOpacity="0.7" strokeLinecap="round">
                {COSTURAS.map((c) => (
                  <line key={`${c.x1}-${c.y1}`} {...c} />
                ))}
              </g>
            </g>
            <circle cx="16" cy="16" r="14" fill="none" stroke="#0c1411" strokeOpacity="0.35" />
          </svg>
        </div>
      </div>
    </div>
  );
}
