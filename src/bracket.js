export function roundName(index, totalRounds) {
  const fromEnd = totalRounds - 1 - index;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Perempat final";
  if (fromEnd === 3) return "16 besar";
  return `Babak ${index + 1}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asTeam(team) {
  if (!team || team.pending) {
    return {
      pending: true,
      label: team?.label || "Menunggu pemenang",
      fromMatchId: team?.fromMatchId || null,
    };
  }
  return { number: team.number, name: team.name };
}

function splitSlots(slots, groupsPerSession) {
  const k = groupsPerSession;
  if (slots.length <= 1) {
    return { matches: [], byeTeams: slots.map(asTeam), done: true };
  }
  if (slots.length <= k) {
    return { matches: [{ teams: slots.map(asTeam) }], byeTeams: [], done: true };
  }
  const nMatches = Math.floor(slots.length / k);
  const matches = [];
  for (let i = 0; i < nMatches; i += 1) {
    matches.push({ teams: slots.slice(i * k, (i + 1) * k).map(asTeam) });
  }
  return {
    matches,
    byeTeams: slots.slice(nMatches * k).map(asTeam).filter((team) => !team.pending),
    done: false,
  };
}

export function slotsFromRound(round) {
  const winners = (round.matches || []).map((match, index) => {
    const winner = (match.teams || []).find(
      (team) => team && !team.pending && team.number === match.winnerNumber,
    );
    if (winner) return { number: winner.number, name: winner.name };
    return {
      pending: true,
      label: `Pemenang ${round.name} sesi ${index + 1}`,
      fromMatchId: match.id,
    };
  });
  const byes = (round.byeTeams || []).map((team) => ({ number: team.number, name: team.name }));
  return [...winners, ...byes];
}

export function buildKnockoutBracket(teams, groupsPerSession = 2) {
  const k = Number(groupsPerSession);
  if (!Number.isInteger(k) || k < 2) {
    throw new Error("Grup per sesi harus bilangan minimal 2.");
  }
  const entries = (teams || []).map((team) => ({ number: team.number, name: team.name }));
  if (entries.length < 2) {
    return { groupsPerSession: k, rounds: [], champion: entries[0] || null };
  }

  const rounds = [];
  let slots = entries;
  while (slots.length > 1 && rounds.length < 16) {
    const split = splitSlots(slots, k);
    const index = rounds.length;
    rounds.push({
      name: `Babak ${index + 1}`,
      matches: split.matches.map((match, session) => ({
        id: `r${index}-s${session}`,
        session: session + 1,
        teams: match.teams,
        winnerNumber: null,
      })),
      byeTeams: split.byeTeams,
    });
    if (split.done) break;
    slots = slotsFromRound(rounds[index]);
  }

  rounds.forEach((round, index) => {
    round.name = roundName(index, rounds.length);
  });
  return refreshBracket({ groupsPerSession: k, rounds });
}

export function refreshBracket(bracket) {
  const next = clone(bracket);
  const k = Number(next.groupsPerSession) || 2;
  for (let r = 0; r < next.rounds.length - 1; r += 1) {
    const slots = slotsFromRound(next.rounds[r]);
    const split = splitSlots(slots, k);
    const round = next.rounds[r + 1];
    round.matches.forEach((match, index) => {
      match.teams = split.matches[index]?.teams || match.teams;
      if (
        match.winnerNumber &&
        !match.teams.some((team) => team && !team.pending && team.number === match.winnerNumber)
      ) {
        match.winnerNumber = null;
      }
    });
    round.byeTeams = split.byeTeams;
  }
  next.champion = championOf(next);
  return next;
}

export function setMatchWinner(bracket, matchId, winnerNumber) {
  const next = clone(bracket);
  const number = Number(winnerNumber);
  let found = false;
  for (const round of next.rounds) {
    const match = round.matches.find((item) => item.id === matchId);
    if (!match) continue;
    const team = match.teams.find((item) => item && !item.pending && item.number === number);
    if (!team) {
      throw Object.assign(new Error("Grup itu tidak ada di sesi ini."), { status: 400 });
    }
    match.winnerNumber = match.winnerNumber === number ? null : number;
    found = true;
    break;
  }
  if (!found) {
    throw Object.assign(new Error("Sesi pertandingan tidak ditemukan."), { status: 404 });
  }
  return refreshBracket(next);
}

export function championOf(bracket) {
  const last = bracket?.rounds?.at(-1);
  if (!last?.matches?.length) return bracket?.rounds?.length ? null : bracket?.champion || null;
  const match = last.matches[0];
  return (
    (match.teams || []).find((team) => team && !team.pending && team.number === match.winnerNumber) ||
    null
  );
}

export function parseBracket(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
