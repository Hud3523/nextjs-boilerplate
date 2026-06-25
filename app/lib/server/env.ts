// Server-only credential access. These values come from environment variables
// (e.g. .env.local in dev, secret store in prod) and must NEVER reach the client.
// Only import this from server code (route handlers / server modules).

export function env(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

/** True when every listed env var is present and non-empty. */
export function hasEnv(...keys: string[]): boolean {
  return keys.every((k) => env(k) !== undefined);
}
