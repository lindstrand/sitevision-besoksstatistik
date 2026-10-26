import fs from "node:fs";
import path from "node:path";

const skip = new Set(["node_modules", "dist", ".git"]);
const forbiddenNames = new Set([".dev_properties.json", ".env", ".env.local", ".env.production"]);
const forbiddenExt = new Set([".pem", ".key", ".p12", ".pfx", ".crt", ".cer", ".csr", ".der", ".jks", ".keystore"]);
const textExt = new Set([".js", ".mjs", ".json", ".html", ".md", ".txt", ".scss", ".css"]);
const findings = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (skip.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) { walk(full); continue; }

    if (forbiddenNames.has(name) || forbiddenExt.has(path.extname(name).toLowerCase())) {
      findings.push(`Känslig fil: ${full}`);
      continue;
    }
    if (!textExt.has(path.extname(name).toLowerCase())) continue;

    const content = fs.readFileSync(full, "utf8");
    const checks = [
      [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i, "privat nyckel"],
      [/\bBearer\s+[A-Za-z0-9._~+\/=\-]{16,}/i, "Bearer-token"],
      [/\b(?:api[_-]?key|client[_-]?secret|password)\s*[:=]\s*["'][^"']{8,}["']/i, "möjlig hemlighet"],
      [/\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/, "privat IP-adress"],
      [/[A-Za-z]:\\Users\\/i, "lokal Windows-sökväg"]
    ];
    for (const [regex, label] of checks) if (regex.test(content)) findings.push(`${label}: ${full}`);
  }
}
walk(".");
if (findings.length) {
  console.error("SÄKERHETSKONTROLL MISSLYCKADES");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log("Säkerhetskontroll OK.");
