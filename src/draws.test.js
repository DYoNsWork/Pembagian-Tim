import { describe, expect, it } from "vitest";
import { chunk, extraDrawIds, groupDrawMembers, normalizeParticipant, personFromRow } from "./draws.js";

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
        nomor: "07",
        excluded: 1,
      }),
    ).toEqual({
      id: 9,
      nama: "Andi",
      jenisKelamin: "Laki-laki",
      cabang: "Jakarta",
      nomor: "07",
      excluded: true,
    });
  });
});

describe("normalizeParticipant", () => {
  it("wajib nama dan menormalisasi gender serta nomor", () => {
    expect(
      normalizeParticipant({
        nama: "  Andi  ",
        jenisKelamin: "L",
        cabang: "Jakarta",
        nomor: "07",
        excluded: true,
      }),
    ).toEqual({
      nama: "Andi",
      jenisKelamin: "Laki-laki",
      cabang: "Jakarta",
      nomor: "07",
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
