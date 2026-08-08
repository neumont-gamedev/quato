import type { ClassroomPlayer, LeaderboardEntry } from "./types";

export function createLeaderboardEntries(players: ClassroomPlayer[], limit = 5): LeaderboardEntry[] {
  return [...players]
    .sort((left, right) => right.score - left.score || right.streak - left.streak || left.name.localeCompare(right.name))
    .slice(0, limit)
    .map((player) => ({
      uid: player.uid,
      name: player.name,
      score: player.score,
      streak: player.streak
    }));
}
