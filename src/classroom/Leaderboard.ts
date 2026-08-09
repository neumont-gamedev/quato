import { getTeamById } from "./GameMeta";
import type { ClassroomPlayer, LeaderboardEntry, TeamLeaderboardEntry } from "./types";

export function createLeaderboardEntries(players: ClassroomPlayer[], limit = 5): LeaderboardEntry[] {
  return [...players]
    .sort((left, right) => right.score - left.score || right.streak - left.streak || left.name.localeCompare(right.name))
    .slice(0, limit)
    .map(toLeaderboardEntry);
}

export function createTeamLeaderboardEntries(players: ClassroomPlayer[], limit = 4): TeamLeaderboardEntry[] {
  const teams = new Map<string, TeamLeaderboardEntry>();

  players.forEach((player) => {
    const team = getTeamById(player.teamId);
    const entry = teams.get(team.id) ?? {
      teamId: team.id,
      teamName: player.teamName || team.name,
      score: 0,
      playerCount: 0,
      averageScore: 0
    };

    entry.score += player.score;
    entry.playerCount += 1;
    entry.averageScore = Math.round(entry.score / entry.playerCount);
    teams.set(team.id, entry);
  });

  return [...teams.values()]
    .sort((left, right) => right.score - left.score || right.averageScore - left.averageScore || left.teamName.localeCompare(right.teamName))
    .slice(0, limit);
}

function toLeaderboardEntry(player: ClassroomPlayer): LeaderboardEntry {
  const team = getTeamById(player.teamId);

  return {
    uid: player.uid,
    name: player.name,
    characterIndex: player.characterIndex,
    teamId: team.id,
    teamName: player.teamName || team.name,
    achievements: Array.isArray(player.achievements) ? player.achievements : [],
    score: player.score,
    streak: player.streak
  };
}
