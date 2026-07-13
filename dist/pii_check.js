const patterns = {
    email: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    ip: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    phone: /\b\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
};
export function scanPii(text) {
    return Object.entries(patterns).flatMap(([pattern, re]) => [...text.matchAll(re)].map((match) => ({
        pattern,
        match: match[0],
        line: text.slice(0, match.index ?? 0).split("\n").length,
    })));
}
