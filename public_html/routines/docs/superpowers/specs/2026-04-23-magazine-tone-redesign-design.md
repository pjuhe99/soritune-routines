# routines.soritune.com 매거진 톤 리뉴얼 — 디자인 스펙

> 작성일: 2026-04-23
> 레퍼런스: longblack.co
> 범위: routines.soritune.com 전체 (사용자 영역 + 어드민)

---

## 1. 배경 & 목표

### 배경
현재 routines는 **극단적 다크 톤**(검정 배경 + framer-blue 단일 강조)이라 "테크 프리미엄" 인상이 강하다. 학습 콘텐츠(영어 reading, listening, expressions 등)를 길게 머물며 읽는 서비스 특성상, 더 따뜻하고 가독성 높은 **매거진 톤**으로 전환하기로 결정.

### 목표
Long Black(longblack.co)의 매거진 톤 중 다음 3가지 특성을 차용한다:
- **A. 타이포그래피 우선** — 큰 한글 헤드라인이 디자인의 주인공
- **B. 종이 질감 색감** — 베이지/크림 배경 + 짙은 텍스트
- **C. 넓은 여백과 호흡** — 빠르게 스크롤하지 않고 "읽게" 만드는 페이싱

### 비차용
- **D. 책장식 카드 정렬** — routines는 도구형 서비스라 부적합

---

## 2. 디자인 결정 요약

| # | 영역 | 결정 |
|---|------|------|
| Q1 | 적용 범위 | **풀 리뉴얼** — 사용자 영역 + 어드민 모두 라이트 베이지 톤 |
| Q2 | 강조색 | **`#FF6400`** (순수 오렌지, 채도 최대) |
| Q3 | Typography | **6단계 의미 클래스 시스템** (hero/display/headline/title/body/caption) + 본문 18px / lh 1.7 |
| Q4 | Radius / Shadow | radius **8/12px** 기본, 그림자 **최소화** (border 1px로 구분) |
| Q5 | 도메인 색 | 학습 상태는 brand orange 단일, 시스템 메시지(성공/에러/경고)만 별도 딥 톤 |

---

## 3. 컬러 토큰

### 3.1 Brand
```
brand-primary           #FF6400   ← CTA, 강조 (한 화면 1~2곳만)
brand-primary-hover     #E55A00
brand-primary-active    #CC5000
brand-primary-light     #FFE4D1   ← 배지/알림 배경
```

### 3.2 Background / Surface (종이 질감)
```
bg-page                 #F1ECE6   ← 메인 베이지 (가장 매거진다움)
bg-subtle               #FAF7F2   ← 연한 크림 (카드 안쪽 영역)
surface                 #FFFFFF   ← 카드, 입력
border-default          #E7E1D8   ← 구분선 (그림자 대신 사용)
border-strong           #D3CFC6   ← 강한 구분선
```

### 3.3 Text
```
text-primary            #282828   ← 본문, 제목 (raisinblack-800)
text-secondary          #666666   ← 보조 텍스트
text-tertiary           #999999   ← 캡션, placeholder
text-inverse            #FFFFFF   ← 어두운 배경 위 텍스트 (예외적 사용)
text-brand-brown        #7C4126   ← 선택적 강조 (인용/리드문) — Bean-600
```

### 3.4 시스템 메시지 (의미별 — 매거진 친화 딥 톤)
```
success                 #2E8188   ← teal-blue-800 (저장 성공, 완료 알림)
danger                  #823F4C   ← cordovan-800 (에러, 삭제 경고)
warning                 #9A583A   ← bean-500 (주의, 만료 임박)
info                    #666666   ← gray (일반 정보)
```

> ⚠️ 일반적인 빨강/노랑/초록 대신 매거진 톤에 어울리는 딥 톤을 사용. 이 결정으로 페이지 어디에서도 "튀는 색"이 등장하지 않음.

---

## 4. Typography 시스템

### 4.1 폰트
- **Pretendard** (현재와 동일, CDN 유지)
- 한글/영문 모두 동일 폰트 사용
- 폴백: `-apple-system, BlinkMacSystemFont, system-ui`

### 4.2 6단계 의미 클래스

| 클래스 | size (PC) | size (모바일) | line-height | letter-spacing | weight | 용도 |
|--------|-----------|---------------|-------------|----------------|--------|------|
| `text-hero` | 100px | 56px | 1.0 | -0.05em | Bold (700) | 홈 메인 타이틀 (한 페이지 1번) |
| `text-display` | 56px | 36px | 1.15 | -0.03em | **Light (300)** | 서브페이지 타이틀 |
| `text-headline` | 32px | 26px | 1.3 | -0.02em | Bold (700) | 섹션 제목 |
| `text-title` | 24px | 20px | 1.4 | -0.02em | Semibold (600) | 카드 제목, 폼 라벨 |
| `text-body` | **18px** | 17px | **1.7** | -0.01em | Regular (400) | 본문 |
| `text-caption` | 13px | 12px | 1.5 | 0 | Regular (400) | 메타정보, 캡션 |

### 4.3 핵심 원칙
- **`text-display`만 Light(300)** — 큰 글자가 light면 매거진 분위기 결정적
- **모든 텍스트 negative letter-spacing** — 한글 가독성 + 매거진 톤
- **본문 line-height 1.7** — 학습 콘텐츠 가독성 확보 (이전 1.6에서 상향)

### 4.4 Reading 페이지 예외
영어 학습 reading-view는 사용자가 가장 오래 머무는 곳이라 별도로 한 단계 키움:
- `font-size: 20px`
- `line-height: 1.8`

> reading-view 컴포넌트 내부에서만 직접 적용 (별도 클래스 만들지 않음).

### 4.5 반응형 전환 방식
- **hero / display** — `clamp()`로 viewport 기반 부드러운 전환
  ```css
  font-size: clamp(56px, 8vw, 100px);   /* hero */
  font-size: clamp(36px, 5vw, 56px);    /* display */
  ```
- **headline / title / body / caption** — 768px breakpoint에서 step 전환 (`md:` 접두어로 처리)
  ```html
  <h2 class="text-[26px] md:text-[32px] ...">  <!-- headline -->
  ```
- 의미 클래스(`text-hero` 등)는 globals.css에서 위 전환을 모두 내부적으로 처리하여 사용처에선 단일 클래스만 쓰도록 한다

---

## 5. Radius & Shadow

### 5.1 Radius
```
radius-none      0       ← 매거진 평면 영역
radius-sm        6px     ← 인라인 강조, 작은 라벨
radius-md        8px     ← 버튼, 입력, 작은 카드
radius-lg        12px    ← 카드, 큰 컨테이너
radius-pill      100px   ← 토글, 태그, 배지 (작은 요소만 예외적으로)
```

### 5.2 Shadow
```
shadow-none      기본 (border 1px로 구분)
shadow-hover     0 4px 12px rgba(0,0,0,0.08)   ← hover 시
shadow-overlay   0 8px 28px rgba(0,0,0,0.15)   ← 다이얼로그/팝오버
```

### 5.3 호버 효과
카드/버튼은 호버 시 살짝 들어올림:
```css
transition: transform 0.2s, box-shadow 0.2s;
&:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}
```

---

## 6. 도메인 색 사용 규칙

### 6.1 학습 상태 (brand orange 단일 + 명도 변형)
```
완료 (complete)       #FF6400 + 체크 아이콘
진행 중 (in-progress) #FF6400 + 진행 바
미시작 (not-started)  #999999  ← brand color 사용 안 함
잠김 (locked)         #C8C8C8 + 잠금 아이콘
```

### 6.2 강조 요소
- **스트릭 숫자** ("🔥 7일 연속") → brand orange (`#FF6400`)
- **일반 통계 숫자** (완료한 콘텐츠 수 등) → text-headline + 검정 (매거진식 큰 숫자 강조)

### 6.3 6단계 학습 진행 표시
- 진도 바: brand orange 채움 + border-default 빈 영역
- 단계 인디케이터: 완료 단계는 orange filled circle, 현재 단계는 orange ring, 미완료는 gray

---

## 7. 적용 범위

### 7.1 변경 대상 파일 (예상)
| 파일 | 변경 내용 |
|------|----------|
| `src/app/globals.css` | 컬러/폰트/radius/shadow CSS 변수 전면 교체, typography 6단계 클래스 추가 |
| `src/app/layout.tsx` | body 배경색 변경 (`bg-void-black` → `bg-page`) |
| `src/components/nav.tsx` | 다크 backdrop → 라이트 backdrop, 텍스트 색 반전 |
| `src/components/ui/button.tsx` | radius pill → md, 색상 토큰 교체 |
| `src/components/ui/card.tsx` | near-black → surface(white), border 추가 |
| `src/components/ui/input.tsx` | 색상 토큰 교체 |
| `src/app/(main)/page.tsx` | text-[110px] → text-hero |
| `src/app/(main)/today/page.tsx` | 색상 토큰 + typography 클래스 적용 |
| `src/app/(main)/archive/page.tsx` | 동일 |
| `src/app/(main)/_profile/page.tsx` | 동일 |
| `src/app/(main)/learn/[contentId]/*` (6개) | 동일 + reading-view는 20px/1.8 별도 적용 |
| `src/app/(admin)/admin/layout.tsx` | 사이드바 다크 → 라이트 |
| `src/app/(admin)/admin/**` (7개 페이지) | 색상 토큰 + typography 적용 |
| `src/components/learning/*` | 색상 토큰 적용 |
| `src/components/admin/*` | 색상 토큰 적용 |

### 7.2 보존 (변경 없음)
- 페이지 라우팅 구조
- 컴포넌트 인터페이스/props
- 비즈니스 로직 (NextAuth, Prisma, API 라우트)
- Pretendard 폰트 (CDN 그대로)
- 800px 본문 컨테이너 폭 (기존 그대로 유지)

---

## 8. 비포함 (Out of Scope)

이 리뉴얼에서 **하지 않는 것**:
- 다크 모드 지원 추가 (라이트 only)
- 컴포넌트 구조 변경 (모양/색만 변경, 동작/구조는 유지)
- 신규 페이지 추가
- 모바일 전용 UX 패턴 도입
- Long Black의 책장식 카드 레이아웃 차용

---

## 9. 성공 기준

이 리뉴얼이 성공이라면:
1. **시각 일관성** — 모든 페이지에서 동일한 6단계 typography + brand color 사용
2. **가독성 개선** — 본문 18px / lh 1.7로 학습 콘텐츠 읽기 편안함
3. **매거진 톤 달성** — 베이지 배경 + 종이 질감 + Pretendard + tight letter-spacing 조합
4. **개발 일관성** — 임의 px 값(`text-[110px]`) 대신 의미 클래스(`text-hero`) 사용
5. **CSS 변수 기반** — 컬러/사이즈가 모두 토큰으로 관리되어 추후 미세 조정 용이

---

## 10. 결정 안 된 항목 (구현 단계에서 정함)

다음은 spec 단계에서 의도적으로 비워둔 항목 — 구현 시 작업 흐름에 따라 자연스럽게 결정:
- 호버 transition timing의 정확한 ease curve
- breakpoint 정확한 px 값 (현재 routines가 쓰는 값 그대로 사용 예정)
- 아이콘 라이브러리 변경 여부 (현재 lucide-react 추정 — 그대로 유지)
- 다이얼로그/모달의 backdrop blur 강도

---

## 부록 A. Long Black 디자인 토큰 출처
- 사용자가 직접 추출한 longblack.co의 Tailwind v4 globals.css 기반
- Pretendard, raisinblack 그레이스케일, Portland Orange brand color, bean/cordovan 보조 색 등을 참고
- 다만 Long Black의 정확한 brand color(`#FF5126`) 대신 **`#FF6400`** 사용 (사용자 결정)

## 부록 B. 적용 우선순위 (구현 계획에서 상세화)
1. 디자인 토큰(globals.css) 먼저 교체 — CSS 변수만 바꿔도 다수 영역 자동 전환
2. 공통 컴포넌트(button, card, input, nav) 교체
3. 사용자 영역 페이지 (today, archive, profile, learn 6단계, home)
4. 어드민 영역 페이지 (sidebar 포함 7개)
5. 학습 도메인 컴포넌트 (reading-view, listening-player 등)
6. QA: 모든 페이지 시각 점검
