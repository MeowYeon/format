"use strict";

let markdownToolsPromise = null;

async function loadMarkdownTools() {
  if (!markdownToolsPromise) {
    markdownToolsPromise = Promise.all([
      import("unified"),
      import("remark-parse"),
      import("unist-util-visit"),
    ]).then(([unifiedModule, remarkParseModule, visitModule]) => {
      return {
        processor: unifiedModule.unified().use(remarkParseModule.default),
        visit: visitModule.visit,
      };
    });
  }

  return markdownToolsPromise;
}

async function formatText(input) {
  const { processor, visit } = await loadMarkdownTools();
  const tree = processor.parse(input);
  const plan = buildFormattingPlan(tree, visit);
  const lines = input.split("\n");
  const outputLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];

    if (plan.codeLineNumbers.has(lineNumber)) {
      outputLines.push(line);
      continue;
    }

    let nextLine = applyLineShorthand(line);
    nextLine = replaceInlineBacktickShorthand(nextLine);

    if (plan.headingDepthByLine.has(lineNumber)) {
      nextLine = normalizeHeadingLine(nextLine, plan.headingDepthByLine.get(lineNumber));
    } else {
      nextLine = normalizeHeadingFallbackLine(nextLine);
    }

    const listItemInfo = plan.listItemsByLine.get(lineNumber);
    if (listItemInfo) {
      nextLine = normalizeListItemLine(nextLine, listItemInfo);
    } else {
      nextLine = normalizeListFallbackLine(nextLine);
    }

    outputLines.push(nextLine);
  }

  const output = outputLines.join("\n");

  return {
    output,
    changes: summarizeChanges(input, output),
  };
}

function buildFormattingPlan(tree, visit) {
  const codeLineNumbers = new Set();
  const headingDepthByLine = new Map();
  const listItemsByLine = new Map();

  visit(tree, "code", (node) => {
    if (!node.position) {
      return;
    }

    addLineRange(codeLineNumbers, node.position.start.line, node.position.end.line);
  });

  visit(tree, "heading", (node) => {
    if (!node.position) {
      return;
    }

    headingDepthByLine.set(node.position.start.line, node.depth);
  });

  visit(tree, "listItem", (node, index, parent) => {
    if (!node.position || parent?.type !== "list") {
      return;
    }

    listItemsByLine.set(node.position.start.line, {
      ordered: Boolean(parent.ordered),
    });
  });

  return {
    codeLineNumbers,
    headingDepthByLine,
    listItemsByLine,
  };
}

function addLineRange(set, startLine, endLine) {
  for (let line = startLine; line <= endLine; line += 1) {
    set.add(line);
  }
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

function normalizeHeadingLine(line, depth) {
  const match = line.match(/^(\s{0,3})(#{1,6})(\s*)(.*)$/);
  if (!match) {
    return line;
  }

  const indent = match[1];
  const content = match[4];
  if (content.trim().length === 0) {
    return line;
  }

  return `${indent}${"#".repeat(depth)} ${content.trimStart()}`;
}

function normalizeHeadingFallbackLine(line) {
  const match = line.match(/^(\s{0,3})(#{1,6})(\S.*)$/);
  if (!match) {
    return line;
  }

  const indent = match[1];
  const marker = match[2];
  const content = match[3];
  if (content.trim().length === 0) {
    return line;
  }

  return `${indent}${marker} ${content.trimStart()}`;
}

function normalizeListItemLine(line, listItemInfo) {
  if (listItemInfo.ordered) {
    const match = line.match(/^(\s*)(\d+)([.)])(\s*)(.*)$/);
    if (!match) {
      return line;
    }

    const indent = match[1];
    const marker = `${match[2]}${match[3]}`;
    const content = match[5];
    if (content.trim().length === 0) {
      return line;
    }

    return `${indent}${marker} ${content.trimStart()}`.replace(/[ \t]*$/, "  ");
  }

  const match = line.match(/^(\s*)([-*+])(\s*)(.*)$/);
  if (!match) {
    return line;
  }

  const indent = match[1];
  const marker = match[2];
  const content = match[4];
  if (content.trim().length === 0) {
    return line;
  }

  return `${indent}${marker} ${content.trimStart()}`.replace(/[ \t]*$/, "  ");
}

function normalizeListFallbackLine(line) {
  const orderedMatch = line.match(/^(\s*)(\d+\.)(\S.*)$/);
  if (orderedMatch) {
    return `${orderedMatch[1]}${orderedMatch[2]} ${orderedMatch[3].trimStart()}`.replace(/[ \t]*$/, "  ");
  }

  const unorderedMatch = line.match(/^(\s*)([-*+])(.*)$/);
  if (!unorderedMatch) {
    return line;
  }

  const indent = unorderedMatch[1];
  const marker = unorderedMatch[2];
  const content = unorderedMatch[3];

  if (content.length === 0) {
    return line;
  }

  if (content[0] === marker || /^\s/.test(content)) {
    return line;
  }

  return `${indent}${marker} ${content.trimStart()}`.replace(/[ \t]*$/, "  ");
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

module.exports = {
  formatText,
  summarizeChanges,
};
