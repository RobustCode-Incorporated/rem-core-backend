// The secret that signs every session token. A missing or short secret stops the
// server: with a known default, anyone could sign a token for any company.
const MIN_LENGTH = 32;

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_LENGTH) {
    throw new Error(
      `JWT_SECRET must be set to a random value of at least ${MIN_LENGTH} characters.`,
    );
  }
  return secret;
}
