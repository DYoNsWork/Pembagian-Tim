export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function divideTeams(participants, { teamCount, membersPerTeam }, random = Math.random) {
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
      `Peserta tidak cukup. Butuh ${needed} orang (${teamsWanted} tim × ${size} anggota), tersedia ${participants.length}.`,
    );
  }

  const shuffled = shuffle(participants, random);
  const selected = shuffled.slice(0, needed);
  const leftover = shuffled.slice(needed);
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
  };
}

export function teamsToCsv(teams, leftover = []) {
  const header = "tim,nama,jenis kelamin,nama cabang";
  const rows = [];

  for (const team of teams) {
    for (const member of team.members) {
      rows.push(
        [team.name, member.nama, member.jenisKelamin, member.cabang]
          .map(csvCell)
          .join(","),
      );
    }
  }

  for (const member of leftover) {
    rows.push(
      ["Cadangan", member.nama, member.jenisKelamin, member.cabang]
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
