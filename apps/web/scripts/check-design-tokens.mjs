#!/usr/bin/env node
// Ratchet for design-token adoption: counts hex / rgba color literals in TSX
// and fails when the count grows above the committed baseline.
// Use semantic classes from app/globals.css (text-fg-muted, bg-surface-panel,
// border-border-subtle, bg-success/10 …) instead of literals.
// Lower the baseline whenever you remove literals:  node scripts/check-design-tokens.mjs --update
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const BASELINE_FILE = join(ROOT, "scripts/design-tokens-baseline.json");
const DIRS = ["app", "components"];
const LITERAL = /#[0-9a-fA-F]{6}\b|rgba\(/g;

function walk(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) walk(path, out);
		else if (path.endsWith(".tsx")) out.push(path);
	}
	return out;
}

const perFile = {};
let total = 0;
for (const dir of DIRS) {
	for (const file of walk(join(ROOT, dir))) {
		const count = (readFileSync(file, "utf8").match(LITERAL) ?? []).length;
		if (count > 0) perFile[relative(ROOT, file)] = count;
		total += count;
	}
}

if (process.argv.includes("--update")) {
	writeFileSync(BASELINE_FILE, `${JSON.stringify({ total }, null, "\t")}\n`);
	console.log(`Baseline updated: ${total} color literals.`);
	process.exit(0);
}

const { total: baseline } = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
if (total > baseline) {
	const top = Object.entries(perFile)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8)
		.map(([file, count]) => `  ${count}\t${file}`)
		.join("\n");
	console.error(
		`✗ ${total} color literals in TSX (baseline ${baseline}). Use design tokens from app/globals.css.\n${top}`,
	);
	process.exit(1);
}
console.log(
	`✓ ${total} color literals in TSX (baseline ${baseline})${total < baseline ? " — run with --update to lower the baseline" : ""}.`,
);
