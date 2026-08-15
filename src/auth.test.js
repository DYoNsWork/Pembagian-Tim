import { describe, expect, it } from "vitest";
import {
  firstAllowedView,
  hasRight,
  normalizeRights,
  publicUser,
  rightsForRole,
  validateUserInput,
} from "./auth.js";
import { hashPassword, verifyPassword } from "./passwords.js";

describe("RBAC", () => {
  it("admin selalu punya semua hak", () => {
    expect(normalizeRights([], "admin")).toEqual([
      "peserta",
      "permainan",
      "pembagian",
      "hasil",
      "pengguna",
    ]);
    expect(hasRight({ role: "admin", rights: [] }, "pengguna")).toBe(true);
  });

  it("panitia tidak bisa kelola pengguna", () => {
    const rights = rightsForRole("panitia");
    expect(rights).toContain("pembagian");
    expect(rights).not.toContain("pengguna");
    expect(hasRight({ role: "panitia", rights }, "pengguna")).toBe(false);
  });

  it("penonton hanya hasil, dibuka di menu pembagian", () => {
    expect(firstAllowedView({ role: "penonton", rights: rightsForRole("penonton") })).toBe(
      "pembagian",
    );
  });

  it("membaca user dari baris database", () => {
    const user = publicUser({
      id: 1,
      username: "andi",
      display_name: "Andi",
      role: "kustom",
      rights: JSON.stringify(["hasil", "peserta"]),
    });
    expect(user).toMatchObject({
      username: "andi",
      displayName: "Andi",
      rights: ["peserta", "hasil"],
    });
  });
});

describe("validateUserInput", () => {
  it("menolak username dan sandi yang lemah", () => {
    expect(() =>
      validateUserInput({ username: "ab", displayName: "A", password: "123456", rights: ["hasil"] }),
    ).toThrow(/username/i);
    expect(() =>
      validateUserInput({
        username: "panitia1",
        displayName: "Panitia",
        password: "123",
        role: "kustom",
        rights: ["hasil"],
      }),
    ).toThrow(/sandi/i);
  });

  it("menerima user panitia", () => {
    const parsed = validateUserInput({
      username: "Panitia_1",
      displayName: "Panitia Satu",
      password: "rahasia",
      role: "panitia",
    });
    expect(parsed.username).toBe("panitia_1");
    expect(parsed.rights).toEqual(["peserta", "permainan", "pembagian", "hasil"]);
  });
});

describe("passwords", () => {
  it("meng-hash dan memverifikasi kata sandi", async () => {
    const stored = await hashPassword("rahasia-kuat");
    expect(await verifyPassword("rahasia-kuat", stored.salt, stored.hash)).toBe(true);
    expect(await verifyPassword("salah", stored.salt, stored.hash)).toBe(false);
  });
});
