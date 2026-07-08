export type Role =
  | "merlin"
  | "percival"
  | "loyal"
  | "morgana"
  | "mordred"
  | "oberon"
  | "assassin"
  | "minion";

export type Alignment = "good" | "evil";

export type OptionalRole = "percival" | "morgana" | "mordred" | "oberon";

export type Phase =
  | "lobby"
  | "team-building"
  | "voting"
  | "mission"
  | "assassin"
  | "finished";

export type Player = {
  userId: string;
  name: string;
  token: string;
  role?: Role;
  joinedAt: number;
};

export type MissionResult = {
  team: string[];
  fails: number;
  passed: boolean;
};

export type GameState = {
  phase: Phase;
  players: Player[];
  optionalRoles: OptionalRole[];
  leaderIndex: number;
  round: number; // 0-indexed mission number, 0-4
  proposalCount: number; // proposals attempted this round (0-4, 5th auto-approves in some variants; we use reject-streak instead)
  team: string[]; // userIds proposed for current mission
  votes: Record<string, boolean>; // userId -> approve/reject for current proposal
  missionCards: Record<string, boolean>; // userId -> success/fail for current mission
  missionResults: MissionResult[];
  rejectStreak: number;
  assassinTarget?: string;
  winner?: Alignment;
  winReason?: string;
};

export type GameRow = {
  id: string;
  lineGroupId: string;
  status: "lobby" | "in_progress" | "finished";
  state: GameState;
};
