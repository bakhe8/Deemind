import path from "path";

export function normalizeText(s, { normalizeWhitespace = true } = {}) {
  let out = s.replace(/\r\n/g, "\n");
  if (normalizeWhitespace) {
    out = out.replace(/[ \t]+$/gm, "");
    out = out.replace(/\n{3,}/g, "\n\n");
  }
  return out.trim();
}

export function normalizeJson(jsonStr, ignoreKeys = []) {
  try {
    const obj = JSON.parse(jsonStr);
    const scrubbed = scrub(obj, new Set(ignoreKeys));
    return JSON.stringify(scrubbed, null, 2);
  } catch {
    return jsonStr;
  }
}

function scrub(v, ignore) {
  if (Array.isArray(v)) return v.map(x => scrub(x, ignore));
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (ignore.has(k)) continue;
      out[k] = scrub(v[k], ignore);
    }
    return out;
  }
  return v;
}

export function isJsonFile(p) {
  return path.extname(p).toLowerCase() === ".json";
}

