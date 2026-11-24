/**
 * PUBLIC key used to verify licenses (Ed25519, 32 bytes in hex).
 *
 * It is safe to publish: it can only VERIFY licenses, never create them.
 * Generate your key pair ONCE with:   npm run license:keygen
 * That command writes your public key here and keeps the PRIVATE key in
 * .license/private-key.json (excluded from git). Back that file up safely:
 * if you lose it you cannot issue new licenses for this public key.
 */
export const LICENSE_PUBLIC_KEY_HEX = "7223561dfb96a71b6ff4017fb9a364b724153fd05e5167342a0a4163b86a327a";
