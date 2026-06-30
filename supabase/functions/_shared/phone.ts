export function normalizeSaudiPhone(input: unknown) {
  const digits = String(input ?? '').replace(/\D/g, '');
  let local = digits;

  if (local.startsWith('00966')) local = local.slice(5);
  if (local.startsWith('966')) local = local.slice(3);
  if (local.startsWith('0')) local = local.slice(1);

  if (local.length === 9 && local.startsWith('5')) return `0${local}`;
  return digits;
}

export function phoneVariants(input: unknown) {
  const normalized = normalizeSaudiPhone(input);
  const digits = normalized.replace(/\D/g, '');
  const local = digits.startsWith('0') ? digits.slice(1) : digits;

  return Array.from(new Set([
    normalized,
    digits,
    local,
    local ? `0${local}` : '',
    local ? `966${local}` : '',
    local ? `+966${local}` : '',
    local ? `00966${local}` : '',
  ].filter(Boolean)));
}

export function isValidSaudiMobile(input: unknown) {
  return /^05\d{8}$/.test(normalizeSaudiPhone(input));
}
