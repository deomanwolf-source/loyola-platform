import {
  ChevronDown,
  Eye,
  EyeOff,
  Monitor,
  Rocket,
  Save,
  Search,
  Smartphone,
  Tablet,
} from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type StudioDevice = "desktop" | "tablet" | "mobile";

const pages = [
  ["home", "Home"],
  ["about", "About"],
  ["academics", "Academics"],
  ["admissions", "Admissions"],
  ["news", "News & Notices"],
  ["events", "Events"],
  ["sports-clubs", "Sports & Clubs"],
  ["gallery", "Gallery"],
  ["downloads", "Downloads"],
  ["student-portal", "Student Portal"],
  ["contact", "Contact"],
];

const devices: { id: StudioDevice; icon: ComponentType<{ className?: string }> }[] = [
  { id: "desktop", icon: Monitor },
  { id: "tablet", icon: Tablet },
  { id: "mobile", icon: Smartphone },
];

export function TopBar({
  device,
  setDevice,
  showPreview,
  togglePreview,
  page,
  setPage,
  onSave,
  onPublish,
  saved,
}: {
  device: StudioDevice;
  setDevice: (device: StudioDevice) => void;
  showPreview: boolean;
  togglePreview: () => void;
  page: string;
  setPage: (page: string) => void;
  onSave: () => void;
  onPublish: () => void;
  saved: boolean;
}) {
  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/80 px-3 backdrop-blur-xl">
      <div className="flex h-full items-center gap-2 border-r border-border pr-3">
        <div className="grid size-8 place-items-center rounded-md bg-gradient-amber font-display text-lg text-primary-foreground">
          L
        </div>
        <div className="leading-tight">
          <div className="font-display text-[15px]">Loyola Digital Studio</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Editor v3.0
          </div>
        </div>
      </div>

      <nav className="hidden items-center gap-1 text-sm lg:flex">
        {["Dashboard", "Editor", "Media", "Settings"].map((item, index) => (
          <button
            key={item}
            type="button"
            className={`h-8 rounded-md px-3 transition-colors ${
              index === 1
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }`}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="relative mx-auto hidden max-w-md flex-1 lg:block">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search assets, pages, sections..."
          className="h-9 border-border bg-background/60 pl-9 pr-16 focus-visible:ring-1 focus-visible:ring-primary/40"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          Ctrl K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden sm:block">
          <select
            value={page}
            onChange={(event) => setPage(event.target.value)}
            className="h-9 cursor-pointer appearance-none rounded-md border border-border bg-secondary pl-3 pr-8 text-sm hover:border-border-strong"
          >
            {pages.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>

        <div className="hidden items-center rounded-md border border-border bg-secondary p-0.5 xl:flex">
          {devices.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDevice(id)}
              className={`grid size-7 place-items-center rounded-[5px] transition ${
                device === id
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={id}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>

        <Button variant="ghost" size="sm" onClick={togglePreview} className="h-9 gap-1.5">
          {showPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          <span className="hidden text-xs xl:inline">{showPreview ? "Hide" : "Show"} Preview</span>
        </Button>

        {saved && (
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-success md:inline">
            Saved
          </span>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          className="h-9 gap-1.5 border-border bg-secondary"
        >
          <Save className="size-3.5" />
          <span className="hidden text-xs sm:inline">Save</span>
        </Button>

        <Button
          size="sm"
          onClick={onPublish}
          className="h-9 gap-1.5 bg-gradient-amber font-medium text-primary-foreground ring-amber-glow hover:opacity-90"
        >
          <Rocket className="size-3.5" />
          <span className="hidden text-xs sm:inline">Publish</span>
        </Button>
      </div>
    </header>
  );
}
