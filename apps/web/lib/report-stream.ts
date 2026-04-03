/**
 * Best-effort extraction of the `report` string value from a partial JSON
 * tool-call arguments payload (streaming).
 */
export function extractPartialReportFromToolArgs(args: string): string | null {
  const key = '"report"';
  const idx = args.indexOf(key);
  if (idx === -1) return null;
  const afterKey = args.slice(idx + key.length);
  const colon = afterKey.indexOf(':');
  if (colon === -1) return null;
  const rest = afterKey.slice(colon + 1).trimStart();
  if (!rest.startsWith('"')) return null;
  let i = 1;
  let out = '';
  while (i < rest.length) {
    const c = rest[i];
    if (c === '\\' && i + 1 < rest.length) {
      const n = rest[i + 1];
      if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else if (n === 'r') out += '\r';
      else if (n === '"') out += '"';
      else if (n === '\\') out += '\\';
      else out += n;
      i += 2;
      continue;
    }
    if (c === '"') break;
    out += c;
    i++;
  }
  return out;
}
