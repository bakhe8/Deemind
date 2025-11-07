/**
 * Deemind CI Build Reporter
 * Logs the status of build/test/validation tasks into /logs/ci-report.json
 */

import fs from "fs";
import path from "path";

const logDir = path.resolve("logs");
const logFile = path.join(logDir, "ci-report.json");

if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

function writeReport(status, details) {
  const report = {
    timestamp: new Date().toISOString(),
    status,
    details,
  };

  fs.writeFileSync(logFile, JSON.stringify(report, null, 2), "utf8");
  console.log(`🧠 CI report written to ${logFile}`);
}

// read arguments from CLI
const [,, status, ...info] = process.argv;
writeReport(status, info.join(" "));
