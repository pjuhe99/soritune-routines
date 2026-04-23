interface ReadingViewProps {
  paragraphs: string[];
  keyPhrase: string;
}

export function ReadingView({ paragraphs, keyPhrase }: ReadingViewProps) {
  return (
    <div className="max-w-[800px] mx-auto space-y-6">
      {paragraphs.map((p, i) => {
        // Highlight key phrase in text
        const parts = p.split(new RegExp(`(${keyPhrase})`, "gi"));
        return (
          <p key={i} className="text-[20px] leading-[1.8] tracking-[-0.01em] text-text-primary">
            {parts.map((part, j) =>
              part.toLowerCase() === keyPhrase.toLowerCase() ? (
                <span key={j} className="text-text-brand-brown font-semibold">
                  {part}
                </span>
              ) : (
                <span key={j}>{part}</span>
              )
            )}
          </p>
        );
      })}
    </div>
  );
}
