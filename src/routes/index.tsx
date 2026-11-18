import { createFileRoute } from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ElementType,
  type FormEvent,
} from "react";
import {
  ArrowRightIcon,
  BellRingingIcon,
  CheckIcon,
  CpuIcon,
  EnvelopeSimpleIcon,
  FileTextIcon,
  LockKeyIcon,
  MinusIcon,
  PlusIcon,
  ShieldCheckIcon,
  TruckIcon,
  VideoCameraIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Kinetic, ScrollWorld, type WorldScene } from "@/components/ScrollWorld";
import logoMark from "@/assets/logo-mark.png";
import teamMaxi from "@/assets/team-maxi.jpg";
import teamFelipe from "@/assets/team-felipe.jpg";
import teamEmiliano from "@/assets/team-emiliano.jpg";

export const Route = createFileRoute("/")({
  component: OpsiaLanding,
});

const CONTACT_EMAIL = "opsia.cv@gmail.com";
const CTA_LABEL = "Agendar demo de 30 minutos";
/** Link de agenda (Cal.com, Google Calendar…). Vacío: no se muestra el botón después del envío. */
const SCHEDULING_URL = "";

/** Envía el lead a Netlify Forms. El formulario se declara en public/__forms.html. */
async function sendLead(data: Record<string, string>) {
  const res = await fetch("/__forms.html", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ "form-name": "contacto", ...data }).toString(),
  });
  if (!res.ok) throw new Error(`Netlify Forms respondió ${res.status}`);
}

// ---------- Reveal: fade up pesado al entrar en viewport (IntersectionObserver) ----------
function Reveal({
  children,
  delay = 0,
  as,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("is-in");
            io.disconnect();
          }
        }),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

// ---------- Contador animado ----------
function Counter({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / 1600);
          setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        io.disconnect();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to]);
  return <span ref={ref}>{val.toLocaleString("es-AR")}</span>;
}

function SectionHead({
  eyebrow,
  title,
  muted,
}: {
  eyebrow: string;
  title: ReactNode;
  muted?: ReactNode;
}) {
  return (
    <>
      <Reveal>
        <p className="text-eyebrow text-amber-signal">{eyebrow}</p>
      </Reveal>
      <Reveal delay={100}>
        <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
          {title}
          {muted && <span className="text-white/50"> {muted}</span>}
        </h2>
      </Reveal>
    </>
  );
}

// ---------- Modal de contacto ----------
function ContactModal({
  open,
  onClose,
  intent,
}: {
  open: boolean;
  onClose: () => void;
  intent?: string;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [fallbackHref, setFallbackHref] = useState(`mailto:${CONTACT_EMAIL}`);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setStatus("idle");
    setErrors({});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;
    const fd = new FormData(e.currentTarget);
    const next: Record<string, string> = {};
    if (!String(fd.get("name") ?? "").trim()) next.name = "Ingrese su nombre.";
    if (!String(fd.get("company") ?? "").trim()) next.company = "Ingrese el nombre de su empresa.";
    if (!fd.get("industry")) next.industry = "Elija un tipo de operación.";
    const email = String(fd.get("email") ?? "").trim();
    if (!email) next.email = "Ingrese su email corporativo.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "El email no tiene un formato válido.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const subject = `[OPSIA] ${intent === "audit" ? "Auditoría piloto" : "Demo"} · ${fd.get("company")}`;
    const body =
      `Nombre: ${fd.get("name")}\n` +
      `Empresa: ${fd.get("company")}\n` +
      `Operación: ${fd.get("industry")}\n` +
      `Email: ${email}\n\n` +
      `${fd.get("message") ?? ""}`;
    setFallbackHref(
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
    setStatus("sending");
    try {
      await sendLead({
        "bot-field": String(fd.get("bot-field") ?? ""),
        intent: intent === "audit" ? "Auditoría piloto" : "Demo",
        name: String(fd.get("name") ?? "").trim(),
        company: String(fd.get("company") ?? "").trim(),
        industry: String(fd.get("industry") ?? ""),
        email,
        message: String(fd.get("message") ?? "").trim(),
      });
      setStatus("sent");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-xl sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-title"
    >
      <div
        className="w-full max-w-lg rounded-t-2xl border border-white/10 bg-[#181818] text-white sm:mx-4 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-eyebrow text-white/50">Contacto</p>
            <h3 id="contact-title" className="mt-1 text-xl font-semibold">
              {intent === "audit" ? "Solicitar auditoría piloto" : "Agendar una demo"}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-10 w-10 place-items-center rounded-full text-white/60 transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#272727] hover:text-white focus-visible:outline-2 focus-visible:outline-amber-signal"
          >
            <XIcon size={18} />
          </button>
        </div>
        {status === "sent" ? (
          <div className="px-6 py-10 text-center" role="status">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-signal/20 text-amber-signal">
              <CheckIcon size={20} weight="bold" />
            </div>
            <p className="mt-4 text-lg font-semibold">Recibimos su solicitud.</p>
            <p className="mt-2 text-sm text-white/60">
              Le respondemos por correo en menos de 24 horas hábiles.
              {SCHEDULING_URL && " Si prefiere, ya puede elegir un horario para la llamada."}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              {SCHEDULING_URL && (
                <a
                  href={SCHEDULING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  Elegir horario
                  <ArrowRightIcon size={16} weight="bold" />
                </a>
              )}
              <button onClick={onClose} className="btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form className="grid gap-4 px-6 py-6" onSubmit={submit} noValidate>
            <p className="hidden" aria-hidden="true">
              <label>
                No completar: <input name="bot-field" tabIndex={-1} autoComplete="off" />
              </label>
            </p>
            <Field label="Nombre" name="name" error={errors.name} autoComplete="name" />
            <Field
              label="Empresa"
              name="company"
              error={errors.company}
              autoComplete="organization"
            />
            <div>
              <label className="text-eyebrow text-white/50" htmlFor="industry">
                Tipo de operación
              </label>
              <select
                id="industry"
                name="industry"
                aria-invalid={!!errors.industry}
                aria-describedby={errors.industry ? "industry-error" : undefined}
                className="mt-2 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none focus:border-amber-signal"
              >
                <option value="">Seleccione el tipo de operación</option>
                <option>Rajo abierto</option>
                <option>Minería subterránea</option>
                <option>Planta de procesamiento</option>
                <option>Contratista minero</option>
                <option>Otra</option>
              </select>
              {errors.industry && (
                <p id="industry-error" className="mt-2 text-xs text-red-400">
                  {errors.industry}
                </p>
              )}
            </div>
            <Field
              label="Email corporativo"
              name="email"
              type="email"
              error={errors.email}
              autoComplete="email"
            />
            <div>
              <label className="text-eyebrow text-white/50" htmlFor="msg">
                Mensaje
              </label>
              <textarea
                id="msg"
                name="message"
                rows={4}
                maxLength={1000}
                className="mt-2 w-full resize-none rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-amber-signal"
                placeholder="Cuéntenos sobre su operación, cantidad de cámaras y objetivos."
              />
            </div>
            {status === "error" && (
              <p
                role="alert"
                className="rounded-lg border border-red-400/40 p-3 text-sm text-red-300"
              >
                No pudimos enviar la solicitud. Puede{" "}
                <a
                  href={fallbackHref}
                  className="font-medium text-white underline underline-offset-4"
                >
                  mandarla por correo con los datos ya cargados
                </a>
                .
              </p>
            )}
            <button
              type="submit"
              className="btn-primary mt-2 disabled:opacity-60"
              disabled={status === "sending"}
            >
              {status === "sending" ? "Enviando…" : "Enviar solicitud"}
              <ArrowRightIcon size={16} weight="bold" />
            </button>
            <p className="text-xs text-white/50">
              Usamos sus datos sólo para responderle. También puede escribirnos a{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-white underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
              . No compartimos su información con terceros.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  error,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  error?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="text-eyebrow text-white/50" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        maxLength={200}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
        className={
          "mt-2 w-full rounded-lg border bg-black px-3 py-2 text-sm text-white outline-none focus:border-amber-signal " +
          (error ? "border-red-400" : "border-white/15")
        }
      />
      {error && (
        <p id={`${name}-error`} className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------- Nav en isla flotante ----------
const NAV = [
  { label: "Recorrido", href: "#recorrido" },
  { label: "Plataforma", href: "#plataforma" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Planes", href: "#planes" },
  { label: "Preguntas", href: "#faq" },
];

function useActiveSection() {
  const [active, setActive] = useState("#recorrido");
  useEffect(() => {
    const els = NAV.map((n) => document.querySelector(n.href)).filter(Boolean) as Element[];
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(`#${e.target.id}`);
        }),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

function Navbar({ onCta }: { onCta: () => void }) {
  const [open, setOpen] = useState(false);
  const active = useActiveSection();
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);
  const ease = "transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]";
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4">
      <div className="relative z-10 mx-auto mt-6 flex w-max max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/60 p-1.5 pl-4 backdrop-blur-xl">
        <a
          href="#top"
          className="flex items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-signal"
          aria-label="OPSIA, ir al inicio"
        >
          <img src={logoMark} alt="" width={24} height={18} className="h-5 w-auto" />
          <span className="text-base font-semibold tracking-tight text-white">
            OPSIA<span className="text-amber-signal">.</span>
          </span>
        </a>
        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Principal">
          {NAV.map((i) => (
            <a
              key={i.href}
              href={i.href}
              aria-current={active === i.href ? "location" : undefined}
              className={
                `rounded-full px-3 py-2 text-sm font-medium ${ease} focus-visible:outline-2 focus-visible:outline-amber-signal ` +
                (active === i.href ? "bg-white/10 text-white" : "text-white/60 hover:text-white")
              }
            >
              {i.label}
            </a>
          ))}
        </nav>
        <button onClick={onCta} className="btn-primary ml-2 hidden text-sm md:inline-flex">
          Agendar demo
        </button>
        <button
          className="relative ml-6 h-10 w-10 rounded-full focus-visible:outline-2 focus-visible:outline-amber-signal md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          <span
            className={`absolute top-1/2 left-1/2 block h-0.5 w-5 -translate-x-1/2 rounded-full bg-white ${ease} ${open ? "-translate-y-1/2 rotate-45" : "-translate-y-1"}`}
          />
          <span
            className={`absolute top-1/2 left-1/2 block h-0.5 w-5 -translate-x-1/2 rounded-full bg-white ${ease} ${open ? "-translate-y-1/2 -rotate-45" : "translate-y-1"}`}
          />
        </button>
      </div>

      <div
        id="mobile-menu"
        className={`fixed inset-0 bg-black/80 backdrop-blur-3xl md:hidden ${ease} ${open ? "visible opacity-100" : "invisible opacity-0"}`}
      >
        <nav className="flex h-full flex-col justify-center gap-6 px-8" aria-label="Menú móvil">
          {NAV.map((i, k) => (
            <a
              key={i.href}
              href={i.href}
              onClick={() => setOpen(false)}
              aria-current={active === i.href ? "location" : undefined}
              className={`text-4xl font-semibold ${ease} ${open ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"} ${active === i.href ? "text-amber-signal" : "text-white"}`}
              style={{ transitionDelay: open ? `${100 + k * 50}ms` : "0ms" }}
            >
              {i.label}
            </a>
          ))}
          <button
            onClick={() => {
              setOpen(false);
              onCta();
            }}
            className={`btn-primary mt-6 self-start ${ease} ${open ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
            style={{ transitionDelay: open ? `${100 + NAV.length * 50}ms` : "0ms" }}
          >
            {CTA_LABEL}
          </button>
        </nav>
      </div>
    </header>
  );
}

// ---------- Hero: recorrido scroll world ----------
const W = "/world";

function SceneCopy({
  eyebrow,
  title,
  body,
  tags,
}: {
  eyebrow: string;
  title: string;
  body: string;
  tags?: string[];
}) {
  return (
    <div className="max-w-xl">
      <p className="sw-fade text-eyebrow text-amber-signal">{eyebrow}</p>
      <h2 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-6xl">
        <Kinetic text={title} />
      </h2>
      <p className="sw-fade mt-4 text-base text-white/80 md:text-lg">{body}</p>
      {tags && (
        <ul className="sw-fade mt-6 flex flex-wrap gap-2">
          {tags.map((t) => (
            <li
              key={t}
              className="rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur"
            >
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ILLUSTRATIVE = "Detecciones ilustrativas sobre imagen de referencia.";

function buildScenes(onCta: () => void): WorldScene[] {
  return [
    {
      id: "rajo",
      label: "Rajo",
      img: `${W}/01-rajo.webp`,
      imgSm: `${W}/01-rajo-sm.webp`,
      iw: 1920,
      ih: 1200,
      focus: [0.5, 0.55],
      to: [0.56, 0.8],
      zoom: 1.45,
      weight: 1.3,
      detections: [
        { x: 26.5, y: 83.5, w: 6.5, h: 10.5, label: "Vehículo · ruta 2", tone: "info" },
        { x: 73.5, y: 47.5, w: 4, h: 5, label: "Vehículo", tone: "info" },
      ],
      caption: ILLUSTRATIVE,
      copy: (
        <div className="max-w-[680px]">
          <p className="sw-fade inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 backdrop-blur">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-signal" />
            <span className="text-eyebrow text-white/80">Seguridad minera con IA</span>
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            <span className="kw">
              <span className="text-hero" style={{ ["--d" as string]: "150ms" }}>
                Sus cámaras ya ven todo.
              </span>
            </span>
            <br />
            <span className="kw">
              <span className="text-hero" style={{ ["--d" as string]: "320ms" }}>
                Nosotros hacemos que entiendan.
              </span>
            </span>
          </h1>
          <p className="sw-fade mt-6 max-w-[680px] text-base text-white/80 md:text-lg">
            OPSIA convierte el CCTV de su faena en un supervisor que no se distrae. Hoy auditamos el
            cumplimiento de EPP sobre el video que usted ya graba. Las alertas en vivo de maquinaria
            y proximidad llegan con el programa piloto. Sin hardware nuevo, sin detener la
            operación.
          </p>
          <div className="sw-fade mt-8">
            <button onClick={onCta} className="btn-primary">
              {CTA_LABEL}
              <ArrowRightIcon size={16} weight="bold" />
            </button>
          </div>
          <p className="sw-fade mt-6 text-sm text-white/60">
            Modelos propios entrenados con más de 48.000 anotaciones de faenas e instalaciones
            industriales reales.
          </p>
        </div>
      ),
    },
    {
      id: "deteccion",
      label: "Vista de operador",
      img: `${W}/02-deteccion.webp`,
      iw: 960,
      ih: 540,
      video: `${W}/02-deteccion.mp4`,
      focus: [0.55, 0.5],
      zoom: 1.12,
      weight: 1.5,
      caption:
        "Video de referencia procesado por el modelo OPSIA. La demo sobre su propia operación se muestra en reunión.",
      copy: (
        <SceneCopy
          eyebrow="Vista de operador"
          title="Cada persona, cada vehículo, evaluado."
          body="Personas, chalecos, camionetas, excavadoras y conos, reconocidos frame a frame. Cada trabajador queda como seguro, inseguro o a revisar, con evidencia de frame y hora."
          tags={["Persona", "Chaleco", "Camioneta", "Excavadora"]}
        />
      ),
    },
    {
      id: "epp",
      label: "EPP en faena",
      img: `${W}/03-mineria.webp`,
      imgSm: `${W}/03-mineria-sm.webp`,
      iw: 1200,
      ih: 900,
      focus: [0.55, 0.45],
      to: [0.4, 0.3],
      zoom: 1.3,
      caption: ILLUSTRATIVE,
      detections: [
        { x: 20, y: 15, w: 27.5, h: 20.5, label: "Casco ✓", tone: "ok" },
        { x: 4, y: 55, w: 45, h: 44, label: "Chaleco ✓", tone: "ok" },
        { x: 49, y: 30, w: 27, h: 47, label: "Maquinaria en movimiento", tone: "warn" },
      ],
      copy: (
        <SceneCopy
          eyebrow="EPP en faena"
          title="Nacimos en la minería. Ahí el estándar es más alto."
          body="Casco, chaleco reflectivo, lentes, botas y guantes, en rajo, planta y talleres. Persona por persona, turno por turno."
          tags={["Rajo", "Planta", "Talleres", "Por contratista"]}
        />
      ),
    },
    {
      id: "proximidad",
      label: "Proximidad",
      img: `${W}/06-equipo.webp`,
      imgSm: `${W}/06-equipo-sm.webp`,
      iw: 1280,
      ih: 896,
      focus: [0.5, 0.35],
      to: [0.5, 0.45],
      zoom: 1.2,
      caption: ILLUSTRATIVE,
      detections: [
        { x: 35, y: 2, w: 30, h: 70, label: "Volquete · radio de riesgo", tone: "warn" },
        { x: 2.5, y: 4, w: 33, h: 95, label: "Persona · EPP ✓", tone: "ok" },
        { x: 66, y: 13, w: 32.5, h: 86, label: "Persona · EPP ✓", tone: "ok" },
      ],
      copy: (
        <SceneCopy
          eyebrow="Maquinaria y proximidad · programa piloto"
          title="Un volquete no ve lo que tiene al lado. OPSIA sí."
          body="El modelo ya reconoce volquetes, excavadoras, motoniveladoras y camionetas. La alerta cuando una persona entra al radio de riesgo de un equipo en movimiento está en desarrollo y se valida en el programa piloto."
          tags={["Volquete", "Excavadora", "Motoniveladora", "En piloto"]}
        />
      ),
    },
    {
      id: "cierre",
      label: "Empezar",
      img: `${W}/01-rajo.webp`,
      imgSm: `${W}/01-rajo-sm.webp`,
      iw: 1920,
      ih: 1200,
      focus: [0.5, 0.35],
      to: [0.5, 0.25],
      zoom: 1.1,
      weight: 1.3,
      copy: (
        <div className="max-w-xl">
          <p className="sw-fade text-eyebrow text-amber-signal">Su faena</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-6xl">
            <Kinetic text="Que cada turno termine como empezó." />
          </h2>
          <p className="sw-fade mt-4 text-base text-white/80 md:text-lg">
            Empiece con una auditoría piloto sobre video grabado de su propia faena. Reporte en 72
            horas, sin integración y sin hardware nuevo.
          </p>
          <div className="sw-fade mt-8">
            <button onClick={onCta} className="btn-primary">
              {CTA_LABEL}
              <ArrowRightIcon size={16} weight="bold" />
            </button>
          </div>
        </div>
      ),
    },
  ];
}

function Hero({ onCta }: { onCta: () => void }) {
  const [scenes] = useState(() => buildScenes(onCta));
  return (
    <div id="recorrido">
      <div id="top" />
      <ScrollWorld scenes={scenes} />
    </div>
  );
}

// ---------- Prueba: métricas verificables ----------
function Proof() {
  const metrics = [
    { pre: "", v: 72, suf: " h", label: "del video grabado al reporte de auditoría" },
    { pre: "", v: 26, suf: "", label: "clases detectadas entre EPP, personas y maquinaria" },
    {
      pre: "+",
      v: 48000,
      suf: "",
      label: "anotaciones de faenas e instalaciones industriales reales",
    },
    { pre: "", v: 0, suf: "", label: "equipos nuevos para instalar" },
  ];
  return (
    <section className="bg-[#181818] py-16" aria-label="OPSIA en números">
      <div className="container-opsia grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m, i) => (
          <Reveal key={m.label} delay={i * 100}>
            <p className="text-5xl font-semibold tracking-tight text-white tabular-nums">
              {m.pre}
              <Counter to={m.v} />
              {m.suf}
            </p>
            <p className="mt-3 max-w-[220px] text-sm text-white/60">{m.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---------- Problema ----------
type Stat = { n?: number; s?: string; big?: string; t: string; src?: string };

function Problem() {
  const stats: Stat[] = [
    {
      n: 60,
      s: "%",
      t: "de los incidentes graves involucran EPP ausente o colisiones entre persona y máquina.",
      src: "Referencias OSHA y literatura HSE",
    },
    {
      big: "Segundos",
      t: "es lo que tarda una infracción de proximidad en volverse incidente. Nadie mirando monitores llega a tiempo.",
    },
    {
      n: 40,
      s: "+",
      t: "cámaras por faena es la norma, y la atención humana sobre monitores cae a los pocos minutos.",
      src: "Límite operativo conocido en videovigilancia",
    },
  ];
  return (
    <section className="bg-black py-24">
      <div className="container-opsia">
        <SectionHead
          eyebrow="El problema"
          title="Un accidente ocurre en segundos."
          muted="La supervisión humana no escala."
        />
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {stats.map((k, i) => (
            <Reveal
              key={k.t}
              delay={100 + i * 100}
              className="rounded-2xl border border-white/10 bg-[#181818] p-8"
            >
              <p className="text-6xl font-semibold tracking-tight text-white tabular-nums">
                {k.big ?? (
                  <>
                    <Counter to={k.n ?? 0} />
                    {k.s}
                  </>
                )}
              </p>
              <p className="mt-4 text-white/70">{k.t}</p>
              {k.src && <p className="mt-4 text-xs text-white/40">Fuente: {k.src}.</p>}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Tagline: palabra por palabra (landing-page-design B11) ----------
function TaglineReveal() {
  const lines = [
    "Un supervisor no puede mirar",
    "cuarenta cámaras a la vez.",
    "OPSIA sí, y no se distrae.",
  ];
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const words = Array.from(root.querySelectorAll<HTMLElement>(".tag-word"));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-on");
            io.unobserve(e.target);
          }
        }),
      // la línea de disparo está al 62% del alto de la pantalla
      { rootMargin: "0px 0px -38% 0px", threshold: 1 },
    );
    words.forEach((w) => io.observe(w));
    return () => io.disconnect();
  }, []);
  return (
    <section className="bg-black py-24" aria-label="Nuestra propuesta">
      <div ref={ref} className="container-opsia">
        <p className="mx-auto max-w-[680px] text-4xl font-semibold tracking-tight md:text-6xl">
          {lines.map((l, li) => (
            <span key={li} className="block">
              {l.split(" ").map((w, wi) => (
                <span key={wi} className="tag-word">
                  {w}{" "}
                </span>
              ))}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

// ---------- Beneficios / plataforma ----------
function Platform() {
  const pillars = [
    {
      icon: ShieldCheckIcon,
      title: "Cumplimiento de EPP, persona por persona",
      status: "Disponible hoy",
      body: "Casco, chaleco reflectivo, lentes, botas y guantes. Estado por trabajador, no por cámara.",
      chips: ["Casco", "Chaleco", "Lentes", "Botas", "Guantes"],
    },
    {
      icon: TruckIcon,
      title: "Maquinaria y proximidad",
      status: "Programa piloto",
      body: "Volquetes, excavadoras, motoniveladoras y camionetas. La alerta por radio de riesgo de un equipo en movimiento está en desarrollo y se valida con el piloto.",
      chips: ["Volquete", "Excavadora", "Motoniveladora", "Radio de riesgo"],
    },
    {
      icon: FileTextIcon,
      title: "Evidencia lista para auditoría",
      status: "Disponible hoy",
      body: "Cada infracción queda registrada con frame, hora y zona. Reportes por turno, área o contratista, exportables.",
      chips: ["Frame y hora", "Por contratista", "Por turno", "Exportable"],
    },
  ];
  return (
    <section id="plataforma" className="bg-black py-24">
      <div className="container-opsia">
        <SectionHead
          eyebrow="La plataforma"
          title="Tres capas de inteligencia sobre las cámaras que ya operan."
        />
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {pillars.map((p, i) => (
            <Reveal
              key={p.title}
              delay={i * 120}
              className="flex flex-col rounded-2xl border border-white/10 bg-[#181818] p-8"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#272727] text-amber-signal">
                <p.icon size={24} />
              </div>
              <p
                className={
                  "text-eyebrow mt-8 " +
                  (p.status === "Disponible hoy" ? "text-emerald-400" : "text-amber-signal")
                }
              >
                {p.status}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">{p.title}</h3>
              <p className="mt-3 text-sm text-white/60">{p.body}</p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {p.chips.map((c) => (
                  <li key={c} className="rounded-full bg-[#272727] px-3 py-1 text-xs text-white/70">
                    {c}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Cómo funciona ----------
function HowItWorks() {
  const steps = [
    {
      icon: VideoCameraIcon,
      n: "01",
      t: "Conectamos sus cámaras",
      d: "Integración por RTSP u ONVIF con la infraestructura existente. Sin obras en la faena ni dispositivos adicionales.",
    },
    {
      icon: CpuIcon,
      n: "02",
      t: "La IA analiza cada frame",
      d: "Modelos propios entrenados con imágenes de faenas e instalaciones industriales reales. Procesamiento en su infraestructura o en la nuestra, según su necesidad.",
    },
    {
      icon: BellRingingIcon,
      n: "03",
      t: "Su equipo recibe reportes y alertas",
      d: "Reporte de cumplimiento por área, turno y contratista. El dashboard y las alertas en el momento llegan con el programa piloto.",
    },
  ];
  return (
    <section id="como-funciona" className="bg-[#181818] py-24">
      <div className="container-opsia">
        <SectionHead
          eyebrow="Cómo funciona"
          title="De la cámara a la evidencia, sin obras en la faena."
        />
        <ol className="mt-16 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal
              as="li"
              key={s.n}
              delay={i * 120}
              className="rounded-2xl border border-white/10 bg-black p-8"
            >
              <div className="flex items-center justify-between">
                <s.icon size={28} className="text-amber-signal" />
                <span className="font-mono text-sm text-white/40">{s.n}</span>
              </div>
              <h3 className="mt-8 text-xl font-semibold text-white">{s.t}</h3>
              <p className="mt-3 text-sm text-white/60">{s.d}</p>
            </Reveal>
          ))}
        </ol>
        <Reveal
          delay={200}
          className="mt-8 flex items-start gap-4 rounded-2xl border border-white/10 bg-black p-6"
        >
          <LockKeyIcon size={24} className="mt-0.5 shrink-0 text-amber-signal" />
          <p className="text-sm text-white/70">
            <span className="font-semibold text-white">Privacidad por diseño.</span> Si lo requiere,
            sus videos nunca salen de su infraestructura. Sin reconocimiento facial de identidad. El
            difuminado de rostros en los reportes está en desarrollo.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ---------- Producto: dashboard ----------
function DashboardShowcase() {
  const ok = "oklch(0.72 0.15 155)";
  return (
    <section className="bg-black py-24">
      <div className="container-opsia">
        <SectionHead
          eyebrow="Producto · en desarrollo"
          title="El dashboard operacional."
          muted="Todo lo que ocurre, en una sola vista."
        />
        <Reveal delay={120}>
          <div className="mt-16 overflow-hidden rounded-2xl border border-white/10 bg-[#181818]">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <p className="ml-4 flex-1 truncate rounded-md bg-black px-3 py-1 font-mono text-xs text-white/50">
                opsia · operaciones / mina-norte
              </p>
            </div>
            <div className="grid gap-px bg-white/10 md:grid-cols-[220px_1fr_300px]">
              <aside className="bg-[#181818] p-6">
                <p className="text-eyebrow text-white/40">Sitios</p>
                <ul className="mt-3 grid gap-1 text-sm">
                  {["Mina Norte", "Planta concentradora", "Rajo Sur", "Botadero Este"].map(
                    (s, i) => (
                      <li
                        key={s}
                        className={
                          "flex items-center justify-between rounded-md px-2 py-1 " +
                          (i === 0 ? "bg-[#313131] text-white" : "text-white/60")
                        }
                      >
                        <span>{s}</span>
                        <span
                          className={
                            "h-1.5 w-1.5 rounded-full " +
                            (i === 1 ? "bg-amber-signal" : "bg-emerald-500")
                          }
                        />
                      </li>
                    ),
                  )}
                </ul>
                <p className="text-eyebrow mt-8 text-white/40">Áreas</p>
                <ul className="mt-3 grid gap-2 text-sm text-white/60">
                  <li>Rajo A · 12 cámaras</li>
                  <li>Chancado · 8 cámaras</li>
                  <li>Talleres · 6 cámaras</li>
                  <li>Accesos · 4 cámaras</li>
                </ul>
              </aside>

              <div className="bg-[#181818] p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-eyebrow text-white/40">Mina Norte · Turno A</p>
                    <h3 className="mt-1 text-lg font-semibold text-white">Cumplimiento en vivo</h3>
                  </div>
                  <p className="flex items-center gap-2 text-xs text-white/60">
                    <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> En línea
                    · 30 cámaras
                  </p>
                </div>
                <div className="mt-6 grid grid-cols-6 gap-2">
                  {Array.from({ length: 24 }).map((_, i) => {
                    const s =
                      i % 7 === 3
                        ? "bg-amber-signal"
                        : i % 11 === 5
                          ? "bg-white/20"
                          : "bg-emerald-500/70";
                    return (
                      <div key={i} className={"h-8 rounded-sm " + s} title={`Zona ${i + 1}`} />
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-4 text-xs text-white/60">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Seguro
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-sm bg-amber-signal" /> Alerta
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-sm bg-white/20" /> Revisar
                  </span>
                </div>
                <div className="mt-8">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-white">
                      Tendencia semanal · Contratista A
                    </p>
                    <p className="text-2xl font-semibold text-white">
                      86% <span className="text-eyebrow align-middle text-white/40">EPP</span>
                    </p>
                  </div>
                  <div className="mt-4 flex h-32 items-end gap-2">
                    {[62, 68, 71, 74, 73, 79, 86].map((v, i) => (
                      <div key={i} className="flex h-full flex-1 flex-col justify-end">
                        <div
                          className={
                            "w-full rounded-t-sm " + (i === 6 ? "bg-amber-signal" : "bg-[#313131]")
                          }
                          style={{ height: `${v}%` }}
                        />
                        <p className="mt-1 text-center text-xs text-white/40">
                          {["L", "M", "M", "J", "V", "S", "D"][i]}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="bg-[#181818] p-6">
                <div className="flex items-center justify-between">
                  <p className="text-eyebrow text-white/40">Alertas en vivo</p>
                  <span className="text-xs text-white/50">últimos 15 min</span>
                </div>
                <ul className="mt-4 grid gap-3">
                  {[
                    {
                      t: "09:41",
                      z: "Rajo A · CAM 07",
                      m: "Trabajador sin chaleco reflectivo",
                      warn: true,
                    },
                    {
                      t: "09:38",
                      z: "Chancado · CAM 03",
                      m: "Persona a 3,1 m de un volquete",
                      warn: true,
                    },
                    { t: "09:34", z: "Accesos · CAM 01", m: "Vehículo no autorizado", warn: true },
                    {
                      t: "09:28",
                      z: "Talleres · CAM 09",
                      m: "EPP completo confirmado",
                      warn: false,
                    },
                    { t: "09:22", z: "Rajo A · CAM 05", m: "Casco no detectado", warn: true },
                  ].map((a) => (
                    <li key={a.t} className="flex gap-3 rounded-lg bg-black p-2">
                      <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md bg-[#272727]">
                        <span
                          className="absolute border"
                          style={{
                            top: "18%",
                            left: a.warn ? "30%" : "22%",
                            width: "38%",
                            height: "64%",
                            borderColor: a.warn ? "var(--amber-signal)" : ok,
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-white/50">
                          {a.t} · {a.z}
                        </p>
                        <p className="truncate text-xs text-white">{a.m}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </div>
          <p className="mt-4 text-xs text-white/40">
            Interfaz en desarrollo, con datos de ejemplo. Hoy los hallazgos se entregan en el
            reporte de auditoría.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ---------- Planes + reversión de riesgo ----------
function ServiceModel({ onCta }: { onCta: () => void }) {
  const tiers = [
    {
      name: "Auditoría",
      tag: "Disponible hoy",
      d: "Análisis de video grabado. Reporte de cumplimiento y hallazgos en 72 horas. Sin integración en tiempo real.",
      features: ["Análisis retrospectivo", "Reporte ejecutivo", "Recomendaciones priorizadas"],
      highlight: false,
    },
    {
      name: "Monitoreo continuo",
      tag: "Programa piloto",
      d: "Procesamiento en vivo, dashboard operacional y alertas en el momento para el equipo HSE.",
      features: [
        "Alertas en tiempo real",
        "Dashboard multisitio",
        "Reportes por turno y contratista",
      ],
      highlight: true,
    },
    {
      name: "Enterprise",
      tag: "Multisitio",
      d: "Integración con sus sistemas HSE. Modelos a medida del uniforme y los procedimientos de su empresa.",
      features: [
        "Modelos a medida",
        "Integración HSE y SSO",
        "SLA dedicado",
        "Procesamiento on premise",
      ],
      highlight: false,
    },
  ];
  return (
    <section id="planes" className="bg-[#181818] py-24">
      <div className="container-opsia">
        <SectionHead eyebrow="Planes" title="Tres formas de empezar." muted="Sin sorpresas." />
        <Reveal
          delay={120}
          className="mt-12 grid gap-4 rounded-2xl border border-white/10 bg-black p-6 sm:grid-cols-3"
        >
          {[
            ["1", "Llamada de 30 minutos"],
            ["2", "Auditoría piloto sobre video de su operación"],
            ["3", "Propuesta con números reales de su sitio"],
          ].map(([n, t]) => (
            <div key={n} className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#272727] font-mono text-sm text-amber-signal">
                {n}
              </span>
              <span className="text-sm text-white/80">{t}</span>
            </div>
          ))}
        </Reveal>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <div
                className={
                  "flex h-full flex-col rounded-2xl border p-8 " +
                  (t.highlight ? "border-amber-signal/60 bg-[#272727]" : "border-white/10 bg-black")
                }
              >
                <p
                  className={
                    "text-eyebrow " + (t.highlight ? "text-amber-signal" : "text-white/40")
                  }
                >
                  {t.tag}
                </p>
                <h3 className="mt-4 text-2xl font-semibold text-white">{t.name}</h3>
                <p className="mt-3 text-sm text-white/60">{t.d}</p>
                <ul className="mt-6 grid gap-3 text-sm text-white/80">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckIcon
                        size={16}
                        weight="bold"
                        className="mt-0.5 shrink-0 text-amber-signal"
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  <button
                    onClick={onCta}
                    className={"w-full " + (t.highlight ? "btn-primary" : "btn-secondary")}
                  >
                    Conversar sobre este plan
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal
          delay={200}
          className="mt-8 flex items-start gap-4 rounded-2xl border border-white/10 bg-black p-6"
        >
          <ShieldCheckIcon size={24} className="mt-0.5 shrink-0 text-amber-signal" />
          <p className="text-sm text-white/70">
            <span className="font-semibold text-white">Riesgo mínimo para empezar.</span> La
            auditoría piloto trabaja sobre video que usted ya tiene grabado: no toca su red, no
            requiere equipos nuevos y entrega resultados en 72 horas.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ---------- Equipo ----------
function Team() {
  const founders = [
    {
      name: "Maximiliano Lombardia",
      role: "Cofundador · Producto",
      base: "Buenos Aires",
      photo: teamMaxi,
    },
    {
      name: "Felipe Bridge",
      role: "Cofundador · Ingeniería",
      base: "San Juan",
      photo: teamFelipe,
    },
    {
      name: "Emiliano Lescuras",
      role: "Cofundador · Datos",
      base: "San Juan",
      photo: teamEmiliano,
    },
  ];
  return (
    <section className="bg-black py-24">
      <div className="container-opsia">
        <SectionHead
          eyebrow="Quiénes somos"
          title="Un equipo de IA con los pies en la tierra minera."
        />
        <Reveal delay={140}>
          <p className="mt-6 max-w-2xl text-white/60">
            OPSIA nace en San Juan, corazón de la minería argentina, con formación en inteligencia
            artificial y ciencia de datos, y una convicción: la seguridad de un operario no puede
            depender de cuántos monitores alcanza a mirar un supervisor.
          </p>
        </Reveal>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {founders.map((f, i) => (
            <Reveal
              key={f.name}
              delay={i * 100}
              className="rounded-2xl border border-white/10 bg-[#181818] p-2"
            >
              <img
                src={f.photo}
                alt={`Retrato de ${f.name}`}
                width={800}
                height={800}
                loading="lazy"
                className="aspect-square w-full rounded-lg object-cover"
              />
              <div className="p-4">
                <h3 className="text-lg font-semibold text-white">{f.name}</h3>
                <p className="mt-1 text-sm text-white/60">{f.role}</p>
                <p className="text-eyebrow mt-3 text-white/40">{f.base}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- FAQ ----------
const FAQ_ITEMS = [
  {
    q: "¿Sirven mis cámaras actuales?",
    a: "Sí. OPSIA se integra con la mayoría de las cámaras IP mediante RTSP u ONVIF. No requerimos hardware nuevo ni reemplazar el CCTV existente.",
  },
  {
    q: "¿Qué necesito para la auditoría piloto?",
    a: "Video grabado de sus propias cámaras. Lo analizamos sin conectarnos a su red y en 72 horas le entregamos un reporte de cumplimiento con hallazgos priorizados.",
  },
  {
    q: "¿Dónde se procesa el video?",
    a: "En su infraestructura o en la nuestra. Si lo requiere, el procesamiento es on premise y el video nunca sale de su operación.",
  },
  {
    q: "¿Cuánto tarda la implementación?",
    a: "Una auditoría entrega resultados en 72 horas. Para monitoreo continuo estimamos entre 8 y 12 semanas por sitio, según la cantidad de cámaras y reglas. El plan concreto sale de la auditoría.",
  },
  {
    q: "¿Funciona en faenas remotas con poca conectividad?",
    a: "La auditoría no necesita conectividad: trabaja sobre video grabado. Para monitoreo continuo, el diseño procesa dentro de la faena y envía sólo alertas y reportes. Lo validamos en el piloto.",
  },
  {
    q: "¿Detecta el uniforme específico de mi empresa?",
    a: "En el plan Enterprise entrenamos modelos a medida del uniforme, los colores corporativos, los distintivos de rol y los procedimientos de su operación.",
  },
  {
    q: "¿Cómo manejan la privacidad de los trabajadores?",
    a: "Aplicamos privacidad por diseño: sin reconocimiento facial de identidad y con retención mínima de imágenes. El difuminado de rostros en los reportes está en desarrollo.",
  },
  {
    q: "¿Funciona de noche o con polvo, lluvia o niebla?",
    a: "Depende de la iluminación, el ángulo y la cámara. Por eso empezamos con una auditoría sobre su propio video: ahí medimos qué cámaras rinden y cuáles no, antes de cualquier compromiso.",
  },
  {
    q: "¿Qué pasa después de la primera llamada?",
    a: "Si hay encaje, coordinamos la auditoría piloto sobre su video. Con esos resultados le presentamos una propuesta con números reales de su sitio, sin compromiso de contratación.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-[#181818] py-24">
      <div className="container-opsia grid gap-12 md:grid-cols-[1fr_1.6fr]">
        <div>
          <Reveal>
            <p className="text-eyebrow text-amber-signal">Preguntas frecuentes</p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Lo que operaciones y HSE preguntan primero.
            </h2>
          </Reveal>
        </div>
        <div className="grid gap-2">
          {FAQ_ITEMS.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={it.q} className="rounded-2xl border border-white/10 bg-black">
                <h3>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-6 rounded-2xl px-6 py-4 text-left focus-visible:outline-2 focus-visible:outline-amber-signal"
                    aria-expanded={isOpen}
                    aria-controls={`faq-${i}`}
                  >
                    <span className="text-base font-medium text-white md:text-lg">{it.q}</span>
                    <span
                      className={
                        "grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] " +
                        (isOpen ? "bg-amber-signal text-black" : "bg-[#272727] text-white/70")
                      }
                    >
                      {isOpen ? (
                        <MinusIcon size={14} weight="bold" />
                      ) : (
                        <PlusIcon size={14} weight="bold" />
                      )}
                    </span>
                  </button>
                </h3>
                <div
                  id={`faq-${i}`}
                  className="grid overflow-hidden transition-[grid-template-rows] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="min-h-0">
                    <p className="px-6 pb-6 text-sm text-white/70">{it.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------- CTA final (idéntico al del hero) ----------
function FinalCTA({ onCta, onAudit }: { onCta: () => void; onAudit: () => void }) {
  return (
    <section className="bg-black py-24">
      <div className="container-opsia">
        <Reveal className="rounded-2xl border border-white/10 bg-[#181818] px-6 py-16 text-center md:px-16">
          <h2 className="text-hero mx-auto max-w-[680px] text-4xl font-semibold tracking-tight md:text-5xl">
            La próxima infracción puede ser un incidente.
            <br />O una alerta.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-white/60">
            En 30 minutos le mostramos cómo se ve OPSIA sobre una operación como la suya.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <button onClick={onCta} className="btn-primary">
              {CTA_LABEL}
              <ArrowRightIcon size={16} weight="bold" />
            </button>
            <button
              onClick={onAudit}
              className="text-sm text-white/60 underline underline-offset-4 transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white"
            >
              O solicite directamente una auditoría piloto
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------- Footer ----------
function Footer() {
  const cols = [
    {
      t: "Recorrido",
      items: [
        ["Vista de operador", "#escena-deteccion"],
        ["EPP en faena", "#escena-epp"],
        ["Proximidad", "#escena-proximidad"],
      ],
    },
    {
      t: "Plataforma",
      items: [
        ["Capacidades", "#plataforma"],
        ["Cómo funciona", "#como-funciona"],
        ["Planes", "#planes"],
      ],
    },
    {
      t: "Empresa",
      items: [
        ["Preguntas frecuentes", "#faq"],
        ["Contacto", `mailto:${CONTACT_EMAIL}`],
      ],
    },
  ];
  return (
    <footer className="bg-black pt-16 pb-8 text-white/80">
      <div className="container-opsia">
        <div className="grid gap-12 border-t border-white/10 pt-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-3">
              <img src={logoMark} alt="" width={32} height={24} className="h-6 w-auto" />
              <p className="text-xl font-semibold tracking-tight text-white">
                OPSIA<span className="text-amber-signal">.</span>
              </p>
            </div>
            <p className="mt-4 max-w-xs text-sm text-white/60">
              Visión artificial para seguridad minera. Convertimos las cámaras de su faena en un
              supervisor que no se distrae.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-4 inline-flex items-center gap-2 text-sm text-white/80 transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-amber-signal"
            >
              <EnvelopeSimpleIcon size={16} />
              {CONTACT_EMAIL}
            </a>
            <p className="mt-3 max-w-xs text-xs text-white/40">
              Cobertura: San Juan · Mendoza · Salta · Jujuy · Neuquén · Río Negro · Buenos Aires
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.t}>
              <p className="text-eyebrow text-white/50">{c.t}</p>
              <ul className="mt-4 grid gap-2 text-sm text-white/70">
                {c.items.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/40 md:flex-row">
          <p>© 2026 OPSIA. Visión artificial para seguridad minera.</p>
          <p>San Juan · Buenos Aires · Argentina</p>
        </div>
      </div>
    </footer>
  );
}

// ---------- Página ----------
function OpsiaLanding() {
  const [modal, setModal] = useState<{ open: boolean; intent?: string }>({ open: false });
  const openDemo = () => setModal({ open: true, intent: "demo" });
  const openAudit = () => setModal({ open: true, intent: "audit" });
  return (
    <div className="min-h-screen bg-black">
      <a
        href="#contenido"
        className="sr-only z-[200] rounded-full bg-amber-signal px-3 py-2 font-semibold text-black focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Saltar al contenido
      </a>
      <Navbar onCta={openDemo} />
      <main>
        <Hero onCta={openDemo} />
        <div id="contenido" tabIndex={-1} />
        <Proof />
        <Problem />
        <TaglineReveal />
        <Platform />
        <HowItWorks />
        <DashboardShowcase />
        <ServiceModel onCta={openDemo} />
        <Team />
        <FAQ />
        <FinalCTA onCta={openDemo} onAudit={openAudit} />
      </main>
      <Footer />
      <ContactModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        intent={modal.intent}
      />
    </div>
  );
}
