/**
 * Renders the coverage numbers both runners produce into one markdown table.
 *
 * Reads the `json-summary` output rather than scraping the `text` reporter,
 * because `pnpm test:cov` interleaves two workspaces through Turbo and the
 * combined stdout has no stable shape to slice.
 *
 * Writes to $GITHUB_STEP_SUMMARY when set, stdout otherwise. This is a report,
 * never a gate: neither runner declares a threshold, and a missing summary file
 * is printed as a dash instead of failing the job.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const workspaces = [
  { name: "backend", summary: "apps/backend/coverage/coverage-summary.json" },
  { name: "frontend", summary: "apps/frontend/coverage/coverage-summary.json" },
];

const metrics = ["statements", "branches", "functions", "lines"];

/** Istanbul writes a `total` key alongside one entry per file; we only want the former. */
function readTotals(relativePath) {
  try {
    const parsed = JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
    return parsed.total ?? null;
  } catch {
    return null;
  }
}

const rows = workspaces.map(({ name, summary }) => {
  const totals = readTotals(summary);
  const cells = metrics.map((metric) =>
    totals?.[metric] ? `${totals[metric].pct.toFixed(2)}%` : "—",
  );

  return `| ${name} | ${cells.join(" | ")} |`;
});

const table = [
  "## Coverage",
  "",
  "| Workspace | Statements | Branches | Functions | Lines |",
  "| --- | --- | --- | --- | --- |",
  ...rows,
  "",
  "_Reported, not enforced — no threshold is configured in either runner._",
  "",
].join("\n");

const stepSummary = process.env.GITHUB_STEP_SUMMARY;

if (stepSummary) {
  appendFileSync(stepSummary, table);
} else {
  process.stdout.write(table);
}
