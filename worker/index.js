import { divideTeams, normalizeGenderMode } from "../src/teams.js";
import { chunk, extraDrawIds, groupDrawMembers, normalizeParticipant, personFromRow } from "../src/draws.js";
import { gameProgressRows, participationCounts } from "../src/dashboard.js";
import {
  gameFromRow,
  getGame,
  MAX_GAMES,
  MAX_GROUPS_PER_SESSION,
  normalizeGame,
  withPicDetails,
} from "../src/games.js";
import { buildKnockoutBracket, parseBracket, setMatchWinner } from "../src/bracket.js";
import {
  createUser,
  deleteUser,
  ensureUserSchema,
  getSessionUser,
  handleAuth,
  listUsers,
  requireAnyRight,
  requireRight,
  updateUser,
} from "./auth.js";

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS participants (id INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT NOT NULL, jenis_kelamin TEXT NOT NULL, cabang TEXT NOT NULL, nomor TEXT NOT NULL DEFAULT '', excluded INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS draws (id INTEGER PRIMARY KEY AUTOINCREMENT, team_count INTEGER NOT NULL, members_per_team INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS draw_members (id INTEGER PRIMARY KEY AUTOINCREMENT, draw_id INTEGER NOT NULL, team_number INTEGER NOT NULL, team_name TEXT NOT NULL, nama TEXT NOT NULL, jenis_kelamin TEXT NOT NULL, cabang TEXT NOT NULL, FOREIGN KEY (draw_id) REFERENCES draws(id))`,
  `CREATE INDEX IF NOT EXISTS idx_draw_members_draw_id ON draw_members(draw_id)`,
  `CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, name TEXT NOT NULL, members INTEGER NOT NULL, team_count INTEGER NOT NULL DEFAULT 1, groups_per_session INTEGER NOT NULL DEFAULT 2, pic1_id INTEGER, pic2_id INTEGER, description TEXT NOT NULL DEFAULT '', label_prefix TEXT NOT NULL, is_builtin INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
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
      await ensureParticipantSchema(env);
      await ensureOneDrawPerGame(env);
      await ensureUserSchema(env);
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

  const authResponse = await handleAuth(request, env, path);
  if (authResponse) return authResponse;

  const user = await getSessionUser(request, env);

  if (path === "/api/users" && request.method === "GET") {
    requireRight(user, "pengguna");
    return json(await listUsers(env));
  }

  if (path === "/api/users" && request.method === "POST") {
    requireRight(user, "pengguna");
    const body = await readJson(request);
    return json(await createUser(env, body), 201);
  }

  const userMatch = path.match(/^\/api\/users\/(\d+)$/);
  if (userMatch && request.method === "PUT") {
    requireRight(user, "pengguna");
    const body = await readJson(request);
    return json(await updateUser(env, Number(userMatch[1]), body, user));
  }

  if (userMatch && request.method === "DELETE") {
    requireRight(user, "pengguna");
    return json(await deleteUser(env, Number(userMatch[1]), user));
  }

  if (path === "/api/participants" && request.method === "GET") {
    requireAnyRight(user, ["peserta", "permainan", "pembagian"]);
    return json(await listParticipants(env));
  }

  if (path === "/api/participants" && request.method === "POST") {
    requireRight(user, "peserta");
    const body = await readJson(request);
    return json(await createParticipant(env, body), 201);
  }

  if (path === "/api/participants" && request.method === "PUT") {
    requireRight(user, "peserta");
    const body = await readJson(request);
    return json(await saveParticipants(env, body), 201);
  }

  const participantMatch = path.match(/^\/api\/participants\/(\d+)$/);
  if (participantMatch && request.method === "PUT") {
    requireRight(user, "peserta");
    const body = await readJson(request);
    return json(await updateParticipant(env, Number(participantMatch[1]), body));
  }

  if (participantMatch && request.method === "DELETE") {
    requireRight(user, "peserta");
    return json(await deleteParticipant(env, Number(participantMatch[1])));
  }

  if (path === "/api/participants" && request.method === "DELETE") {
    requireRight(user, "peserta");
    await env.DB.batch([
      env.DB.prepare("DELETE FROM draw_members"),
      env.DB.prepare("DELETE FROM draws"),
      env.DB.prepare("DELETE FROM participants"),
      env.DB.prepare("DELETE FROM meta"),
    ]);
    return json({ ok: true });
  }

  if (path === "/api/games" && request.method === "GET") {
    requireAnyRight(user, ["permainan", "pembagian", "hasil"]);
    return json({ games: await listGames(env) });
  }

  if (path === "/api/games" && request.method === "POST") {
    requireRight(user, "permainan");
    const body = await readJson(request);
    return json(await createGame(env, body), 201);
  }

  const gameMatch = path.match(/^\/api\/games\/([^/]+)$/);
  if (gameMatch && request.method === "PUT") {
    requireRight(user, "permainan");
    const body = await readJson(request);
    return json(await updateGame(env, decodeURIComponent(gameMatch[1]), body));
  }

  if (gameMatch && request.method === "DELETE") {
    requireRight(user, "permainan");
    return json(await deleteGame(env, decodeURIComponent(gameMatch[1])));
  }

  if (path === "/api/draws" && request.method === "GET") {
    requireAnyRight(user, ["pembagian", "hasil"]);
    return json(await listDraws(env));
  }

  if (path === "/api/dashboard" && request.method === "GET") {
    requireAnyRight(user, ["pembagian", "hasil", "permainan"]);
    return json(await getDashboard(env));
  }

  if (path === "/api/draws" && request.method === "POST") {
    requireRight(user, "pembagian");
    const body = await readJson(request);
    return json(await createDraw(env, body, user), 201);
  }

  const drawMatch = path.match(/^\/api\/draws\/(\d+)$/);
  if (drawMatch && request.method === "GET") {
    requireAnyRight(user, ["pembagian", "hasil"]);
    const draw = await getDraw(env, Number(drawMatch[1]));
    if (!draw) return json({ error: "Hasil undian tidak ditemukan." }, 404);
    return json(draw);
  }

  if (drawMatch && request.method === "PUT") {
    requireRight(user, "hasil");
    const body = await readJson(request);
    return json(await updateDrawBracket(env, Number(drawMatch[1]), body));
  }

  return json({ error: "Endpoint tidak ditemukan." }, 404);
}

async function listParticipants(env) {
  const [{ results }, filenameRow] = await Promise.all([
    env.DB.prepare(
      "SELECT id, nama, jenis_kelamin, cabang, excluded FROM participants ORDER BY id ASC",
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
    .map((person) => {
      try {
        return normalizeParticipant(person);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

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
    "INSERT INTO participants (nama, jenis_kelamin, cabang, excluded) VALUES (?, ?, ?, ?)",
  );
  for (const group of chunk(participants, INSERT_CHUNK)) {
    await env.DB.batch(
      group.map((person) =>
        insert.bind(person.nama, person.jenisKelamin, person.cabang, person.excluded ? 1 : 0),
      ),
    );
  }

  console.log("participants_saved", { count: participants.length, filename });
  return listParticipants(env);
}

async function createParticipant(env, body) {
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS n FROM participants").first();
  if (Number(countRow?.n) >= MAX_PARTICIPANTS) {
    throw Object.assign(new Error(`Maksimal ${MAX_PARTICIPANTS} peserta.`), { status: 400 });
  }
  const parsed = normalizeParticipant(body);
  await env.DB.prepare(
    "INSERT INTO participants (nama, jenis_kelamin, cabang, excluded) VALUES (?, ?, ?, ?)",
  )
    .bind(parsed.nama, parsed.jenisKelamin, parsed.cabang, parsed.excluded ? 1 : 0)
    .run();
  return listParticipants(env);
}

async function updateParticipant(env, id, body) {
  const current = await env.DB.prepare("SELECT id FROM participants WHERE id = ?").bind(id).first();
  if (!current) {
    throw Object.assign(new Error("Peserta tidak ditemukan."), { status: 404 });
  }
  const parsed = normalizeParticipant(body);
  await env.DB.prepare(
    "UPDATE participants SET nama = ?, jenis_kelamin = ?, cabang = ?, excluded = ? WHERE id = ?",
  )
    .bind(parsed.nama, parsed.jenisKelamin, parsed.cabang, parsed.excluded ? 1 : 0, id)
    .run();
  return listParticipants(env);
}

async function deleteParticipant(env, id) {
  const current = await env.DB.prepare("SELECT id FROM participants WHERE id = ?").bind(id).first();
  if (!current) {
    throw Object.assign(new Error("Peserta tidak ditemukan."), { status: 404 });
  }
  await env.DB.prepare("DELETE FROM participants WHERE id = ?").bind(id).run();
  return listParticipants(env);
}

async function listDraws(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, team_count, members_per_team, created_at, game_id, game_name, gender_mode FROM draws ORDER BY id DESC LIMIT 80",
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
    "SELECT id, name, members, team_count, groups_per_session, pic1_id, pic2_id, gender_mode, description, label_prefix, is_builtin, sort_order FROM games ORDER BY sort_order ASC, name ASC",
  ).all();
  const people = await env.DB.prepare("SELECT id, nama, jenis_kelamin, cabang, excluded FROM participants").all();
  const byId = new Map((people.results || []).map((row) => [Number(row.id), personFromRow(row)]));
  return (results || []).map((row) => withPicDetails(gameFromRow(row), byId));
}

async function createGame(env, body) {
  const games = await listGames(env);
  if (games.length >= MAX_GAMES) {
    throw Object.assign(new Error(`Maksimal ${MAX_GAMES} jenis permainan.`), { status: 400 });
  }

  const parsed = normalizeGame(body, { existingIds: games.map((game) => game.id) });
  const sortOrder = games.reduce((max, game) => Math.max(max, game.sortOrder), 0) + 1;
  await env.DB.prepare(
    "INSERT INTO games (id, name, members, team_count, groups_per_session, pic1_id, pic2_id, gender_mode, description, label_prefix, is_builtin, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)",
  )
    .bind(
      parsed.id,
      parsed.name,
      parsed.members,
      parsed.teamCount,
      parsed.groupsPerSession,
      parsed.pic1Id,
      parsed.pic2Id,
      parsed.genderMode,
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
    "UPDATE games SET name = ?, members = ?, team_count = ?, groups_per_session = ?, pic1_id = ?, pic2_id = ?, gender_mode = ?, description = ?, label_prefix = ? WHERE id = ?",
  )
    .bind(
      parsed.name,
      parsed.members,
      parsed.teamCount,
      parsed.groupsPerSession,
      parsed.pic1Id,
      parsed.pic2Id,
      parsed.genderMode,
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

  const { results } = await env.DB.prepare("SELECT id FROM draws WHERE game_id = ?").bind(id).all();
  for (const row of results || []) {
    await deleteDraw(env, row.id);
  }
  await env.DB.prepare("DELETE FROM games WHERE id = ?").bind(id).run();
  console.log("game_deleted", { id });
  return { ok: true, deletedId: id, games: await listGames(env) };
}

async function createDraw(env, body, user) {
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
  const teamCount = game.teamCount;
  const membersPerTeam = game.members;
  const genderMode = normalizeGenderMode(game.genderMode);
  const groupsPerSession = game.groupsPerSession || 2;
  const existing = await env.DB.prepare("SELECT id FROM draws WHERE game_id = ?").bind(game.id).first();
  const replace = Boolean(body?.replace);
  if (existing && !replace) {
    throw Object.assign(
      new Error("Hasil acak sudah ada untuk permainan ini. Hanya admin yang bisa mengacak ulang."),
      { status: 409 },
    );
  }
  if (existing && replace && user?.role !== "admin") {
    throw Object.assign(new Error("Hanya admin yang bisa mengacak ulang."), { status: 403 });
  }
  const stored = await listParticipants(env);
  const picIds = [game.pic1Id, game.pic2Id];
  const missingPic = picIds.some((id) => !stored.participants.some((person) => Number(person.id) === Number(id)));
  if (missingPic) {
    throw Object.assign(new Error("PIC permainan tidak ditemukan di data peserta."), { status: 400 });
  }
  let result;
  try {
    result = divideTeams(stored.participants, {
      teamCount,
      membersPerTeam,
      gameName: game.name,
      genderMode,
      picIds,
    });
  } catch (error) {
    throw Object.assign(error, { status: 400 });
  }

  const bracket = buildKnockoutBracket(result.teams, groupsPerSession);

  if (existing) {
    await deleteDraw(env, existing.id);
  }

  const drawInsert = await env.DB.prepare(
    "INSERT INTO draws (team_count, members_per_team, game_id, game_name, gender_mode, groups_per_session, bracket) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, created_at",
  )
    .bind(
      teamCount,
      membersPerTeam,
      game.id,
      game.name,
      genderMode,
      groupsPerSession,
      JSON.stringify(bracket),
    )
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

  console.log("draw_saved", { id: drawInsert.id, teams: result.teams.length, replaced: Boolean(existing) });

  return {
    ...result,
    id: drawInsert.id,
    createdAt: drawInsert.created_at,
    teamCount,
    membersPerTeam,
    gameId: game.id,
    gameName: game.name,
    genderMode,
    groupsPerSession,
    pic1Id: game.pic1Id,
    pic2Id: game.pic2Id,
    pic1Name: game.pic1Name,
    pic2Name: game.pic2Name,
    pic1Cabang: game.pic1Cabang,
    pic2Cabang: game.pic2Cabang,
    bracket,
    replaced: Boolean(existing),
  };
}

async function getDraw(env, id) {
  const draw = await env.DB.prepare(
    "SELECT id, team_count, members_per_team, created_at, game_id, game_name, gender_mode, groups_per_session, bracket FROM draws WHERE id = ?",
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
  const groupsPerSession = Number(draw.groups_per_session) || 2;
  let bracket = parseBracket(draw.bracket);
  if (!bracket && grouped.teams.length) {
    bracket = buildKnockoutBracket(grouped.teams, groupsPerSession);
  }
  const games = await listGames(env);
  const game = games.find((item) => item.id === draw.game_id);
  return {
    id: draw.id,
    createdAt: draw.created_at,
    teamCount: draw.team_count,
    membersPerTeam: draw.members_per_team,
    gameId: draw.game_id || "",
    gameName: draw.game_name || "Permainan",
    genderMode: normalizeGenderMode(draw.gender_mode),
    groupsPerSession,
    pic1Name: game?.pic1Name || "",
    pic2Name: game?.pic2Name || "",
    pic1Cabang: game?.pic1Cabang || "",
    pic2Cabang: game?.pic2Cabang || "",
    bracket,
    needed: draw.team_count * draw.members_per_team,
    ...grouped,
  };
}

async function updateDrawBracket(env, id, body) {
  const draw = await getDraw(env, id);
  if (!draw) {
    throw Object.assign(new Error("Hasil undian tidak ditemukan."), { status: 404 });
  }
  if (!draw.bracket) {
    throw Object.assign(new Error("Bagan pertandingan belum tersedia."), { status: 400 });
  }
  let bracket;
  try {
    bracket = setMatchWinner(draw.bracket, body?.matchId, body?.winnerNumber);
  } catch (error) {
    throw Object.assign(error, { status: error.status || 400 });
  }
  await env.DB.prepare("UPDATE draws SET bracket = ? WHERE id = ?")
    .bind(JSON.stringify(bracket), id)
    .run();
  return { ...draw, bracket };
}

async function getDashboard(env) {
  const games = await listGames(env);
  const { results: drawRows } = await env.DB.prepare(
    "SELECT id, game_id, game_name, bracket FROM draws",
  ).all();
  const drawsByGame = new Map(
    (drawRows || []).map((row) => [row.game_id, { id: row.id, bracket: row.bracket }]),
  );
  const { results: memberRows } = await env.DB.prepare(
    "SELECT team_number, nama, cabang FROM draw_members",
  ).all();
  return {
    games: gameProgressRows(games, drawsByGame),
    topParticipants: participationCounts(memberRows).slice(0, 12),
  };
}

async function deleteDraw(env, id) {
  await env.DB.prepare("DELETE FROM draw_members WHERE draw_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM draws WHERE id = ?").bind(id).run();
}

async function ensureOneDrawPerGame(env) {
  const { results } = await env.DB.prepare("SELECT id, game_id FROM draws ORDER BY id DESC").all();
  for (const id of extraDrawIds(results)) {
    await deleteDraw(env, id);
  }
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_draws_game_id ON draws(game_id)").run();
}

async function ensureGameSchema(env) {
  const { results } = await env.DB.prepare("PRAGMA table_info(games)").all();
  const columns = new Set((results || []).map((row) => row.name));
  if (!columns.has("team_count")) {
    await env.DB.prepare("ALTER TABLE games ADD COLUMN team_count INTEGER NOT NULL DEFAULT 1").run();
  }
  if (!columns.has("groups_per_session")) {
    await env.DB.prepare(
      "ALTER TABLE games ADD COLUMN groups_per_session INTEGER NOT NULL DEFAULT 2",
    ).run();
  }
  if (!columns.has("pic1_id")) {
    await env.DB.prepare("ALTER TABLE games ADD COLUMN pic1_id INTEGER").run();
  }
  if (!columns.has("pic2_id")) {
    await env.DB.prepare("ALTER TABLE games ADD COLUMN pic2_id INTEGER").run();
  }
  if (!columns.has("gender_mode")) {
    await env.DB.prepare("ALTER TABLE games ADD COLUMN gender_mode TEXT NOT NULL DEFAULT 'campur'").run();
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

async function ensureParticipantSchema(env) {
  const { results } = await env.DB.prepare("PRAGMA table_info(participants)").all();
  const columns = new Set((results || []).map((row) => row.name));
  if (!columns.has("nomor")) {
    await env.DB.prepare("ALTER TABLE participants ADD COLUMN nomor TEXT NOT NULL DEFAULT ''").run();
  }
  if (!columns.has("excluded")) {
    await env.DB.prepare("ALTER TABLE participants ADD COLUMN excluded INTEGER NOT NULL DEFAULT 0").run();
  }
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
  if (!columns.has("groups_per_session")) {
    await env.DB.prepare("ALTER TABLE draws ADD COLUMN groups_per_session INTEGER").run();
  }
  if (!columns.has("bracket")) {
    await env.DB.prepare("ALTER TABLE draws ADD COLUMN bracket TEXT").run();
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
