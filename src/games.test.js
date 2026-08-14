import { describe, expect, it } from "vitest";
import { getGame, GAMES, suggestedTeamCount } from "./games.js";

describe("getGame", () => {
  it("mengembalikan futsal dengan 5 anggota", () => {
    expect(getGame("futsal")).toMatchObject({ name: "Futsal", members: 5 });
  });

  it("jatuh ke umum jika id tidak dikenal", () => {
    expect(getGame("tidak-ada").id).toBe("umum");
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
  });
});
