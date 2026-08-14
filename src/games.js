export const GAMES = [
  {
    id: "umum",
    name: "Umum / kustom",
    members: 4,
    description: "Pembagian bebas. Atur sendiri jumlah grup dan anggota.",
    labelPrefix: "Tim",
  },
  {
    id: "futsal",
    name: "Futsal",
    members: 5,
    description: "5 pemain inti per tim. Cocok untuk pertandingan 5 lawan 5.",
    labelPrefix: "Tim Futsal",
  },
  {
    id: "sepak-bola",
    name: "Sepak bola",
    members: 11,
    description: "11 pemain inti per tim.",
    labelPrefix: "Tim Sepak Bola",
  },
  {
    id: "basket",
    name: "Bola basket",
    members: 5,
    description: "5 pemain inti per tim.",
    labelPrefix: "Tim Basket",
  },
  {
    id: "voli",
    name: "Bola voli",
    members: 6,
    description: "6 pemain inti per tim.",
    labelPrefix: "Tim Voli",
  },
  {
    id: "badminton-ganda",
    name: "Badminton ganda",
    members: 2,
    description: "Pasangan 2 orang per grup.",
    labelPrefix: "Ganda",
  },
  {
    id: "tenis-meja-ganda",
    name: "Tenis meja ganda",
    members: 2,
    description: "Pasangan 2 orang per grup.",
    labelPrefix: "Ganda",
  },
  {
    id: "estafet",
    name: "Estafet",
    members: 4,
    description: "4 pelari per estafet.",
    labelPrefix: "Tim Estafet",
  },
  {
    id: "e-sports",
    name: "E-sports 5v5",
    members: 5,
    description: "5 pemain per skuad, misalnya Mobile Legends atau Valorant.",
    labelPrefix: "Skuad",
  },
  {
    id: "tarik-tambang",
    name: "Tarik tambang",
    members: 8,
    description: "8 orang per sisi.",
    labelPrefix: "Regu",
  },
  {
    id: "tenis-meja-beregu",
    name: "Beregu",
    members: 4,
    description: "4 orang per regu untuk pertandingan beregu.",
    labelPrefix: "Regu",
  },
];

export function getGame(id) {
  return GAMES.find((game) => game.id === id) || GAMES[0];
}

export function suggestedTeamCount(participantCount, membersPerTeam) {
  const size = Number(membersPerTeam);
  if (!Number.isInteger(size) || size < 1) return 1;
  return Math.max(1, Math.floor(Number(participantCount) / size) || 1);
}
