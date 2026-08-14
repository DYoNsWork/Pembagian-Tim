import { divideTeams, normalizeGenderMode } from "../src/teams.js";
import { chunk, groupDrawMembers, personFromRow } from "../src/draws.js";
import {
  gameFromRow,
  getGame,
  MAX_GAMES,
  normalizeGame,
} from "../src/games.js";

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS participants (id INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT NOT NULL, jenis_kelamin TEXT NOT NULL, cabang TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS draws (id INTEGER PRIMARY KEY AUTOINCREMENT, team_count INTEGER NOT NULL, members_per_team INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS draw_members (id INTEGER PRIMARY KEY AUTOINCREMENT, draw_id INTEGER NOT NULL, team_number INTEGER NOT NULL, team_name TEXT NOT NULL, nama TEXT NOT NULL, jenis_kelamin TEXT NOT NULL, cabang TEXT NOT NULL, FOREIGN KEY (draw_id) REFERENCES draws(id))`,
  `CREATE INDEX IF NOT EXISTS idx_draw_members_draw_id ON draw_members(draw_id)`,
  `CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, name TEXT NOT NULL, members INTEGER NOT NULL, team_count INTEGER NOT NULL DEFAULT 1, description TEXT NOT NULL DEFAULT '', label_prefix TEXT NOT NULL, is_builtin INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
];

const MAX_PARTICIPANTS = 2000;
const INSERT_CHUNK = 25;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    try {
      await env.DB.batch(SCHEMA_STATEMENTS.map((sql) => env.DB.prepare(sql)));
      await ensureDrawGameColumns(env);
      await ensureGameSchema(env);
      return await handleApi(request, env, url);
    } catch (error) {
      const status = Number(error.status) || 500;
      console.error("api_error", error);
      return json({ error: error.message || "Terjadi kesalahan di server." }, status);
    }
  },
};

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/\/$/, "") || "/";

  if (path === "/api/participants" && request.method === "GET") {
    return json(await listParticipants(env));
  }

  if (path === "/api/participants" && request.method === "PUT") {
    const body = await readJson(request);
    return json(await saveParticipants(env, body), 201);
  }

  if (path === "/api/participants" && request.method === "DELETE") {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM draw_members"),
      env.DB.prepare("DELETE FROM draws"),
      env.DB.prepare("DELETE FROM participants"),
      env.DB.prepare("DELETE FROM meta"),
    ]);
    return json({ ok: true });
  }

  if (path === "/api/games" && request.method === "GET") {
    return json({ games: await listGames(env) });
  }

  if (path === "/api/games" && request.method === "POST") {
    const body = await readJson(request);
    return json(await createGame(env, body), 201);
  }

  const gameMatch = path.match(/^\/api\/games\/([^/]+)$/);
  if (gameMatch && request.method === "PUT") {
    const body = await readJson(request);
    return json(await updateGame(env, decodeURIComponent(gameMatch[1]), body));
  }

  if (gameMatch && request.method === "DELETE") {
    return json(await deleteGame(env, decodeURIComponent(gameMatch[1])));
  }

  if (path === "/api/draws" && request.method === "GET") {
    return json(await listDraws(env));
  }

  if (path === "/api/draws" && request.method === "POST") {
    const body = await readJson(request);
    return json(await createDraw(env, body), 201);
  }

  const drawMatch = path.match(/^\/api\/draws\/(\d+)$/);
  if (drawMatch && request.method === "GET") {
    const draw = await getDraw(env, Number(drawMatch[1]));
    if (!draw) return json({ error: "Hasil undian tidak ditemukan." }, 404);
    return json(draw);
  }

  return json({ error: "Endpoint tidak ditemukan." }, 404);
}

async function listParticipants(env) {
  const [{ results }, filenameRow] = await Promise.all([
    env.DB.prepare(
      "SELECT id, nama, jenis_kelamin, cabang FROM participants ORDER BY id ASC",
    ).all(),
    env.DB.prepare("SELECT value FROM meta WHERE key = ?").bind("source_filename").first(),
  ]);

  return {
    participants: results.map(personFromRow),
    filename: filenameRow?.value || "",
  };
}

async function saveParticipants(env, body) {
  const filename = String(body?.filename || "unggahan.csv").slice(0, 180);
  const incoming = Array.isArray(body?.participants) ? body.participants : [];
  const participants = incoming
    .map((person) => ({
      nama: String(person?.nama || "").trim(),
      jenisKelamin: String(person?.jenisKelamin || person?.jenis_kelamin || "").trim() || "-",
      cabang: String(person?.cabang || "").trim() || "-",
    }))
    .filter((person) => person.nama);

  if (participants.length === 0) {
    throw Object.assign(new Error("Tidak ada peserta valid untuk disimpan."), { status: 400 });
  }
  if (participants.length > MAX_PARTICIPANTS) {
    throw Object.assign(
      new Error(`Maksimal ${MAX_PARTICIPANTS} peserta per unggahan.`),
      { status: 400 },
    );
  }

  await env.DB.batch([
    env.DB.prepare("DELETE FROM participants"),
    env.DB.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").bind(
      "source_filename",
      filename,
    ),
  ]);

  const insert = env.DB.prepare(
    "INSERT INTO participants (nama, jenis_kelamin, cabang) VALUES (?, ?, ?)",
  );
  for (const group of chunk(participants, INSERT_CHUNK)) {
    await env.DB.batch(
      group.map((person) => insert.bind(person.nama, person.jenisKelamin, person.cabang)),
    );
  }

  console.log("participants_saved", { count: participants.length, filename });
  return listParticipants(env);
}

async function listDraws(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, team_count, members_per_team, created_at, game_id, game_name, gender_mode FROM draws ORDER BY id DESC LIMIT 20",
  ).all();

  return {
    draws: results.map((row) => ({
      id: row.id,
      teamCount: row.team_count,
      membersPerTeam: row.members_per_team,
      gameId: row.game_id || "",
      gameName: row.game_name || "Permainan",
      genderMode: normalizeGenderMode(row.gender_mode),
      createdAt: row.created_at,
    })),
  };
}

async function listGames(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, members, team_count, description, label_prefix, is_builtin, sort_order FROM games ORDER BY sort_order ASC, name ASC",
  ).all();
  return (results || []).map(gameFromRow);
}

async function createGame(env, body) {
  const games = await listGames(env);
  if (games.length >= MAX_GAMES) {
    throw Object.assign(new Error(`Maksimal ${MAX_GAMES} jenis permainan.`), { status: 400 });
  }

  const parsed = normalizeGame(body, { existingIds: games.map((game) => game.id) });
  const sortOrder = games.reduce((max, game) => Math.max(max, game.sortOrder), 0) + 1;
  await env.DB.prepare(
    "INSERT INTO games (id, name, members, team_count, description, label_prefix, is_builtin, sort_order) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
  )
    .bind(
      parsed.id,
      parsed.name,
      parsed.members,
      parsed.teamCount,
      parsed.description,
      parsed.labelPrefix,
      sortOrder,
    )
    .run();

  console.log("game_created", { id: parsed.id });
  const list = await listGames(env);
  return { game: getGame(parsed.id, list), games: list };
}

async function updateGame(env, id, body) {
  const games = await listGames(env);
  const current = games.find((game) => game.id === id);
  if (!current) {
    throw Object.assign(new Error("Jenis permainan tidak ditemukan."), { status: 404 });
  }

  const parsed = normalizeGame(body, { id, existingIds: games.map((game) => game.id) });
  await env.DB.prepare(
    "UPDATE games SET name = ?, members = ?, team_count = ?, description = ?, label_prefix = ? WHERE id = ?",
  )
    .bind(
      parsed.name,
      parsed.members,
      parsed.teamCount,
      parsed.description,
      parsed.labelPrefix,
      id,
    )
    .run();

  console.log("game_updated", { id });
  const list = await listGames(env);
  return { game: getGame(id, list), games: list };
}

async function deleteGame(env, id) {
  const games = await listGames(env);
  const current = games.find((game) => game.id === id);
  if (!current) {
    throw Object.assign(new Error("Jenis permainan tidak ditemukan."), { status: 404 });
  }

  await env.DB.prepare("DELETE FROM games WHERE id = ?").bind(id).run();
  console.log("game_deleted", { id });
  return { ok: true, deletedId: id, games: await listGames(env) };
}

async function createDraw(env, body) {
  const games = await listGames(env);
  if (!games.length) {
    throw Object.assign(new Error("Belum ada jenis permainan. Tambah permainan dulu."), {
      status: 400,
    });
  }
  const game = games.find((item) => item.id === body?.gameId);
  if (!game) {
    throw Object.assign(new Error("Pilih jenis permainan yang valid."), { status: 400 });
  }
  const teamCount = Number(body?.teamCount) || game.teamCount;
  const membersPerTeam = Number(body?.membersPerTeam) || game.members;
  const genderMode = normalizeGenderMode(body?.genderMode);
  const stored = await listParticipants(env);
  let result;
  try {
    result = divideTeams(stored.participants, {
      teamCount,
      membersPerTeam,
      gameName: game.labelPrefix,
      genderMode,
    });
  } catch (error) {
    throw Object.assign(error, { status: 400 });
  }

  const drawInsert = await env.DB.prepare(
    "INSERT INTO draws (team_count, members_per_team, game_id, game_name, gender_mode) VALUES (?, ?, ?, ?, ?) RETURNING id, created_at",
  )
    .bind(teamCount, membersPerTeam, game.id, game.name, genderMode)
    .first();

  const memberStmt = env.DB.prepare(
    "INSERT INTO draw_members (draw_id, team_number, team_name, nama, jenis_kelamin, cabang) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const rows = [];

  for (const team of result.teams) {
    for (const member of team.members) {
      rows.push(
        memberStmt.bind(
          drawInsert.id,
          team.number,
          team.name,
          member.nama,
          member.jenisKelamin,
          member.cabang,
        ),
      );
    }
  }

  for (const member of result.leftover) {
    rows.push(
      memberStmt.bind(
        drawInsert.id,
        0,
        "Cadangan",
        member.nama,
        member.jenisKelamin,
        member.cabang,
      ),
    );
  }

  for (const group of chunk(rows, INSERT_CHUNK)) {
    await env.DB.batch(group);
  }

  console.log("draw_saved", { id: drawInsert.id, teams: result.teams.length });

  return {
    id: drawInsert.id,
    createdAt: drawInsert.created_at,
    teamCount,
    membersPerTeam,
    gameId: game.id,
    gameName: game.name,
    genderMode,
    ...result,
  };
}

async function getDraw(env, id) {
  const draw = await env.DB.prepare(
    "SELECT id, team_count, members_per_team, created_at, game_id, game_name, gender_mode FROM draws WHERE id = ?",
  )
    .bind(id)
    .first();

  if (!draw) return null;

  const { results } = await env.DB.prepare(
    "SELECT team_number, team_name, nama, jenis_kelamin, cabang FROM draw_members WHERE draw_id = ? ORDER BY id ASC",
  )
    .bind(id)
    .all();

  const grouped = groupDrawMembers(results);
  return {
    id: draw.id,
    createdAt: draw.created_at,
    teamCount: draw.team_count,
    membersPerTeam: draw.members_per_team,
    gameId: draw.game_id || "",
    gameName: draw.game_name || "Permainan",
    genderMode: normalizeGenderMode(draw.gender_mode),
    needed: draw.team_count * draw.members_per_team,
    ...grouped,
  };
}

async function ensureGameSchema(env) {
  const { results } = await env.DB.prepare("PRAGMA table_info(games)").all();
  const columns = new Set((results || []).map((row) => row.name));
  if (!columns.has("team_count")) {
    await env.DB.prepare("ALTER TABLE games ADD COLUMN team_count INTEGER NOT NULL DEFAULT 1").run();
  }

  const cleared = await env.DB.prepare("SELECT value FROM meta WHERE key = ?")
    .bind("cleared_builtin_games")
    .first();
  if (cleared?.value === "1") return;

  await env.DB.prepare("DELETE FROM games WHERE is_builtin = 1").run();
  await env.DB.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").bind(
    "cleared_builtin_games",
    "1",
  ).run();
}

async function ensureDrawGameColumns(env) {
  const { results } = await env.DB.prepare("PRAGMA table_info(draws)").all();
  const columns = new Set((results || []).map((row) => row.name));
  if (!columns.has("game_id")) {
    await env.DB.prepare("ALTER TABLE draws ADD COLUMN game_id TEXT").run();
  }
  if (!columns.has("game_name")) {
    await env.DB.prepare("ALTER TABLE draws ADD COLUMN game_name TEXT").run();
  }
  if (!columns.has("gender_mode")) {
    await env.DB.prepare("ALTER TABLE draws ADD COLUMN gender_mode TEXT").run();
  }
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw Object.assign(new Error("Body JSON tidak valid."), { status: 400 });
  }
}

function json(data, status = 200) {
  return Response.json(data, { status });
}
