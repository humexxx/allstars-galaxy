/** Lower-cased and without accents, so a search for "maria" finds "María". */
export function foldForSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
