import { describe, expect, it } from "vitest";
import {
  DEFAULT_GAMES,
  getGame,
  GAMES,
  normalizeGame,
  slugifyGameId,
  suggestedTeamCount,
  uniqueGameId,
} from "./games.js";

describe("getGame", () => {
  it("mengembalikan futsal dengan 5 anggota", () => {
    expect(getGame("futsal")).toMatchObject({ name: "Futsal", members: 5 });
  });

  it("jatuh ke umum jika id tidak dikenal", () => {
    expect(getGame("tidak-ada").id).toBe("umum");
  });

  it("mencari dari daftar kustom", () => {
    const custom = [{ id: "gobak-sodor", name: "Gobak sodor", members: 8, labelPrefix: "Regu" }];
    expect(getGame("gobak-sodor", custom).name).toBe("Gobak sodor");
    expect(getGame("tidak-ada", custom).id).toBe("gobak-sodor");
  });
});

describe("suggestedTeamCount", () => {
  it("menghitung jumlah grup penuh dari peserta", () => {
    expect(suggestedTeamCount(72, 5)).toBe(14);
    expect(suggestedTeamCount(16, 4)).toBe(4);
  });
});

describe("GAMES", () => {
  it("memiliki id unik", () => {
    const ids = GAMES.map((game) => game.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEFAULT_GAMES).toHaveLength(GAMES.length);
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
      normalizeGame(
        { name: "Panjat Pinang", members: 6, labelPrefix: "Regu", description: "6 orang." },
        { existingIds: DEFAULT_GAMES.map((game) => game.id) },
      ),
    ).toMatchObject({
      id: "panjat-pinang",
      name: "Panjat Pinang",
      members: 6,
      labelPrefix: "Regu",
    });
  });

  it("gagal tanpa nama atau anggota tidak valid", () => {
    expect(() => normalizeGame({ name: "", members: 4 })).toThrow(/nama/i);
    expect(() => normalizeGame({ name: "Tes", members: 0 })).toThrow(/anggota/i);
  });
});
