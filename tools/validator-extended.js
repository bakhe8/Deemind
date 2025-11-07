import fs from 'fs-extra';
import path from 'path';
import Ajv from 'ajv';

export async function validateExtended(outputPath) {
  const reportPath = path.join(outputPath, 'report-extended.json');
  const configsDir = path.resolve('configs');
  const schemaFile = path.join(configsDir, 'salla-schema.json');
  const budgetsFile = path.join(configsDir, 'budgets.json');

  const result = { checks: {}, warnings: [], errors: [] };

  // Load optional schema and budgets
  const hasSchema = await fs.pathExists(schemaFile);
  const hasBudgets = await fs.pathExists(budgetsFile);

  if (hasBudgets) {
    try {
      const budgets = await fs.readJson(budgetsFile);
      result.checks.budgets = budgets;
    } catch (e) {
      result.warnings.push({ type: 'budgets-parse', message: e.message });
    }
  }

  if (hasSchema) {
    try {
      const schema = await fs.readJson(schemaFile);
      const ajv = new Ajv();
      const validate = ajv.compile(schema);
      // Example data to validate: minimal theme meta
      const data = { engine: 'Deemind 1.0', adapter: 'Salla' };
      const valid = validate(data);
      if (!valid) result.warnings.push({ type: 'schema', details: validate.errors });
    } catch (e) {
      result.warnings.push({ type: 'schema-parse', message: e.message });
    }
  }

  await fs.writeJson(reportPath, { status: result.errors.length ? 'fail' : 'ok', ...result }, { spaces: 2 });
  return result;
}

// CLI mode support when run via npm script
if (process.argv[1] && process.argv[1].endsWith('validator-extended.js')) {
  const theme = process.argv[2] || 'demo';
  const out = path.join(process.cwd(), 'output', theme);
  validateExtended(out).then(() => {
    console.log(`Extended validation written for ${out}`);
  }).catch((e) => {
    console.error('Extended validation failed', e);
    process.exit(1);
  });
}

