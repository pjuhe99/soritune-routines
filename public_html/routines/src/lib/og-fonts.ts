// Fetches Pretendard from jsdelivr for OG image rendering (Next.js / satori).
// Cached in module scope so each Node process only pays the fetch cost once
// per OG variant; Next.js itself caches generated OG images so fetches are
// infrequent in practice.

const BASE =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static";

let cache: { bold: ArrayBuffer; regular: ArrayBuffer } | null = null;

export async function getPretendardFonts(): Promise<{
  bold: ArrayBuffer;
  regular: ArrayBuffer;
}> {
  if (cache) return cache;
  const [bold, regular] = await Promise.all([
    fetch(`${BASE}/Pretendard-Bold.otf`).then((r) => {
      if (!r.ok) throw new Error(`Pretendard Bold fetch failed: ${r.status}`);
      return r.arrayBuffer();
    }),
    fetch(`${BASE}/Pretendard-Regular.otf`).then((r) => {
      if (!r.ok) throw new Error(`Pretendard Regular fetch failed: ${r.status}`);
      return r.arrayBuffer();
    }),
  ]);
  cache = { bold, regular };
  return cache;
}
