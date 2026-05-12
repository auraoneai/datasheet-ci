import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { requiredSections as datasheet } from "./validators/datasheet.js";
import { requiredSections as modelCard } from "./validators/model_card.js";
import { requiredSections as dataCard } from "./validators/data_card.js";
import { scanPii } from "./pii_check.js";
const requiredByKind = {
    datasheet,
    model_card: modelCard,
    data_card: dataCard,
};
const ignoredDirs = new Set([".git", "node_modules", "dist", "coverage", ".next", ".turbo"]);
export function validateMarkdown(text, kind = "datasheet") {
    const required = requiredByKind[kind];
    const missing = required.filter((section) => !new RegExp(`^#{1,3}\\s+${section}\\b`, "mi").test(text));
    return { ok: missing.length === 0, kind, missing, piiWarnings: scanPii(text) };
}
function normalizePath(path) {
    return path.split("\\").join("/");
}
function globToRegExp(pattern) {
    let out = "^";
    for (let i = 0; i < pattern.length; i += 1) {
        const char = pattern[i];
        const next = pattern[i + 1];
        if (char === "*" && next === "*") {
            out += ".*";
            i += 1;
        }
        else if (char === "*") {
            out += "[^/]*";
        }
        else if ("\\.^$+?()[]{}|".includes(char)) {
            out += `\\${char}`;
        }
        else {
            out += char;
        }
    }
    return new RegExp(`${out}$`);
}
function listMarkdownFiles(root) {
    const files = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory() && ignoredDirs.has(entry.name)) {
            continue;
        }
        const path = resolve(root, entry.name);
        if (entry.isDirectory()) {
            files.push(...listMarkdownFiles(path));
        }
        else if (entry.isFile() && path.toLowerCase().endsWith(".md")) {
            files.push(path);
        }
    }
    return files;
}
function expandPatterns(input, cwd = process.cwd()) {
    const patterns = input
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);
    const allMarkdown = listMarkdownFiles(cwd);
    const matched = new Set();
    for (const pattern of patterns.length ? patterns : ["**/*.md"]) {
        const absolute = resolve(cwd, pattern);
        if (existsSync(absolute)) {
            const stat = statSync(absolute);
            if (stat.isDirectory()) {
                listMarkdownFiles(absolute).forEach((path) => matched.add(path));
            }
            else if (stat.isFile()) {
                matched.add(absolute);
            }
            continue;
        }
        if (pattern.includes("*")) {
            const matcher = globToRegExp(normalizePath(pattern));
            for (const file of allMarkdown) {
                if (matcher.test(normalizePath(relative(cwd, file)))) {
                    matched.add(file);
                }
            }
        }
    }
    return Array.from(matched).sort();
}
function countHeadings(text, sections) {
    return sections.filter((section) => new RegExp(`^#{1,3}\\s+${section}\\b`, "mi").test(text)).length;
}
function inferKind(path, text) {
    const lowerPath = path.toLowerCase();
    if (lowerPath.includes("model-card") || lowerPath.includes("model_card")) {
        return "model_card";
    }
    if (lowerPath.includes("data-card") || lowerPath.includes("data_card")) {
        return "data_card";
    }
    if (lowerPath.includes("datasheet")) {
        return "datasheet";
    }
    const scores = Object.entries(requiredByKind)
        .map(([kind, sections]) => ({ kind, score: countHeadings(text, sections) }))
        .sort((a, b) => b.score - a.score);
    return scores[0]?.score > 0 ? scores[0].kind : null;
}
function validateFiles(paths, requireRecognizedKind) {
    const files = [];
    const skipped = [];
    for (const path of paths) {
        const text = readFileSync(path, "utf8");
        const kind = requireRecognizedKind ? inferKind(path, text) : "datasheet";
        if (!kind) {
            skipped.push(path);
            continue;
        }
        files.push({ path, ...validateMarkdown(text, kind) });
    }
    return { ok: files.every((file) => file.ok), files, skipped };
}
function emitGitHubAnnotations(results) {
    for (const result of results) {
        for (const finding of result.piiWarnings) {
            console.log(`::warning file=${result.path}::PII-like ${finding.pattern} pattern found: ${finding.match}`);
        }
        if (!result.ok) {
            console.log(`::error file=${result.path}::Missing required ${result.kind} sections: ${result.missing.join(", ")}`);
        }
    }
}
function runCli(args) {
    if (args.length > 0) {
        const paths = args.flatMap((arg) => expandPatterns(arg));
        const result = validateFiles(paths, false);
        console.log(JSON.stringify(result.files.length === 1 ? result.files[0] : result, null, 2));
        return result.ok && result.files.length > 0 ? 0 : 1;
    }
    const actionPaths = process.env.INPUT_PATHS ?? "**/*.md";
    const paths = expandPatterns(actionPaths);
    const result = validateFiles(paths, true);
    emitGitHubAnnotations(result.files);
    console.log(JSON.stringify(result, null, 2));
    return result.ok && result.files.length > 0 ? 0 : 1;
}
if (process.argv[1]?.endsWith("index.js")) {
    process.exit(runCli(process.argv.slice(2)));
}
