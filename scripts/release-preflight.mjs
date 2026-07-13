import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const lock = JSON.parse(readFileSync(new URL("package-lock.json", root), "utf8"));
const action = readFileSync(new URL("action.yml", root), "utf8");
const expectedTag = process.argv[2] || process.env.GITHUB_REF_NAME || `v${pkg.version}`;
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[-+][0-9A-Za-z.-]+)?$/.test(pkg.version)) {
  throw new Error(`package version is not semantic: ${pkg.version}`);
}
if (expectedTag !== `v${pkg.version}`) {
  throw new Error(`tag ${expectedTag} must match package version v${pkg.version}`);
}
if (lock.version !== pkg.version || lock.packages?.[""]?.version !== pkg.version) {
  throw new Error("package.json and package-lock.json versions must match");
}
if (!action.includes("using: node20") || !action.includes("main: dist/index.js")) {
  throw new Error("action.yml must execute the checked-in Node 20 distribution");
}
if (process.env.GITHUB_ACTIONS === "true") {
  const head = execFileSync("git", ["rev-parse", "HEAD^{commit}"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const tagCommit = execFileSync("git", ["rev-parse", `${expectedTag}^{commit}`], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (head !== tagCommit) {
    throw new Error(`checked-out commit ${head} does not match ${expectedTag} (${tagCommit})`);
  }
}

execFileSync("npm", ["test"], { cwd: root, stdio: "inherit" });
execFileSync("npm", ["audit", "--omit=dev"], { cwd: root, stdio: "inherit" });
const outDir = mkdtempSync(join(tmpdir(), "datasheet-ci-dist-"));
try {
  execFileSync("npx", ["tsc", "--outDir", outDir], { cwd: root, stdio: "inherit" });
  execFileSync("diff", ["-ru", new URL("dist", root).pathname, outDir], {
    cwd: root,
    stdio: "inherit",
  });
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
console.log(`release preflight passed for @auraone/datasheet-ci ${pkg.version}`);
