"use client";

export interface VariantFormState {
  paragraphs: string;
  sentences: string;
  expressions: string;
  quiz: string;
  interview: string;
  speakSentences: string;
}

export const VARIANT_FIELD_KEYS = [
  "paragraphs",
  "sentences",
  "expressions",
  "quiz",
  "interview",
  "speakSentences",
] as const satisfies readonly (keyof VariantFormState)[];

interface Props {
  state: VariantFormState;
  onChange: (key: keyof VariantFormState, value: string) => void;
}

export function ContentVariantFields({ state, onChange }: Props) {
  return (
    <div className="space-y-4">
      {VARIANT_FIELD_KEYS.map((field) => (
        <div key={field}>
          <label className="text-[13px] font-medium text-muted-silver block mb-2">
            {field} (JSON)
          </label>
          <textarea
            value={state[field]}
            onChange={(e) => onChange(field, e.target.value)}
            className="w-full bg-near-black border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white font-mono leading-[1.6] placeholder:text-white/40 focus:border-framer-blue focus:outline-none min-h-[150px] resize-y"
          />
        </div>
      ))}
    </div>
  );
}
