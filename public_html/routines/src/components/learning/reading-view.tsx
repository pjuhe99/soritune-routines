interface ReadingViewProps {
  paragraphs: string[];
  keyPhrase: string;
}

export function ReadingView({ paragraphs, keyPhrase }: ReadingViewProps) {
  return (
    <div className="space-y-6">
      {paragraphs.map((p, i) => {
        // Highlight key phrase in text
        const parts = p.split(new RegExp(`(${keyPhrase})`, "gi"));
        return (
          <p key={i} className="text-[15px] text-white/90 leading-[1.7] tracking-[-0.01px]">
            {parts.map((part, j) =>
              part.toLowerCase() === keyPhrase.toLowerCase() ? (
                <span key={j} className="text-framer-blue font-medium">
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
