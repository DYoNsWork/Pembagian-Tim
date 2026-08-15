export const MAX_GAMES = 80;
export const MAX_GAME_NAME = 80;
export const MAX_GAME_DESCRIPTION = 500;
export const MAX_TEAMS = 200;
export const MAX_MEMBERS = 99;
export const MAX_GROUPS_PER_SESSION = 16;

export function getGame(id, games = []) {
  const list = Array.isArray(games) ? games : [];
  if (!list.length) return null;
  return list.find((game) => game.id === id) || list[0];
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
  const description = String(input?.description || "").trim();
  const teamCount = Number(input?.teamCount ?? input?.team_count);
  const members = Number(input?.members);
  const groupsPerSession = Number(
    input?.groupsPerSession ?? input?.groups_per_session ?? input?.grupPerSesi ?? 2,
  );
  const pic1Id = Number(input?.pic1Id ?? input?.pic1_id ?? 0) || null;
  const pic2Id = Number(input?.pic2Id ?? input?.pic2_id ?? 0) || null;
  const labelPrefix = name || "Tim";
  const gameId = id || uniqueGameId(name, existingIds);

  if (!name) {
    throw Object.assign(new Error("Nama permainan wajib diisi."), { status: 400 });
  }
  if (name.length > MAX_GAME_NAME) {
    throw Object.assign(new Error(`Nama permainan maksimal ${MAX_GAME_NAME} karakter.`), {
      status: 400,
    });
  }
  if (description.length > MAX_GAME_DESCRIPTION) {
    throw Object.assign(new Error(`Penjelasan maksimal ${MAX_GAME_DESCRIPTION} karakter.`), {
      status: 400,
    });
  }
  if (!Number.isInteger(teamCount) || teamCount < 1 || teamCount > MAX_TEAMS) {
    throw Object.assign(new Error(`Jumlah grup harus bilangan 1–${MAX_TEAMS}.`), { status: 400 });
  }
  if (!Number.isInteger(members) || members < 1 || members > MAX_MEMBERS) {
    throw Object.assign(new Error(`Peserta per grup harus bilangan 1–${MAX_MEMBERS}.`), {
      status: 400,
    });
  }
  if (!Number.isInteger(groupsPerSession) || groupsPerSession < 2 || groupsPerSession > MAX_GROUPS_PER_SESSION) {
    throw Object.assign(
      new Error(`Grup per sesi harus bilangan 2–${MAX_GROUPS_PER_SESSION}.`),
      { status: 400 },
    );
  }
  if (!pic1Id || !pic2Id) {
    throw Object.assign(new Error("Pilih 2 PIC untuk permainan ini."), { status: 400 });
  }
  if (pic1Id === pic2Id) {
    throw Object.assign(new Error("PIC 1 dan PIC 2 harus orang yang berbeda."), { status: 400 });
  }

  return {
    id: gameId,
    name,
    description,
    teamCount,
    members,
    groupsPerSession,
    pic1Id,
    pic2Id,
    labelPrefix,
  };
}

export function gameFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    teamCount: Number(row.team_count ?? row.teamCount) || 1,
    members: Number(row.members),
    groupsPerSession: Number(row.groups_per_session ?? row.groupsPerSession) || 2,
    pic1Id: Number(row.pic1_id ?? row.pic1Id) || null,
    pic2Id: Number(row.pic2_id ?? row.pic2Id) || null,
    pic1Name: row.pic1_name || row.pic1Name || "",
    pic2Name: row.pic2_name || row.pic2Name || "",
    pic1Cabang: row.pic1_cabang || row.pic1Cabang || "",
    pic2Cabang: row.pic2_cabang || row.pic2Cabang || "",
    pic1Nomor: row.pic1_nomor || row.pic1Nomor || "",
    pic2Nomor: row.pic2_nomor || row.pic2Nomor || "",
    labelPrefix: row.label_prefix || row.labelPrefix || row.name || "Tim",
    sortOrder: Number(row.sort_order) || 0,
  };
}

export function formatPicLine(name, cabang, nomor) {
  const who = String(name || "").trim();
  if (!who) return "";
  const num = String(nomor || "").trim();
  const branch = String(cabang || "").trim();
  return [num ? `${who} (${num})` : who, branch && branch !== "-" ? branch : ""]
    .filter(Boolean)
    .join(" · ");
}

export function withPicDetails(game, peopleById = new Map()) {
  const pic1 = peopleById.get(Number(game?.pic1Id));
  const pic2 = peopleById.get(Number(game?.pic2Id));
  return {
    ...game,
    pic1Name: pic1?.nama || game?.pic1Name || "",
    pic1Cabang: pic1?.cabang || game?.pic1Cabang || "",
    pic1Nomor: pic1?.nomor || game?.pic1Nomor || "",
    pic2Name: pic2?.nama || game?.pic2Name || "",
    pic2Cabang: pic2?.cabang || game?.pic2Cabang || "",
    pic2Nomor: pic2?.nomor || game?.pic2Nomor || "",
  };
}
