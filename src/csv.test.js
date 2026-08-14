import { describe, expect, it } from "vitest";
import { normalizeGender, parseParticipantsCsv, summarizeParticipants } from "./csv.js";

const SAMPLE = `nama,jenis kelamin,nama cabang
Andi,L,Jakarta
Siti,P,Bandung
Budi,Laki-laki,Surabaya
`;

describe("parseParticipantsCsv", () => {
  it("membaca header standar dan menormalkan jenis kelamin", () => {
    const { participants } = parseParticipantsCsv(SAMPLE);
    expect(participants).toHaveLength(3);
    expect(participants[0]).toMatchObject({
      nama: "Andi",
      jenisKelamin: "Laki-laki",
      cabang: "Jakarta",
    });
    expect(participants[1].jenisKelamin).toBe("Perempuan");
    expect(participants[2].jenisKelamin).toBe("Laki-laki");
  });

  it("mendukung pemisah titik koma seperti Excel Indonesia", () => {
    const text = "nama;jenis kelamin;nama cabang\nRina;P;Medan";
    const { participants } = parseParticipantsCsv(text);
    expect(participants[0]).toMatchObject({
      nama: "Rina",
      jenisKelamin: "Perempuan",
      cabang: "Medan",
    });
  });

  it("melewati baris tanpa nama", () => {
    const text = "nama,jenis kelamin,nama cabang\n,L,Jakarta\nDoni,L,Depok";
    const { participants, errors } = parseParticipantsCsv(text);
    expect(participants).toHaveLength(1);
    expect(participants[0].nama).toBe("Doni");
    expect(errors).toHaveLength(1);
  });

  it("menangani BOM dan field berkoma", () => {
    const text = '\uFEFFnama,jenis kelamin,nama cabang\n"Sari, S.Pd",P,"Cabang A, Utara"';
    const { participants } = parseParticipantsCsv(text);
    expect(participants[0].nama).toBe("Sari, S.Pd");
    expect(participants[0].cabang).toBe("Cabang A, Utara");
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
  it("menghitung total, gender, dan cabang unik", () => {
    const { participants } = parseParticipantsCsv(SAMPLE);
    expect(summarizeParticipants(participants)).toEqual({
      total: 3,
      laki: 2,
      perempuan: 1,
      cabang: 3,
    });
  });
});
