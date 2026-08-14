import { describe, expect, it } from "vitest";
import {
  divideTeams,
  filterByGender,
  genderModeLabel,
  normalizeGenderMode,
  shuffle,
  teamsToCsv,
} from "./teams.js";

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

  it("menamai grup sesuai permainan", () => {
    const result = divideTeams(people(8), {
      teamCount: 2,
      membersPerTeam: 4,
      gameName: "Tim Futsal",
    });
    expect(result.teams.map((team) => team.name)).toEqual(["Tim Futsal 1", "Tim Futsal 2"]);
  });

  it("menyeimbangkan jenis kelamin antar grup jika campur", () => {
    const result = divideTeams(people(8), {
      teamCount: 2,
      membersPerTeam: 4,
      genderMode: "campur",
    });
    for (const team of result.teams) {
      const laki = team.members.filter((m) => m.jenisKelamin === "Laki-laki").length;
      const perempuan = team.members.filter((m) => m.jenisKelamin === "Perempuan").length;
      expect(laki).toBe(2);
      expect(perempuan).toBe(2);
    }
  });

  it("hanya memakai peserta laki-laki", () => {
    const result = divideTeams(people(16), {
      teamCount: 2,
      membersPerTeam: 3,
      genderMode: "laki-laki",
    });
    expect(result.teams.flatMap((team) => team.members).every((m) => m.jenisKelamin === "Laki-laki")).toBe(
      true,
    );
    expect(result.leftover.every((m) => m.jenisKelamin === "Laki-laki")).toBe(true);
    expect(result.leftover).toHaveLength(2);
    expect(result.poolSize).toBe(8);
    expect(result.genderMode).toBe("laki-laki");
  });

  it("hanya memakai peserta perempuan", () => {
    const result = divideTeams(people(12), {
      teamCount: 2,
      membersPerTeam: 3,
      genderMode: "perempuan",
    });
    expect(
      result.teams.flatMap((team) => team.members).every((m) => m.jenisKelamin === "Perempuan"),
    ).toBe(true);
  });

  it("gagal jika peserta laki-laki kurang", () => {
    expect(() =>
      divideTeams(people(8), { teamCount: 3, membersPerTeam: 4, genderMode: "laki-laki" }),
    ).toThrow(/laki-laki tidak cukup/i);
  });
});

describe("normalizeGenderMode", () => {
  it("menyeragamkan pilihan komposisi", () => {
    expect(normalizeGenderMode("Campur")).toBe("campur");
    expect(normalizeGenderMode("laki")).toBe("laki-laki");
    expect(normalizeGenderMode("wanita")).toBe("perempuan");
    expect(genderModeLabel("laki-laki")).toBe("Laki-laki saja");
  });
});

describe("filterByGender", () => {
  it("menyaring peserta sesuai mode", () => {
    expect(filterByGender(people(10), "laki-laki")).toHaveLength(5);
    expect(filterByGender(people(10), "perempuan")).toHaveLength(5);
    expect(filterByGender(people(10), "campur")).toHaveLength(10);
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
    const csv = teamsToCsv(teams, leftover, "Futsal");
    expect(csv).toContain("permainan,tim,nama,jenis kelamin,nama cabang");
    expect(csv).toContain("Futsal,Tim 1,Andi,Laki-laki,Jakarta");
    expect(csv).toContain("Futsal,Cadangan,Siti,Perempuan,Bandung");
  });
});
