"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { formatText } = require("./formatter");

const CASE_DIR = path.join(__dirname, "case");
const CASE_FILE_PATTERN = /^case-.*\.md$/;

for (const fileName of getCaseFiles()) {
  const filePath = path.join(CASE_DIR, fileName);
  const { title, input, expected } = parseCaseFile(fs.readFileSync(filePath, "utf8"), fileName);

  test(title, async () => {
    const result = await formatText(input);
    assert.equal(result.output, expected);
  });
}

function getCaseFiles() {
  return fs
    .readdirSync(CASE_DIR)
    .filter((fileName) => CASE_FILE_PATTERN.test(fileName))
    .sort();
}

function parseCaseFile(content, fileName) {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const input = extractSectionBlock(content, "输入", fileName);
  const expected = extractSectionBlock(content, "预期输出", fileName);

  return {
    title: titleMatch?.[1] ?? fileName,
    input,
    expected,
  };
}

function extractSectionBlock(content, heading, fileName) {
  const lines = content.split("\n");
  const headingLine = `## ${heading}`;
  const startIndex = lines.findIndex((line) => line.trim() === headingLine);

  if (startIndex === -1) {
    throw new Error(`Missing section "${heading}" in ${fileName}`);
  }

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const candidate = lines[index].trim();
    if (candidate === "## 输入" || candidate === "## 预期输出") {
      endIndex = index;
      break;
    }
  }

  const sectionLines = lines.slice(startIndex + 1, endIndex);
  return extractFencedBlock(sectionLines, heading, fileName);
}

function extractFencedBlock(lines, heading, fileName) {
  let openIndex = -1;
  let fenceMarker = null;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)(`{3,}|~{3,})/);
    if (!match) {
      continue;
    }

    openIndex = index;
    fenceMarker = match[2];
    break;
  }

  if (openIndex === -1 || !fenceMarker) {
    throw new Error(`Missing fenced code block in section "${heading}" of ${fileName}`);
  }

  for (let index = openIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim() === fenceMarker) {
      return lines.slice(openIndex + 1, index).join("\n");
    }
  }

  throw new Error(`Missing closing fence in section "${heading}" of ${fileName}`);
}
