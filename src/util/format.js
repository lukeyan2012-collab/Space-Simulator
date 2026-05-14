// Number formatting that uses `× 10^N` notation (or HTML superscript) instead of `e+N` /
// `e-N`. Below ~1e4 in magnitude we just show fixed-decimal; very small (< 1e-2) and very
// large numbers get switched to scientific form.
//
// fmtNum(n)      — returns HTML with <sup> for the exponent (use in innerHTML contexts)
// fmtNumPlain(n) — returns plain text like "1.50 × 10^23"  (use in textContent contexts)
const NORMAL_HI = 1e4;
const NORMAL_LO = 1e-2;

function split(n) {
  const abs = Math.abs(n);
  const exp = Math.floor(Math.log10(abs));
  const mantissa = n / Math.pow(10, exp);
  return { mantissa, exp };
}

export function fmtNum(n, mantissaDigits = 2) {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= NORMAL_LO && abs < NORMAL_HI) return n.toFixed(3);
  const { mantissa, exp } = split(n);
  return `${mantissa.toFixed(mantissaDigits)} × 10<sup>${exp}</sup>`;
}

export function fmtNumPlain(n, mantissaDigits = 2) {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= NORMAL_LO && abs < NORMAL_HI) return n.toFixed(3);
  const { mantissa, exp } = split(n);
  return `${mantissa.toFixed(mantissaDigits)} × 10^${exp}`;
}
