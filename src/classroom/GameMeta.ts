export interface TeamOption {
  id: string;
  name: string;
}

export interface AchievementMeta {
  id: string;
  name: string;
  description: string;
}

export const TEAM_OPTIONS: TeamOption[] = [
  { id: "red", name: "Red Team" },
  { id: "blue", name: "Blue Team" },
  { id: "green", name: "Green Team" },
  { id: "gold", name: "Gold Team" }
];

export const SOLO_TEAM: TeamOption = { id: "solo", name: "Individual" };

export const ACHIEVEMENTS: AchievementMeta[] = [
  { id: "first-correct", name: "First Spark", description: "Answered a question correctly." },
  { id: "streak-3", name: "On Fire", description: "Built a 3-answer streak." },
  { id: "speed-demon", name: "Quick Draw", description: "Earned a strong speed bonus." },
  { id: "boss-clear", name: "Boss Breaker", description: "Answered a boss round correctly." }
];

export function normalizeTeamId(teamId: string | null | undefined, teamMode = true): string {
  if (!teamMode) {
    return SOLO_TEAM.id;
  }

  return typeof teamId === "string" && TEAM_OPTIONS.some((team) => team.id === teamId) ? teamId : TEAM_OPTIONS[0].id;
}

export function getTeamById(teamId: string | null | undefined): TeamOption {
  return teamId === SOLO_TEAM.id ? SOLO_TEAM : TEAM_OPTIONS.find((team) => team.id === teamId) ?? SOLO_TEAM;
}

export function getAchievementById(achievementId: string): AchievementMeta {
  return ACHIEVEMENTS.find((achievement) => achievement.id === achievementId) ?? {
    id: achievementId,
    name: achievementId,
    description: "Unlocked during this session."
  };
}
