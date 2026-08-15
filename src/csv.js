export function normalizeGender(value) {
  const raw = String(value ?? "").trim();
  const key = raw.toLowerCase();

  if (["l", "lk", "laki", "laki-laki", "laki laki", "pria", "male", "m", "cowok"].includes(key)) {
    return "Laki-laki";
  }
  if (["p", "pr", "perempuan", "wanita", "female", "f", "cewek"].includes(key)) {
    return "Perempuan";
  }
  return raw || "-";
}

function detectDelimiter(firstLine) {
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function parseCsvLine(line, delimiter) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseParticipantsCsv(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("File CSV kosong.");
  }

  const delimiter = detectDelimiter(lines[0]);
  const participants = [];
  const errors = [];

  for (let i = 0; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i], delimiter);
    const nama = (cells[0] || "").trim();
    if (!nama) {
      errors.push(`Baris ${i + 1}: nama kosong, dilewati.`);
      continue;
    }

    participants.push({
      id: `${i}-${nama}`,
      nama,
      jenisKelamin: normalizeGender(cells[1] || ""),
      cabang: (cells[2] || "").trim() || "-",
      nomor: (cells[3] || "").trim(),
      excluded: false,
    });
  }

  if (participants.length === 0) {
    throw new Error("Tidak ada data peserta yang valid di file CSV.");
  }

  return { participants, errors, delimiter };
}

export function summarizeParticipants(participants) {
  const cabang = new Set();
  let laki = 0;
  let perempuan = 0;
  let excluded = 0;

  for (const person of participants) {
    cabang.add(person.cabang);
    if (person.jenisKelamin === "Laki-laki") laki += 1;
    if (person.jenisKelamin === "Perempuan") perempuan += 1;
    if (person.excluded) excluded += 1;
  }

  return {
    total: participants.length,
    laki,
    perempuan,
    cabang: cabang.size,
    excluded,
  };
}
