/**
 * Typed Result for core logic. Errors are values, not exceptions; only the
 * outermost shells (route handlers, server actions) translate them to HTTP
 * responses or redirects.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function err<E>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}
