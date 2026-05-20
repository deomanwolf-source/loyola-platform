import { useDb } from "@/lib/store";

export function BrandedLoader({
  title = "Loading Loyola College",
  subtitle = "Preparing your experience",
  fullScreen = true,
}: {
  title?: string;
  subtitle?: string;
  fullScreen?: boolean;
}) {
  const db = useDb();
  const logo = db.websiteContent.logoImage || "/loyola-crest.jpg";

  return (
    <div
      className={`brand-loader ${fullScreen ? "min-h-screen" : "min-h-[260px]"} grid place-items-center bg-[#eef3ff] px-6 text-center`}
    >
      <div className="brand-loader-card">
        <div className="brand-loader-mark">
          <span className="brand-loader-ring brand-loader-ring-one" />
          <span className="brand-loader-ring brand-loader-ring-two" />
          <img src={logo} alt="Loyola College" className="brand-loader-logo" />
        </div>
        <h1 className="mt-8 font-serif text-3xl font-bold text-navy">{title}</h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
