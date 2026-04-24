import { PrismaClient } from "@prisma/client";

interface SeedRow {
  category: string;
  subtopicKo: string;
  keyPhraseEn: string;
  keyKo: string;
}

const SEED_ROWS: SeedRow[] = [
  // 웰빙
  { category: "웰빙", subtopicKo: "아침 산책 습관", keyPhraseEn: "take a walk", keyKo: "산책하다" },
  { category: "웰빙", subtopicKo: "깊은 숙면", keyPhraseEn: "get a good night's sleep", keyKo: "숙면을 취하다" },
  { category: "웰빙", subtopicKo: "스트레스 관리", keyPhraseEn: "keep stress in check", keyKo: "스트레스 관리" },
  { category: "웰빙", subtopicKo: "건강한 식단 유지", keyPhraseEn: "stick to a healthy diet", keyKo: "건강식 유지" },
  { category: "웰빙", subtopicKo: "갱년기 증상 다루기", keyPhraseEn: "deal with", keyKo: "잘 다루다" },
  { category: "웰빙", subtopicKo: "명상 루틴", keyPhraseEn: "clear your mind", keyKo: "머리를 비우다" },
  { category: "웰빙", subtopicKo: "혈압 관리", keyPhraseEn: "keep an eye on", keyKo: "주시하다" },
  { category: "웰빙", subtopicKo: "수분 섭취", keyPhraseEn: "stay hydrated", keyKo: "수분 유지" },
  { category: "웰빙", subtopicKo: "무리 없는 운동", keyPhraseEn: "work out", keyKo: "운동하다" },
  { category: "웰빙", subtopicKo: "체중 관리", keyPhraseEn: "keep the weight off", keyKo: "살이 찌지 않게 유지하다" },
  // 교육
  { category: "교육", subtopicKo: "자녀와 소통", keyPhraseEn: "open up to", keyKo: "마음을 열다" },
  { category: "교육", subtopicKo: "학습 동기 부여", keyPhraseEn: "be motivated", keyKo: "동기부여되다" },
  { category: "교육", subtopicKo: "진로 고민 함께하기", keyPhraseEn: "figure out", keyKo: "알아내다" },
  { category: "교육", subtopicKo: "대학 입시 스트레스", keyPhraseEn: "under pressure", keyKo: "압박을 받다" },
  { category: "교육", subtopicKo: "자녀 사춘기 이해", keyPhraseEn: "go through", keyKo: "겪다" },
  { category: "교육", subtopicKo: "잔소리 줄이기", keyPhraseEn: "back off", keyKo: "물러서다" },
  { category: "교육", subtopicKo: "독서 습관 들이기", keyPhraseEn: "make a habit of", keyKo: "습관이 되다" },
  { category: "교육", subtopicKo: "스마트폰 사용 규칙", keyPhraseEn: "set boundaries", keyKo: "한계를 정하다" },
  { category: "교육", subtopicKo: "자존감 키우기", keyPhraseEn: "believe in yourself", keyKo: "자신을 믿다" },
  { category: "교육", subtopicKo: "실패에서 배우기", keyPhraseEn: "learn from mistakes", keyKo: "실수에서 배우다" },
  // 자기개발
  { category: "자기개발", subtopicKo: "은퇴 준비", keyPhraseEn: "plan ahead", keyKo: "미리 계획하다" },
  { category: "자기개발", subtopicKo: "새로운 기술 배우기", keyPhraseEn: "pick up", keyKo: "익히다" },
  { category: "자기개발", subtopicKo: "재테크 기초", keyPhraseEn: "set aside", keyKo: "따로 떼어두다" },
  { category: "자기개발", subtopicKo: "평생 독서 습관", keyPhraseEn: "keep up with", keyKo: "뒤처지지 않다" },
  { category: "자기개발", subtopicKo: "시간 효율 관리", keyPhraseEn: "make the most of", keyKo: "최대한 활용하다" },
  { category: "자기개발", subtopicKo: "인생 2막 커리어", keyPhraseEn: "start over", keyKo: "다시 시작하다" },
  { category: "자기개발", subtopicKo: "부업 사이드잡", keyPhraseEn: "on the side", keyKo: "부업으로" },
  { category: "자기개발", subtopicKo: "네트워킹", keyPhraseEn: "stay in touch", keyKo: "연락을 유지하다" },
  { category: "자기개발", subtopicKo: "외국어 학습", keyPhraseEn: "get the hang of", keyKo: "감을 잡다" },
  { category: "자기개발", subtopicKo: "목표 설정", keyPhraseEn: "set your mind on", keyKo: "결심하다" },
  // 환경
  { category: "환경", subtopicKo: "플라스틱 줄이기", keyPhraseEn: "cut down on", keyKo: "줄이다" },
  { category: "환경", subtopicKo: "재활용 분리배출", keyPhraseEn: "sort out", keyKo: "분류하다" },
  { category: "환경", subtopicKo: "전기 절약", keyPhraseEn: "turn off", keyKo: "끄다" },
  { category: "환경", subtopicKo: "친환경 장보기", keyPhraseEn: "go green", keyKo: "친환경적이다" },
  { category: "환경", subtopicKo: "음식물 쓰레기 줄이기", keyPhraseEn: "throw away", keyKo: "버리다" },
  { category: "환경", subtopicKo: "중고 구매와 재사용", keyPhraseEn: "second-hand", keyKo: "중고의" },
  { category: "환경", subtopicKo: "대중교통 이용", keyPhraseEn: "get around", keyKo: "돌아다니다" },
  { category: "환경", subtopicKo: "에너지 효율 가전", keyPhraseEn: "save energy", keyKo: "에너지 절약" },
  { category: "환경", subtopicKo: "지속가능한 소비", keyPhraseEn: "think twice", keyKo: "재고하다" },
  { category: "환경", subtopicKo: "작은 실천의 힘", keyPhraseEn: "make a difference", keyKo: "차이를 만들다" },
  // 일상
  { category: "일상", subtopicKo: "가족 저녁 식사", keyPhraseEn: "sit down together", keyKo: "함께 앉다" },
  { category: "일상", subtopicKo: "이웃과 인사", keyPhraseEn: "wave hello", keyKo: "손 흔들어 인사" },
  { category: "일상", subtopicKo: "주말 집 정리", keyPhraseEn: "clean up", keyKo: "치우다" },
  { category: "일상", subtopicKo: "부모님 안부 전화", keyPhraseEn: "check in on", keyKo: "안부를 확인하다" },
  { category: "일상", subtopicKo: "동네 카페 발견", keyPhraseEn: "drop by", keyKo: "들르다" },
  { category: "일상", subtopicKo: "계절 반찬 만들기", keyPhraseEn: "put together", keyKo: "만들다" },
  { category: "일상", subtopicKo: "오래된 친구 만나기", keyPhraseEn: "catch up with", keyKo: "근황을 나누다" },
  { category: "일상", subtopicKo: "빨래 루틴", keyPhraseEn: "get done", keyKo: "끝내다" },
  { category: "일상", subtopicKo: "아침 커피 한잔", keyPhraseEn: "kick off", keyKo: "시작하다" },
  { category: "일상", subtopicKo: "잠자리 정리", keyPhraseEn: "make the bed", keyKo: "침대 정리하다" },
];

export async function seedTopicPool(prisma: PrismaClient): Promise<void> {
  for (const row of SEED_ROWS) {
    await prisma.topicPool.upsert({
      where: { uk_category_subtopic: { category: row.category, subtopicKo: row.subtopicKo } },
      create: {
        category: row.category,
        subtopicKo: row.subtopicKo,
        keyPhraseEn: row.keyPhraseEn,
        keyKo: row.keyKo,
        isActive: true,
        useCount: 0,
        lastUsedAt: null,
      },
      update: {
        keyPhraseEn: row.keyPhraseEn,
        keyKo: row.keyKo,
      },
    });
  }
  console.log(`Seeded/upserted ${SEED_ROWS.length} topic_pool rows`);
}
