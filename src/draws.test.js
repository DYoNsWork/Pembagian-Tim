import { describe, expect, it } from "vitest";
import { chunk, extraDrawIds, groupDrawMembers, memberIdFromPerson, normalizeParticipant, normalizeTeamComposition, personFromRow, playedParticipantKeys } from "./draws.js";
import { participantKey } from "./csv.js";

describe("playedParticipantKeys", () => {
  it("mengabaikan cadangan dan memakai nama + cabang", () => {
    const keys = playedParticipantKeys([
      { team_number: 1, nama: "Putri", cabang: "Botania" },
      { team_number: 0, nama: "Rina", cabang: "Solo" },
      { team_number: 2, nama: "Putri", cabang: "Prima" },
    ]);
    expect(keys.size).toBe(2);
    expect(keys.has(participantKey("Putri", "Botania"))).toBe(true);
    expect(keys.has(participantKey("Putri", "Prima"))).toBe(true);
  });
});

describe("normalizeTeamComposition", () => {
  const eligible = new Map([
    [1, { id: 1, nama: "Andi", jenisKelamin: "Laki-laki", cabang: "Jakarta" }],
    [2, { id: 2, nama: "Budi", jenisKelamin: "Laki-laki", cabang: "Bandung" }],
    [3, { id: 3, nama: "Siti", jenisKelamin: "Perempuan", cabang: "Medan" }],
    [4, { id: 4, nama: "Rina", jenisKelamin: "Perempuan", cabang: "Solo" }],
  ]);

  it("memvalidasi jumlah anggota dan duplikat", () => {
    expect(
      normalizeTeamComposition(
        [
          { number: 1, memberIds: [1, 2] },
          { number: 2, memberIds: [3, 4] },
        ],
        { teamCount: 2, membersPerTeam: 2, eligibleById: eligible },
      ).teams.map((team) => team.members.map((member) => member.nama)),
    ).toEqual([
      ["Andi", "Budi"],
      ["Siti", "Rina"],
    ]);

    expect(() =>
      normalizeTeamComposition([{ number: 1, memberIds: [1, 1] }], {
        teamCount: 1,
        membersPerTeam: 2,
        eligibleById: eligible,
      }),
    ).toThrow(/tidak boleh/i);
  });
});

describe("memberIdFromPerson", () => {
  it("mencocokkan anggota tim ke id peserta", () => {
    const list = [{ id: 7, nama: "Putri", cabang: "Botania", jenisKelamin: "Perempuan" }];
    expect(memberIdFromPerson(list, { nama: "Putri", cabang: "Botania" })).toBe(7);
  });
});

describe("groupDrawMembers", () => {
  it("mengelompokkan anggota tim dan cadangan", () => {
    const result = groupDrawMembers([
      { team_number: 1, team_name: "Tim 1", nama: "Andi", jenis_kelamin: "Laki-laki", cabang: "Jakarta" },
      { team_number: 1, team_name: "Tim 1", nama: "Budi", jenis_kelamin: "Laki-laki", cabang: "Bandung" },
      { team_number: 2, team_name: "Tim 2", nama: "Siti", jenis_kelamin: "Perempuan", cabang: "Medan" },
      { team_number: 0, team_name: "Cadangan", nama: "Rina", jenis_kelamin: "Perempuan", cabang: "Solo" },
    ]);

    expect(result.teams).toHaveLength(2);
    expect(result.teams[0].members.map((m) => m.nama)).toEqual(["Andi", "Budi"]);
    expect(result.leftover).toEqual([
      { nama: "Rina", jenisKelamin: "Perempuan", cabang: "Solo" },
    ]);
    expect(result.used).toBe(3);
    expect(result.total).toBe(4);
  });
});

describe("personFromRow", () => {
  it("mengubah kolom D1 ke bentuk aplikasi", () => {
    expect(
      personFromRow({
        id: 9,
        nama: "Andi",
        jenis_kelamin: "Laki-laki",
        cabang: "Jakarta",
        excluded: 1,
      }),
    ).toEqual({
      id: 9,
      nama: "Andi",
      jenisKelamin: "Laki-laki",
      cabang: "Jakarta",
      excluded: true,
    });
  });
});

describe("normalizeParticipant", () => {
  it("wajib nama dan menormalisasi gender", () => {
    expect(
      normalizeParticipant({
        nama: "  Andi  ",
        jenisKelamin: "L",
        cabang: "Jakarta",
        excluded: true,
      }),
    ).toEqual({
      nama: "Andi",
      jenisKelamin: "Laki-laki",
      cabang: "Jakarta",
      excluded: true,
    });
    expect(() => normalizeParticipant({ nama: " " })).toThrow(/nama/i);
  });
});

describe("extraDrawIds", () => {
  it("menyimpan undian terbaru untuk setiap permainan", () => {
    expect(
      extraDrawIds([
        { id: 9, game_id: "futsal" },
        { id: 8, game_id: "voli" },
        { id: 7, game_id: "futsal" },
        { id: 6, game_id: "voli" },
      ]),
    ).toEqual([7, 6]);
  });
});

describe("chunk", () => {
  it("memotong array sesuai ukuran batch D1", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
