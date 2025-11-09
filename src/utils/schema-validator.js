/**
 * Lightweight AJV wrapper for validating JSON files against local schemas.
 */
import fs from 'fs-extra';
import path from 'path';
import Ajv from 'ajv';

const ajv = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true });

async function loadSchema(schemaPath) {
  const abs = path.resolve(schemaPath);
  if (!(await fs.pathExists(abs))) {
    throw new Error(`Schema not found: ${abs}`);
  }
  const schema = await fs.readJson(abs);
  return { schema, abs };
}

export async function validateJsonAgainstSchema(data, schemaPath, label = 'schema') {
  const { schema, abs } = await loadSchema(schemaPath);
  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid) {
    const message = ajv.errorsText(validate.errors, { separator: '\n  ' });
    throw new Error(`Validation failed for ${label} (${abs}):\n  ${message}`);
  }
  return true;
}

export async function validateFile(schemaPath, filePath, label) {
  const absFile = path.resolve(filePath);
  if (!(await fs.pathExists(absFile))) {
    throw new Error(`File not found: ${absFile}`);
  }
  const data = await fs.readJson(absFile);
  await validateJsonAgainstSchema(data, schemaPath, label);
  return data;
}
