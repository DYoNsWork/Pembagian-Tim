import { describe, expect, it } from "vitest";
import { normalizeGender, parseParticipantsCsv, summarizeParticipants } from "./csv.js";

const SAMPLE = `Andi,L,Jakarta,01
Siti,P,Bandung,02
Budi,Laki-laki,Surabaya,03
`;

describe("parseParticipantsCsv", () => {
  it("membaca semua baris sebagai data, tanpa header", () => {
    const { participants } = parseParticipantsCsv(SAMPLE);
    expect(participants).toHaveLength(3);
    expect(participants[0]).toMatchObject({
      nama: "Andi",
      jenisKelamin: "Laki-laki",
      cabang: "Jakarta",
      nomor: "01",
    });
    expect(participants[1].jenisKelamin).toBe("Perempuan");
    expect(participants[2].jenisKelamin).toBe("Laki-laki");
  });

  it("menganggap baris pertama sebagai peserta, bukan judul kolom", () => {
    const { participants } = parseParticipantsCsv("Rina,P,Medan,A1\nDoni,L,Depok,A2");
    expect(participants).toHaveLength(2);
    expect(participants[0]).toMatchObject({
      nama: "Rina",
      jenisKelamin: "Perempuan",
      cabang: "Medan",
      nomor: "A1",
    });
  });

  it("mendukung pemisah titik koma seperti Excel Indonesia", () => {
    const { participants } = parseParticipantsCsv("Rina;P;Medan;07");
    expect(participants[0]).toMatchObject({
      nama: "Rina",
      jenisKelamin: "Perempuan",
      cabang: "Medan",
      nomor: "07",
    });
  });

  it("melewati baris tanpa nama", () => {
    const { participants, errors } = parseParticipantsCsv(",L,Jakarta\nDoni,L,Depok");
    expect(participants).toHaveLength(1);
    expect(participants[0].nama).toBe("Doni");
    expect(errors).toHaveLength(1);
  });

  it("menangani BOM dan field berkoma", () => {
    const { participants } = parseParticipantsCsv('\uFEFF"Sari, S.Pd",P,"Cabang A, Utara",12');
    expect(participants[0].nama).toBe("Sari, S.Pd");
    expect(participants[0].cabang).toBe("Cabang A, Utara");
    expect(participants[0].nomor).toBe("12");
  });

  it("gagal jika file kosong", () => {
    expect(() => parseParticipantsCsv(" \n ")).toThrow(/kosong/i);
  });
});

describe("normalizeGender", () => {
  it("mengenali alias umum", () => {
    expect(normalizeGender("l")).toBe("Laki-laki");
    expect(normalizeGender("Wanita")).toBe("Perempuan");
    expect(normalizeGender("lainnya")).toBe("lainnya");
  });
});

describe("summarizeParticipants", () => {
  it("menghitung total, gender, cabang, dan yang di-exclude", () => {
    const { participants } = parseParticipantsCsv(SAMPLE);
    participants[0].excluded = true;
    expect(summarizeParticipants(participants)).toEqual({
      total: 3,
      laki: 2,
      perempuan: 1,
      cabang: 3,
      excluded: 1,
    });
  });
});
