import type { Project } from "@/features/auth/api";

export function formatRelativeTime(value: string): string {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return "unknown";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000));

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

export function chooseDefaultProject(projects: Project[]): Project | null {
  return projects.find((project) => project.status === "active") ?? projects[0] ?? null;
}

export function severityClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-700";
    case "high":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "medium":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}
