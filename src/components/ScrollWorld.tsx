import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

/*
 * Scroll world liviano, inspirado en github.com/oso95/scroll-world.
 * En vez de scrubear clips pre-renderizados (pesados), la cámara se renderiza en vivo:
 * cada escena es un still WebP que el scroll empuja hacia su punto focal, y entre escenas
 * la cámara "atraviesa" la imagen (zoom + desenfoque) mientras la siguiente llega desde
 * la profundidad. Todo son transform/opacity en GPU: el hero completo pesa ~1 MB.
 */

export type Detection = {
  /** caja en % del encuadre de la imagen */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  tone?: "ok" | "warn" | "info";
};

export type WorldScene = {
  id: string;
  label: string;
  img: string;
  imgSm?: string;
  /** dimensiones intrínsecas para calcular el encuadre */
  iw: number;
  ih: number;
  video?: string;
  /** punto focal inicial y final (0..1) del empuje de cámara */
  focus: [number, number];
  to?: [number, number];
  zoom: number;
  /** alto de scroll relativo de la escena */
  weight?: number;
  detections?: Detection[];
  caption?: string;
  copy: ReactNode;
};

const T = 0.36; // fracción de cada escena dedicada a la transición hacia la siguiente
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
const easeIn = (x: number) => x * x * x;
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const pad = (n: number) => String(n).padStart(2, "0");

function Clock() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const f = () => {
      const d = new Date();
      setT(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    };
    f();
    const id = setInterval(f, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">{t}</span>;
}

export function ScrollWorld({ scenes }: { scenes: WorldScene[] }) {
  const N = scenes.length;
  const weights = scenes.map((s) => s.weight ?? 1.1);
  const total = weights.reduce((a, b) => a + b, 0);

  const rootRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const frameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const copyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const segRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camRef = useRef<HTMLSpanElement | null>(null);
  const switchRef = useRef<HTMLDivElement | null>(null);
  const switchTxtRef = useRef<HTMLSpanElement | null>(null);
  const hintRef = useRef<HTMLDivElement | null>(null);
  const jumpRef = useRef<(i: number) => void>(() => {});

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const smallMQ = window.matchMedia("(max-width: 767px)");
    const cum: number[] = [];
    weights.reduce((a, w, i) => ((cum[i] = a), a + w), 0);
    const videoIdx = scenes.findIndex((s) => s.video);

    let vw = 0;
    let vh = 0;
    let lastW = 0;
    let geo: { ox0: number; oy0: number; ox1: number; oy1: number }[] = [];
    let target = 0;
    let cur = 0;
    let raf = 0;
    let running = false;
    let active = -1;
    const loaded = scenes.map((_, i) => i < 2);

    function layout() {
      vw = stage!.clientWidth;
      vh = stage!.clientHeight;
      lastW = window.innerWidth;
      geo = scenes.map((s, i) => {
        const ar = s.iw / s.ih;
        let W = Math.max(vw, vh * ar);
        let H = W / ar;
        if (H < vh) {
          H = vh;
          W = H * ar;
        }
        const [fx, fy] = s.focus;
        const [tx, ty] = s.to ?? s.focus;
        // encuadre centrado en el punto focal sin dejar bordes vacíos
        const left = clamp(vw / 2 - fx * W, vw - W, 0);
        const top = clamp(vh / 2 - fy * H, vh - H, 0);
        const f = frameRefs.current[i];
        if (f) {
          f.style.width = `${W}px`;
          f.style.height = `${H}px`;
          f.style.left = `${left}px`;
          f.style.top = `${top}px`;
        }
        return { ox0: fx * W, oy0: fy * H, ox1: tx * W, oy1: ty * H };
      });
      target = readScroll();
      cur = target;
      render(cur);
    }

    function readScroll() {
      const r = root!.getBoundingClientRect();
      const scrollable = Math.max(1, r.height - vh);
      const u = clamp(-r.top / scrollable) * total;
      let i = 0;
      while (i < N - 1 && u >= cum[i + 1]) i++;
      return Math.min(N - 0.0001, i + (u - cum[i]) / weights[i]);
    }

    function render(t: number) {
      const small = smallMQ.matches;
      let switching = 0;
      let switchTo = 0;
      for (let i = 0; i < N; i++) {
        const layer = layerRefs.current[i];
        const frame = frameRefs.current[i];
        if (!layer || !frame) continue;
        const p = t - i;
        // carga diferida: sólo las escenas cercanas piden su imagen
        if (!loaded[i] && Math.abs(p) < 2.2) {
          loaded[i] = true;
          const img = imgRefs.current[i];
          if (img?.dataset.srcset) {
            img.srcset = img.dataset.srcset;
            img.src = img.dataset.src ?? "";
          }
        }
        const last = i === N - 1;
        const d = clamp(p / (last ? 1 : 1 - T));
        const g = geo[i];
        const ox = g.ox0 + (g.ox1 - g.ox0) * smooth(d);
        const oy = g.oy0 + (g.oy1 - g.oy0) * smooth(d);
        const z = scenes[i].zoom;
        let s = 1 + (z - 1) * (0.35 * d + 0.65 * smooth(d));
        let op = 1;
        let blur = 0;
        if (p < 0) {
          // llegando desde la profundidad
          const q = clamp((p + T) / T);
          s = 1 + 0.32 * (1 - easeOut(q));
          op = smooth(q);
          blur = (1 - q) * 10;
        } else if (!last && p > 1 - T) {
          // la cámara atraviesa la escena
          const q = clamp((p - (1 - T)) / T);
          s = z * (1 + 1.6 * easeIn(q));
          op = 1 - smooth((q - 0.15) / 0.85);
          blur = q * 14;
          const sw = Math.sin(Math.PI * q);
          if (sw > switching) {
            switching = sw;
            switchTo = i + 1;
          }
        }
        if (reduce) {
          s = 1;
          blur = 0;
        }
        const vis = op > 0.002 && p > -T - 0.01 && (last || p < 1.01);
        layer.style.visibility = vis ? "visible" : "hidden";
        if (!vis) continue;
        layer.style.opacity = op.toFixed(3);
        layer.style.zIndex = String(N - i);
        layer.style.filter = !small && blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : "none";
        frame.style.transformOrigin = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;
        frame.style.transform = `scale(${s.toFixed(4)})`;
      }

      const a = clamp(Math.floor(t + T * 0.5), 0, N - 1);
      if (a !== active) {
        active = a;
        copyRefs.current.forEach((c, k) => c?.classList.toggle("is-active", k === a));
        layerRefs.current.forEach((l, k) => l?.classList.toggle("is-active", k === a));
        dotRefs.current.forEach((d, k) => {
          d?.classList.toggle("is-active", k === a);
          d?.setAttribute("aria-current", k === a ? "step" : "false");
        });
        if (camRef.current) camRef.current.textContent = `CAM ${pad(a + 1)} · ${scenes[a].label}`;
      }
      segRefs.current.forEach((sg, k) => {
        if (sg) sg.style.transform = `scaleX(${clamp(t - k).toFixed(3)})`;
      });
      if (switchRef.current) switchRef.current.style.opacity = (reduce ? 0 : switching).toFixed(3);
      if (switchTxtRef.current && switching > 0.01)
        switchTxtRef.current.textContent = `Conmutando a CAM ${pad(switchTo + 1)}`;
      if (hintRef.current) hintRef.current.style.opacity = String(clamp(1 - t / 0.2));

      // el video del operador sólo se descarga y reproduce cuando está cerca
      const v = videoRef.current;
      if (v && videoIdx >= 0) {
        const near = Math.abs(t - videoIdx - 0.3) < 1;
        if (near) {
          if (!v.src) {
            v.src = v.dataset.src ?? "";
          }
          if (v.paused && !reduce) v.play().catch(() => {});
        } else if (!v.paused) v.pause();
      }
    }

    function tick() {
      cur += (target - cur) * (reduce ? 1 : 0.12);
      if (Math.abs(target - cur) < 0.0004) cur = target;
      render(cur);
      if (cur !== target) raf = requestAnimationFrame(tick);
      else running = false;
    }
    const onScroll = () => {
      target = readScroll();
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    // en mobile la barra de URL cambia sólo el alto: no rehacer el encuadre (evita saltos)
    const onResize = () => {
      if (smallMQ.matches && window.innerWidth === lastW) return;
      layout();
    };

    jumpRef.current = (i: number) => {
      const r = root.getBoundingClientRect();
      const scrollable = r.height - vh;
      const u = cum[i] + weights[i] * (i === 0 ? 0 : 0.3);
      window.scrollTo({
        top: window.scrollY + r.top + (u / total) * scrollable,
        behavior: reduce ? "auto" : "smooth",
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    layout();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
    // la configuración de escenas es estática
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={rootRef}
      className="relative"
      style={{ height: `${Math.round((total + 0.7) * 100)}svh` }}
      aria-label="Recorrido por las operaciones que protege OPSIA"
    >
      <div ref={stageRef} className="sw-stage sticky top-0 h-svh overflow-hidden bg-black">
        {scenes.map((s, i) => (
          <div
            key={s.id}
            ref={(el) => {
              layerRefs.current[i] = el;
            }}
            className="sw-layer absolute inset-0"
            style={{ visibility: i === 0 ? "visible" : "hidden", zIndex: N - i }}
            aria-hidden="true"
          >
            <div
              ref={(el) => {
                frameRefs.current[i] = el;
              }}
              className="sw-frame absolute inset-0"
            >
              {s.video ? (
                <video
                  ref={videoRef}
                  data-src={s.video}
                  poster={s.img}
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <img
                  ref={(el) => {
                    imgRefs.current[i] = el;
                  }}
                  {...(i < 2
                    ? { src: s.imgSm ?? s.img, srcSet: `${s.imgSm} 900w, ${s.img} 1600w` }
                    : {
                        "data-src": s.imgSm ?? s.img,
                        "data-srcset": `${s.imgSm} 900w, ${s.img} 1600w`,
                      })}
                  sizes="100vw"
                  alt=""
                  decoding="async"
                  fetchPriority={i === 0 ? "high" : "low"}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              {s.detections?.map((d, k) => (
                <div
                  key={k}
                  className={`sw-det sw-det--${d.tone ?? "ok"}`}
                  style={{
                    left: `${d.x}%`,
                    top: `${d.y}%`,
                    width: `${d.w}%`,
                    height: `${d.h}%`,
                    ["--d" as string]: `${300 + k * 180}ms`,
                  }}
                >
                  <span className="sw-det__label">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="sw-scrim pointer-events-none absolute inset-0 z-30" aria-hidden="true" />
        <div className="sw-grain pointer-events-none absolute inset-0 z-30" aria-hidden="true" />

        {/* HUD de visor */}
        <div className="pointer-events-none absolute inset-4 z-40 md:inset-6" aria-hidden="true">
          <span className="sw-corner top-0 left-0 border-t-2 border-l-2" />
          <span className="sw-corner top-0 right-0 border-t-2 border-r-2" />
          <span className="sw-corner bottom-0 left-0 border-b-2 border-l-2" />
          <span className="sw-corner right-0 bottom-0 border-r-2 border-b-2" />
        </div>
        <div
          className="pointer-events-none absolute inset-x-8 bottom-8 z-40 flex items-center justify-between gap-4 font-mono text-xs text-white/70 md:inset-x-12 md:bottom-12"
          aria-hidden="true"
        >
          <span ref={camRef} className="truncate uppercase">
            CAM 01 · {scenes[0].label}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-red-500" />
            REC <Clock />
          </span>
        </div>
        <div
          className="pointer-events-none absolute inset-x-8 bottom-6 z-40 flex gap-1 md:inset-x-12 md:bottom-8"
          aria-hidden="true"
        >
          {scenes.map((s, i) => (
            <span key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/15">
              <span
                ref={(el) => {
                  segRefs.current[i] = el;
                }}
                className="block h-full w-full origin-left scale-x-0 bg-amber-signal"
              />
            </span>
          ))}
        </div>

        {/* cambio de señal entre escenas */}
        <div
          ref={switchRef}
          className="sw-switch pointer-events-none absolute inset-0 z-40 grid place-items-center opacity-0"
          aria-hidden="true"
        >
          <div className="sw-reticle">
            <span
              ref={switchTxtRef}
              className="font-mono text-xs tracking-widest text-amber-signal uppercase"
            />
          </div>
        </div>

        <div className="absolute inset-0 z-50">
          {scenes.map((s, i) => (
            <div
              key={s.id}
              id={`escena-${s.id}`}
              ref={(el) => {
                copyRefs.current[i] = el;
              }}
              className="sw-copy absolute inset-x-0 bottom-0 px-8 pb-20 md:top-1/2 md:bottom-auto md:-translate-y-1/2 md:px-20 md:pb-0"
            >
              {s.copy}
              {s.caption && <p className="sw-fade mt-4 text-xs text-white/50">{s.caption}</p>}
            </div>
          ))}
        </div>

        <nav
          className="absolute top-1/2 right-6 z-50 hidden -translate-y-1/2 flex-col gap-4 md:flex"
          aria-label="Escenas del recorrido"
        >
          {scenes.map((s, i) => (
            <button
              key={s.id}
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
              onClick={() => jumpRef.current(i)}
              className="sw-dot group relative grid h-6 w-6 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-signal"
              aria-label={`Ir a ${s.label}`}
            >
              <span className="sw-dot__label pointer-events-none absolute right-8 rounded-full bg-[#181818]/90 px-3 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 backdrop-blur">
                {s.label}
              </span>
              <i className="block h-2 w-2 rounded-full bg-white/30" />
            </button>
          ))}
        </nav>

        <div
          ref={hintRef}
          className="pointer-events-none absolute bottom-20 left-1/2 z-40 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs tracking-widest text-white/60 uppercase md:flex"
          aria-hidden="true"
        >
          <span>Deslice para recorrer</span>
          <i className="sw-wheel relative block h-8 w-5 rounded-full border-2 border-white/30" />
        </div>
      </div>
    </section>
  );
}

/** Título que sube palabra por palabra cuando su escena se activa. */
export function Kinetic({ text, className = "" }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((w, k) => (
        <Fragment key={k}>
          <span className="kw">
            <span style={{ ["--d" as string]: `${120 + k * 55}ms` }}>{w}</span>
          </span>
          {k < words.length - 1 && " "}
        </Fragment>
      ))}
    </span>
  );
}
