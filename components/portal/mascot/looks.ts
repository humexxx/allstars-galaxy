/**
 * Who the hero can be drawn as. Every character stands on the same rig — the
 * same joints, the same hands and feet, so every scene plays unchanged — and
 * differs in what is painted on it: a head, a palette, and whatever it wears
 * or carries on its back.
 *
 * Details are placed on the sprite grid (multiples of `PX`): a feature that
 * covers no square's middle is not drawn at all.
 */
import type { MascotCharacter } from "@/types/preferences";

import { add, all, any, box, circle, not, on, poly, type Layer, type Shape } from "./sprite";

export type HeroFace = "calm" | "happy" | "tired";

export type Look = {
  /** Colour by role. A role ending in `2` is the shade the far limbs take. */
  palette: Record<string, string>;
  head: (face: HeroFace) => Layer[];
  /** Painted on the torso, then around the neck. */
  torso?: Layer[];
  /** What rides on the back, where the explorer wears a pack. */
  back?: Layer[];
  /** Painted on the near arm; the far arm takes the same, shaded. */
  arm?: Layer[];
  /** Painted on the near leg and shoe; the far leg takes the same, shaded. */
  leg?: Layer[];
  /** The role the hands are painted in, when not bare skin. */
  hand?: string;
};

const SKULL = circle(1, -46, 14.5);
const above = (y0: number): Shape => (_x, y) => y < y0;
const below = (y0: number): Shape => (_x, y) => y > y0;

const skull = (): Layer[] => [add("skin", SKULL), on("skin2", all(SKULL, not(circle(1, -50, 15.5))))];

const rightOf = (x0: number): Shape => (x) => x > x0;

type FaceOptions = { eye?: string; glint?: boolean; brow?: string; mouth?: boolean; eyes?: boolean };

/** Two eyes and a mouth, on the side of the head the hero faces. */
function features(face: HeroFace, { eye = "ink", glint = false, brow, mouth = true, eyes = true }: FaceOptions = {}): Layer[] {
  const layers: Layer[] = [];
  if (!eyes) {
    // The character draws its own.
  } else if (face === "tired") {
    layers.push(on("ink", box(4.5, -43.5, 7.5, -42)), on("ink", box(10.5, -43.5, 13.5, -42)));
  } else {
    layers.push(on(eye, box(4.5, -45, 7.5, -40.5)), on(eye, box(10.5, -45, 13.5, -40.5)));
    if (eye !== "ink") {
      layers.push(on("ink", box(4.5, -45, 7.5, -43.5)), on("ink", box(10.5, -45, 13.5, -43.5)));
    }
    if (glint) layers.push(on("white", box(4.5, -45, 6, -43.5)), on("white", box(10.5, -45, 12, -43.5)));
  }
  if (brow) layers.push(on(brow, box(3, -48, 7.5, -46.5)), on(brow, box(10.5, -48, 15, -46.5)));
  if (mouth) {
    layers.push(on("ink", box(9, -37.5, 12, -36)));
    if (face === "happy") layers.push(on("ink", box(7.5, -39, 9, -37.5)), on("ink", box(12, -39, 13.5, -37.5)));
  }
  return layers;
}

const SKIN = { skin: "#FFD9B8", skin2: "#F0B48C", white: "#FFFFFF" } as const;

const CAP = poly(-13.5, -50, -13, -57, -9, -62, -3, -64.3, 3, -64, 10, -62.5, 14.5, -58, 16, -51.5, 8, -53.3, 1, -53.5, -6, -52.3);

const explorer: Look = {
  palette: {
    ...SKIN,
    hair: "#7A4A2B",
    hair2: "#5A331C",
    hat: "#465070",
    hat2: "#333B56",
    top: "#5B6CF0",
    top2: "#4350C4",
    pants: "#3F4566",
    pants2: "#2F3450",
    shoe: "#F0554D",
    shoe2: "#C43D36",
    pack: "#F59E42",
    pack2: "#D67C22",
    gold: "#FFC83D",
    gold0: "#FFF1B8",
  },
  head: (face) => [
    ...skull(),
    on("skin2", poly(-3, -53, 7, -54.6, 15.6, -51, 15.2, -48.5, 7, -51, -3, -49.6)),
    add(
      "hair",
      poly(-7, -58, -12, -55, -14.5, -50, -14.5, -45, -13, -36, -11, -33.5, -8.5, -38, -5.5, -34.5, -4.5, -40.5, -1.5, -38.5, -1.5, -45, 2, -49.5, 4, -45.5, 7, -50, 9.5, -47, 13, -53, 10, -59)
    ),
    on("hair2", poly(-14.5, -46, -13, -36, -11, -33.5, -8.5, -38, -5.5, -34.5, -4.5, -40.5, -2.5, -39.2, -9, -41)),
    ...features(face),
    add("hat", CAP),
    on("hat2", poly(-13.5, -50, -13, -57, -9, -62, -3, -64.3, 3, -64, -3.5, -62.5, -8, -58, -8.4, -51.6)),
    on("hat2", poly(-13.5, -50, -6, -52.3, 1, -53.5, 8, -53.3, 16, -51.5, 16, -54.5, 8, -56.3, 1, -56.5, -6, -55.3, -13.5, -53)),
    add("hat2", poly(11, -54, 17, -55, 24, -53.5, 25, -50.5, 21, -49.5, 12.5, -50.5)),
    on("gold", any(box(1.5, -63, 3, -61.5), box(0, -61.5, 3, -60), box(1.5, -60, 4.5, -58.5), box(1.5, -58.5, 3, -57))),
  ],
  torso: [
    on("white", box(-6, -24, 9, -22.5)),
    on("top2", box(3, -28.5, 4.5, -16.5)),
    add("top2", box(-8.5, -34, 8.5, -28.5, 2.6)),
    on("white", box(4.5, -34, 8.5, -28.5)),
  ],
  back: [
    add("pack", box(-18, -31, -7, -15, 4)),
    on("pack2", box(-18, -22.5, -7, -15)),
    on("gold0", box(-16.5, -25.5, -13.5, -21)),
  ],
  arm: [on("top2", box(-4, -21, 2.5, -16))],
  leg: [on("white", box(1.5, -4.5, 4.5, 0))],
};

const link: Look = {
  palette: {
    ...SKIN,
    hair: "#F4CC4E",
    hair2: "#C9992C",
    hat: "#4FAE4F",
    hat2: "#2F7F3B",
    top: "#4FAE4F",
    top2: "#2F7F3B",
    under: "#F4F1E4",
    under2: "#D3CDB8",
    pants: "#F4F1E4",
    pants2: "#D3CDB8",
    shoe: "#8A5A33",
    shoe2: "#6A4222",
    hand: "#8A5A33",
    hand2: "#6A4222",
    belt: "#6A4222",
    gold: "#FFC83D",
    shield: "#3B62C4",
    shield2: "#2A4796",
    steel: "#C9CDD8",
    red: "#D64545",
  },
  head: (face) => [
    // The cap's tail hangs behind the head.
    add("hat", poly(-13.5, -57, -8, -62.5, -18, -62, -26, -55, -30, -43.5, -24, -49, -17, -51, -14, -49.5)),
    on("hat2", poly(-14, -49.5, -17, -51, -24, -49, -30, -43.5, -27.5, -51, -21, -56, -13.5, -54.5)),
    ...skull(),
    add("hair", poly(-13.5, -53, -15.5, -44, -14, -36, -10, -32.5, -7, -37.5, -5, -44, -4, -53)),
    on("hair2", poly(-15.5, -44, -14, -36, -10, -32.5, -7, -37.5, -9, -41)),
    add("hair", poly(-6, -57, 15.5, -53, 15, -47.5, 11.5, -51, 8.5, -45.5, 5, -51, 2, -46, 0, -36.5, -3, -38, -3, -50)),
    add("skin", poly(-4.5, -47.5, -16.5, -53.5, -6, -40)),
    on("skin2", poly(-5.5, -46, -12, -50, -6.5, -42.5)),
    ...features(face, { eye: "shield" }),
    add("hat", poly(-14, -49.5, -13.5, -57, -8, -62.5, 0, -65, 8, -63.5, 14, -59, 16.5, -52, 9, -54.5, 0, -55, -7, -53)),
    on("hat2", poly(-14, -49.5, -7, -53, 0, -55, 9, -54.5, 16.5, -52, 16.3, -55, 9, -57.5, 0, -58, -7, -56, -13.8, -52.5)),
  ],
  torso: [
    on("belt", box(-10, -18, 9, -15)),
    on("gold", box(4.5, -18, 7.5, -15)),
    add("under", box(-6, -33, 7, -29, 2)),
  ],
  back: [
    add("shield2", box(-15, -42, -12, -33)),
    add("steel", poly(-20.5, -33, -7, -33, -7, -22, -13.5, -11.5, -20.5, -22)),
    on("shield", poly(-19, -31.5, -8.5, -31.5, -8.5, -22.5, -13.5, -14.5, -19, -22.5)),
    on("gold", poly(-13.7, -30, -10, -24, -17.5, -24)),
    on("red", box(-15, -22.5, -12, -19.5)),
  ],
  arm: [on("under", box(-4, -22.5, 2.5, -16))],
  leg: [on("shoe", box(-8, -9, 0, -3))],
  hand: "hand",
};

const YELLOW = "#FFD93D";
const YELLOW_2 = "#E5AE1B";
const EAR_NEAR = poly(-10, -54.5, -19.5, -75, -2, -59);
const EAR_FAR = poly(4, -59, 13.5, -78, 12.5, -56);

const pikachu: Look = {
  palette: {
    skin: YELLOW,
    skin2: YELLOW_2,
    top: YELLOW,
    top2: YELLOW_2,
    pants: YELLOW,
    pants2: YELLOW_2,
    shoe: YELLOW,
    shoe2: YELLOW_2,
    cheek: "#E8483F",
    brown: "#9A5F2C",
    white: "#FFFFFF",
  },
  head: (face) => [
    add("skin2", EAR_FAR),
    on("ink", all(EAR_FAR, above(-69))),
    add("skin", EAR_NEAR),
    on("ink", all(EAR_NEAR, above(-67.5))),
    ...skull(),
    on("cheek", circle(12.5, -38.5, 3)),
    ...features(face, { glint: true, mouth: false }),
    on("ink", box(9, -42, 10.5, -40.5)),
    on("ink", box(6, -39, 9, -37.5)),
    ...(face === "happy" ? [on("cheek", box(6, -37.5, 9, -36))] : []),
  ],
  torso: [on("brown", box(-10, -27, -4.5, -25.5)), on("brown", box(-10, -22.5, -4.5, -21))],
  back: [
    add("skin", any(box(-16.5, -25.5, -10.5, -19.5), box(-22.5, -33, -13.5, -25.5), poly(-31.5, -48, -15, -43.5, -15, -33, -27, -33))),
    on("skin2", any(box(-16.5, -21, -10.5, -19.5), box(-22.5, -27, -16.5, -25.5), all(box(-28.5, -36, -22.5, -33), below(-34.5)))),
    add("brown", box(-12, -19.5, -7, -15)),
  ],
};

const EAR = [add("skin", circle(-3.5, -43, 2.8)), on("skin2", circle(-3.8, -43, 1.3))];

const mario: Look = {
  palette: {
    ...SKIN,
    hair: "#5A331C",
    hair2: "#3E2212",
    stache: "#2B1B12",
    hat: "#E0352B",
    hat2: "#B3241C",
    top: "#E0352B",
    top2: "#B3241C",
    bib: "#2F5BD6",
    bib2: "#2143A6",
    pants: "#2F5BD6",
    pants2: "#2143A6",
    shoe: "#7A4A2B",
    shoe2: "#5A331C",
    hand: "#FFFFFF",
    hand2: "#D9DCE6",
    gold: "#FFC83D",
    gold2: "#E59A12",
  },
  head: (face) => [
    ...skull(),
    add("hair", poly(-13.5, -52, -15.5, -45, -13.5, -37, -10, -34, -7.5, -38, -6, -44, -5, -52)),
    on("hair2", poly(-15.5, -45, -13.5, -37, -10, -34, -7.5, -38, -10, -41)),
    on("hair", poly(-1.5, -51, 2, -51, 1, -43, -1.5, -44)),
    ...EAR,
    add("skin", circle(16, -39.5, 3.6)),
    on("skin2", all(circle(16, -39.5, 3.6), below(-39))),
    ...features(face, { mouth: false }),
    add("stache", poly(6, -38, 13, -36.5, 18.5, -37, 17.5, -33.5, 11, -32.5, 6.5, -34.5)),
    add("hat", poly(-13.5, -50, -13.5, -57, -9, -62.5, -2, -65, 6, -64.5, 12, -61.5, 15.5, -56, 16.5, -52, 8, -53.5, 0, -53.5, -7, -52)),
    on("hat2", poly(-13.5, -50, -13.5, -57, -9, -62.5, -2, -65, -5, -61, -8.5, -56, -8.5, -51.5)),
    add("hat", poly(10, -55, 18, -56, 25, -54, 26.5, -50.5, 20, -50, 12, -50.5)),
    on("hat2", poly(11, -52, 26.5, -52, 26.5, -50, 12, -50)),
    on("white", circle(8.25, -59.25, 3.9)),
    on("hat", any(box(6, -61.5, 7.5, -57), box(9, -61.5, 10.5, -57), box(7.5, -60, 9, -58.5))),
  ],
  torso: [
    on("bib", box(-10, -24, 9, -12)),
    on("bib", box(-7.5, -31, -4.5, -24)),
    on("bib", box(1.5, -31, 4.5, -24)),
    on("bib2", box(-10, -16.5, 9, -12)),
    on("gold", box(-7.5, -24, -6, -22.5)),
    on("gold", box(3, -24, 4.5, -22.5)),
  ],
  back: [
    add("gold", poly(-7, -31, -12, -30, -19, -21, -22, -11.5, -12, -14, -7, -18)),
    on("gold2", poly(-22, -11.5, -12, -14, -7, -18, -7, -21, -13, -17.5, -20.5, -15.5)),
  ],
  hand: "hand",
};

const goku: Look = {
  palette: {
    ...SKIN,
    hair: "#23202E",
    top: "#F07A1A",
    top2: "#C95C0E",
    under: "#2B4FBF",
    under2: "#1E3A94",
    pants: "#F07A1A",
    pants2: "#C95C0E",
    shoe: "#2B4FBF",
    shoe2: "#1E3A94",
    gold: "#FFC83D",
    pole: "#D64545",
    pole2: "#A82F2F",
  },
  head: (face) => [
    add(
      "hair",
      poly(-13, -40, -22, -37, -17, -45, -27, -48, -18, -53, -26, -62, -14, -60, -15, -72, -5, -64, 0, -76, 5, -64.5, 13, -72, 12, -61, 20, -62, 15.5, -53, -5, -50)
    ),
    ...skull(),
    add("hair", poly(-14, -44, -13, -56, -5, -62, 6, -62, 15, -57, 16, -51, 12.5, -49.5, 10.5, -54, 8, -48.5, 4.5, -54, 1.5, -48, -1.5, -53, -3, -44, -6, -38, -10, -34, -13.5, -39)),
    ...EAR,
    ...features(face, { brow: "ink" }),
  ],
  torso: [
    on("under", box(-10, -18, 9, -15)),
    on("under2", box(4.5, -18, 7.5, -13.5)),
    add("under", box(-6, -33, 7, -29.5, 2)),
  ],
  back: [
    add("pole", poly(-24, -13.5, -21, -13.5, -7, -45, -10, -45)),
    on("pole2", poly(-24, -13.5, -21, -13.5, -18, -20, -21, -20)),
  ],
  arm: [on("under", box(-4, -27, 2.5, -24)), on("skin", box(-4, -24, 2.5, -16)), on("under", box(-4, -19.5, 2.5, -16.5))],
  leg: [on("shoe", box(-8, -9, 0, -3)), on("gold", box(-7, -7.5, 0, -6))],
};

const naruto: Look = {
  palette: {
    ...SKIN,
    hair: "#FFD23F",
    hair2: "#E0A51A",
    eye: "#2F7FD6",
    band: "#34529E",
    band2: "#233A75",
    steel: "#C9CDD8",
    top: "#F58220",
    top2: "#CC6410",
    blue: "#2F56B8",
    blue2: "#213F8C",
    pants: "#F58220",
    pants2: "#CC6410",
    shoe: "#2F56B8",
    shoe2: "#213F8C",
    scroll: "#EDE6CC",
    scroll2: "#CFC6A6",
    red: "#D64545",
  },
  head: (face) => [
    add("band", poly(-13, -52, -22, -50, -27, -44, -24, -43, -19, -47, -13, -48)),
    add("band2", poly(-13, -50, -20, -46, -22, -39, -19, -39, -17, -44, -13, -47)),
    add("hair", poly(-13.5, -48, -22, -52, -16, -56, -22, -64, -12, -61, -11, -71, -3, -64, 2, -73, 6, -64, 14, -70, 13, -60, 20, -60, 15, -53)),
    ...skull(),
    add("hair", poly(-14, -46, -13, -56, -5, -61, 8, -61, 15.5, -56, 15.5, -53, -3, -53, -4, -46, -6, -41, -9, -43.5, -11, -38, -13.5, -42)),
    on("hair2", poly(-14, -46, -4, -46, -6, -41, -9, -43.5, -11, -38, -13.5, -42)),
    ...EAR,
    add("band", poly(-13.8, -50, -6, -52.5, 3, -53.5, 16, -51.5, 16, -56, 3, -58, -6, -57, -13.8, -54.5)),
    on("steel", box(4.5, -57, 13.5, -52.5)),
    on("ink", box(7.5, -55.5, 10.5, -54)),
    ...features(face, { eye: "eye" }),
    on("ink", box(0, -42, 3, -40.5)),
    on("ink", box(0, -39, 3, -37.5)),
  ],
  torso: [
    on("blue", box(-10, -31, 9, -27)),
    on("top2", box(3, -27, 4.5, -13.5)),
    add("white", box(-7.5, -34, 8, -29.5, 2.2)),
  ],
  back: [
    add("scroll", box(-19.5, -28.5, -7, -16.5, 2)),
    on("scroll2", box(-19.5, -19.5, -7, -16.5)),
    on("red", box(-15, -28.5, -12, -16.5)),
  ],
  arm: [on("blue", box(-4, -29, 2.5, -25.5)), on("top2", box(-4, -19.5, 2.5, -16))],
  leg: [on("skin", box(1.5, -3, 4.5, 0))],
};

const messi: Look = {
  palette: {
    ...SKIN,
    hair: "#5A3A22",
    hair2: "#3F2714",
    beard: "#8C5A34",
    top: "#7CC4F0",
    top2: "#57A3D6",
    pants: "#1F2333",
    pants2: "#151824",
    sock: "#FFFFFF",
    sock2: "#D9DCE6",
    shoe: "#FF6B35",
    shoe2: "#D14F1E",
    gold: "#FFC83D",
    ball2: "#D9DCE6",
  },
  head: (face) => [
    ...skull(),
    add("hair", poly(-13.5, -49, -14, -56, -9, -61.5, 0, -63.5, 9, -62, 15, -57, 16, -52, 12, -54.5, 6, -56, 0, -55.5, -3, -52, -4, -46, -6, -42, -9, -43, -12, -40)),
    on("hair2", poly(-13.5, -49, -4, -49, -4, -46, -6, -42, -9, -43, -12, -40)),
    ...EAR,
    on("beard", all(SKULL, any(all(below(-39), rightOf(-5)), box(-5, -42, 1.5, -39)))),
    on("skin", box(7.5, -37.5, 13.5, -36)),
    ...features(face),
  ],
  torso: [
    on("white", box(-7.5, -31, -4.5, -12)),
    on("white", box(-1.5, -31, 1.5, -12)),
    on("white", box(4.5, -31, 7.5, -12)),
    add("white", box(-5, -33, 6.5, -30, 1.5)),
  ],
  back: [
    add("white", circle(-14, -22, 6.2)),
    on("ball2", all(circle(-14, -22, 6.2), below(-18.5))),
    on("ink", any(box(-15, -24, -12, -21), box(-19.5, -21, -18, -18), box(-10.5, -28.5, -9, -25.5), box(-18, -28.5, -16.5, -27), box(-12, -18, -9, -16.5))),
  ],
  arm: [on("skin", box(-4, -22.5, 2.5, -16))],
  leg: [on("skin", box(-7, -10.5, 0, -9)), on("sock", box(-7, -9, 0, -3))],
};

const CLOUD = any(
  circle(-11, -57, 7),
  circle(-2, -61, 7),
  circle(7, -60.5, 6.5),
  circle(14, -56, 5),
  circle(-16, -49, 6.5),
  circle(-15, -40, 5.5),
  circle(-19, -55, 4.5),
  circle(18.5, -52, 3)
);

const einstein: Look = {
  palette: {
    skin: "#F5CDB0",
    skin2: "#DDA587",
    white: "#FFFFFF",
    hair: "#F4F4F8",
    hair2: "#C2C6D6",
    top: "#9A7B5B",
    top2: "#77593D",
    pants: "#4A4E63",
    pants2: "#363A4D",
    shoe: "#5A3A22",
    shoe2: "#3F2714",
    tongue: "#F27B8B",
    case: "#7A4A2B",
    case2: "#5A331C",
    gold: "#FFC83D",
  },
  head: (face) => [
    add("hair", CLOUD),
    on("hair2", (x, y) => CLOUD(x, y) && !CLOUD(x + 1.5, y - 3)),
    ...skull(),
    on("hair", poly(-14, -44, -14, -56, -6, -61, 5, -61.5, 10, -58, 2, -56, -3, -51, -4, -45, -7, -40, -11, -36)),
    on("hair2", poly(-14, -44, -4, -45, -7, -40, -11, -36)),
    ...EAR,
    add("skin", circle(15.5, -41, 2.6)),
    ...features(face, { brow: "hair", mouth: false }),
    add("hair", poly(5.5, -39, 16.5, -39.5, 17, -36, 6.5, -35.5)),
    on("hair2", box(6, -37.5, 17, -36)),
    ...(face === "happy" ? [add("tongue", box(9, -36, 12, -33))] : []),
  ],
  torso: [on("top2", box(3, -28.5, 4.5, -13.5)), add("white", box(-6, -33, 7, -29.5, 2))],
  back: [add("case", box(-18, -29, -7, -15, 3)), on("case2", box(-18, -21, -7, -15)), on("gold", box(-13.5, -24, -12, -21))],
  arm: [on("top2", box(-4, -21, 2.5, -16))],
};

const buffett: Look = {
  palette: {
    skin: "#F7CFB4",
    skin2: "#E0A98C",
    white: "#FFFFFF",
    hair: "#E9EAF0",
    hair2: "#BFC3D2",
    glass: "#BFE3F5",
    top: "#27324F",
    top2: "#1B2338",
    tie: "#C9302C",
    pants: "#27324F",
    pants2: "#1B2338",
    shoe: "#1E1E28",
    shoe2: "#14141B",
    case: "#7A4A2B",
    case2: "#5A331C",
    gold: "#FFC83D",
  },
  head: (face) => [
    ...skull(),
    add("hair", poly(-13.5, -50, -14.5, -44, -13, -36.5, -10, -34, -7.5, -39, -5.5, -45, -4.5, -52, 2, -56.5, 10, -57.5, 14, -56, 12, -60.5, 5, -63, -3, -63, -10, -60)),
    on("hair2", poly(-14.5, -44, -13, -36.5, -10, -34, -7.5, -39, -5.5, -45)),
    ...EAR,
    on("glass", box(3, -45, 9, -39)),
    on("glass", box(10.5, -45, 15, -39)),
    ...(face === "tired"
      ? [on("ink", box(4.5, -42, 7.5, -40.5)), on("ink", box(10.5, -42, 13.5, -40.5))]
      : [on("ink", box(6, -43.5, 7.5, -40.5)), on("ink", box(12, -43.5, 13.5, -40.5))]),
    on("ink", box(3, -46.5, 15, -45)),
    on("ink", box(9, -45, 10.5, -43.5)),
    on("ink", box(-3, -46.5, 3, -45)),
    ...features(face, { eyes: false }),
  ],
  torso: [
    on("white", poly(1.5, -31, 9, -31, 9, -21, 6, -21)),
    on("tie", box(6, -30, 7.5, -19.5)),
    on("top2", box(4.5, -18, 6, -16.5)),
    add("white", box(-5, -33, 7, -30, 1.5)),
  ],
  back: [
    add("case2", box(-18, -28.5, -12, -24)),
    add("case", box(-21, -25.5, -9, -15, 1.5)),
    on("case2", box(-21, -18, -9, -15)),
    on("gold", box(-16.5, -22.5, -13.5, -21)),
  ],
  arm: [on("white", box(-4, -18, 2.5, -16.5))],
};

export const LOOKS: Record<MascotCharacter, Look> = {
  explorer,
  link,
  pikachu,
  mario,
  goku,
  naruto,
  messi,
  einstein,
  buffett,
};
