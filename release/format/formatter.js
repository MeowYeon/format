"use strict";

const CODE_FENCE_PATTERN = /^(\s*)(```|~~~)/;
const HEADING_PATTERN = /^(\s{0,3})(#{1,6})(\S.*)$/;
const ORDERED_LIST_PATTERN = /^(\s*)(\d+\.)(\S.*)$/;

function formatText(input) {
  const lines = input.split("\n");
  const outputLines = [];
  let inCodeFence = false;
  let activeFence = null;

  for (const line of lines) {
    const fenceMatch = line.match(CODE_FENCE_PATTERN);

    if (fenceMatch) {
      const fenceToken = fenceMatch[2];

      if (!inCodeFence) {
        inCodeFence = true;
        activeFence = fenceToken;
      } else if (fenceToken === activeFence) {
        inCodeFence = false;
        activeFence = null;
      }

      outputLines.push(line);
      continue;
    }

    if (inCodeFence) {
      outputLines.push(line);
      continue;
    }

    outputLines.push(formatMarkdownLine(line));
  }

  const output = outputLines.join("\n");

  return {
    output,
    changes: summarizeChanges(input, output),
  };
}

function formatMarkdownLine(line) {
  let nextLine = applyLineShorthand(line);
  nextLine = replaceInlineBacktickShorthand(nextLine);
  const parsedLine = parseMarkdownLine(nextLine);

  nextLine = normalizeHeadingSpacing(nextLine, parsedLine);
  nextLine = normalizeListMarkerSpacing(nextLine, parsedLine);
  nextLine = normalizeListTrailingSpaces(nextLine, parsedLine);

  return nextLine;
}

function applyLineShorthand(line) {
  const markerIndex = line.indexOf(";;+");
  if (markerIndex === -1) {
    return line;
  }

  const prefix = line.slice(0, markerIndex);
  const content = line.slice(markerIndex + 3);
  return `${prefix}\`${content}\``;
}

function parseMarkdownLine(line) {
  const headingMatch = line.match(HEADING_PATTERN);
  if (headingMatch) {
    return {
      kind: "heading",
      indent: headingMatch[1],
      marker: headingMatch[2],
      content: headingMatch[3],
    };
  }

  const orderedListMatch = line.match(ORDERED_LIST_PATTERN);
  if (orderedListMatch) {
    return {
      kind: "ordered-list",
      indent: orderedListMatch[1],
      marker: orderedListMatch[2],
      content: orderedListMatch[3],
    };
  }

  const unorderedListMatch = parseUnorderedListLine(line);
  if (unorderedListMatch) {
    return unorderedListMatch;
  }

  return {
    kind: "text",
    content: line,
  };
}

function parseUnorderedListLine(line) {
  const match = line.match(/^(\s*)([-*+])(.*)$/);
  if (!match) {
    return null;
  }

  const indent = match[1];
  const marker = match[2];
  const content = match[3];

  if (marker === "*" && content.startsWith("*")) {
    return null;
  }

  if (content.length === 0) {
    return null;
  }

  return {
    kind: "unordered-list",
    indent,
    marker,
    content,
  };
}

function normalizeHeadingSpacing(line, parsedLine) {
  if (parsedLine.kind !== "heading") {
    return line;
  }

  return `${parsedLine.indent}${parsedLine.marker} ${parsedLine.content.trimStart()}`;
}

function normalizeListMarkerSpacing(line, parsedLine) {
  if (parsedLine.kind === "unordered-list" || parsedLine.kind === "ordered-list") {
    return `${parsedLine.indent}${parsedLine.marker} ${parsedLine.content.trimStart()}`;
  }

  return line;
}

function normalizeListTrailingSpaces(line, parsedLine) {
  if (parsedLine.kind !== "unordered-list" && parsedLine.kind !== "ordered-list") {
    return line;
  }

  return line.replace(/[ \t]*$/, "  ");
}

function summarizeChanges(before, after) {
  if (before === after) {
    return [];
  }

  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const maxLength = Math.max(beforeLines.length, afterLines.length);
  const changes = [];

  for (let index = 0; index < maxLength; index += 1) {
    const beforeLine = beforeLines[index] ?? "";
    const afterLine = afterLines[index] ?? "";

    if (beforeLine === afterLine) {
      continue;
    }

    changes.push({
      line: index + 1,
      before: beforeLine,
      after: afterLine,
    });
  }

  return changes;
}

function replaceInlineBacktickShorthand(line) {
  let result = "";
  let index = 0;
  let inCodeSpan = false;

  while (index < line.length) {
    if (line[index] === "`") {
      inCodeSpan = !inCodeSpan;
      result += line[index];
      index += 1;
      continue;
    }

    if (!inCodeSpan && line.startsWith(";;", index)) {
      const closingIndex = line.indexOf(";;", index + 2);
      if (closingIndex !== -1) {
        const content = line.slice(index + 2, closingIndex);
        result += `\`${content}\``;
        index = closingIndex + 2;
        continue;
      }
    }

    result += line[index];
    index += 1;
  }

  return result;
}

module.exports = {
  formatText,
  formatMarkdownLine,
  summarizeChanges,
};
