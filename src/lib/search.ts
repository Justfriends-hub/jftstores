/**
 * Strip characters that PostgREST treats as filter syntax so user-typed search
 * text can never inject extra filter clauses into an `.or(...)` string.
 */
export function sanitizeSearchTerm(input: string, maxLength = 80): string {
  return input
    .replace(/[,().:*%\\"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
