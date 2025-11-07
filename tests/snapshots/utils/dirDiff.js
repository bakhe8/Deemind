import fs from "fs";
import path from "path";
import crypto from "crypto";
import { normalizeText, normalizeJson, isJsonFile } from "./normalize.js";

export function listFiles(root, includeExts, ignoreGlobs=[]) {
  const acc = [];
  walk(root, acc, includeExts, ignoreGlobs, root);
  acc.sort();
  return acc;
}

function walk(dir, acc, includeExts, ignoreGlobs, root) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel  = path.relative(root, full);
    if (shouldIgnore(rel, ignoreGlobs)) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      walk(full, acc, includeExts, ignoreGlobs, root);
    } else {
      if (!includeExts.length || includeExts.includes(path.extname(name))) {
        acc.push(rel);
      }
    }
  }
}

function shouldIgnore(rel, ignoreGlobs) {
  return ignoreGlobs.some(g => globLike(rel, g));
}

function globLike(str, pat) {
  const esc = s => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const rx = "^" + pat.split("**").map(part => esc(part).replace(/\\\*/g, "[^/]*")).join(".*") + "$";
  return new RegExp(rx).test(str);
}

export function compareFiles(aRoot, bRoot, relPath, ignoreJsonKeys = [], normalizeWhitespace = true) {
  const aBuf = fs.readFileSync(path.join(aRoot, relPath), "utf8");
  const bBuf = fs.readFileSync(path.join(bRoot, relPath), "utf8");

  let aNorm, bNorm;
  if (isJsonFile(relPath)) {
    aNorm = normalizeJson(aBuf, ignoreJsonKeys);
    bNorm = normalizeJson(bBuf, ignoreJsonKeys);
  } else {
    aNorm = normalizeText(aBuf, { normalizeWhitespace });
    bNorm = normalizeText(bBuf, { normalizeWhitespace });
  }
  if (aNorm === bNorm) return null;

  const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
  return {
    file: relPath,
    expectedHash: hash(bNorm),
    actualHash: hash(aNorm),
    expectedPreview: bNorm.slice(0, 300),
    actualPreview: aNorm.slice(0, 300)
  };
}

