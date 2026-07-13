import { appendFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
const commentMarker = "<!-- datasheet-ci-summary -->";
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
function matchesAnyPattern(path, patternsInput) {
    const normalized = normalizePath(path);
    const patterns = patternsInput
        .split(/[\n,]/)
        .map((item) => normalizePath(item.trim()))
        .filter(Boolean);
    for (const pattern of patterns.length ? patterns : ["**/*.md"]) {
        if (pattern.includes("*")) {
            if (globToRegExp(pattern).test(normalized)) {
                return true;
            }
            continue;
        }
        if (normalized === pattern || normalized.startsWith(`${pattern}/`)) {
            return true;
        }
    }
    return false;
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
    const failures = files.filter((file) => !file.ok).length;
    const warnings = files.reduce((count, file) => count + file.piiWarnings.length, 0);
    const state = files.length === 0 ? "blocked" : failures > 0 ? "fail" : warnings > 0 ? "review" : "pass";
    return { ok: state === "pass" || state === "review", state, files, skipped };
}
function emitGitHubAnnotations(results) {
    for (const result of results) {
        for (const finding of result.piiWarnings) {
            emitAnnotation("warning", `PII-like ${finding.pattern} pattern`, `Review this match and remove or document it if it is not approved: ${finding.match}`, result.path, finding.line);
        }
        if (!result.ok) {
            emitAnnotation("error", `Incomplete ${displayKind(result.kind)}`, `Add the required sections: ${result.missing.join(", ")}`, result.path);
        }
    }
}
function getInput(name) {
    const envName = `INPUT_${name.toUpperCase().replaceAll("-", "_")}`;
    return process.env[envName];
}
function getPullRequestContext() {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath || !existsSync(eventPath)) {
        return null;
    }
    const event = JSON.parse(readFileSync(eventPath, "utf8"));
    const number = event.pull_request?.number;
    const [owner, repo] = event.repository?.full_name?.split("/") ?? [];
    if (!number || !owner || !repo) {
        return null;
    }
    return {
        owner,
        repo,
        number,
        apiUrl: process.env.GITHUB_API_URL ?? "https://api.github.com",
    };
}
async function githubRequest(context, token, path, init = {}) {
    const response = await fetch(`${context.apiUrl}${path}`, {
        ...init,
        headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            "x-github-api-version": "2022-11-28",
            ...init.headers,
        },
    });
    if (!response.ok) {
        throw new Error(`GitHub API ${init.method ?? "GET"} ${path} failed: ${response.status} ${await response.text()}`);
    }
    return (await response.json());
}
async function getChangedMarkdownFiles(context, token, patternsInput) {
    const files = [];
    let page = 1;
    while (true) {
        const batch = await githubRequest(context, token, `/repos/${context.owner}/${context.repo}/pulls/${context.number}/files?per_page=100&page=${page}`);
        files.push(...batch);
        if (batch.length < 100) {
            break;
        }
        page += 1;
    }
    return files
        .map((file) => file.filename)
        .filter((path) => path.toLowerCase().endsWith(".md"))
        .filter((path) => matchesAnyPattern(path, patternsInput))
        .filter((path) => existsSync(path))
        .map((path) => resolve(path))
        .sort();
}
export function buildPrComment(result, version = "0.2.1") {
    const failures = result.files.filter((file) => !file.ok);
    const warnings = result.files.reduce((count, file) => count + file.piiWarnings.length, 0);
    const lines = [
        commentMarker,
        "## AuraOne Datasheet CI",
        "",
        `**Decision:** ${decisionLabel(result.state)}`,
        "",
        "| Evidence | Result |",
        "| --- | ---: |",
        `| Checked files | ${result.files.length} |`,
        `| Blocking failures | ${failures.length} |`,
        `| PII-like warnings | ${warnings} |`,
        `| Skipped files | ${result.skipped.length} |`,
    ];
    if (failures.length > 0) {
        lines.push("", "### Missing Sections");
        for (const failure of failures) {
            lines.push(`- \`${escapeInlineCode(relative(process.cwd(), failure.path))}\`: ${failure.missing.map(escapeMarkdown).join(", ")}`);
        }
    }
    if (warnings > 0) {
        lines.push("", "### Warnings");
        for (const file of result.files) {
            for (const warning of file.piiWarnings) {
                lines.push(`- \`${escapeInlineCode(relative(process.cwd(), file.path))}:${warning.line}\`: PII-like ${escapeMarkdown(warning.pattern)} pattern \`${escapeInlineCode(warning.match)}\``);
            }
        }
    }
    if (result.skipped.length > 0) {
        lines.push("", "### Skipped Files");
        for (const path of result.skipped)
            lines.push(`- \`${escapeInlineCode(relative(process.cwd(), path))}\``);
    }
    lines.push("", "### Next action", "", nextAction(result.state));
    lines.push("", `Generated by AuraOne Datasheet CI ${escapeMarkdown(version)}. Validation runs locally in this workflow.`);
    return `${lines.join("\n")}\n`;
}
async function postPullRequestComment(context, token, body) {
    const comments = await githubRequest(context, token, `/repos/${context.owner}/${context.repo}/issues/${context.number}/comments?per_page=100`);
    const previous = comments.find((comment) => (comment.user?.type === "Bot" || comment.user?.login === "github-actions[bot]") &&
        comment.body?.includes(commentMarker));
    if (previous) {
        await githubRequest(context, token, `/repos/${context.owner}/${context.repo}/issues/comments/${previous.id}`, { method: "PATCH", body: JSON.stringify({ body }) });
        return;
    }
    await githubRequest(context, token, `/repos/${context.owner}/${context.repo}/issues/${context.number}/comments`, { method: "POST", body: JSON.stringify({ body }) });
}
async function resolveActionPaths(patternsInput, token) {
    const context = getPullRequestContext();
    if (context && token) {
        const changed = await getChangedMarkdownFiles(context, token, patternsInput);
        if (changed.length > 0) {
            return changed;
        }
    }
    return expandPatterns(patternsInput);
}
async function runCli(args) {
    if (args.length > 0) {
        const paths = args.flatMap((arg) => expandPatterns(arg));
        const result = validateFiles(paths, false);
        console.log(JSON.stringify(result.files.length === 1 ? result.files[0] : result, null, 2));
        return result.ok ? 0 : 1;
    }
    const actionPaths = process.env.INPUT_PATHS ?? "**/*.md";
    const token = getInput("github-token") || process.env.GITHUB_TOKEN;
    const paths = await resolveActionPaths(actionPaths, token);
    const result = validateFiles(paths, true);
    emitGitHubAnnotations(result.files);
    const summary = buildPrComment(result);
    writeJobSummary(summary);
    writeOutput("decision", result.state);
    writeOutput("checked-files", String(result.files.length));
    writeOutput("blocking-failures", String(result.files.filter((file) => !file.ok).length));
    writeOutput("warnings", String(result.files.reduce((count, file) => count + file.piiWarnings.length, 0)));
    const context = getPullRequestContext();
    if (context && token && getInput("comment-on-pr") !== "false") {
        await postPullRequestComment(context, token, summary);
    }
    console.log(JSON.stringify(result, null, 2));
    if (result.state === "blocked") {
        emitAnnotation("error", "Datasheet CI blocked", "No recognized documentation files matched the configured paths.");
    }
    return result.ok ? 0 : 1;
}
function writeJobSummary(markdown) {
    if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown.replace(commentMarker, "").trim()}\n`, "utf8");
    }
}
function writeOutput(name, value) {
    if (!process.env.GITHUB_OUTPUT)
        return;
    const delimiter = `AURAONE_${name.toUpperCase()}_${process.pid}`;
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${value}\n${delimiter}\n`, "utf8");
}
function emitAnnotation(level, title, message, file, line) {
    const properties = [`title=${escapeWorkflowProperty(title)}`];
    if (file)
        properties.push(`file=${escapeWorkflowProperty(relative(process.cwd(), file))}`);
    if (line)
        properties.push(`line=${line}`);
    console.log(`::${level} ${properties.join(",")}::${escapeWorkflowData(message)}`);
}
function decisionLabel(state) {
    return { pass: "Passed", review: "Review recommended", fail: "Failed", blocked: "Blocked" }[state];
}
function nextAction(state) {
    return {
        pass: "No blocking action is required. Keep the documentation aligned with future dataset or model changes.",
        review: "Review each PII-like match and remove it or document why the content is approved before merging.",
        fail: "Add the listed required sections, then rerun the workflow.",
        blocked: "Correct the configured paths or add a recognized Datasheet, Model Card, or Data Card, then rerun the workflow.",
    }[state];
}
function displayKind(kind) {
    return { datasheet: "Datasheet", model_card: "Model Card", data_card: "Data Card" }[kind];
}
export function escapeMarkdown(value) {
    return value
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .replace(/([\\`*_[\]{}()#+\-.!|>])/g, "\\$1");
}
function escapeInlineCode(value) {
    return value.replace(/`/g, "\\`").replace(/[\r\n]/g, " ");
}
function escapeWorkflowData(value) {
    return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
function escapeWorkflowProperty(value) {
    return escapeWorkflowData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
}
if (process.argv[1]?.endsWith("index.js")) {
    runCli(process.argv.slice(2))
        .then((code) => process.exit(code))
        .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
}
