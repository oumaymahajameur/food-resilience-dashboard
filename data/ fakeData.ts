// data/fakeData.ts

export const piliers = [
  { id: "cpi",       label: "CPI alimentaire",   score: 72, poids: 0.30, evolution: +2.3 },
  { id: "acces",     label: "Accessibilité",      score: 61, poids: 0.25, evolution: -1.1 },
  { id: "transport", label: "Transport",          score: 59, poids: 0.20, evolution: +4.0 },
  { id: "economie",  label: "Forces économiques", score: 65, poids: 0.25, evolution: -0.8 },
];

export const pays = [
  { nom: "Maroc",    cpi: 70, acces: 65, transport: 60, economie: 72 },
  { nom: "Tunisie",  cpi: 68, acces: 63, transport: 58, economie: 68 },
  { nom: "Égypte",   cpi: 62, acces: 58, transport: 55, economie: 64 },
  { nom: "Sénégal",  cpi: 48, acces: 45, transport: 42, economie: 50 },
  { nom: "Éthiopie", cpi: 38, acces: 35, transport: 30, economie: 40 },
];

export const tendance = [
  { annee: "2019", cpi: 65, acces: 60, transport: 50, economie: 68 },
  { annee: "2020", cpi: 62, acces: 55, transport: 51, economie: 60 },
  { annee: "2021", cpi: 66, acces: 58, transport: 53, economie: 62 },
  { annee: "2022", cpi: 69, acces: 63, transport: 55, economie: 66 },
  { annee: "2023", cpi: 71, acces: 62, transport: 57, economie: 66 },
  { annee: "2024", cpi: 72, acces: 61, transport: 59, economie: 65 },
];