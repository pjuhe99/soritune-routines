// User-facing Korean strings for the routines UI.
// Reusable labels and system messages live here so tone/wording stays consistent.
// Page-unique headers (e.g., "문장을 들어볼까요?") are kept inline at their call site.

export const L = {
  common: {
    skip: '건너뛰기',
    loading: '불러오는 중...',
  },
  step: {
    captionReading: '1단계 · 읽기',
    captionListening: '2단계 · 듣기',
    captionExpressions: '3단계 · 표현',
    captionQuiz: '4단계 · 퀴즈',
    captionInterview: '5단계 · AI 인터뷰',
    captionSpeaking: '6단계 · 말하기',
  },
  next: {
    listening: '다음: 듣기',
    expressions: '다음: 표현',
    quiz: '다음: 퀴즈',
  },
  complete: {
    title: '잘하셨어요!',
    subtitle: '오늘의 학습 루틴을 마쳤어요',
    shareButton: '결과 공유하기',
    backToToday: '오늘로',
    copied: '클립보드에 복사했어요',
    shareText:
      'Routines에서 오늘의 영어 학습을 마쳤어요! https://routines.soritune.com',
  },
  player: {
    playAll: '전체 재생',
    listenTooltip: '듣기',
    ttsUnsupported:
      '이 브라우저는 음성 재생을 지원하지 않아요. 아래 문장을 직접 소리 내어 읽어보세요.',
  },
  recording: {
    failed: '녹음에 실패했어요',
  },
} as const;
