import { normalizeGender, participantKey } from "./csv.js";

export function personFromRow(row) {
  return {
    id: row.id,
    nama: row.nama,
    jenisKelamin: row.jenis_kelamin,
    cabang: row.cabang,
    excluded: Boolean(Number(row.excluded)),
  };
}

export function normalizeParticipant(input) {
  const nama = String(input?.nama || "").trim();
  const jenisKelamin = normalizeGender(input?.jenisKelamin || input?.jenis_kelamin || "");
  const cabang = String(input?.cabang || "").trim() || "-";
  const excluded = Boolean(input?.excluded);
  if (!nama) {
    throw Object.assign(new Error("Nama peserta wajib diisi."), { status: 400 });
  }
  return { nama, jenisKelamin, cabang, excluded };
}

export function normalizeTeamComposition(teamsInput, { teamCount, membersPerTeam, eligibleById }) {
  const count = Number(teamCount);
  const size = Number(membersPerTeam);
  if (!Number.isInteger(count) || count < 1) {
    throw Object.assign(new Error("Jumlah tim tidak valid."), { status: 400 });
  }
  if (!Number.isInteger(size) || size < 1) {
    throw Object.assign(new Error("Anggota per tim tidak valid."), { status: 400 });
  }
  if (!Array.isArray(teamsInput) || teamsInput.length !== count) {
    throw Object.assign(new Error(`Kirim komposisi untuk ${count} tim.`), { status: 400 });
  }

  const usedIds = new Set();
  const teams = [];

  for (let number = 1; number <= count; number += 1) {
    const entry = teamsInput.find((team) => Number(team.number) === number);
    if (!entry) {
      throw Object.assign(new Error(`Tim ${number} belum diisi.`), { status: 400 });
    }

    const rawIds = entry.memberIds ?? entry.members ?? [];
    if (!Array.isArray(rawIds) || rawIds.length !== size) {
      throw Object.assign(
        new Error(`Tim ${number} harus berisi ${size} anggota.`),
        { status: 400 },
      );
    }

    const members = [];
    for (const rawId of rawIds) {
      const id = Number(rawId);
      const person = eligibleById.get(id);
      if (!id || !person) {
        throw Object.assign(new Error(`Peserta pada Tim ${number} tidak valid.`), { status: 400 });
      }
      if (usedIds.has(id)) {
        throw Object.assign(
          new Error(`${person.nama} tidak boleh masuk lebih dari satu tim.`),
          { status: 400 },
        );
      }
      usedIds.add(id);
      members.push(person);
    }

    teams.push({
      number,
      name: entry.name || `Tim ${number}`,
      members,
    });
  }

  const leftover = [...eligibleById.values()].filter((person) => !usedIds.has(Number(person.id)));
  return { teams, leftover };
}

export function memberIdFromPerson(participants, member) {
  const key = participantKey(member.nama, member.cabang);
  const person = (participants || []).find((item) => participantKey(item.nama, item.cabang) === key);
  return person ? Number(person.id) : null;
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
