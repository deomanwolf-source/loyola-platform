import { memo, useState } from "react";
import { DEFAULT_HERO_IMAGE, useDb } from "@/lib/store";
import {
  ArrowRight,
  ChevronDown,
  Facebook,
  Instagram,
  Linkedin,
  Lock,
  Mail,
  MessageCircle,
  MapPin,
  Menu,
  Phone,
  X,
  Youtube,
} from "lucide-react";

function hrefFor(id: string) {
  return id === "home" ? "/" : `/${id}`;
}

function clampMediaOpacity(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.34;
  return Math.min(0.75, Math.max(0.08, value));
}

function pageIdFromHref(href: string) {
  return href.split("#")[0].replace(/^\/+/, "") || "home";
}

function cleanExternalUrl(value?: string) {
  const url = value?.trim();
  return url && url !== "#" ? url : "";
}

export const SiteHeader = memo(function SiteHeader() {
  const db = useDb();
  const [open, setOpen] = useState(false);
  const path = typeof window === "undefined" ? "/" : window.location.pathname;
  const pageIsLive = (id: string) =>
    Boolean(db.pages[id]) && (db.navigation.find((item) => item.id === id)?.visible ?? true);
  const hrefIsLive = (href: string) => pageIsLive(pageIdFromHref(href));
  const nav = [...db.navigation]
    .filter(
      (item) =>
        item.visible !== false &&
        !item.parentId &&
        item.id !== "student-portal" &&
        Boolean(db.pages[item.id]),
    )
    .sort((a, b) => a.order - b.order);
  const childNav = [...db.navigation]
    .filter(
      (item) =>
        item.visible !== false &&
        item.parentId &&
        item.id !== "student-portal" &&
        Boolean(db.pages[item.id]) &&
        pageIsLive(item.parentId),
    )
    .sort((a, b) => a.order - b.order);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-white/95 shadow-[0_18px_45px_-34px_rgb(10_22_40_/0.55)] backdrop-blur-xl transition-smooth">
      <div className="hidden border-b border-white/10 bg-navy text-white xl:block">
        <div className="mx-auto flex h-9 max-w-[110rem] items-center justify-between px-4 text-[11px] font-semibold sm:px-6">
          <div className="flex min-w-0 items-center gap-5 text-white/72">
            <span className="inline-flex min-w-0 items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-gold" />
              <span className="truncate">{db.websiteContent.address}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-gold" />
              {db.websiteContent.phone}
            </span>
            <span className="inline-flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-gold" />
              {db.websiteContent.email}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-5">
            {hrefIsLive("/news") && (
              <a href="/news" className="text-white/78 transition-smooth hover:text-white">
                Notices
              </a>
            )}
            {hrefIsLive("/admissions") && (
              <a href="/admissions" className="text-white/78 transition-smooth hover:text-white">
                Admissions
              </a>
            )}
            {hrefIsLive("/contact") && (
              <a href="/contact" className="text-white/78 transition-smooth hover:text-white">
                Contact
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex h-[76px] max-w-[110rem] items-center justify-between gap-3 px-4 pr-16 sm:px-6 sm:pr-20 xl:h-[82px] xl:pr-6">
        <a
          href="/"
          className="group flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3 xl:flex-none"
        >
          <span className="grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-gold bg-navy p-1.5 font-serif text-lg font-bold text-gold shadow-[0_16px_32px_-22px_rgb(10_22_40_/0.9)] ring-4 ring-navy/5 xl:h-[58px] xl:w-[58px]">
            {db.websiteContent.logoImage ? (
              <img
                src={db.websiteContent.logoImage}
                alt="Loyola College crest"
                className="h-full w-full rounded-full object-contain"
              />
            ) : (
              db.websiteContent.logoText
            )}
          </span>
          <span className="min-w-0 max-w-[52vw] leading-tight sm:max-w-[260px] xl:max-w-[250px] 2xl:max-w-[320px]">
            <span className="block truncate font-serif text-[18px] font-bold text-navy 2xl:text-[22px]">
              {db.websiteContent.schoolName}
            </span>
            <span className="mt-1 block truncate text-[9px] font-bold uppercase tracking-[0.18em] text-crimson 2xl:tracking-[0.22em]">
              {db.websiteContent.tagline}
            </span>
          </span>
        </a>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 xl:flex">
          {nav.map((item) => {
            const href = hrefFor(item.id);
            const children = [
              ...childNav
                .filter((child) => child.parentId === item.id)
                .map((child) => [child.label, hrefFor(child.id)] as [string, string]),
            ];
            const active = path === href || (href !== "/" && path.startsWith(href));
            return (
              <div key={item.id} className="group relative">
                <a
                  href={href}
                  className={`relative inline-flex h-11 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[13px] font-bold transition-smooth 2xl:gap-1.5 2xl:px-4 2xl:text-sm ${
                    active
                      ? "bg-gold/15 text-navy"
                      : "text-slate-700 hover:bg-secondary hover:text-navy"
                  }`}
                >
                  {item.label}
                  {children.length > 0 && <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                </a>
                {children.length > 0 && (
                  <div className="invisible absolute left-0 top-full z-50 min-w-64 translate-y-2 rounded-xl border border-border bg-white p-2 opacity-0 shadow-elegant transition-smooth group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    {children.map(([label, childHref]) => (
                      <a
                        key={childHref}
                        href={childHref}
                        className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 transition-smooth hover:bg-secondary hover:text-navy"
                      >
                        {label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center xl:flex">
          <a
            href="/login"
            className="inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-crimson px-4 text-sm font-bold text-white shadow-crimson transition-smooth hover:-translate-y-0.5 hover:bg-crimson-dark 2xl:px-5"
          >
            <Lock className="h-4 w-4 shrink-0" />{" "}
            {db.websiteContent.headerSignInLabel || "Portal Login"}
          </a>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="fixed right-4 top-[38px] z-[60] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md border border-border bg-white text-navy shadow-soft xl:hidden"
          aria-label="Menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="animate-fade-in border-t border-border bg-white shadow-elegant xl:hidden">
          <div className="flex flex-col gap-2 px-6 py-5">
            {nav.map((item) => (
              <div key={item.id}>
                <a
                  href={hrefFor(item.id)}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-4 py-3 text-sm font-semibold text-navy hover:bg-secondary"
                >
                  {item.label}
                </a>
                {[
                  ...childNav
                    .filter((child) => child.parentId === item.id)
                    .map((child) => [child.label, hrefFor(child.id)] as [string, string]),
                ].length > 0 && (
                  <div className="ml-4 border-l border-border pl-3">
                    {[
                      ...childNav
                        .filter((child) => child.parentId === item.id)
                        .map((child) => [child.label, hrefFor(child.id)] as [string, string]),
                    ].map(([label, href]) => (
                      <a
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-2 text-sm text-muted-foreground"
                      >
                        {label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-3">
              {hrefIsLive("/admissions") && (
                <a
                  href="/admissions"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-gold/50 px-4 py-3 text-center text-sm font-bold text-navy"
                >
                  {db.websiteContent.headerApplyLabel || "Admissions"}
                </a>
              )}
              <a
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-navy px-4 py-3 text-center text-sm font-bold text-white"
              >
                {db.websiteContent.headerSignInLabel || "Portal Login"}
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});

export const SiteFooter = memo(function SiteFooter() {
  const db = useDb();
  const nav = [...db.navigation]
    .filter(
      (n) =>
        n.visible !== false &&
        !n.parentId &&
        n.id !== "student-portal" &&
        Boolean(db.pages[n.id]),
    )
    .sort((a, b) => a.order - b.order);
  const hrefIsLive = (href: string) => {
    const id = pageIdFromHref(href);
    return Boolean(db.pages[id]) && (db.navigation.find((item) => item.id === id)?.visible ?? true);
  };
  const socialLinks = [
    {
      label: "Facebook",
      href: cleanExternalUrl(db.websiteContent.socials.facebook),
      icon: <Facebook className="h-4 w-4" />,
    },
    {
      label: "Instagram",
      href: cleanExternalUrl(db.websiteContent.socials.instagram),
      icon: <Instagram className="h-4 w-4" />,
    },
    {
      label: "YouTube",
      href: cleanExternalUrl(db.websiteContent.socials.youtube),
      icon: <Youtube className="h-4 w-4" />,
    },
    {
      label: "LinkedIn",
      href: cleanExternalUrl(db.websiteContent.socials.linkedin),
      icon: <Linkedin className="h-4 w-4" />,
    },
    {
      label: "WhatsApp channel",
      href: cleanExternalUrl(db.websiteContent.socials.whatsapp),
      icon: <MessageCircle className="h-4 w-4" />,
    },
  ].filter((item) => item.href);

  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full border-2 border-gold bg-white p-1.5 font-serif text-lg font-bold text-navy">
              {db.websiteContent.logoImage ? (
                <img
                  src={db.websiteContent.logoImage}
                  alt=""
                  className="h-full w-full rounded-full object-contain"
                />
              ) : (
                db.websiteContent.logoText
              )}
            </span>
            <div>
              <p className="font-serif text-2xl font-bold">{db.websiteContent.schoolName}</p>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">
                {db.websiteContent.tagline}
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-white/65">
            {db.websiteContent.footerText}
          </p>
          {socialLinks.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3 text-white/70">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/15 transition-smooth hover:border-gold hover:bg-gold hover:text-navy"
                >
                  {item.icon}
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Visit</p>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-white/72">
            <p>{db.websiteContent.address}</p>
            <p>{db.websiteContent.phone}</p>
            <p>{db.websiteContent.email}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Explore</p>
          <ul className="mt-4 space-y-2 text-sm text-white/72">
            {nav.slice(0, 6).map((item) => (
              <li key={item.id}>
                <a href={hrefFor(item.id)} className="transition-smooth hover:text-gold">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">Quick Actions</p>
          <div className="mt-4 space-y-3">
            {hrefIsLive("/admissions") && (
              <a
                href="/admissions"
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-smooth hover:bg-white/10"
              >
                Admissions <ArrowRight className="h-4 w-4" />
              </a>
            )}
            {hrefIsLive("/contact") && (
              <a
                href="/contact"
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-smooth hover:bg-white/10"
              >
                Contact office <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-white/12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-white/50 md:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {db.websiteContent.schoolName}. All rights reserved.
          </p>
          <p>{db.websiteContent.footerLegalLine}</p>
        </div>
      </div>
    </footer>
  );
});

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const db = useDb();
  return (
    <div className="public-site flex min-h-screen flex-col bg-background">
      {db.websiteContent.customCss && <style>{db.websiteContent.customCss}</style>}
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function HeroBackgroundLayer({
  fallbackImage,
  fallbackOpacity = 0.28,
  mediaUrl,
  mediaType,
  mediaOpacity,
  gradientClassName = "bg-[linear-gradient(105deg,rgb(10_22_40_/0.98),rgb(10_22_40_/0.86),rgb(183_15_27_/0.42))]",
  gridOpacityClassName = "opacity-20",
}: {
  fallbackImage?: string;
  fallbackOpacity?: number;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "";
  mediaOpacity?: number;
  gradientClassName?: string;
  gridOpacityClassName?: string;
}) {
  const hasPageMedia = Boolean(mediaUrl);
  const resolvedUrl = hasPageMedia ? mediaUrl || "" : fallbackImage || "";
  const resolvedMediaType = hasPageMedia ? mediaType || "image" : fallbackImage ? "image" : "";
  const resolvedOpacity = hasPageMedia ? clampMediaOpacity(mediaOpacity) : fallbackOpacity;

  return (
    <>
      {resolvedUrl && resolvedMediaType === "video" && (
        <video
          key={resolvedUrl}
          src={resolvedUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="hero-media absolute inset-0 h-full w-full object-cover"
          style={{ opacity: resolvedOpacity }}
        />
      )}
      {resolvedUrl && resolvedMediaType !== "video" && (
        <img
          src={resolvedUrl}
          alt=""
          className="hero-media absolute inset-0 h-full w-full object-cover"
          style={{ opacity: resolvedOpacity }}
        />
      )}
      <div className={`absolute inset-0 ${gradientClassName}`} />
      <div className={`absolute inset-0 premium-grid ${gridOpacityClassName}`} />
    </>
  );
}

export function PageHeader({
  pageId,
  kicker,
  title,
  subtitle,
  image,
}: {
  pageId?: string;
  kicker: string;
  title: string;
  subtitle?: string;
  image?: string;
}) {
  const db = useDb();
  const page = pageId ? db.pages[pageId] : undefined;
  const fallbackHeroImage =
    image || db.websiteContent.heroImage || db.media.campusImage || DEFAULT_HERO_IMAGE;

  return (
    <section className="relative overflow-hidden border-b border-border bg-navy text-white">
      <HeroBackgroundLayer
        fallbackImage={fallbackHeroImage}
        mediaUrl={page?.backgroundMediaUrl}
        mediaType={page?.backgroundMediaType}
        mediaOpacity={page?.backgroundMediaOpacity}
      />
      <div className="relative mx-auto max-w-7xl px-6 py-20 md:py-28 animate-fade-in-up">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-light">{kicker}</p>
        <span className="gold-divider mt-4" />
        <h1 className="max-w-4xl font-serif text-4xl font-bold leading-tight md:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
