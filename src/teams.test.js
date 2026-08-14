import { describe, expect, it } from "vitest";
import { divideTeams, shuffle, teamsToCsv } from "./teams.js";

function people(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    nama: `Peserta ${i + 1}`,
    jenisKelamin: i % 2 === 0 ? "Laki-laki" : "Perempuan",
    cabang: `Cabang ${(i % 5) + 1}`,
  }));
}

describe("shuffle", () => {
  it("tidak mengubah array asli dan tetap berisi anggota yang sama", () => {
    const source = [1, 2, 3, 4];
    const result = shuffle(source, () => 0.4);
    expect(source).toEqual([1, 2, 3, 4]);
    expect(result.sort()).toEqual([1, 2, 3, 4]);
    expect(result).not.toBe(source);
  });
});

describe("divideTeams", () => {
  it("membentuk 16 tim berisi 4 orang dari 64 peserta", () => {
    const result = divideTeams(people(64), { teamCount: 16, membersPerTeam: 4 });
    expect(result.teams).toHaveLength(16);
    expect(result.teams.every((team) => team.members.length === 4)).toBe(true);
    expect(result.leftover).toHaveLength(0);
    expect(result.needed).toBe(64);
  });

  it("menyimpan sisa peserta sebagai cadangan", () => {
    const result = divideTeams(people(70), { teamCount: 16, membersPerTeam: 4 });
    expect(result.teams).toHaveLength(16);
    expect(result.leftover).toHaveLength(6);
    const usedIds = result.teams.flatMap((team) => team.members.map((m) => m.id));
    const leftoverIds = result.leftover.map((m) => m.id);
    expect(new Set([...usedIds, ...leftoverIds]).size).toBe(70);
  });

  it("gagal jika peserta kurang dari kebutuhan", () => {
    expect(() => divideTeams(people(10), { teamCount: 16, membersPerTeam: 4 })).toThrow(
      /tidak cukup/i,
    );
  });

  it("gagal jika jumlah tim atau anggota tidak valid", () => {
    expect(() => divideTeams(people(8), { teamCount: 0, membersPerTeam: 4 })).toThrow(/tim/i);
    expect(() => divideTeams(people(8), { teamCount: 2, membersPerTeam: 1.5 })).toThrow(
      /anggota/i,
    );
  });

  it("mengacak urutan, bukan mengelompokkan berdasarkan cabang", () => {
    const sequential = people(16);
    let seed = 7;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const result = divideTeams(sequential, { teamCount: 4, membersPerTeam: 4 }, rng);
    const firstTeamIds = result.teams[0].members.map((m) => m.id);
    expect(firstTeamIds).not.toEqual(["1", "2", "3", "4"]);
    const usedIds = result.teams.flatMap((team) => team.members.map((m) => m.id)).sort((a, b) => Number(a) - Number(b));
    expect(usedIds).toEqual(sequential.map((p) => p.id));
  });
});

describe("teamsToCsv", () => {
  it("mengekspor anggota tim dan cadangan", () => {
    const teams = [
      {
        name: "Tim 1",
        members: [{ nama: "Andi", jenisKelamin: "Laki-laki", cabang: "Jakarta" }],
      },
    ];
    const leftover = [{ nama: "Siti", jenisKelamin: "Perempuan", cabang: "Bandung" }];
    const csv = teamsToCsv(teams, leftover);
    expect(csv).toContain("tim,nama,jenis kelamin,nama cabang");
    expect(csv).toContain("Tim 1,Andi,Laki-laki,Jakarta");
    expect(csv).toContain("Cadangan,Siti,Perempuan,Bandung");
  });
});
