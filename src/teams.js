import { participantKey } from "./csv.js";

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const GENDER_MODES = [
  { id: "campur", label: "Campur", gender: null },
  { id: "laki-laki", label: "Laki-laki saja", gender: "Laki-laki" },
  { id: "perempuan", label: "Perempuan saja", gender: "Perempuan" },
];

export function normalizeGenderMode(value) {
  const id = String(value || "campur").trim().toLowerCase();
  if (id === "laki-laki" || id === "laki" || id === "pria") return "laki-laki";
  if (id === "perempuan" || id === "wanita") return "perempuan";
  return "campur";
}

export function genderModeLabel(value) {
  const mode = normalizeGenderMode(value);
  return GENDER_MODES.find((item) => item.id === mode)?.label || "Campur";
}

export function filterByGender(participants, genderMode) {
  const mode = normalizeGenderMode(genderMode);
  if (mode === "laki-laki") {
    return participants.filter((person) => person.jenisKelamin === "Laki-laki");
  }
  if (mode === "perempuan") {
    return participants.filter((person) => person.jenisKelamin === "Perempuan");
  }
  return participants;
}

export function eligibleParticipants(participants, { genderMode = "campur", picIds = [] } = {}) {
  const pics = new Set(
    (Array.isArray(picIds) ? picIds : []).filter((id) => id != null && id !== "").map(Number),
  );
  return filterByGender(participants, genderMode).filter(
    (person) => !person.excluded && !pics.has(Number(person.id)),
  );
}

export function partitionByPlayed(pool, playedKeys = new Set()) {
  const fresh = [];
  const veterans = [];
  for (const person of pool) {
    const key = participantKey(person.nama, person.cabang);
    if (playedKeys.has(key)) veterans.push(person);
    else fresh.push(person);
  }
  return { fresh, veterans };
}

export function selectWithPlayPriority(pool, needed, playedKeys = new Set(), random = Math.random) {
  const { fresh, veterans } = partitionByPlayed(pool, playedKeys);
  const ordered = [...shuffle(fresh, random), ...shuffle(veterans, random)];
  return ordered.slice(0, needed);
}

export function divideTeams(
  participants,
  {
    teamCount,
    membersPerTeam,
    gameName = "Tim",
    genderMode = "campur",
    picIds = [],
    playedKeys = null,
  },
  random = Math.random,
) {
  const teamsWanted = Number(teamCount);
  const size = Number(membersPerTeam);
  const mode = normalizeGenderMode(genderMode);

  if (!Number.isInteger(teamsWanted) || teamsWanted < 1) {
    throw new Error("Jumlah tim harus bilangan bulat minimal 1.");
  }
  if (!Number.isInteger(size) || size < 1) {
    throw new Error("Anggota per tim harus bilangan bulat minimal 1.");
  }

  const pool = eligibleParticipants(participants, { genderMode: mode, picIds });
  const needed = teamsWanted * size;
  if (pool.length < needed) {
    const who =
      mode === "laki-laki"
        ? "Peserta laki-laki"
        : mode === "perempuan"
          ? "Peserta perempuan"
          : "Peserta";
    throw new Error(
      `${who} tidak cukup. Butuh ${needed} orang (${teamsWanted} grup × ${size} anggota), tersedia ${pool.length}.`,
    );
  }

  const played =
    playedKeys instanceof Set ? playedKeys : playedKeys ? new Set(playedKeys) : new Set();
  const selected = played.size
    ? selectWithPlayPriority(pool, needed, played, random)
    : shuffle(pool, random).slice(0, needed);
  const selectedSet = new Set(selected);
  const leftover = pool.filter((person) => !selectedSet.has(person));

  const teams = [];
  for (let i = 0; i < teamsWanted; i += 1) {
    teams.push({
      number: i + 1,
      name: `Tim ${i + 1}`,
      members: selected.slice(i * size, (i + 1) * size),
    });
  }

  return {
    teams,
    leftover,
    needed,
    used: selected.length,
    total: participants.length,
    poolSize: pool.length,
    gameName: String(gameName || "").trim(),
    genderMode: mode,
  };
}

export function teamsToCsv(teams, leftover = [], gameName = "") {
  const header = "permainan,tim,nama,jenis kelamin,nama cabang";
  const rows = [];

  for (const team of teams) {
    for (const member of team.members) {
      rows.push(
        [gameName, team.name, member.nama, member.jenisKelamin, member.cabang]
          .map(csvCell)
          .join(","),
      );
    }
  }

  for (const member of leftover) {
    rows.push(
      [gameName, "Cadangan", member.nama, member.jenisKelamin, member.cabang]
        .map(csvCell)
        .join(","),
    );
  }

  return [header, ...rows].join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}
