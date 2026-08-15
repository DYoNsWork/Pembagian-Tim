import { describe, expect, it } from "vitest";
import { formatPicLine, getGame, normalizeGame, slugifyGameId, uniqueGameId } from "./games.js";

describe("getGame", () => {
  it("mengembalikan null jika katalog kosong", () => {
    expect(getGame("futsal")).toBeNull();
    expect(getGame("futsal", [])).toBeNull();
  });

  it("mencari dari daftar yang diberikan", () => {
    const custom = [
      { id: "gobak-sodor", name: "Gobak sodor", teamCount: 4, members: 8 },
    ];
    expect(getGame("gobak-sodor", custom).name).toBe("Gobak sodor");
    expect(getGame("tidak-ada", custom).id).toBe("gobak-sodor");
  });
});

describe("slugifyGameId", () => {
  it("membuat id dari nama permainan", () => {
    expect(slugifyGameId("Gobak Sodor")).toBe("gobak-sodor");
    expect(slugifyGameId("  ")).toBe("permainan");
  });
});

describe("uniqueGameId", () => {
  it("menambah nomor jika id sudah dipakai", () => {
    expect(uniqueGameId("Futsal", ["futsal"])).toBe("futsal-2");
    expect(uniqueGameId("Futsal", ["futsal", "futsal-2"])).toBe("futsal-3");
  });
});

describe("normalizeGame", () => {
  it("menormalisasi permainan baru", () => {
    expect(
      normalizeGame({
        name: "Panjat Pinang",
        description: "Lomba panjat pinang 17 Agustus.",
        teamCount: 8,
        members: 6,
        groupsPerSession: 2,
        pic1Id: 1,
        pic2Id: 2,
      }),
    ).toMatchObject({
      id: "panjat-pinang",
      name: "Panjat Pinang",
      description: "Lomba panjat pinang 17 Agustus.",
      teamCount: 8,
      members: 6,
      groupsPerSession: 2,
      pic1Id: 1,
      pic2Id: 2,
      genderMode: "campur",
      labelPrefix: "Panjat Pinang",
    });
  });

  it("mengisi grup per sesi 2 jika tidak disebutkan", () => {
    expect(
      normalizeGame({ name: "Tes", teamCount: 4, members: 4, pic1Id: 1, pic2Id: 2 }).groupsPerSession,
    ).toBe(2);
  });

  it("gagal tanpa nama, jumlah grup, atau peserta per grup", () => {
    expect(() => normalizeGame({ name: "", teamCount: 4, members: 4, pic1Id: 1, pic2Id: 2 })).toThrow(
      /nama/i,
    );
    expect(() => normalizeGame({ name: "Tes", teamCount: 0, members: 4, pic1Id: 1, pic2Id: 2 })).toThrow(
      /grup/i,
    );
    expect(() => normalizeGame({ name: "Tes", teamCount: 2, members: 0, pic1Id: 1, pic2Id: 2 })).toThrow(
      /peserta/i,
    );
    expect(() =>
      normalizeGame({ name: "Tes", teamCount: 4, members: 4, groupsPerSession: 1, pic1Id: 1, pic2Id: 2 }),
    ).toThrow(/sesi/i);
    expect(() => normalizeGame({ name: "Tes", teamCount: 4, members: 4 })).toThrow(/pic/i);
    expect(() => normalizeGame({ name: "Tes", teamCount: 4, members: 4, pic1Id: 1, pic2Id: 1 })).toThrow(
      /berbeda/i,
    );
  });
});

describe("formatPicLine", () => {
  it("menampilkan nama dan cabang PIC", () => {
    expect(formatPicLine("Andi", "Jakarta")).toBe("Andi · Jakarta");
    expect(formatPicLine("Siti", "Bandung")).toBe("Siti · Bandung");
    expect(formatPicLine("", "Jakarta")).toBe("");
  });
});
