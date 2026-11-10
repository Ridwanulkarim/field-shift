
import {
  House,
  LayoutDashboard,
  MapPinned,
  Sprout,
  GitCompareArrows,
  Lightbulb,
  CalendarDays,
} from "lucide-react";

export const navigation = [
  {
    label: "Home",
    translations: {
      en: "Home",
      bn: "হোম",
    },
    path: "/",
    icon: House,
    group: "START HERE",
    groupTranslations: {
      en: "START HERE",
      bn: "শুরু করুন",
    },
  },
  {
    label: "Dashboard",
    translations: {
      en: "Dashboard",
      bn: "ড্যাশবোর্ড",
    },
    path: "/dashboard",
    icon: LayoutDashboard,
    group: "WORKSPACE",
    groupTranslations: {
      en: "WORKSPACE",
      bn: "কর্মক্ষেত্র",
    },
  },
  {
    label: "Field management",
    translations: {
      en: "Field management",
      bn: "জমি ব্যবস্থাপনা",
    },
    path: "/fields",
    icon: MapPinned,
    group: "WORKSPACE",
    groupTranslations: {
      en: "WORKSPACE",
      bn: "কর্মক্ষেত্র",
    },
  },
  {
    label: "Rotation planner",
    translations: {
      en: "Rotation planner",
      bn: "শস্য পর্যায় পরিকল্পনা",
    },
    path: "/planner",
    icon: Sprout,
    group: "PLANNING",
    groupTranslations: {
      en: "PLANNING",
      bn: "পরিকল্পনা",
    },
  },
  {
    label: "Rotation comparison",
    translations: {
      en: "Rotation comparison",
      bn: "শস্য পর্যায় তুলনা",
    },
    path: "/comparison",
    icon: GitCompareArrows,
    group: "PLANNING",
    groupTranslations: {
      en: "PLANNING",
      bn: "পরিকল্পনা",
    },
  },
  {
    label: "Recommendation",
    translations: {
      en: "Recommendation",
      bn: "সুপারিশ",
    },
    path: "/recommendation",
    icon: Lightbulb,
    group: "PLANNING",
    groupTranslations: {
      en: "PLANNING",
      bn: "পরিকল্পনা",
    },
  },
  {
    label: "Planting advisory",
    translations: {
      en: "Planting advisory",
      bn: "রোপণ পরামর্শ",
    },
    path: "/advisory",
    icon: CalendarDays,
    group: "ADVISORIES",
    groupTranslations: {
      en: "ADVISORIES",
      bn: "কৃষি পরামর্শ",
    },
  },
];
