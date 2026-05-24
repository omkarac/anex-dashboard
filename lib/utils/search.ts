/**
 * Sanitize a user-supplied search term before interpolating it into a PostgREST
 * `.or()` / `.filter()` expression.
 *
 * Values passed to `.eq()`/`.ilike(col, value)` are parameterized by PostgREST
 * and safe, but the string argument to `.or(...)` is a raw filter EXPRESSION —
 * commas start new conditions, parens group, and `{}` delimit arrays. A term
 * containing those characters can break out of the intended predicate. We strip
 * the PostgREST metacharacters (and wildcards, so callers control matching).
 */
export function sanitizePostgrestTerm(raw: string): string {
  return raw
    .trim()
    .replace(/[,(){}*\\%"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
