/**
 * SaveReason Local Memory Engine
 *
 * Deterministic, no external API required.
 * Generates structured memory fields from page data.
 * Can be replaced later by an LLM without changing the API contract.
 */

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","it","its","this","that","these","those","was","are",
  "be","been","being","have","has","had","do","does","did","will","would",
  "could","should","may","might","can","i","my","me","we","our","you","your",
  "he","his","she","her","they","their","them","what","which","who","how",
  "when","where","why","all","also","into","as","not","no","up","so","if",
  "about","than","more","just","like","then","some","use","using","get",
  "make","made","s","t","re","ve","ll","d","www","http","https","com","org",
  "net","html","php","page","site","web","via","etc","new","one","two","three",
]);

function cleanText(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 500);
}

function truncate(text, max = 200) {
  const t = cleanText(text);
  if (t.length <= max) return t;
  return t.substring(0, max - 1).replace(/\s\S*$/, "") + "…";
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url || "";
  }
}

function extractWords(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function scoredTags(title, reason, selectedText, url) {
  const counts = {};

  const titleWords = extractWords(title);
  const reasonWords = extractWords(reason);
  const selectedWords = extractWords(selectedText);
  const domainWords = extractWords(getDomain(url));

  // Title words weighted highest
  titleWords.forEach((w) => { counts[w] = (counts[w] || 0) + 3; });
  reasonWords.forEach((w) => { counts[w] = (counts[w] || 0) + 2; });
  selectedWords.forEach((w) => { counts[w] = (counts[w] || 0) + 1; });
  domainWords.forEach((w) => { counts[w] = (counts[w] || 0) + 1; });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .filter((w) => w.length >= 3)
    .slice(0, 5);
}

/**
 * createMemory({ title, url, reason, selectedText })
 * Returns: { summary, whyItMatters, keyInsight, intendedUse, tags }
 */
export function createMemory({ title, url, reason, selectedText }) {
  const cleanTitle = cleanText(title) || "Untitled page";
  const cleanReason = cleanText(reason) || "no specific reason";
  const cleanSelected = cleanText(selectedText);
  const domain = getDomain(url);

  // Summary
  const summary = cleanSelected
    ? `A resource titled "${cleanTitle}" from ${domain}. Key excerpt: "${truncate(cleanSelected, 120)}"`
    : `A resource titled "${cleanTitle}" from ${domain}.`;

  // Why it matters
  const whyItMatters = `You saved this because: "${truncate(cleanReason, 150)}". Revisit it when that need arises.`;

  // Key insight — use selected text if available, else build from title + reason
  let keyInsight;
  if (cleanSelected && cleanSelected.length > 20) {
    keyInsight = truncate(cleanSelected, 180);
  } else {
    keyInsight = `"${cleanTitle}" — saved for: ${truncate(cleanReason, 120)}`;
  }

  // Intended use — synthesized from reason
  const lowerReason = cleanReason.toLowerCase();
  let intendedUse;
  if (lowerReason.includes("project")) {
    intendedUse = `Reference this when working on your project.`;
  } else if (lowerReason.includes("learn") || lowerReason.includes("study")) {
    intendedUse = `Return to this when you have time to study or learn the topic.`;
  } else if (lowerReason.includes("research")) {
    intendedUse = `Use this as a research reference or citation.`;
  } else if (lowerReason.includes("college") || lowerReason.includes("school")) {
    intendedUse = `Reference this resource for your academic work.`;
  } else if (lowerReason.includes("idea")) {
    intendedUse = `Come back to this when developing or refining your ideas.`;
  } else if (lowerReason.includes("reference") || lowerReason.includes("later")) {
    intendedUse = `Keep as a reference and revisit when the topic becomes relevant.`;
  } else {
    intendedUse = `Revisit this resource when: "${truncate(cleanReason, 100)}"`;
  }

  // Tags
  const tags = scoredTags(cleanTitle, cleanReason, cleanSelected, url);

  return { summary, whyItMatters, keyInsight, intendedUse, tags };
}
