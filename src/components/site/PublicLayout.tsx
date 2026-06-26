import { memo, useState } from "react";
import {
  DEFAULT_DEVELOPER_CREDIT,
  DEFAULT_FOOTER_COPYRIGHT_LINE,
  DEFAULT_HERO_IMAGE,
  useDb,
} from "@/lib/store";
import { formatDisplayHeading } from "@/lib/utils";
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
  return Math.min(1, Math.max(0.08, value));
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
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
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

  const childrenFor = (id: string) =>
    childNav
      .filter((child) => child.parentId === id)
      .map((child) => [child.label, hrefFor(child.id)] as [string, string]);

  const isActive = (href: string) =>
    path === href || (href !== "/" && path.startsWith(href));

  return (
    <header
      data-website-section="Header"
      className="sticky top-0 z-50 bg-white shadow-[0_1px_0_0_#dde4ed,0_4px_24px_-8px_rgb(10_22_40_/0.10)] transition-smooth"
    >
      {/* Top bar — contact + quick links */}
      <div className="hidden border-b border-navy/8 bg-navy text-white lg:block">
        <div className="mx-auto flex h-9 max-w-[90rem] items-center justify-between px-6 text-[11px]">
          <div className="flex items-center gap-6 text-white/65">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-gold" />
              {db.websiteContent.address}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3 w-3 text-gold" />
              {db.websiteContent.phone}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-gold" />
              {db.websiteContent.email}
            </span>
          </div>
          <div className="flex items-center gap-5 font-medium">
            {hrefIsLive("/news") && (
              <a href="/news" className="text-white/60 transition-smooth hover:text-gold">
                Notices
              </a>
            )}
            {hrefIsLive("/admissions") && (
              <a href="/admissions" className="text-white/60 transition-smooth hover:text-gold">
                Admissions
              </a>
            )}
            {hrefIsLive("/contact") && (
              <a href="/contact" className="text-white/60 transition-smooth hover:text-gold">
                Contact
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="mx-auto flex h-[72px] max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6 xl:h-[80px]">

        {/* Logo */}
        <a
          href="/"
          className="group flex shrink-0 items-center gap-3"
          aria-label={db.websiteContent.schoolName}
        >
          <span className="grid h-[50px] w-[50px] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-gold/80 bg-navy p-1 shadow-[0_4px_16px_-4px_rgb(10_22_40_/0.4)] transition-smooth group-hover:border-gold xl:h-[56px] xl:w-[56px]">
            <img
                src={db.websiteContent.logoImage || "/loyola-crest.jpg"}
                alt="Loyola College crest"
                className="h-full w-full rounded-full object-contain"
              />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate font-serif text-[17px] font-bold leading-tight text-navy transition-smooth group-hover:text-navy/80 xl:text-[19px]">
              {db.websiteContent.schoolName}
            </span>
            <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.2em] text-crimson xl:tracking-[0.24em]">
              {db.websiteContent.tagline}
            </span>
          </span>
        </a>

        {/* Desktop navigation */}
        <nav className="hidden xl:flex h-full flex-1 items-center justify-center">
          <ul className="flex h-full items-stretch gap-0 flex-nowrap">
            {nav.map((item) => {
              const href = hrefFor(item.id);
              const children = childrenFor(item.id);
              const active = isActive(href);
              const hasDropdown = children.length > 0;

              return (
                <li
                  key={item.id}
                  className="relative flex items-stretch shrink-0"
                  onMouseEnter={() => hasDropdown && setActiveDropdown(item.id)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <a
                    href={href}
                    className={`relative flex items-center gap-0.5 whitespace-nowrap px-2.5 text-[12.5px] font-semibold tracking-[0.01em] transition-smooth after:absolute after:bottom-0 after:left-2.5 after:right-2.5 after:h-[2px] after:rounded-full after:bg-gold after:transition-smooth ${
                      active
                        ? "text-navy after:scale-x-100"
                        : "text-slate-600 after:scale-x-0 hover:text-navy hover:after:scale-x-100"
                    }`}
                    style={{ transformOrigin: "left" }}
                  >
                    {formatDisplayHeading(item.label)}
                    {hasDropdown && (
                      <ChevronDown
                        className={`h-3 w-3 shrink-0 transition-smooth ${activeDropdown === item.id ? "rotate-180" : ""}`}
                      />
                    )}
                  </a>

                  {/* Dropdown */}
                  {hasDropdown && (
                    <div
                      className={`absolute left-0 top-full z-50 min-w-56 origin-top-left rounded-xl border border-border bg-white py-2 shadow-elegant transition-smooth ${
                        activeDropdown === item.id
                          ? "visible scale-100 opacity-100"
                          : "invisible scale-95 opacity-0"
                      }`}
                    >
                      {children.map(([label, childHref]) => (
                        <a
                          key={childHref}
                          href={childHref}
                          className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-slate-600 transition-smooth hover:bg-secondary hover:text-navy"
                        >
                          <span className="h-1 w-1 shrink-0 rounded-full bg-gold/60" />
                          {formatDisplayHeading(label)}
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Right side — CTA + login */}
        <div className="hidden xl:flex shrink-0 items-center gap-3">
          {hrefIsLive("/admissions") && (
            <a
              href="/admissions"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gold/60 bg-gold/8 px-4 text-[13px] font-semibold text-navy transition-smooth hover:border-gold hover:bg-gold/15"
            >
              {db.websiteContent.headerApplyLabel || "Admissions"}
            </a>
          )}
          <a
            href="/login"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-[13px] font-semibold text-white shadow-[0_4px_16px_-4px_rgb(10_22_40_/0.5)] transition-smooth hover:bg-navy-mid hover:-translate-y-px"
          >
            <Lock className="h-3.5 w-3.5 shrink-0" />
            {db.websiteContent.headerSignInLabel || "Portal Login"}
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-white text-navy shadow-soft transition-smooth hover:bg-secondary xl:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="animate-fade-in border-t border-border bg-white shadow-elegant xl:hidden">
          <div className="mx-auto max-w-[90rem] px-4 py-4 sm:px-6">
            {/* Contact info on mobile */}
            <div className="mb-4 flex flex-wrap gap-3 border-b border-border pb-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-gold" />
                {db.websiteContent.phone}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-gold" />
                {db.websiteContent.email}
              </span>
            </div>

            {/* Nav links */}
            <ul className="space-y-0.5">
              {nav.map((item) => {
                const children = childrenFor(item.id);
                const active = isActive(hrefFor(item.id));
                return (
                  <li key={item.id}>
                    <a
                      href={hrefFor(item.id)}
                      onClick={() => setOpen(false)}
                      className={`flex items-center rounded-lg px-3 py-2.5 text-[14px] font-semibold transition-smooth ${
                        active
                          ? "bg-gold/10 text-navy"
                          : "text-slate-700 hover:bg-secondary hover:text-navy"
                      }`}
                    >
                      {active && <span className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />}
                      {formatDisplayHeading(item.label)}
                    </a>
                    {children.length > 0 && (
                      <ul className="ml-5 mt-0.5 space-y-0.5 border-l-2 border-gold/20 pl-3">
                        {children.map(([label, href]) => (
                          <li key={href}>
                            <a
                              href={href}
                              onClick={() => setOpen(false)}
                              className="flex items-center rounded px-3 py-2 text-[13px] text-slate-500 transition-smooth hover:text-navy"
                            >
                              {formatDisplayHeading(label)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Mobile CTA buttons */}
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
              {hrefIsLive("/admissions") && (
                <a
                  href="/admissions"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center rounded-lg border border-gold/50 bg-gold/8 px-4 py-2.5 text-center text-[13px] font-semibold text-navy"
                >
                  {db.websiteContent.headerApplyLabel || "Admissions"}
                </a>
              )}
              <a
                href="/login"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-navy px-4 py-2.5 text-center text-[13px] font-semibold text-white"
              >
                <Lock className="h-3.5 w-3.5" />
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
  const socials = db.websiteContent.socials || {};
  const footerCopyrightLine =
    db.websiteContent.footerCopyrightLine || DEFAULT_FOOTER_COPYRIGHT_LINE;
  const developerCredit = db.websiteContent.developerCredit || DEFAULT_DEVELOPER_CREDIT;
  const footerLegalLine = db.websiteContent.footerLegalLine?.trim();

  const nav = [...db.navigation]
    .filter(
      (n) =>
        n.visible !== false && !n.parentId && n.id !== "student-portal" && Boolean(db.pages[n.id]),
    )
    .sort((a, b) => a.order - b.order);

  const hrefIsLive = (href: string) => {
    const id = pageIdFromHref(href);
    return Boolean(db.pages[id]) && (db.navigation.find((item) => item.id === id)?.visible ?? true);
  };

  const socialLinks = [
    { label: "Facebook", href: cleanExternalUrl(socials.facebook), icon: <Facebook className="h-4 w-4" /> },
    { label: "Instagram", href: cleanExternalUrl(socials.instagram), icon: <Instagram className="h-4 w-4" /> },
    { label: "YouTube", href: cleanExternalUrl(socials.youtube), icon: <Youtube className="h-4 w-4" /> },
    { label: "LinkedIn", href: cleanExternalUrl(socials.linkedin), icon: <Linkedin className="h-4 w-4" /> },
    { label: "WhatsApp", href: cleanExternalUrl(socials.whatsapp), icon: <MessageCircle className="h-4 w-4" /> },
  ].filter((item) => item.href);

  return (
    <footer data-website-section="Footer" className="bg-navy text-white">
      {/* Gold top accent line */}
      <div className="h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-60" />

      <div className="mx-auto max-w-[90rem] px-6 py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.8fr_1fr_1fr_1.1fr]">

          {/* Brand column */}
          <div>
            <a href="/" className="group inline-flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-gold/60 bg-white/8 p-1.5 transition-smooth group-hover:border-gold">
                <img
                    src={db.websiteContent.logoImage || "/loyola-crest.jpg"}
                    alt="Loyola College crest"
                    className="h-full w-full rounded-full object-contain"
                  />
              </span>
              <div>
                <p className="font-serif text-xl font-bold leading-snug text-white transition-smooth group-hover:text-gold/90">
                  {db.websiteContent.schoolName}
                </p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-gold/80">
                  {db.websiteContent.tagline}
                </p>
              </div>
            </a>

            <p className="mt-6 max-w-xs text-[13.5px] leading-relaxed text-white/55">
              {db.websiteContent.footerText}
            </p>

            {socialLinks.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {socialLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.label}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-white/12 text-white/55 transition-smooth hover:border-gold/60 hover:bg-gold/12 hover:text-gold"
                  >
                    {item.icon}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
              Contact Us
            </h3>
            <div className="mt-4 space-y-3">
              {db.websiteContent.address && (
                <p className="flex items-start gap-2 text-[13.5px] text-white/60">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold/70" />
                  {db.websiteContent.address}
                </p>
              )}
              {db.websiteContent.phone && (
                <p className="flex items-center gap-2 text-[13.5px] text-white/60">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-gold/70" />
                  {db.websiteContent.phone}
                </p>
              )}
              {db.websiteContent.email && (
                <p className="flex items-center gap-2 text-[13.5px] text-white/60">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-gold/70" />
                  {db.websiteContent.email}
                </p>
              )}
            </div>
          </div>

          {/* Explore */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
              Explore
            </h3>
            <ul className="mt-4 space-y-2">
              {nav.slice(0, 7).map((item) => (
                <li key={item.id}>
                  <a
                    href={hrefFor(item.id)}
                    className="group flex items-center gap-2 text-[13.5px] text-white/60 transition-smooth hover:text-gold"
                  >
                    <ArrowRight className="h-3 w-3 shrink-0 opacity-0 -translate-x-1 transition-smooth group-hover:opacity-100 group-hover:translate-x-0" />
                    {formatDisplayHeading(item.label)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
              Quick Access
            </h3>
            <div className="mt-4 space-y-2.5">
              <a
                href="/login"
                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[13px] font-medium text-white/75 transition-smooth hover:border-gold/40 hover:bg-white/8 hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-gold/70" />
                  Portal Login
                </span>
                <ArrowRight className="h-3.5 w-3.5 opacity-50" />
              </a>
              {hrefIsLive("/admissions") && (
                <a
                  href="/admissions"
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[13px] font-medium text-white/75 transition-smooth hover:border-gold/40 hover:bg-white/8 hover:text-white"
                >
                  <span>Admissions</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-50" />
                </a>
              )}
              {hrefIsLive("/contact") && (
                <a
                  href="/contact"
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[13px] font-medium text-white/75 transition-smooth hover:border-gold/40 hover:bg-white/8 hover:text-white"
                >
                  <span>Contact Office</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-50" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/8">
        <div className="mx-auto flex max-w-[90rem] flex-col items-center justify-between gap-3 px-6 py-5 text-[11.5px] text-white/40 md:flex-row">
          <div className="space-y-1 text-center md:text-left">
            <p>{footerCopyrightLine}</p>
            {developerCredit && (
              <p className="text-[10.5px] text-white/28">{developerCredit}</p>
            )}
          </div>
          {footerLegalLine && (
            <p className="max-w-sm text-center text-white/35 md:text-right">{footerLegalLine}</p>
          )}
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
    <section
      data-website-section="Hero"
      className="relative overflow-hidden border-b border-border bg-navy text-white"
    >
      <HeroBackgroundLayer
        fallbackImage={fallbackHeroImage}
        mediaUrl={page?.backgroundMediaUrl}
        mediaType={page?.backgroundMediaType}
        mediaOpacity={page?.backgroundMediaOpacity}
      />
      <div className="relative mx-auto max-w-[90rem] px-6 py-20 md:py-28 animate-fade-in-up">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gold/80">
          {formatDisplayHeading(kicker)}
        </p>
        <span className="gold-divider mt-4" />
        <h1 className="max-w-4xl break-words font-serif text-3xl font-bold leading-tight sm:text-4xl md:text-5xl lg:text-6xl">
          {formatDisplayHeading(title)}
        </h1>
        {subtitle && (
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/72 md:text-lg">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
