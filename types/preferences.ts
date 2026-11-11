/** Who the module mascot is drawn as. The first one is the app's own figure and the default. */
export const MASCOT_CHARACTERS = [
  "explorer",
  "link",
  "pikachu",
  "mario",
  "goku",
  "naruto",
  "messi",
  "einstein",
  "buffett",
] as const;

export type MascotCharacter = (typeof MASCOT_CHARACTERS)[number];

export const DEFAULT_MASCOT_CHARACTER: MascotCharacter = "explorer";

export const MASCOT_CHARACTER_LABELS: Record<MascotCharacter, string> = {
  explorer: "Explorer",
  link: "Link",
  pikachu: "Pikachu",
  mario: "Mario",
  goku: "Goku",
  naruto: "Naruto",
  messi: "Messi",
  einstein: "Einstein",
  buffett: "Buffett",
};

export type UserPreferences = {
  showContextAvatar: boolean;
  mascotCharacter: MascotCharacter;
  /** Net-worth milestones annotated on the projection charts. */
  financeMilestones: number[];
};
