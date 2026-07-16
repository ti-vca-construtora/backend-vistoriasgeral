const BRAZIL_PHONE_PATTERN = /^55\d{10,11}$/;

function expandNumericNotation(value: string) {
  const normalized = value.replace(',', '.');
  if (!/[.e]/i.test(normalized)) return value;
  if (!/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(normalized)) return value;

  const numeric = Number(normalized);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) return value;
  return numeric.toFixed(0);
}

export function normalizeBrazilPhone(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  const raw = String(value).trim();
  if (!raw) return undefined;

  const digits = expandNumericNotation(raw).replace(/\D/g, '');
  const candidates = [digits];

  if (digits.startsWith('00')) candidates.push(digits.slice(2));
  if (digits.startsWith('0')) {
    candidates.push(digits.slice(1));
    // 0 + codigo da operadora + DDD + numero.
    if (digits.length >= 13) candidates.push(digits.slice(3));
  }

  for (const candidate of candidates) {
    if (BRAZIL_PHONE_PATTERN.test(candidate)) return candidate;
    if (/^\d{10,11}$/.test(candidate)) return `55${candidate}`;
  }

  return digits || raw;
}

export function isValidBrazilPhone(value: string | undefined) {
  return value === undefined || BRAZIL_PHONE_PATTERN.test(value);
}
