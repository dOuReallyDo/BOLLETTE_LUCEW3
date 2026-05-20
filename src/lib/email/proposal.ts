/**
 * Generate a 6-character redemption code [A-Z2-9]
 * Excludes ambiguous: 0/O, 1/I/L
 */
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRedemptionCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return code;
}