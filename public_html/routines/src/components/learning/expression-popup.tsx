"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Expression } from "@/lib/expression-matching";

interface ExpressionPopupProps {
  anchor: HTMLElement;
  expression: Expression;
  onClose: () => void;
}

const POPUP_GAP = 8;

export function ExpressionPopup({ anchor, expression, onClose }: ExpressionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (!popup) return;

    const anchorRect = anchor.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    const spaceBelow = viewportH - anchorRect.bottom;
    const spaceAbove = anchorRect.top;
    const placeBelow =
      spaceBelow >= popupRect.height + POPUP_GAP || spaceBelow >= spaceAbove;

    const top = placeBelow
      ? anchorRect.bottom + window.scrollY + POPUP_GAP
      : anchorRect.top + window.scrollY - popupRect.height - POPUP_GAP;

    let left = anchorRect.left + window.scrollX;
    const maxLeft = viewportW + window.scrollX - popupRect.width - 8;
    const minLeft = window.scrollX + 8;
    if (left > maxLeft) left = maxLeft;
    if (left < minLeft) left = minLeft;

    setPos({ top, left });
  }, [anchor, expression]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointer(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (popupRef.current?.contains(target)) return;
      if (anchor.contains(target)) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("touchstart", onPointer);
    };
  }, [anchor, onClose]);

  return (
    <div
      ref={popupRef}
      role="dialog"
      style={{
        position: "absolute",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width: "min(360px, 90vw)",
        visibility: pos ? "visible" : "hidden",
      }}
      className="z-50 bg-surface border border-border-default rounded-lg p-4 shadow-[var(--shadow-overlay)]"
    >
      <p className="text-body font-semibold text-brand-primary mb-1">{expression.expression}</p>
      <p className="text-body text-text-primary mb-2">{expression.meaning}</p>
      <p className="text-body text-text-secondary leading-[1.7]">{expression.explanation}</p>
    </div>
  );
}
