import { readFileSync } from "node:fs";

const report = JSON.parse(readFileSync(process.argv[2], "utf8"));
const allowedAdvisories = new Set([
  "https://github.com/advisories/GHSA-qwww-vcr4-c8h2",
]);

function isAllowedFinding(name, visited = new Set()) {
  if (visited.has(name)) return true;
  visited.add(name);

  const finding = report.vulnerabilities?.[name];
  return finding?.via.every((advisory) => {
    if (typeof advisory === "string") {
      return isAllowedFinding(advisory, visited);
    }
    return Boolean(advisory.url && allowedAdvisories.has(advisory.url));
  });
}

const unresolved = Object.entries(report.vulnerabilities ?? {}).filter(([name]) =>
  !isAllowedFinding(name)
);

if (unresolved.length > 0) {
  console.error("Unapproved production dependency advisories:");
  for (const [name, finding] of unresolved) {
    console.error(`${name}: ${finding.severity}`);
  }
  process.exit(1);
}

if (Object.keys(report.vulnerabilities ?? {}).length > 0) {
  console.warn("Approved RSC-only React Router advisory remains; this SPA does not use RSC mode.");
}