import {
  ArrowLeftRight,
  ClipboardList,
  Compass,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type WelcomeSlide = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const WELCOME_SLIDES: WelcomeSlide[] = [
  {
    icon: Compass,
    title: "Welcome to Trivedi Marbles Inventory",
    description:
      "Track every slab, lot, and warehouse movement from one place. Here's a 60-second look around before you dive in.",
  },
  {
    icon: ClipboardList,
    title: "Find any slab in seconds",
    description:
      "Inventory is grouped by category, then lot, then slab — drill down instead of scrolling one giant list.",
  },
  {
    icon: ArrowLeftRight,
    title: "Log stock as it moves",
    description:
      "Add Stock and Movement record everything that arrives, shifts between warehouses, or ships out, so your numbers stay honest.",
  },
  {
    icon: Plus,
    title: "Stay on top of your work",
    description:
      "Tasks and notifications keep you and your team aligned on what's due and who owns it.",
  },
];

export type SpotlightStep = {
  tourId: string;
  title: string;
  description: string;
};

// Ordered to roughly match the sidebar, top to bottom. A step is skipped
// automatically if the current user's role/permissions don't render that
// nav item (or icon), so this full list degrades gracefully per role.
export const SPOTLIGHT_STEPS: SpotlightStep[] = [
  {
    tourId: "tour-theme",
    title: "Light / dark mode",
    description: "Switch between light and dark mode to match your preference.",
  },
  {
    tourId: "tour-notifications",
    title: "Notifications",
    description: "Get notified here when something needs your attention, like low stock or a new task.",
  },
  {
    tourId: "tour-dashboard",
    title: "Dashboard",
    description: "A quick snapshot of stock value, low-stock alerts, and recent activity.",
  },
  {
    tourId: "tour-inventory",
    title: "Inventory",
    description: "Browse by category, open a category for its lots, then a lot for its slabs.",
  },
  {
    tourId: "tour-add-stock",
    title: "Add Stock",
    description: "Log new material as soon as it arrives at the warehouse.",
  },
  {
    tourId: "tour-movement",
    title: "Movement",
    description: "Record stock moving between warehouses or going out for a sale.",
  },
  {
    tourId: "tour-tasks",
    title: "Tasks",
    description: "Track what's assigned to you and your team, with due dates and reminders.",
  },
  {
    tourId: "tour-task-calendar",
    title: "Task Calendar",
    description: "See tasks laid out on a calendar to plan your week at a glance.",
  },
  {
    tourId: "tour-kra",
    title: "KRA / KPI",
    description: "Track key results and performance targets for yourself and your team.",
  },
  {
    tourId: "tour-quotations",
    title: "Quotations",
    description: "Create and manage price quotations for clients.",
  },
  {
    tourId: "tour-client-leads",
    title: "Client Leads",
    description: "Keep track of prospective clients and their inquiries.",
  },
  {
    tourId: "tour-visualizer",
    title: "Visualizer",
    description: "Preview how a slab or lot will look installed, right from the browser.",
  },
  {
    tourId: "tour-journal",
    title: "Journal",
    description: "Publish blog-style updates and articles.",
  },
  {
    tourId: "tour-users",
    title: "Users",
    description: "Invite teammates and manage their roles and permissions.",
  },
  {
    tourId: "tour-audit-log",
    title: "Audit Log",
    description: "See a full history of who changed what, and when.",
  },
  {
    tourId: "tour-archive",
    title: "Archive",
    description: "Browse stock that's been archived or sold, without cluttering the active list.",
  },
  {
    tourId: "tour-settings",
    title: "Settings",
    description: "Your profile, password, notifications, and appearance preferences.",
  },
  {
    tourId: "tour-account",
    title: "Your account",
    description: "Click here anytime to update your profile or picture. Logout is right below it.",
  },
];
