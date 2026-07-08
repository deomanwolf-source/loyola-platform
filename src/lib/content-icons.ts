import type { LucideIcon } from "lucide-react";
import {
  Landmark,
  Images,
  FileText,
  Calendar,
  Camera,
  Award,
  Film,
  ShieldCheck,
  GraduationCap,
  Users,
  BookOpen,
  Trophy,
  Star,
  Heart,
  Music,
  Palette,
  Globe,
  Microscope,
  FlaskConical,
  Dumbbell,
  Medal,
  Newspaper,
  Mail,
  Phone,
  MapPin,
  Building2,
  School,
  Library,
  Laptop,
  Lightbulb,
  Rocket,
  Target,
  Handshake,
  Church,
  PenTool,
  Flag,
  Sparkles,
  Briefcase,
  Bus,
  Eye,
  CheckCircle2,
  Compass,
  Leaf,
  Sun,
} from "lucide-react";

/**
 * Central registry mapping a stored icon NAME (a plain string that lives in the
 * content database and is editable from the Website Studio) to the Lucide icon
 * component used to render it on the public site.
 *
 * Add new icons here and they become instantly available in every Studio icon
 * picker. Never rename a key that is already stored in content — that would
 * orphan existing selections (they would fall back to the default icon).
 */
export const CONTENT_ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Landmark,
  Images,
  FileText,
  Calendar,
  Camera,
  Award,
  Film,
  ShieldCheck,
  GraduationCap,
  Users,
  BookOpen,
  Trophy,
  Star,
  Heart,
  Music,
  Palette,
  Globe,
  Microscope,
  FlaskConical,
  Dumbbell,
  Medal,
  Newspaper,
  Mail,
  Phone,
  MapPin,
  Building2,
  School,
  Library,
  Laptop,
  Lightbulb,
  Rocket,
  Target,
  Handshake,
  Church,
  PenTool,
  Flag,
  Briefcase,
  Bus,
  Eye,
  CheckCircle2,
  Compass,
  Leaf,
  Sun,
};

export const CONTENT_ICON_NAMES = Object.keys(CONTENT_ICONS);

export const DEFAULT_CONTENT_ICON_NAME = "Sparkles";

/** Resolve a stored icon name to a renderable Lucide component, with a safe fallback. */
export function resolveContentIcon(
  name?: string,
  fallback: LucideIcon = CONTENT_ICONS[DEFAULT_CONTENT_ICON_NAME],
): LucideIcon {
  if (name && CONTENT_ICONS[name]) return CONTENT_ICONS[name];
  return fallback;
}
