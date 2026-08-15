import { normalizeGender } from "./csv.js";

export function personFromRow(row) {
  return {
    id: row.id,
    nama: row.nama,
    jenisKelamin: row.jenis_kelamin,
    cabang: row.cabang,
    nomor: row.nomor || "",
    excluded: Boolean(Number(row.excluded)),
  };
}

export function normalizeParticipant(input) {
  const nama = String(input?.nama || "").trim();
  const jenisKelamin = normalizeGender(input?.jenisKelamin || input?.jenis_kelamin || "");
  const cabang = String(input?.cabang || "").trim() || "-";
  const nomor = String(input?.nomor || "").trim().slice(0, 40);
  const excluded = Boolean(input?.excluded);
  if (!nama) {
    throw Object.assign(new Error("Nama peserta wajib diisi."), { status: 400 });
  }
  return { nama, jenisKelamin, cabang, nomor, excluded };
}

export function groupDrawMembers(rows) {
  const teams = new Map();
  const leftover = [];

  for (const row of rows) {
    const person = {
      nama: row.nama,
      jenisKelamin: row.jenis_kelamin,
      cabang: row.cabang,
    };

    if (Number(row.team_number) === 0 || row.team_name === "Cadangan") {
      leftover.push(person);
      continue;
    }

    const key = Number(row.team_number);
    if (!teams.has(key)) {
      teams.set(key, {
        number: key,
        name: row.team_name,
        members: [],
      });
    }
    teams.get(key).members.push(person);
  }

  const ordered = [...teams.values()].sort((a, b) => a.number - b.number);
  const used = ordered.reduce((sum, team) => sum + team.members.length, 0);

  return {
    teams: ordered,
    leftover,
    used,
    total: used + leftover.length,
  };
}

export function extraDrawIds(rows) {
  const seen = new Set();
  const extra = [];
  for (const row of rows || []) {
    const gameId = String(row.game_id || "").trim();
    if (!gameId) continue;
    if (seen.has(gameId)) extra.push(row.id);
    else seen.add(gameId);
  }
  return extra;
}

export function chunk(items, size) {
  const groups = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}
