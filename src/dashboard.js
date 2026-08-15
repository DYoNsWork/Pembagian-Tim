import { parseBracket } from "./bracket.js";

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
    if (!map.has(nama)) {
      map.set(nama, { nama, cabang, count: 0 });
    }
    map.get(nama).count += 1;
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.nama.localeCompare(b.nama, "id"),
  );
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
