import { divideTeams } from "../src/teams.js";
import { chunk, groupDrawMembers, personFromRow } from "../src/draws.js";

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS participants (id INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT NOT NULL, jenis_kelamin TEXT NOT NULL, cabang TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS draws (id INTEGER PRIMARY KEY AUTOINCREMENT, team_count INTEGER NOT NULL, members_per_team INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS draw_members (id INTEGER PRIMARY KEY AUTOINCREMENT, draw_id INTEGER NOT NULL, team_number INTEGER NOT NULL, team_name TEXT NOT NULL, nama TEXT NOT NULL, jenis_kelamin TEXT NOT NULL, cabang TEXT NOT NULL, FOREIGN KEY (draw_id) REFERENCES draws(id))`,
  `CREATE INDEX IF NOT EXISTS idx_draw_members_draw_id ON draw_members(draw_id)`,
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
    "SELECT id, team_count, members_per_team, created_at FROM draws ORDER BY id DESC LIMIT 20",
  ).all();

  return {
    draws: results.map((row) => ({
      id: row.id,
      teamCount: row.team_count,
      membersPerTeam: row.members_per_team,
      createdAt: row.created_at,
    })),
  };
}

async function createDraw(env, body) {
  const teamCount = Number(body?.teamCount);
  const membersPerTeam = Number(body?.membersPerTeam);
  const stored = await listParticipants(env);
  let result;
  try {
    result = divideTeams(stored.participants, { teamCount, membersPerTeam });
  } catch (error) {
    throw Object.assign(error, { status: 400 });
  }

  const drawInsert = await env.DB.prepare(
    "INSERT INTO draws (team_count, members_per_team) VALUES (?, ?) RETURNING id, created_at",
  )
    .bind(teamCount, membersPerTeam)
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
    ...result,
  };
}

async function getDraw(env, id) {
  const draw = await env.DB.prepare(
    "SELECT id, team_count, members_per_team, created_at FROM draws WHERE id = ?",
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
    needed: draw.team_count * draw.members_per_team,
    ...grouped,
  };
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
