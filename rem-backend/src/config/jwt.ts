// The old fallback value is in the git history, so anyone could sign a valid token with it.
const LEAKED_SECRET = 'SuperSecretKeyREM2026!';

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET manquant : le serveur refuse de démarrer sans secret de signature.');
  }
  if (secret === LEAKED_SECRET) {
    throw new Error('JWT_SECRET utilise l ancienne valeur publique : générez-en un nouveau (openssl rand -base64 48).');
  }
  return secret;
};
