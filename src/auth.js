export const RIGHTS = [
  { id: "peserta", label: "Peserta", description: "Lihat dan unggah data peserta" },
  { id: "daftar", label: "Daftar peserta", description: "Lihat tabel seluruh peserta" },
  { id: "permainan", label: "Permainan", description: "Kelola jenis permainan" },
  { id: "pembagian", label: "Pembagian", description: "Bagi grup secara acak" },
  { id: "hasil", label: "Hasil", description: "Lihat grup, bagan, dan tentukan pemenang" },
  { id: "pengguna", label: "Pengguna", description: "Tambah user dan atur hak akses" },
];

export const ROLE_PRESETS = {
  admin: RIGHTS.map((right) => right.id),
  panitia: ["peserta", "daftar", "permainan", "pembagian", "hasil"],
  penonton: ["hasil"],
  kustom: [],
};

export const ROLES = [
  { id: "admin", label: "Admin" },
  { id: "panitia", label: "Panitia" },
  { id: "penonton", label: "Penonton" },
  { id: "kustom", label: "Kustom" },
];

const ROLE_IDS = new Set(ROLES.map((role) => role.id));

export function parseRights(value) {
  if (Array.isArray(value)) return normalizeRights(value);
  if (typeof value !== "string" || !value) return [];
  try {
    return normalizeRights(JSON.parse(value));
  } catch {
    return [];
  }
}

export function normalizeRole(value) {
  const role = String(value || "kustom").trim().toLowerCase();
  return ROLE_IDS.has(role) ? role : "kustom";
}

export function normalizeRights(input, role = "kustom") {
  if (normalizeRole(role) === "admin") return [...ROLE_PRESETS.admin];
  const list = new Set((Array.isArray(input) ? input : []).map((item) => String(item)));
  return RIGHTS.map((right) => right.id).filter((id) => list.has(id));
}

export function rightsForRole(role, rights) {
  const normalized = normalizeRole(role);
  if (normalized === "admin") return [...ROLE_PRESETS.admin];
  if (normalized === "kustom") return normalizeRights(rights, "kustom");
  return [...ROLE_PRESETS[normalized]];
}

export function hasRight(user, right) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return (user.rights || []).includes(right);
}

export function viewForRight(right) {
  if (right === "hasil") return "pembagian";
  return right;
}

export function firstAllowedView(user) {
  if (hasRight(user, "pembagian") || hasRight(user, "hasil") || hasRight(user, "permainan")) {
    return "dashboard";
  }
  if (hasRight(user, "daftar")) return "daftar";
  const right = RIGHTS.map((item) => item.id).find((id) => hasRight(user, id));
  return right ? viewForRight(right) : "";
}

export function publicUser(row) {
  if (!row) return null;
  const role = normalizeRole(row.role);
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name || row.displayName || row.username,
    role,
    rights: rightsForRole(role, parseRights(row.rights ?? row.rightsJson)),
  };
}

export function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function validateUserInput(input, { requirePassword = true } = {}) {
  const username = normalizeUsername(input?.username);
  const displayName = String(input?.displayName || input?.display_name || "").trim();
  const password = String(input?.password || "");
  const role = normalizeRole(input?.role);
  const rights = rightsForRole(role, input?.rights);

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw Object.assign(
      new Error("Username 3–32 karakter, hanya huruf kecil, angka, titik, _ atau -."),
      { status: 400 },
    );
  }
  if (!displayName || displayName.length > 80) {
    throw Object.assign(new Error("Nama tampilan wajib diisi, maksimal 80 karakter."), {
      status: 400,
    });
  }
  if (requirePassword && password.length < 6) {
    throw Object.assign(new Error("Kata sandi minimal 6 karakter."), { status: 400 });
  }
  if (!requirePassword && password && password.length < 6) {
    throw Object.assign(new Error("Kata sandi minimal 6 karakter."), { status: 400 });
  }
  if (!rights.length) {
    throw Object.assign(new Error("Pilih minimal satu hak akses."), { status: 400 });
  }

  return { username, displayName, password, role, rights };
}
