#!/usr/bin/env ts-node
import fs from "fs-extra";
import path from "path";
import Ajv from "ajv";

const ROOT = process.cwd();
const schemaMap: Record<string, string> = {
  theme: path.join(ROOT, "core", "salla", "schema.json"),
  canonical: path.join(ROOT, "core", "contracts", "theme-contract.json"),
};

function parseArgs() {
  const args = process.argv.slice(2);
  if (!args.length) {
    throw new Error("Usage: npm run validate:theme -- <file> [--schema=theme|canonical]");
  }
  const file = args[0];
  let schemaKey: keyof typeof schemaMap | undefined;
  for (const arg of args.slice(1)) {
    if (arg.startsWith("--schema=")) {
      schemaKey = arg.split("=")[1] as keyof typeof schemaMap;
    }
  }
  if (!schemaKey) {
    schemaKey = file.includes(`${path.sep}canonical${path.sep}`) ? "canonical" : "theme";
  }
  return { file, schemaKey };
}

async function validateFile(file: string, schemaKey: keyof typeof schemaMap) {
  const target = path.resolve(file);
  if (!(await fs.pathExists(target))) {
    throw new Error(`File not found: ${target}`);
  }
  const schemaPath = schemaMap[schemaKey];
  if (!(await fs.pathExists(schemaPath))) {
    throw new Error(`Schema not found: ${schemaPath}`);
  }

  const data = await fs.readJson(target);
  const schema = await fs.readJson(schemaPath);

  const ajv = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true });
  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid) {
    const message = ajv.errorsText(validate.errors, { separator: "\n  " });
    throw new Error(`Validation failed against ${schemaKey} schema:\n  ${message}`);
  }
  console.log(`✅ ${path.relative(ROOT, target)} conforms to ${schemaKey} schema.`);
}

async function main() {
  const { file, schemaKey } = parseArgs();
  await validateFile(file, schemaKey);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
