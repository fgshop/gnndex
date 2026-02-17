#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const STRICT_WARNINGS = process.argv.includes("--strict-warnings");

const ROOTS = [
  "frontend/src/i18n/messages",
  "admin/src/i18n/messages",
  "mobile/src/i18n/messages",
];

const EXPECTED_LOCALES = [
  "en", "fr", "es", "it", "de", "zh", "ja", "ko", "th", "vi", "id", "ru",
];

const PLACEHOLDER_RE = /\{\{([a-zA-Z0-9_]+)\}\}/g;

function toKey(nameNode) {
  if (!nameNode) return null;
  if (ts.isIdentifier(nameNode)) return nameNode.text;
  if (ts.isStringLiteral(nameNode) || ts.isNoSubstitutionTemplateLiteral(nameNode)) {
    return nameNode.text;
  }
  return null;
}

function getPlaceholders(text) {
  const out = [];
  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    out.push(match[1]);
  }
  out.sort();
  return out;
}

function hasLatin(text) {
  return /[A-Za-z]/.test(text);
}

function isLikelyLongText(text) {
  return text.length >= 18;
}

function parseMessageFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const localeToMessages = {};

  function addLocaleObject(locale, objNode) {
    const keyValueMap = {};
    for (const prop of objNode.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const key = toKey(prop.name);
      if (!key) continue;
      if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
        keyValueMap[key] = prop.initializer.text;
      }
    }
    localeToMessages[locale] = keyValueMap;
  }

  function walk(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      EXPECTED_LOCALES.includes(node.name.text) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      addLocaleObject(node.name.text, node.initializer);
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "messages" &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const localeProp of node.initializer.properties) {
        if (!ts.isPropertyAssignment(localeProp)) continue;
        const locale = toKey(localeProp.name);
        if (!locale || !EXPECTED_LOCALES.includes(locale)) continue;
        if (!ts.isObjectLiteralExpression(localeProp.initializer)) continue;
        addLocaleObject(locale, localeProp.initializer);
      }
    }

    ts.forEachChild(node, walk);
  }

  walk(sf);
  return localeToMessages;
}

function collectMessageFiles() {
  const files = [];
  for (const root of ROOTS) {
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root)) {
      if (!name.endsWith(".ts")) continue;
      files.push(path.join(root, name));
    }
  }
  files.sort();
  return files;
}

let errorCount = 0;
let warningCount = 0;

function reportError(msg) {
  errorCount += 1;
  console.error(`ERROR ${msg}`);
}

function reportWarning(msg) {
  warningCount += 1;
  console.warn(`WARN  ${msg}`);
}

for (const filePath of collectMessageFiles()) {
  const localeMap = parseMessageFile(filePath);

  for (const locale of EXPECTED_LOCALES) {
    if (!localeMap[locale]) {
      reportError(`${filePath}: missing locale '${locale}'`);
    }
  }

  const en = localeMap.en;
  if (!en) {
    reportError(`${filePath}: missing base locale 'en'`);
    continue;
  }

  const enKeys = Object.keys(en).sort();

  for (const locale of EXPECTED_LOCALES) {
    const messages = localeMap[locale];
    if (!messages) continue;

    for (const key of enKeys) {
      if (!(key in messages)) {
        reportError(`${filePath}: locale '${locale}' missing key '${key}'`);
      }
    }

    for (const key of Object.keys(messages)) {
      if (!(key in en)) {
        reportWarning(`${filePath}: locale '${locale}' has extra key '${key}' not in en`);
      }
    }

    if (locale === "en") continue;

    for (const key of enKeys) {
      const enText = en[key];
      const localText = messages[key];
      if (typeof localText !== "string") continue;

      const enTokens = getPlaceholders(enText).join(",");
      const localeTokens = getPlaceholders(localText).join(",");
      if (enTokens !== localeTokens) {
        reportError(
          `${filePath}: locale '${locale}' key '${key}' placeholder mismatch (en='${enTokens}' locale='${localeTokens}')`
        );
      }

      if (enText === localText && hasLatin(enText) && isLikelyLongText(enText) && !key.endsWith("Placeholder")) {
        reportWarning(`${filePath}: locale '${locale}' key '${key}' is identical to English`);
      }
    }
  }
}

const summary = `i18n check complete: ${errorCount} error(s), ${warningCount} warning(s)`;
if (errorCount > 0) {
  console.error(summary);
  process.exit(1);
}

if (STRICT_WARNINGS && warningCount > 0) {
  console.error(summary);
  process.exit(2);
}

console.log(summary);
