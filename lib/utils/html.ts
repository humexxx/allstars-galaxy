/**
 * Text out of HTML a feed or a page hands over: entities decoded (numeric,
 * the common named ones, accented letters), tags dropped, spaces collapsed.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  szlig: "ß",
  oslash: "ø",
  Oslash: "Ø",
  aelig: "æ",
  AElig: "Æ",
};

/** The diacritic each accented-letter entity puts on its letter: `&eacute;` is e + ◌́. */
const COMBINING: Record<string, string> = {
  acute: "́",
  grave: "̀",
  circ: "̂",
  tilde: "̃",
  uml: "̈",
  ring: "̊",
  cedil: "̧",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    const named = NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()];
    if (named) return named;
    const accented = /^([a-z])(acute|grave|circ|tilde|uml|ring|cedil)$/i.exec(body);
    return accented ? `${accented[1]}${COMBINING[accented[2].toLowerCase()]}`.normalize("NFC") : whole;
  });
}

/** An element's words: tags dropped, entities decoded, spaces collapsed. */
export function htmlText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}
