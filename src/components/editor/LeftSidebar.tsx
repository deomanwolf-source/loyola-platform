import {
  Blocks,
  Bot,
  CalendarDays,
  ChevronRight,
  DatabaseBackup,
  Download,
  FileCode2,
  FileText,
  Film,
  GalleryVerticalEnd,
  GraduationCap,
  History,
  Home,
  Image as ImageIcon,
  ImagePlus,
  Info,
  LayoutDashboard,
  LibraryBig,
  LogIn,
  MessagesSquare,
  Newspaper,
  Palette,
  PanelBottom,
  PanelTop,
  PenSquare,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Tags,
  Users,
  Wand2,
} from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";

type Item = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
};
type Group = { title: string; items: Item[]; defaultOpen?: boolean };

const groups: Group[] = [
  {
    title: "Loyola Digital Studio",
    defaultOpen: true,
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Website Editing Studio",
    defaultOpen: true,
    items: [
      { id: "live", label: "Live Website Editor", icon: PenSquare, badge: "Live" },
      { id: "pageBuilder", label: "Page Builder", icon: Blocks },
      { id: "sectionLibrary", label: "Section Library", icon: LibraryBig },
      { id: "navigation", label: "Header & Menu Editor", icon: PanelTop },
      { id: "footer", label: "Footer Editor", icon: PanelBottom },
      { id: "theme", label: "Design & Animation", icon: Wand2 },
      { id: "mediaLibrary", label: "Media Library", icon: ImageIcon },
      { id: "contentManager", label: "Content Manager", icon: FileText },
      { id: "galleryVideo", label: "Gallery & Video", icon: Film },
      { id: "staffProfiles", label: "Staff & Profiles", icon: Users },
      { id: "calendarEvents", label: "Calendar & Events", icon: CalendarDays },
      { id: "downloadsManager", label: "Downloads Manager", icon: Download },
      { id: "seo", label: "SEO Studio", icon: Search },
      { id: "mobile", label: "Mobile Responsive", icon: Smartphone },
      { id: "publish", label: "Publish Center", icon: Send },
      { id: "versions", label: "Version History", icon: History },
      { id: "usersRoles", label: "Users & Roles", icon: Users },
      { id: "security", label: "Security Center", icon: ShieldCheck },
      { id: "backupRestore", label: "Backup & Restore", icon: DatabaseBackup },
    ],
  },
  {
    title: "Advanced Panels",
    defaultOpen: true,
    items: [
      { id: "branding", label: "Branding & Identity", icon: Palette, badge: "Active" },
      { id: "pages", label: "Page Content", icon: FileCode2 },
      { id: "home", label: "Home Sections", icon: Home },
      { id: "about", label: "About Sections", icon: Info },
      { id: "academics", label: "Academics Sections", icon: GraduationCap },
      { id: "listings", label: "News & Events Sections", icon: Newspaper },
      { id: "media", label: "Hero & Images", icon: ImagePlus },
      { id: "gallery", label: "Photo Gallery", icon: GalleryVerticalEnd },
      { id: "news", label: "News & Blog", icon: Newspaper },
      { id: "events", label: "Events", icon: CalendarDays },
      { id: "forms", label: "Forms & Messages", icon: MessagesSquare },
      { id: "login", label: "Login Page", icon: LogIn },
      { id: "labels", label: "Header & Footer Labels", icon: Tags },
      { id: "automation", label: "Automation Center", icon: Bot },
      { id: "advanced", label: "Advanced Overrides", icon: SlidersHorizontal },
    ],
  },
];

export function LeftSidebar({
  active,
  setActive,
}: {
  active: string;
  setActive: (id: string) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map((group) => [group.title, group.defaultOpen ?? true])),
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="scrollbar-thin flex-1 overflow-y-auto py-3">
        {groups.map((group) => (
          <div key={group.title} className="mb-1">
            <button
              type="button"
              onClick={() => setOpen({ ...open, [group.title]: !open[group.title] })}
              className="flex w-full items-center gap-1.5 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
            >
              <ChevronRight
                className={`size-3 transition-transform ${open[group.title] ? "rotate-90" : ""}`}
              />
              {group.title}
            </button>
            {open[group.title] && (
              <div className="space-y-0.5 px-2">
                {group.items.map((item) => {
                  const isActive = active === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActive(item.id)}
                      className={`group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition ${
                        isActive
                          ? "bg-sidebar-accent text-foreground"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-foreground"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-r-full bg-primary" />
                      )}
                      <Icon className={`size-3.5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      {item.badge && (
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                            item.badge === "Live"
                              ? "bg-success/15 text-success"
                              : "bg-primary/15 text-primary"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/15 via-surface to-surface p-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">
            Auto-save ready
          </div>
          <div className="text-xs text-muted-foreground">
            Panel saves write to local storage and the remote database.
          </div>
        </div>
      </div>
    </aside>
  );
}
