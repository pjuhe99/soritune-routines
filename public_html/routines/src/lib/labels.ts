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
    shareHint: '이 글이 좋았다면 친구에게도 추천해보세요.',
    shareButton: '친구에게 추천하기',
    backToToday: '오늘로 가기',
  },
  player: {
    playAll: '전체 재생',
    listenTooltip: '듣기',
    ttsUnsupported:
      '이 브라우저는 음성 재생을 지원하지 않아요. 아래 문장을 직접 소리 내어 읽어보세요.',
  },
  recording: {
    failed: '녹음에 실패했어요',
    postToCafe: '카페에 올리기',
    recommendToFriend: '친구에게 추천하기',
    cafeHint: '다운받은 녹음 파일을 카페 게시글에 첨부해주세요!',
    deleteConfirm: '이 녹음을 삭제할까요?',
    deleteFailed: '삭제에 실패했어요. 다시 시도해주세요.',
    deleteError: '삭제 중 오류가 발생했어요.',
    uploadFailedDefault: '업로드에 실패했어요.',
  },
  share: {
    sheetTitle: '친구에게 추천하기',
    kakao: '카카오톡으로 보내기',
    imageDownload: '이미지 저장',
    copyLink: '링크 복사',
    cafe: '카페에 올리기',
    webShare: '더 많은 공유 옵션',
    close: '닫기',
    copyDone: '링크를 복사했어요',
    linkCopyFailed: '링크 복사에 실패했어요. 잠시 후 다시 시도해주세요.',
    kakaoLoadFailed: '카카오톡 공유를 불러올 수 없어요. 잠시 후 다시 시도해주세요.',
    imageDownloadFailed: '이미지를 만들 수 없어요. 잠시 후 다시 시도해주세요.',
    cafeHint: '다운받은 녹음 파일을 카페 게시글에 첨부해주세요!',
    pitchTitle: '하루 10분, 영어가 조금씩 편해집니다',
    pitchDescription: '짧은 글 하나로 듣고, 읽고, 따라 말해보세요. 꾸준히 하면 차이가 느껴집니다.',
    pitchButton: '지금 시작하기',
  },
} as const;
