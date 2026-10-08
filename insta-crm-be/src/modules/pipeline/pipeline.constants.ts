export const DEFAULT_PIPELINE_STAGES = [
  {
    name: "New",
    position: 0,
    color: "#64748b",
    isWon: false,
    isLost: false,
  },
  {
    name: "Contacted",
    position: 1,
    color: "#0284c7",
    isWon: false,
    isLost: false,
  },
  {
    name: "Quoted",
    position: 2,
    color: "#7c3aed",
    isWon: false,
    isLost: false,
  },
  {
    name: "Negotiation",
    position: 3,
    color: "#d97706",
    isWon: false,
    isLost: false,
  },
  {
    name: "Won",
    position: 4,
    color: "#059669",
    isWon: true,
    isLost: false,
  },
  {
    name: "Lost",
    position: 5,
    color: "#dc2626",
    isWon: false,
    isLost: true,
  },
] as const;
