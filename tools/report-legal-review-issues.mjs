#!/usr/bin/env node
import fs from "node:fs";
import ts from "typescript";

const SOURCE_FILE = "frontend/src/i18n/messages/legal.ts";
const OUTPUT_FILE = "docs/11_LEGAL_LOCALE_REVIEW_ISSUES.md";

const LOCALES = ["en", "fr", "es", "it", "de", "zh", "ja", "ko", "th", "vi", "id", "ru"];
const CRITICAL_RATIO = 0.35;
const WARNING_RATIO = 0.55;
const LONG_TEXT_THRESHOLD = 120;
const TOP_FINDINGS_PER_LOCALE = 8;
const PLACEHOLDER_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g;

function keyOf(nameNode) {
  if (!nameNode) return null;
  if (ts.isIdentifier(nameNode)) return nameNode.text;
  if (ts.isStringLiteral(nameNode) || ts.isNoSubstitutionTemplateLiteral(nameNode)) return nameNode.text;
  return null;
}

function placeholders(text) {
  const tokens = [];
  for (const m of text.matchAll(PLACEHOLDER_RE)) tokens.push(m[1]);
  return tokens.sort();
}

function parseMessages(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const map = {};

  function addLocale(locale, objNode) {
    const out = {};
    for (const prop of objNode.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = keyOf(prop.name);
      if (!key) continue;
      if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
        out[key] = prop.initializer.text;
      }
    }
    map[locale] = out;
  }

  function walk(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "messages" &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const localeProp of node.initializer.properties) {
        if (!ts.isPropertyAssignment(localeProp)) continue;
        const locale = keyOf(localeProp.name);
        if (!locale || !LOCALES.includes(locale)) continue;
        if (!ts.isObjectLiteralExpression(localeProp.initializer)) continue;
        addLocale(locale, localeProp.initializer);
      }
    }
    ts.forEachChild(node, walk);
  }

  walk(sf);
  return map;
}

function sectionNameFromKey(key) {
  if (key.startsWith("legal.terms.")) return "terms";
  if (key.startsWith("legal.privacy.")) return "privacy";
  if (key.startsWith("legal.fees.")) return "fees";
  if (key.startsWith("legal.risk.")) return "risk";
  return "other";
}

function isLongNarrativeKey(key, value) {
  if (!key.startsWith("legal.")) return false;
  if (!key.endsWith(".content") && !key.endsWith(".intro") && !key.endsWith(".warning")) return false;
  return value.length >= LONG_TEXT_THRESHOLD;
}

function buildReport() {
  const messages = parseMessages(SOURCE_FILE);
  const en = messages.en;
  if (!en) throw new Error("English locale not found in legal.ts");

  const keys = Object.keys(en).sort();
  const findings = [];
  const sectionStats = {};

  for (const locale of LOCALES) {
    if (locale === "en") continue;
    const loc = messages[locale] ?? {};

    const stats = {
      terms: { en: 0, loc: 0 },
      privacy: { en: 0, loc: 0 },
      fees: { en: 0, loc: 0 },
      risk: { en: 0, loc: 0 },
    };

    for (const key of keys) {
      const enText = en[key];
      const locText = loc[key];
      const section = sectionNameFromKey(key);

      if (section in stats && isLongNarrativeKey(key, enText)) {
        stats[section].en += enText.length;
        stats[section].loc += (locText ?? "").length;
      }

      if (typeof locText !== "string") {
        findings.push({ severity: "P0", locale, key, issue: "missing_key", detail: "Missing translation key", ratio: 0 });
        continue;
      }

      const enTokens = placeholders(enText).join(",");
      const locTokens = placeholders(locText).join(",");
      if (enTokens !== locTokens) {
        findings.push({
          severity: "P0",
          locale,
          key,
          issue: "placeholder_mismatch",
          detail: `Expected {${enTokens}} but got {${locTokens}}`,
          ratio: 0,
        });
      }

      if (enText === locText && /[A-Za-z]/.test(enText) && enText.length >= 18 && !key.endsWith(".title")) {
        findings.push({ severity: "P1", locale, key, issue: "english_residue", detail: "Identical to English", ratio: 1 });
      }

      if (isLongNarrativeKey(key, enText)) {
        const ratio = enText.length === 0 ? 1 : locText.length / enText.length;
        if (ratio < CRITICAL_RATIO) {
          findings.push({
            severity: "P1",
            locale,
            key,
            issue: "semantic_compression_high",
            detail: `Length ratio ${ratio.toFixed(2)} (< ${CRITICAL_RATIO})`,
            ratio,
          });
        } else if (ratio < WARNING_RATIO) {
          findings.push({
            severity: "P2",
            locale,
            key,
            issue: "semantic_compression_medium",
            detail: `Length ratio ${ratio.toFixed(2)} (< ${WARNING_RATIO})`,
            ratio,
          });
        }
      }
    }

    sectionStats[locale] = {
      terms: stats.terms.en ? stats.terms.loc / stats.terms.en : 1,
      privacy: stats.privacy.en ? stats.privacy.loc / stats.privacy.en : 1,
      fees: stats.fees.en ? stats.fees.loc / stats.fees.en : 1,
      risk: stats.risk.en ? stats.risk.loc / stats.risk.en : 1,
    };
  }

  return { findings, sectionStats };
}

function toMarkdown(report) {
  const now = new Date().toISOString().slice(0, 10);
  const lines = [];

  lines.push("# 11. Legal Locale Review Issues");
  lines.push("");
  lines.push(`- Generated: ${now}`);
  lines.push(`- Source: \`${SOURCE_FILE}\``);
  lines.push("- Goal: 현재 디자인/톤앤매너 유지 전제에서 법률 문구 번역 품질 고도화");
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push("| Locale | Terms Ratio | Privacy Ratio | Fees Ratio | Risk Ratio | P0 | P1 | P2 | Total | Priority |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---|");

  const byLocale = new Map();
  for (const row of report.findings) {
    const arr = byLocale.get(row.locale) ?? [];
    arr.push(row);
    byLocale.set(row.locale, arr);
  }

  function priority(stats, p0, p1) {
    const minRatio = Math.min(stats.terms, stats.privacy, stats.fees, stats.risk);
    if (p0 > 0) return "Immediate";
    if (p1 >= 12 || minRatio < 0.30) return "High";
    if (p1 >= 4 || minRatio < 0.45) return "Medium";
    return "Low";
  }

  for (const locale of LOCALES.filter((l) => l !== "en")) {
    const stats = report.sectionStats[locale] ?? { terms: 1, privacy: 1, fees: 1, risk: 1 };
    const rows = byLocale.get(locale) ?? [];
    const p0 = rows.filter((r) => r.severity === "P0").length;
    const p1 = rows.filter((r) => r.severity === "P1").length;
    const p2 = rows.filter((r) => r.severity === "P2").length;
    lines.push(
      `| ${locale} | ${stats.terms.toFixed(2)} | ${stats.privacy.toFixed(2)} | ${stats.fees.toFixed(2)} | ${stats.risk.toFixed(2)} | ${p0} | ${p1} | ${p2} | ${rows.length} | ${priority(stats, p0, p1)} |`
    );
  }

  lines.push("");
  lines.push("## Actionable Backlog (Top Issues Per Locale)");
  lines.push("");

  for (const locale of LOCALES.filter((l) => l !== "en")) {
    const rows = (byLocale.get(locale) ?? []).sort((a, b) => {
      const sevOrder = { P0: 0, P1: 1, P2: 2 };
      return sevOrder[a.severity] - sevOrder[b.severity] || a.ratio - b.ratio;
    });

    if (rows.length === 0) continue;

    lines.push(`### ${locale}`);
    lines.push("");
    for (const item of rows.slice(0, TOP_FINDINGS_PER_LOCALE)) {
      lines.push(`- [${item.severity}] \`${item.key}\` - ${item.issue}: ${item.detail}`);
    }
    lines.push("");
  }

  lines.push("## Review Order");
  lines.push("");
  lines.push("1. Wave 1: zh, ja, ko, th, vi, id, ru (High)");
  lines.push("2. Wave 2: it, de (Medium)");
  lines.push("3. Wave 3: es, fr (Low/Medium polish)");
  lines.push("4. 각 Wave 완료 후 `npm run check:i18n` + 전체 빌드 재검증");

  return `${lines.join("\n")}\n`;
}

function main() {
  const report = buildReport();
  const markdown = toMarkdown(report);
  fs.writeFileSync(OUTPUT_FILE, markdown);
  console.log(`Generated ${OUTPUT_FILE}`);
}

main();
