export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function divideTeams(
  participants,
  { teamCount, membersPerTeam, gameName = "Tim", balanceGender = false },
  random = Math.random,
) {
  const teamsWanted = Number(teamCount);
  const size = Number(membersPerTeam);

  if (!Number.isInteger(teamsWanted) || teamsWanted < 1) {
    throw new Error("Jumlah tim harus bilangan bulat minimal 1.");
  }
  if (!Number.isInteger(size) || size < 1) {
    throw new Error("Anggota per tim harus bilangan bulat minimal 1.");
  }

  const needed = teamsWanted * size;
  if (participants.length < needed) {
    throw new Error(
      `Peserta tidak cukup. Butuh ${needed} orang (${teamsWanted} grup × ${size} anggota), tersedia ${participants.length}.`,
    );
  }

  const prefix = String(gameName || "Tim").trim() || "Tim";
  const selected = balanceGender
    ? pickBalanced(participants, teamsWanted, size, random)
    : shuffle(participants, random).slice(0, needed);
  const selectedSet = new Set(selected);
  const leftover = participants.filter((person) => !selectedSet.has(person));

  const teams = [];
  for (let i = 0; i < teamsWanted; i += 1) {
    teams.push({
      number: i + 1,
      name: `${prefix} ${i + 1}`,
      members: selected.slice(i * size, (i + 1) * size),
    });
  }

  return {
    teams,
    leftover,
    needed,
    used: selected.length,
    total: participants.length,
    gameName: prefix,
  };
}

function pickBalanced(participants, teamCount, membersPerTeam, random) {
  const queues = {
    laki: shuffle(
      participants.filter((person) => person.jenisKelamin === "Laki-laki"),
      random,
    ),
    perempuan: shuffle(
      participants.filter((person) => person.jenisKelamin === "Perempuan"),
      random,
    ),
    lain: shuffle(
      participants.filter(
        (person) => person.jenisKelamin !== "Laki-laki" && person.jenisKelamin !== "Perempuan",
      ),
      random,
    ),
  };

  const teams = Array.from({ length: teamCount }, () => []);
  for (const team of teams) {
    while (team.length < membersPerTeam) {
      const laki = team.filter((person) => person.jenisKelamin === "Laki-laki").length;
      const perempuan = team.filter((person) => person.jenisKelamin === "Perempuan").length;
      const person =
        laki <= perempuan && queues.laki.length
          ? queues.laki.shift()
          : queues.perempuan.length
            ? queues.perempuan.shift()
            : queues.laki.shift() || queues.lain.shift();
      if (!person) break;
      team.push(person);
    }
  }

  return teams.flat();
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
