export interface Expression {
  expression: string;
  meaning: string;
  explanation: string;
  example: string;
}

export interface ParagraphToken {
  text: string;
  expressionKey?: string;
}

const MIN_EXPRESSION_LENGTH = 3;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordBoundaryPattern(expr: string): string {
  const escaped = escapeRegex(expr);
  const startsWithWord = /^\w/.test(expr);
  const endsWithWord = /\w$/.test(expr);
  // Reject adjacent word characters on either side (like \b), regardless of
  // whether the expression edge is a word char or a non-word char (e.g. C++).
  // Using (?<!\w)/(?!\w) on both branches allows punctuation to terminate a
  // non-word-ending expression (e.g. "C++," or "C++."), whereas the previous
  // (?<!\S)/(?!\S) wrongly required whitespace or string boundary.
  const prefix = startsWithWord ? "(?<!\\w)" : "(?<!\\w)";
  const suffix = endsWithWord ? "(?!\\w)" : "(?!\\w)";
  return `${prefix}(${escaped})${suffix}`;
}

export function tokenizeParagraph(
  paragraph: string,
  expressions: Expression[]
): ParagraphToken[] {
  const eligible = expressions
    .filter((e) => e.expression.length >= MIN_EXPRESSION_LENGTH)
    .sort((a, b) => b.expression.length - a.expression.length);

  if (eligible.length === 0) {
    return [{ text: paragraph }];
  }

  const pattern = eligible.map((e) => wordBoundaryPattern(e.expression)).join("|");
  const regex = new RegExp(pattern, "gi");

  const tokens: ParagraphToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(paragraph)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: paragraph.slice(lastIndex, match.index) });
    }
    const matchedText = match[0];
    const matchedLower = matchedText.toLowerCase();
    // expressionKey is always defined: the regex is built from eligible, so
    // every match corresponds to an eligible entry.
    const expressionKey = eligible.find(
      (e) => e.expression.toLowerCase() === matchedLower
    )!.expression;
    tokens.push({
      text: matchedText,
      expressionKey,
    });
    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < paragraph.length) {
    tokens.push({ text: paragraph.slice(lastIndex) });
  }

  return tokens;
}
