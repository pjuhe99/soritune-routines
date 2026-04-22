import type { ReactElement } from "react";

// Shared 1200x630 OG card layout. Consumers pass the text payload; fonts/sizes
// are already decided to keep visuals consistent across /today and /learn.

export interface OgCardProps {
  genre?: string;
  title: string;
  subtitle?: string | null;
  keyPhrase?: string;
  keyKo?: string;
  stepLabel?: string; // e.g. "Step 3 · Expressions"
}

const BG = "#000000";
const NEAR_BLACK_GRADIENT =
  "radial-gradient(circle at 85% 15%, rgba(0, 153, 255, 0.18), transparent 55%), linear-gradient(135deg, #000000 0%, #050510 100%)";
const WHITE = "#ffffff";
const FRAMER_BLUE = "#0099ff";
const MUTED_SILVER = "#a6a6a6";

export function OgCard({
  genre,
  title,
  subtitle,
  keyPhrase,
  keyKo,
  stepLabel,
}: OgCardProps): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "72px",
        background: BG,
        backgroundImage: NEAR_BLACK_GRADIENT,
        color: WHITE,
        fontFamily: "Pretendard",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: FRAMER_BLUE,
          }}
        >
          {genre ?? "Routines"}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: MUTED_SILVER,
            letterSpacing: 3,
          }}
        >
          SORITUNE · ROUTINES
        </div>
      </div>

      {/* Center: step + title + subtitle */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          marginTop: 24,
        }}
      >
        {stepLabel && (
          <div
            style={{
              fontSize: 20,
              color: FRAMER_BLUE,
              letterSpacing: 2,
              fontWeight: 700,
              marginBottom: 18,
            }}
          >
            {stepLabel}
          </div>
        )}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: -2.2,
            color: WHITE,
            marginBottom: subtitle ? 24 : 0,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 26,
              color: "#d4d4d4",
              lineHeight: 1.45,
              maxWidth: 1000,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* KeyPhrase pill + Korean gloss */}
      {keyPhrase && (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 24,
            marginTop: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              background: "rgba(0, 153, 255, 0.15)",
              border: "1px solid rgba(0, 153, 255, 0.4)",
              borderRadius: 14,
              padding: "12px 22px",
              fontSize: 30,
              fontWeight: 700,
              color: FRAMER_BLUE,
            }}
          >
            {keyPhrase}
          </div>
          {keyKo && (
            <div style={{ fontSize: 24, color: MUTED_SILVER }}>{keyKo}</div>
          )}
        </div>
      )}
    </div>
  );
}
