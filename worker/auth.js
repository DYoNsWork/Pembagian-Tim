import {
  firstAllowedView,
  hasRight,
  publicUser,
  validateUserInput,
} from "../src/auth.js";
import { hashPassword, verifyPassword } from "../src/passwords.js";

export { firstAllowedView, hasRight, publicUser };

const MAX_USERS = 40;
const SESSION_DAYS = 7;
const COOKIE = "pg_session";

export async function ensureUserSchema(env) {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'kustom',
        rights TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
    ),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)"),
  ]);
}

export async function userCount(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
  return Number(row?.n) || 0;
}

export async function getSessionUser(request, env) {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT users.id, users.username, users.display_name, users.role, users.rights, sessions.expires_at
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ?`,
  )
    .bind(token)
    .first();
  if (!row) return null;
  if (new Date(`${row.expires_at}Z`).getTime() < Date.now()) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(token).run();
    return null;
  }
  return publicUser(row);
}

export function requireRight(user, right) {
  if (!user) {
    throw Object.assign(new Error("Silakan masuk dulu."), { status: 401 });
  }
  if (!hasRight(user, right)) {
    throw Object.assign(new Error("Anda tidak punya hak untuk aksi ini."), { status: 403 });
  }
}

export function requireAnyRight(user, rights) {
  if (!user) {
    throw Object.assign(new Error("Silakan masuk dulu."), { status: 401 });
  }
  if (!rights.some((right) => hasRight(user, right))) {
    throw Object.assign(new Error("Anda tidak punya hak untuk aksi ini."), { status: 403 });
  }
}

export function requireAdmin(user) {
  if (!user) {
    throw Object.assign(new Error("Silakan masuk dulu."), { status: 401 });
  }
  if (user.role !== "admin") {
    throw Object.assign(new Error("Hanya admin yang bisa melakukan aksi ini."), { status: 403 });
  }
}

export async function handleAuth(request, env, path) {
  if (path === "/api/auth/me" && request.method === "GET") {
    const needsSetup = (await userCount(env)) === 0;
    const user = needsSetup ? null : await getSessionUser(request, env);
    return json({
      user,
      needsSetup,
      defaultView: firstAllowedView(user),
    });
  }

  if (path === "/api/auth/setup" && request.method === "POST") {
    if ((await userCount(env)) > 0) {
      throw Object.assign(new Error("Akun admin sudah dibuat. Silakan masuk."), { status: 400 });
    }
    const body = await readJson(request);
    const parsed = validateUserInput({ ...body, role: "admin", rights: ["pengguna"] });
    const user = await insertUser(env, parsed);
    return createSessionResponse(env, request, user, 201);
  }

  if (path === "/api/auth/login" && request.method === "POST") {
    const body = await readJson(request);
    const username = String(body?.username || "")
      .trim()
      .toLowerCase();
    const password = String(body?.password || "");
    const row = await env.DB.prepare(
      "SELECT id, username, display_name, role, rights, password_hash, password_salt FROM users WHERE username = ?",
    )
      .bind(username)
      .first();
    if (!row || !(await verifyPassword(password, row.password_salt, row.password_hash))) {
      throw Object.assign(new Error("Username atau kata sandi salah."), { status: 401 });
    }
    return createSessionResponse(env, request, publicUser(row));
  }

  if (path === "/api/auth/logout" && request.method === "POST") {
    const token = readCookie(request, COOKIE);
    if (token) {
      await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(token).run();
    }
    const response = json({ ok: true });
    response.headers.append("Set-Cookie", clearCookie(request));
    return response;
  }

  return null;
}

export async function listUsers(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, username, display_name, role, rights, created_at FROM users ORDER BY id ASC",
  ).all();
  return { users: (results || []).map(publicUser) };
}

export async function createUser(env, body) {
  const count = await userCount(env);
  if (count >= MAX_USERS) {
    throw Object.assign(new Error(`Maksimal ${MAX_USERS} pengguna.`), { status: 400 });
  }
  const parsed = validateUserInput(body);
  const user = await insertUser(env, parsed);
  return { user, users: (await listUsers(env)).users };
}

export async function updateUser(env, id, body, actor) {
  const current = await env.DB.prepare(
    "SELECT id, username, display_name, role, rights FROM users WHERE id = ?",
  )
    .bind(id)
    .first();
  if (!current) {
    throw Object.assign(new Error("Pengguna tidak ditemukan."), { status: 404 });
  }

  const parsed = validateUserInput(
    {
      username: body?.username ?? current.username,
      displayName: body?.displayName ?? current.display_name,
      password: body?.password || "",
      role: body?.role ?? current.role,
      rights: body?.rights,
    },
    { requirePassword: false },
  );

  if (Number(actor?.id) === id && parsed.role !== "admin" && !(await hasOtherAdmin(env, id))) {
    throw Object.assign(new Error("Tidak bisa menghapus hak admin dari akun admin terakhir."), {
      status: 400,
    });
  }

  if (parsed.password) {
    const stored = await hashPassword(parsed.password);
    await env.DB.prepare(
      "UPDATE users SET username = ?, display_name = ?, role = ?, rights = ?, password_hash = ?, password_salt = ? WHERE id = ?",
    )
      .bind(
        parsed.username,
        parsed.displayName,
        parsed.role,
        JSON.stringify(parsed.rights),
        stored.hash,
        stored.salt,
        id,
      )
      .run();
  } else {
    await env.DB.prepare(
      "UPDATE users SET username = ?, display_name = ?, role = ?, rights = ? WHERE id = ?",
    )
      .bind(parsed.username, parsed.displayName, parsed.role, JSON.stringify(parsed.rights), id)
      .run();
  }

  const users = (await listUsers(env)).users;
  return { user: users.find((item) => item.id === id), users };
}

export async function deleteUser(env, id, actor) {
  if (Number(actor?.id) === Number(id)) {
    throw Object.assign(new Error("Tidak bisa menghapus akun yang sedang dipakai."), { status: 400 });
  }
  const current = await env.DB.prepare("SELECT id, role FROM users WHERE id = ?").bind(id).first();
  if (!current) {
    throw Object.assign(new Error("Pengguna tidak ditemukan."), { status: 404 });
  }
  if (current.role === "admin" && !(await hasOtherAdmin(env, id))) {
    throw Object.assign(new Error("Tidak bisa menghapus admin terakhir."), { status: 400 });
  }
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return { ok: true, users: (await listUsers(env)).users };
}

async function insertUser(env, parsed) {
  const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
    .bind(parsed.username)
    .first();
  if (existing) {
    throw Object.assign(new Error("Username sudah dipakai."), { status: 400 });
  }
  const stored = await hashPassword(parsed.password);
  const row = await env.DB.prepare(
    "INSERT INTO users (username, display_name, password_hash, password_salt, role, rights) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, username, display_name, role, rights",
  )
    .bind(
      parsed.username,
      parsed.displayName,
      stored.hash,
      stored.salt,
      parsed.role,
      JSON.stringify(parsed.rights),
    )
    .first();
  return publicUser(row);
}

async function hasOtherAdmin(env, exceptId) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?",
  )
    .bind(exceptId)
    .first();
  return Number(row?.n) > 0;
}

async function createSessionResponse(env, request, user, status = 200) {
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  const id = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(id, user.id, expires)
    .run();
  const response = json({ user, defaultView: firstAllowedView(user) }, status);
  response.headers.append("Set-Cookie", sessionCookie(id, request));
  return response;
}

function readCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function sessionCookie(id, request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${id}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}${secure}`;
}

function clearCookie(request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
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
