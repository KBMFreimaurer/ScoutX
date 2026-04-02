export const JUGEND_KLASSEN = [
  { id: "bambini", label: "Bambini", alter: "4–6", kurz: "Bam", turnier: true },
  { id: "f-jugend", label: "F-Jugend", alter: "7–8", kurz: "F", turnier: true },
  { id: "e-jugend", label: "E-Jugend", alter: "9–10", kurz: "E", turnier: false },
  { id: "d-jugend", label: "D-Jugend", alter: "11–12", kurz: "D", turnier: false },
  { id: "c-jugend", label: "C-Jugend", alter: "13–14", kurz: "C", turnier: false },
  { id: "b-jugend", label: "B-Jugend", alter: "15–16", kurz: "B", turnier: false },
  { id: "a-jugend", label: "A-Jugend", alter: "17–18", kurz: "A", turnier: false },
];

export const KICKOFF_ZEITEN = {
  bambini: ["09:00", "10:00", "10:30", "11:00"],
  "f-jugend": ["09:00", "10:00", "11:00", "12:00"],
  "e-jugend": ["09:00", "10:00", "11:00", "12:00"],
  "d-jugend": ["10:00", "11:00", "13:00", "14:00"],
  "c-jugend": ["11:00", "13:00", "14:00", "15:00"],
  "b-jugend": ["13:00", "14:00", "15:00", "15:30"],
  "a-jugend": ["14:00", "15:00", "15:30", "17:00"],
};
