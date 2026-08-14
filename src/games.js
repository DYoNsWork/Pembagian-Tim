export const DEFAULT_GAMES = [
  {
    id: "umum",
    name: "Umum / kustom",
    members: 4,
    description: "Pembagian bebas. Atur sendiri jumlah grup dan anggota.",
    labelPrefix: "Tim",
  },
  {
    id: "futsal",
    name: "Futsal",
    members: 5,
    description: "5 pemain inti per tim. Cocok untuk pertandingan 5 lawan 5.",
    labelPrefix: "Tim Futsal",
  },
  {
    id: "sepak-bola",
    name: "Sepak bola",
    members: 11,
    description: "11 pemain inti per tim.",
    labelPrefix: "Tim Sepak Bola",
  },
  {
    id: "basket",
    name: "Bola basket",
    members: 5,
    description: "5 pemain inti per tim.",
    labelPrefix: "Tim Basket",
  },
  {
    id: "voli",
    name: "Bola voli",
    members: 6,
    description: "6 pemain inti per tim.",
    labelPrefix: "Tim Voli",
  },
  {
    id: "badminton-ganda",
    name: "Badminton ganda",
    members: 2,
    description: "Pasangan 2 orang per grup.",
    labelPrefix: "Ganda",
  },
  {
    id: "tenis-meja-ganda",
    name: "Tenis meja ganda",
    members: 2,
    description: "Pasangan 2 orang per grup.",
    labelPrefix: "Ganda",
  },
  {
    id: "estafet",
    name: "Estafet",
    members: 4,
    description: "4 pelari per estafet.",
    labelPrefix: "Tim Estafet",
  },
  {
    id: "e-sports",
    name: "E-sports 5v5",
    members: 5,
    description: "5 pemain per skuad, misalnya Mobile Legends atau Valorant.",
    labelPrefix: "Skuad",
  },
  {
    id: "tarik-tambang",
    name: "Tarik tambang",
    members: 8,
    description: "8 orang per sisi.",
    labelPrefix: "Regu",
  },
  {
    id: "tenis-meja-beregu",
    name: "Beregu",
    members: 4,
    description: "4 orang per regu untuk pertandingan beregu.",
    labelPrefix: "Regu",
  },
];

export const GAMES = DEFAULT_GAMES;
export const MAX_GAMES = 80;
export const MAX_GAME_NAME = 80;
export const MAX_GAME_DESCRIPTION = 200;
export const MAX_GAME_PREFIX = 40;

export function getGame(id, games = DEFAULT_GAMES) {
  const list = Array.isArray(games) && games.length ? games : DEFAULT_GAMES;
  return list.find((game) => game.id === id) || list.find((game) => game.id === "umum") || list[0];
}

export function suggestedTeamCount(participantCount, membersPerTeam) {
  const size = Number(membersPerTeam);
  if (!Number.isInteger(size) || size < 1) return 1;
  return Math.max(1, Math.floor(Number(participantCount) / size) || 1);
}

export function slugifyGameId(name) {
  const slug = String(name || "")
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "permainan";
}

export function uniqueGameId(name, existingIds = []) {
  const used = new Set(existingIds);
  const base = slugifyGameId(name);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function normalizeGame(input, { id, existingIds = [] } = {}) {
  const name = String(input?.name || "").trim();
  const members = Number(input?.members);
  const description = String(input?.description || "").trim();
  const labelPrefix = String(input?.labelPrefix || input?.label_prefix || name || "Tim").trim();
  const gameId = id || uniqueGameId(name, existingIds);

  if (!name) {
    throw Object.assign(new Error("Nama permainan wajib diisi."), { status: 400 });
  }
  if (name.length > MAX_GAME_NAME) {
    throw Object.assign(new Error(`Nama permainan maksimal ${MAX_GAME_NAME} karakter.`), {
      status: 400,
    });
  }
  if (!Number.isInteger(members) || members < 1 || members > 99) {
    throw Object.assign(new Error("Anggota per grup harus bilangan 1–99."), { status: 400 });
  }
  if (description.length > MAX_GAME_DESCRIPTION) {
    throw Object.assign(new Error(`Deskripsi maksimal ${MAX_GAME_DESCRIPTION} karakter.`), {
      status: 400,
    });
  }
  if (!labelPrefix) {
    throw Object.assign(new Error("Awalan nama grup wajib diisi."), { status: 400 });
  }
  if (labelPrefix.length > MAX_GAME_PREFIX) {
    throw Object.assign(new Error(`Awalan nama grup maksimal ${MAX_GAME_PREFIX} karakter.`), {
      status: 400,
    });
  }

  return {
    id: gameId,
    name,
    members,
    description: description || `${members} orang per grup.`,
    labelPrefix,
  };
}

export function gameFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    members: Number(row.members),
    description: row.description || "",
    labelPrefix: row.label_prefix || row.labelPrefix || "Tim",
    builtin: Boolean(row.is_builtin),
    sortOrder: Number(row.sort_order) || 0,
  };
}
