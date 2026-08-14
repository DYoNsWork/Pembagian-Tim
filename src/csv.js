const HEADER_ALIASES = {
  nama: ["nama", "name", "nama peserta", "peserta", "nama lengkap"],
  jenisKelamin: [
    "jenis kelamin",
    "jk",
    "gender",
    "kelamin",
    "sex",
    "jenis_kelamin",
  ],
  cabang: [
    "nama cabang",
    "cabang",
    "branch",
    "klub",
    "asal",
    "nama_cabang",
    "kota",
  ],
};

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function detectDelimiter(headerLine) {
  const commas = (headerLine.match(/,/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;
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

function mapHeaderIndex(headers) {
  const indexes = { nama: -1, jenisKelamin: -1, cabang: -1 };

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (indexes[field] === -1 && aliases.includes(normalized)) {
        indexes[field] = index;
      }
    }
  });

  if (indexes.nama === -1 && headers.length >= 1) indexes.nama = 0;
  if (indexes.jenisKelamin === -1 && headers.length >= 2) indexes.jenisKelamin = 1;
  if (indexes.cabang === -1 && headers.length >= 3) indexes.cabang = 2;

  return indexes;
}

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
  const headers = parseCsvLine(lines[0], delimiter);
  const indexes = mapHeaderIndex(headers);

  if (indexes.nama === -1) {
    throw new Error('Kolom "nama" tidak ditemukan. Gunakan header: nama, jenis kelamin, nama cabang.');
  }

  const participants = [];
  const errors = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i], delimiter);
    const nama = (cells[indexes.nama] || "").trim();
    if (!nama) {
      errors.push(`Baris ${i + 1}: nama kosong, dilewati.`);
      continue;
    }

    participants.push({
      id: `${i}-${nama}`,
      nama,
      jenisKelamin: normalizeGender(indexes.jenisKelamin >= 0 ? cells[indexes.jenisKelamin] : ""),
      cabang: (indexes.cabang >= 0 ? cells[indexes.cabang] : "").trim() || "-",
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

  for (const person of participants) {
    cabang.add(person.cabang);
    if (person.jenisKelamin === "Laki-laki") laki += 1;
    if (person.jenisKelamin === "Perempuan") perempuan += 1;
  }

  return {
    total: participants.length,
    laki,
    perempuan,
    cabang: cabang.size,
  };
}
