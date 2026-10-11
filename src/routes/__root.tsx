import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <div className="max-w-md text-center">
        <p className="text-eyebrow text-amber-signal">Error 404</p>
        <h1 className="text-hero mt-4 text-5xl font-semibold tracking-tight">
          Esta cámara no tiene señal.
        </h1>
        <p className="mt-4 text-sm text-white/60">La página que busca no existe o fue movida.</p>
        <div className="mt-8">
          <Link to="/" className="btn-primary">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página no cargó
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo falló de nuestro lado. Puede reintentar o volver al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "OPSIA · Visión artificial para seguridad minera" },
      {
        name: "description",
        content:
          "OPSIA convierte las cámaras de su faena minera en un sistema de monitoreo inteligente: cumplimiento de EPP, detección de maquinaria pesada y alertas de proximidad en tiempo real.",
      },
      { name: "author", content: "OPSIA" },
      { property: "og:title", content: "OPSIA · Visión artificial para seguridad minera" },
      {
        property: "og:description",
        content:
          "EPP, maquinaria pesada y proximidad detectados en tiempo real en faenas mineras, sobre las cámaras que ya tienen instaladas.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://opsia-cv.netlify.app/" },
      { property: "og:image", content: "https://opsia-cv.netlify.app/og-image.jpg" },
      { property: "og:locale", content: "es_AR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://opsia-cv.netlify.app/og-image.jpg" },
      { name: "theme-color", content: "#000000" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "OPSIA",
          description:
            "Visión artificial para seguridad minera: cumplimiento de EPP, maquinaria pesada y proximidad en tiempo real sobre cámaras existentes.",
          url: "https://opsia-cv.netlify.app/",
          logo: "https://opsia-cv.netlify.app/apple-touch-icon.png",
          email: "opsia.cv@gmail.com",
          foundingLocation: { "@type": "Place", name: "San Juan, Argentina" },
          areaServed: "Argentina",
          knowsAbout: [
            "visión artificial",
            "seguridad minera",
            "detección de EPP",
            "minería",
            "proximidad de maquinaria pesada",
          ],
        }),
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon-64.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
