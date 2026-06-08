const PREPOSICOES = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas",
  "a", "ao", "por", "para", "com", "sem", "sob",
]);

/** Converte para Title Case respeitando preposicoes portuguesas. */
export function toTitleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && PREPOSICOES.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Chave de comparacao normalizada: minusculo + sem acentos.
 * Usada para agrupamento e deduplicacao, nao para exibicao.
 * Filtra codigo 768-879 (combining diacritical marks Unicode block).
 */
export function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 768 || code > 879;
    })
    .join("");
}
