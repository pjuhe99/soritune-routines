"use client";

import { useCallback, useMemo, useState } from "react";
import { tokenizeParagraph, type Expression } from "@/lib/expression-matching";
import { ExpressionPopup } from "./expression-popup";

interface ReadingViewProps {
  paragraphs: string[];
  expressions: Expression[];
}

export function ReadingView({ paragraphs, expressions }: ReadingViewProps) {
  const tokenized = useMemo(
    () => paragraphs.map((p) => tokenizeParagraph(p, expressions)),
    [paragraphs, expressions]
  );

  const expressionMap = useMemo(() => {
    const m = new Map<string, Expression>();
    for (const e of expressions) m.set(e.expression, e);
    return m;
  }, [expressions]);

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  function handleClick(e: React.MouseEvent<HTMLElement>, key: string) {
    if (openKey === key) {
      setOpenKey(null);
      setAnchor(null);
      return;
    }
    setOpenKey(key);
    setAnchor(e.currentTarget);
  }

  const openExpression = openKey ? expressionMap.get(openKey) : null;

  const handleClose = useCallback(() => {
    setOpenKey(null);
    setAnchor(null);
  }, []);

  return (
    <>
      <div className="max-w-[800px] mx-auto space-y-6">
        {tokenized.map((tokens, i) => (
          <p
            key={i}
            className="text-[20px] leading-[1.8] tracking-[-0.01em] text-text-primary"
          >
            {tokens.map((tok, j) =>
              tok.expressionKey ? (
                <span
                  key={j}
                  onClick={(e) => handleClick(e, tok.expressionKey!)}
                  className="bg-[var(--color-highlight)] hover:bg-[var(--color-highlight-hover)] px-0.5 rounded-[2px] cursor-pointer transition-colors"
                >
                  {tok.text}
                </span>
              ) : (
                <span key={j}>{tok.text}</span>
              )
            )}
          </p>
        ))}
      </div>
      {openExpression && anchor && (
        <ExpressionPopup
          anchor={anchor}
          expression={openExpression}
          onClose={handleClose}
        />
      )}
    </>
  );
}
