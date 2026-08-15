import { describe, expect, it } from "vitest";
import { bracketProgress, gameProgressRows, participationCounts } from "./dashboard.js";

describe("bracketProgress", () => {
  it("menghitung persentase sesi yang sudah punya pemenang", () => {
    expect(
      bracketProgress({
        rounds: [
          {
            matches: [
              { teams: [{ number: 1, name: "Tim 1" }, { number: 2, name: "Tim 2" }], winnerNumber: 1 },
              { teams: [{ number: 3, name: "Tim 3" }, { number: 4, name: "Tim 4" }], winnerNumber: null },
            ],
          },
        ],
      }),
    ).toBe(50);
  });
});

describe("participationCounts", () => {
  it("menghitung permainan per peserta", () => {
    expect(
      participationCounts([
        { team_number: 1, nama: "Andi", cabang: "Jakarta" },
        { team_number: 1, nama: "Andi", cabang: "Jakarta" },
        { team_number: 2, nama: "Siti", cabang: "Bandung" },
        { team_number: 0, nama: "Cadangan", cabang: "Solo" },
      ]),
    ).toEqual([
      { nama: "Andi", cabang: "Jakarta", count: 2 },
      { nama: "Siti", cabang: "Bandung", count: 1 },
    ]);
  });

  it("memisahkan nama sama di cabang berbeda", () => {
    expect(
      participationCounts([
        { team_number: 1, nama: "Putri", cabang: "Botania" },
        { team_number: 1, nama: "Putri", cabang: "Prima" },
        { team_number: 2, nama: "Putri", cabang: "Botania" },
      ]),
    ).toEqual([
      { nama: "Putri", cabang: "Botania", count: 2 },
      { nama: "Putri", cabang: "Prima", count: 1 },
    ]);
  });
});

describe("gameProgressRows", () => {
  it("menandai permainan belum, berjalan, atau selesai", () => {
    const rows = gameProgressRows(
      [{ id: "a", name: "Futsal" }, { id: "b", name: "Voli" }],
      new Map([
        [
          "a",
          {
            bracket: {
              champion: { name: "Tim 1" },
              rounds: [{ matches: [{ teams: [{ number: 1, name: "Tim 1" }], winnerNumber: 1 }] }],
            },
          },
        ],
        [
          "b",
          {
            bracket: {
              rounds: [
                {
                  matches: [
                    {
                      teams: [{ number: 1, name: "Tim 1" }, { number: 2, name: "Tim 2" }],
                      winnerNumber: null,
                    },
                  ],
                },
              ],
            },
          },
        ],
      ]),
    );
    expect(rows[0]).toMatchObject({ status: "selesai", champion: "Tim 1", progress: 100 });
    expect(rows[1]).toMatchObject({ status: "berjalan", hasDraw: true, progress: 0 });
  });
});
