import { describe, expect, it } from "vitest";
import { buildKnockoutBracket, championOf, setMatchWinner } from "./bracket.js";

function teams(n) {
  return Array.from({ length: n }, (_, i) => ({ number: i + 1, name: `Grup ${i + 1}` }));
}

describe("buildKnockoutBracket", () => {
  it("membuat 3 babak untuk 8 grup, 2 per sesi", () => {
    const bracket = buildKnockoutBracket(teams(8), 2);
    expect(bracket.rounds.map((round) => round.name)).toEqual([
      "Perempat final",
      "Semifinal",
      "Final",
    ]);
    expect(bracket.rounds[0].matches).toHaveLength(4);
    expect(bracket.rounds[1].matches).toHaveLength(2);
    expect(bracket.rounds[2].matches).toHaveLength(1);
    expect(bracket.rounds[0].matches[0].teams.map((team) => team.name)).toEqual(["Grup 1", "Grup 2"]);
  });

  it("memberi bye jika jumlah grup ganjil", () => {
    const bracket = buildKnockoutBracket(teams(5), 2);
    expect(bracket.rounds[0].matches).toHaveLength(2);
    expect(bracket.rounds[0].byeTeams.map((team) => team.number)).toEqual([5]);
    expect(bracket.rounds.at(-1).name).toBe("Final");
  });

  it("satu sesi jika semua grup bertanding bersama", () => {
    const bracket = buildKnockoutBracket(teams(4), 4);
    expect(bracket.rounds).toHaveLength(1);
    expect(bracket.rounds[0].name).toBe("Final");
    expect(bracket.rounds[0].matches[0].teams).toHaveLength(4);
  });
});

describe("setMatchWinner", () => {
  it("memajukan pemenang ke babak berikutnya", () => {
    let bracket = buildKnockoutBracket(teams(4), 2);
    bracket = setMatchWinner(bracket, "r0-s0", 1);
    bracket = setMatchWinner(bracket, "r0-s1", 4);
    expect(bracket.rounds[1].matches[0].teams.map((team) => team.number)).toEqual([1, 4]);
    bracket = setMatchWinner(bracket, "r1-s0", 4);
    expect(championOf(bracket)).toMatchObject({ number: 4, name: "Grup 4" });
  });
});
