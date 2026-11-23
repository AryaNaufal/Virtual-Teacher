import { Sparkles, ListChecks, LayoutDashboard, Building2, Bot, Users, School, CalendarCheck, GraduationCap, ClipboardList, FileCheck2, BookOpen, FileBarChart, Archive, Settings } from "lucide-react";

export const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, phase: 1 },
  { href: "/office", label: "Virtual Office", icon: Building2, phase: 1 },
  { href: "/employees", label: "AI Employees", icon: Bot, phase: 1 },
  { href: "/command", label: "Command Center", icon: Sparkles, phase: 2 },
  { href: "/tasks", label: "Tasks", icon: ListChecks, phase: 2 },
  { href: "/students", label: "Students", icon: Users, phase: 3 },
  { href: "/classes", label: "Classes", icon: School, phase: 3 },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck, phase: 3 },
  { href: "/grades", label: "Grades", icon: GraduationCap, phase: 3 },
  { href: "/assignments", label: "Assignments", icon: ClipboardList, phase: 4 },
  { href: "/papers", label: "Korektor Paper", icon: FileCheck2, phase: 4 },
  { href: "/materials", label: "Learning Materials", icon: BookOpen, phase: 4 },
  { href: "/reports", label: "Reports", icon: FileBarChart, phase: 4 },
  { href: "/archive", label: "Document Archive", icon: Archive, phase: 4 },
  { href: "/settings", label: "Settings", icon: Settings, phase: 5 },
];
