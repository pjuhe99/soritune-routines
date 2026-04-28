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
  // For word-char edges, ensure no adjacent word char (like \b).
  // For non-word-char edges, ensure preceded/followed by whitespace or string boundary.
  const prefix = startsWithWord ? "(?<!\\w)" : "(?<!\\S)";
  const suffix = endsWithWord ? "(?!\\w)" : "(?!\\S)";
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
    const expressionKey = eligible.find(
      (e) => e.expression.toLowerCase() === matchedLower
    )?.expression;
    tokens.push({
      text: matchedText,
      expressionKey: expressionKey ?? matchedLower,
    });
    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < paragraph.length) {
    tokens.push({ text: paragraph.slice(lastIndex) });
  }

  return tokens;
}
