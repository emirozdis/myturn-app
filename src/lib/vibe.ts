// ./src/lib/vibe.ts

export function getVibeArchetype(xp: number): string {
  if (xp <= 100) return "Ghost Watcher";
  if (xp <= 400) return "Vibe Checker";
  if (xp <= 1000) return "Reality Star";
  if (xp <= 2500) return "Chief Vibe Officer";
  return "Hollywood A-Lister";
}

export function getVibeBadgeStyle(archetype: string) {
  switch (archetype) {
    case "Ghost Watcher":
      return {
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#94a3b8",
      };
    case "Vibe Checker":
      return {
        background: "rgba(48,209,88,0.1)",
        border: "1px solid rgba(48,209,88,0.3)",
        color: "#30d158",
      };
    case "Reality Star":
      return {
        background: "rgba(10,132,255,0.1)",
        border: "1px solid rgba(10,132,255,0.3)",
        color: "#0a84ff",
      };
    case "Chief Vibe Officer":
      return {
        background: "rgba(191,90,242,0.12)",
        border: "1px solid rgba(191,90,242,0.35)",
        color: "#bf5af2",
      };
    case "Hollywood A-Lister":
    default:
      return {
        background: "linear-gradient(135deg, rgba(253,224,71,0.15) 0%, rgba(234,179,8,0.08) 100%)",
        border: "1px solid rgba(234,179,8,0.45)",
        color: "#facc15",
      };
  }
}