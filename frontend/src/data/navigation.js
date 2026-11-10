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
  { label: "Home", path: "/", icon: House, group: "START HERE" },
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    group: "WORKSPACE",
  },
  {
    label: "Field management",
    path: "/fields",
    icon: MapPinned,
    group: "WORKSPACE",
  },
  {
    label: "Rotation planner",
    path: "/planner",
    icon: Sprout,
    group: "PLANNING",
  },
  {
    label: "Rotation comparison",
    path: "/comparison",
    icon: GitCompareArrows,
    group: "PLANNING",
  },
  {
    label: "Recommendation",
    path: "/recommendation",
    icon: Lightbulb,
    group: "PLANNING",
  },
  {
    label: "Planting advisory",
    path: "/advisory",
    icon: CalendarDays,
    group: "ADVISORIES",
  },
];
