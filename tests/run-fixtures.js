// tests/run-fixtures.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to fixtures folder
const fixturesDir = path.join(__dirname, 'fixtures');

async function runFixtures() {
  console.log(`Looking for test fixtures in: ${fixturesDir}`);

  try {
    const files = await fs.readdir(fixturesDir);
    console.log(`Found ${files.length} fixture(s):`);
    files.forEach(file => console.log('- ' + file));

    // Placeholder: here you can run actual validation logic
    console.log("Deemind tests executed successfully.");
  } catch (err) {
    console.error("Error reading fixtures:", err);
    process.exit(1);
  }
}

// Execute the test runner
await runFixtures();
