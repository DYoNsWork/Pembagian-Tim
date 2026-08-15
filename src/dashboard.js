import { parseBracket } from "./bracket.js";
import { participantKey } from "./csv.js";

export function bracketProgress(bracket) {
  const parsed = typeof bracket === "string" ? parseBracket(bracket) : bracket;
  if (!parsed?.rounds?.length) {
    return parsed?.champion ? 100 : 0;
  }
  let total = 0;
  let done = 0;
  for (const round of parsed.rounds) {
    for (const match of round.matches || []) {
      const teams = (match.teams || []).filter((team) => team && !team.pending);
      if (teams.length < 1) continue;
      total += 1;
      if (match.winnerNumber) done += 1;
    }
  }
  if (!total) return parsed.champion ? 100 : 0;
  return Math.round((done / total) * 100);
}

export function participationCounts(memberRows) {
  const map = new Map();
  for (const row of memberRows || []) {
    if (Number(row.team_number) === 0) continue;
    const nama = String(row.nama || "").trim();
    if (!nama) continue;
    const cabang = String(row.cabang || "-").trim() || "-";
    const key = participantKey(nama, cabang);
    if (!map.has(key)) {
      map.set(key, { nama, cabang, count: 0 });
    }
    map.get(key).count += 1;
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.nama.localeCompare(b.nama, "id") || a.cabang.localeCompare(b.cabang, "id"),
  );
}

export function winCounts(drawSnapshots) {
  const map = new Map();
  for (const draw of drawSnapshots || []) {
    const teamsByNumber = new Map();
    for (const member of draw.members || []) {
      const teamNumber = Number(member.team_number);
      if (!teamNumber) continue;
      if (!teamsByNumber.has(teamNumber)) teamsByNumber.set(teamNumber, []);
      teamsByNumber.get(teamNumber).push(member);
    }

    const bracket = parseBracket(draw.bracket);
    for (const round of bracket?.rounds || []) {
      for (const match of round.matches || []) {
        if (!match.winnerNumber) continue;
        for (const member of teamsByNumber.get(Number(match.winnerNumber)) || []) {
          const nama = String(member.nama || "").trim();
          if (!nama) continue;
          const cabang = String(member.cabang || "-").trim() || "-";
          const key = participantKey(nama, cabang);
          if (!map.has(key)) map.set(key, { nama, cabang, wins: 0 });
          map.get(key).wins += 1;
        }
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => b.wins - a.wins || a.nama.localeCompare(b.nama, "id") || a.cabang.localeCompare(b.cabang, "id"),
  );
}

export function participantLeaderboard(memberRows, drawSnapshots, limit = 10) {
  const map = new Map();

  for (const row of participationCounts(memberRows)) {
    const key = participantKey(row.nama, row.cabang);
    map.set(key, { nama: row.nama, cabang: row.cabang, games: row.count, wins: 0 });
  }

  for (const row of winCounts(drawSnapshots)) {
    const key = participantKey(row.nama, row.cabang);
    if (!map.has(key)) {
      map.set(key, { nama: row.nama, cabang: row.cabang, games: 0, wins: row.wins });
    } else {
      map.get(key).wins = row.wins;
    }
  }

  return [...map.values()]
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.games - a.games ||
        a.nama.localeCompare(b.nama, "id") ||
        a.cabang.localeCompare(b.cabang, "id"),
    )
    .slice(0, limit);
}

export function gameProgressRows(games, drawsByGameId = new Map()) {
  return (games || []).map((game) => {
    const draw = drawsByGameId.get(game.id);
    const bracket = parseBracket(draw?.bracket);
    const champion = bracket?.champion?.name || null;
    const progress = draw ? bracketProgress(bracket) : 0;
    let status = "belum";
    if (draw) status = champion ? "selesai" : "berjalan";
    return {
      id: game.id,
      name: game.name,
      hasDraw: Boolean(draw),
      champion,
      progress,
      status,
    };
  });
}
