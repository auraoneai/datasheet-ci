import { readFileSync } from "node:fs";
import { requiredSections as datasheet } from "./validators/datasheet.js";
import { requiredSections as modelCard } from "./validators/model_card.js";
import { requiredSections as dataCard } from "./validators/data_card.js";
import { scanPii } from "./pii_check.js";
export function validateMarkdown(text, kind = "datasheet") {
    const required = kind === "model_card" ? modelCard : kind === "data_card" ? dataCard : datasheet;
    const missing = required.filter((section) => !new RegExp(`^#{1,3}\\s+${section}\\b`, "mi").test(text));
    return { ok: missing.length === 0, missing, piiWarnings: scanPii(text) };
}
if (process.argv[1]?.endsWith("index.js") && process.argv[2]) {
    const result = validateMarkdown(readFileSync(process.argv[2], "utf8"));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
}
