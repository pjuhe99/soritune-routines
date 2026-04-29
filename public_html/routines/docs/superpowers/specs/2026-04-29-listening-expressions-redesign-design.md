# 듣기·표현 파트 재설계

## 배경

routines 프로젝트의 학습 플로우 중 **듣기(Listening)**·**표현(Expressions)** 두 단계는 현재 다음 한계가 있다:

- TTS가 브라우저 디폴트 voice 한 종류로만 재생되어 사용자가 다른 톤(남/여)을 들을 수 없다.
- 표현에 발음기호(IPA)가 없어 학습자가 표현을 어떻게 발음하는지 시각적으로 확인할 수 없다.
- 표현 페이지가 모든 정보(표현·의미·설명·예문)를 펼쳐 한 번에 보여줘서 표현 목록을 한눈에 훑어보기 어렵다.

## 목표

1. 듣기·표현 두 페이지에서 **남/여 음성 토글**을 제공한다.
2. 표현 카드에 **발음기호(IPA)**를 표시한다.
3. 표현 카드를 **접힘/펼침 카드**로 바꿔 처음에는 표현+IPA만 보이고, 클릭하면 의미·설명·예문이 펼쳐진다.

## 비목표

- 음성 품질 향상을 위한 서버 TTS 도입(파일럿 단계라 Web Speech API 활용에 그침).
- 음성 선택을 사용자 계정/localStorage에 영구 저장(로그인 기반이 아니므로 페이지별 디폴트로 시작).
- 듣기 문장이나 표현 예문에 IPA 부착(시각적 노이즈 우려, 학습 타겟은 expression 본문).
- 표현 카드 펼침/접힘에 부드러운 height 애니메이션(콘텐츠 길이 가변, 깜빡임 없는 즉시 전환이 학습 톤에 적합).

## 설계 결정 요약

| 항목 | 결정 |
|---|---|
| 음성 소스 | Web Speech API의 OS 설치 voice 중 영어 남/여 매핑 |
| 음성 지속 범위 | 페이지별 디폴트(여자), 페이지 이동/새로고침 시 초기화 |
| 음성 UI | 세그먼트 토글 2개 (👩 여자 / 👨 남자) |
| IPA 생성 | AI 콘텐츠 생성 시 함께 출력 (`expressions[].phonetic`) |
| IPA 표시 범위 | expression 본문에만 |
| IPA 백필 | 일회성 스크립트로 기존 글 일괄 처리 |
| 표현 카드 펼침 | 독립 펼침(여러 개 동시 펼침 가능), 디폴트 모두 접힘 |
| 펼침 트리거 | 카드 전체 클릭(🔊 버튼은 stopPropagation) |
| 접힌 상태 노출 | expression 텍스트 + IPA + 🔊 + ▾ |
| 안내 문구 | 리스트 상단 "💡 카드를 눌러 자세한 설명을 볼 수 있어요" |

## 데이터 모델 변경

### Expression 타입

```ts
// 변경 전
{ expression, meaning, explanation, example }
// 변경 후
{ expression, phonetic, meaning, explanation, example }
```

`phonetic`은 미국식 IPA를 슬래시 표기로 담은 문자열(예: `/meɪk ə ɡʊd ɪmˈprɛʃən/`). 빈 문자열을 허용해 백필 전 또는 생성 실패 시 안전망으로 둔다. 빈 값이면 UI에서 IPA 줄을 렌더하지 않는다.

### 영향 받는 파일

- `src/lib/content-generation.ts`
  - `Expression` 타입(L43)에 `phonetic: string` 추가.
  - 검증 로직(L189-198): AI가 누락(undefined/null)으로 보낸 경우 빈 문자열로 정규화. AI가 문자열로 보낸 경우 trim해서 저장. 빈 문자열도 통과(전체 검증을 fail시키지 않음 — IPA 누락은 학습 본질에 치명적이지 않으므로 콘텐츠 생성 자체를 막지 않는다).
- `src/lib/generation-prompts.ts`
  - L155-170 expressions 스키마 설명에 다음 추가:
    - `"phonetic" (IPA): 표현의 미국식 발음을 IPA 슬래시 표기로 출력. 예: /meɪk ə ɡʊd ɪmˈprɛʃən/`
  - L168~ 의 예시 JSON에 `"phonetic"` 키 포함.
  - **정책 차이 주의**: 프롬프트는 모든 필드(phonetic 포함)를 non-empty로 출력하도록 요구한다(품질 유도). 단, validation 단(content-generation.ts)에서는 phonetic만 빈 문자열을 허용해 fallback을 둔다. 이 비대칭은 의도된 것 — 프롬프트로는 최고 품질을 끌어내되 모델이 가끔 누락해도 콘텐츠 전체 생성을 실패시키지 않기 위함.
- `src/lib/expression-matching.ts:2` — `Expression` 인터페이스에 `phonetic?: string` 추가(매칭 알고리즘은 변동 없음).
- `src/components/learning/expression-list.tsx`, `src/components/learning/expression-popup.tsx` — `phonetic` 필드 사용/타입에 추가(아래 UI 절 참조).
- `src/app/(main)/learn/[contentId]/expressions/page.tsx:9-14` — 페이지 내 Expression 타입에 `phonetic` 추가.
- DB 스키마는 변경 없음. `Content.expressions`는 이미 `Json` 컬럼이라 마이그레이션 불필요.

### 백필 스크립트

신규: `scripts/backfill-expression-phonetics.ts`

동작:

1. `prisma.content.findMany()`로 모든 Content 로드.
2. 각 글의 3개 난이도(beginner/intermediate/advanced)별 `expressions` JSON 순회.
3. `phonetic`이 비어있는 expression만 골라 IPA 생성 전용 프롬프트로 OpenAI 호출.
   - 한 글의 비어있는 expression들을 한 번에 묶어 호출(배치).
   - 프롬프트는 입력 expression 문자열 배열을 받고 **같은 길이·같은 순서의 IPA 문자열 배열**을 반환하도록 설계 (`response_format: json_object` + 명시적 키 사용).
   - 출력은 `{ "phonetics": ["/…/", "/…/", …] }` 형태로 받아 인덱스 기반으로만 머지.
4. 결과를 expression 객체에 머지해 `prisma.content.update`로 저장.

검증 / 안전장치:

- **배치 응답 길이 검증**: 입력 expression 수와 응답 `phonetics` 배열 길이가 다르면 해당 배치 전체를 1회 재시도. 재시도도 실패하면 그 배치는 스킵하고 로깅(전체 중단 X).
- **인덱스 기반 머지**: 응답을 expression 텍스트로 매칭하지 않고 입력 순서 인덱스로만 매칭. 모델이 expression 텍스트를 살짝 변형해 돌려보내도 매칭이 깨지지 않게 하기 위함.
- **슬래시 표기 보정**: 응답 IPA가 `/…/` 슬래시로 감싸져 있지 않으면 코드에서 양 끝에 `/` 추가. 빈 문자열·공백만 있는 경우 빈 문자열로 둠.
- **타입 검증**: 각 IPA 항목이 문자열이 아닌 경우 빈 문자열로 둠.

옵션:

- `--dry`: 생성·DB 업데이트 없이 대상만 로깅.
- 이미 채워진 항목은 스킵(멱등성 보장: 재실행해도 채워진 IPA는 건드리지 않음).
- expression 단위 실패는 빈 IPA로 두고 다음 항목 진행(전체 중단 X).

실행: `pnpm tsx scripts/backfill-expression-phonetics.ts [--dry]`

규모: 글 9개 × 표현 평균 5개 × 난이도 3개 ≈ 135 IPA. 토큰/시간 비용 미미.

## 음성 선택

### 모듈 분리

신규: `src/lib/voice-picker.ts`

```ts
export type VoiceGender = "female" | "male";
export interface VoicePick {
  female: SpeechSynthesisVoice | null;
  male: SpeechSynthesisVoice | null;
}
export function pickEnglishVoices(voices: SpeechSynthesisVoice[]): VoicePick;
```

선택 알고리즘 (우선순위 순):

1. **이름 화이트리스트**: 영어 voice(`lang.startsWith("en")`) 중 알려진 이름을 매핑.
   - 여자: `Samantha`, `Karen`, `Moira`, `Tessa`, `Veena`, `Allison`, `Ava`, `Susan`, `Victoria`, `Zira`, `Google US English Female`, `Microsoft Aria`, `Microsoft Jenny` 등.
   - 남자: `Daniel`, `Alex`, `Aaron`, `Fred`, `Tom`, `Oliver`, `Rishi`, `Google UK English Male`, `Microsoft Guy`, `Microsoft David` 등.
2. **이름에 `female`/`male` 키워드 포함** 시 매핑.
3. **fallback**: 위에서 못 채우면 en-* voice를 정렬(en-US → en-GB → en-* 순)해서 빈 슬롯에 순차 배정. 한쪽이 끝까지 비면 `null`.

### SpeechContext 확장

`src/contexts/speech-context.tsx`:

```ts
interface SpeechCapabilities {
  ttsAvailable: boolean;
  voicePick: VoicePick;
}
```

- 마운트 시 `speechSynthesis.getVoices()`를 호출하고 `pickEnglishVoices`로 변환해 저장.
- Chrome은 voice 목록을 비동기로 채우므로 `voiceschanged` 이벤트를 한 번 청취해 한 번 더 갱신 후 detach.
- `ttsAvailable`이 false면 `voicePick`은 `{ female: null, male: null }`로 둔다.

### 음성 토글 컴포넌트

신규: `src/components/learning/voice-toggle.tsx`

```tsx
<VoiceToggle value={gender} onChange={setGender} pick={pick} />
```

- 세그먼트 버튼 2개(👩 여자 / 👨 남자). 활성 상태는 `level-tabs.tsx`와 톤을 맞춘 클래스 사용.
- 한쪽 voice가 `null`이면 그 버튼은 `disabled` + `title="이 브라우저에서 ○○ 음성을 사용할 수 없습니다"`.
- `pick.female == null && pick.male == null`인 경우(예: ttsAvailable=true이지만 영어 voice를 못 고른 환경): **토글 자체를 숨기고 utterance.voice를 지정하지 않은 채 재생한다.** 브라우저는 OS 기본 voice로 재생함. `lang="en-US"`만 세팅. 영어 voice가 아예 없는 환경에서도 학습 자체는 가능하게 유지하기 위함이며, 별도 안내 메시지는 띄우지 않는다(노이즈 우려). `ttsAvailable=false`인 경우는 기존 listening-player의 "This browser does not support…" fallback 메시지가 그대로 동작.

### 컴포넌트별 상태 + 통합

VoiceToggle은 `ListeningPlayer`와 `ExpressionList` **내부에** 둔다. 페이지 컴포넌트(`listening/page.tsx`, `expressions/page.tsx`)는 voice 상태를 알 필요가 없다 — 두 컴포넌트가 각자 자기 상태를 관리한다.

- `listening-player.tsx` (현 line 11에 useState 추가)
  - 자체 `useState<VoiceGender>("female")` 보유, `useSpeech()`에서 `voicePick` 가져옴.
  - 헤더 행: 좌측에 VoiceToggle, 우측에 기존 "Play All" 버튼.
  - `speak/playAll`에서 `utterance.voice = selectedVoice` 적용(아래 "selectedVoice 결정 규칙" 참조).
- `expression-list.tsx` (현 line 16에 useState 추가)
  - 자체 `useState<VoiceGender>("female")` 보유.
  - 헤더 영역: 좌측에 안내 문구, 우측에 VoiceToggle.
  - `speak`에서 `utterance.voice = selectedVoice` 적용.

### selectedVoice 결정 규칙

`gender` 상태 + `voicePick`이 주어졌을 때 실제로 utterance에 박을 voice는 다음 규칙으로 결정한다.

```ts
const selectedVoice =
  voicePick[gender] ?? voicePick.female ?? voicePick.male ?? null;
```

- 사용자가 선택한 성별이 `null`이면 다른 성별로 자동 fallback. 둘 다 `null`이면 `null`(브라우저 기본 voice가 사용됨).
- 추가로, **컴포넌트 마운트 직후 또는 `voicePick`이 비동기로 채워지는 시점**에 `gender`가 사용 불가한 경우 사용 가능한 쪽으로 한 번 자동 보정한다:
  ```ts
  useEffect(() => {
    if (gender === "female" && !voicePick.female && voicePick.male) {
      setGender("male");
    } else if (gender === "male" && !voicePick.male && voicePick.female) {
      setGender("female");
    }
  }, [voicePick.female, voicePick.male]);
  ```
  → 디폴트가 여자인데 여자 voice가 없는 환경에서 활성 선택지가 disabled된 채로 남는 문제 방지. 사용자가 의도적으로 disabled가 아닌 쪽을 선택한 뒤에는 위 effect가 다시 트리거되어도 그쪽이 살아있으면 그대로 유지된다.

### voice 변경 시 동작 + 재생 상태 정리

토글 클릭 시 다음을 한 번에 수행한다:

1. `window.speechSynthesis.cancel()` 즉시 호출해 진행 중인 재생을 끊는다.
2. 같은 핸들러에서 `setPlayingIndex(null)`(ListeningPlayer)을 호출해 재생 UI 상태를 즉시 비운다. 이유: `cancel()`이 모든 브라우저에서 일관되게 `onend`를 호출한다는 보장이 없어 UI에 "재생 중" 강조가 남을 수 있음.
3. 다음 클릭부터 새 voice 사용.

또한 `speak/playAll`에서 생성하는 `SpeechSynthesisUtterance`마다 `onerror` 핸들러를 추가해 `setPlayingIndex(null)`로 정리하도록 한다 — `onend`가 호출되지 않는 에러 경로(취소·voice 로드 실패 등)에서 UI가 멈추는 걸 방지.

`expression-list.tsx`는 `playingIndex` 상태가 없지만(현재 단순 `speak`만 호출), voice 변경 시 `cancel()`은 동일하게 호출해 진행 중인 재생을 끊는다.

## 표현 카드 접힘/펼침 UI

### 컴포넌트 분리

`src/components/learning/expression-list.tsx`를 다음 구조로 정리:

- `ExpressionList` (export) — voice 토글, 안내 문구, 카드 매핑.
- `ExpressionCard` (내부) — 한 카드의 접힘/펼침 + 콘텐츠 렌더. 자체 `useState<boolean>(false)` 보유.

각 카드가 자체 상태를 가져 부모는 collective 상태를 알 필요가 없다. (전체 펼치기 같은 기능을 미래에 추가하면 그때 부모로 끌어올린다.)

### 접힌 상태 (디폴트)

```
┌──────────────────────────────────────────────────┐
│  make a good impression                  🔊  ▾  │
│  /meɪk ə ɡʊd ɪmˈprɛʃən/                          │
└──────────────────────────────────────────────────┘
```

- 첫 행: `expression`(굵게, 브랜드 컬러) + 우측에 🔊 + 회전 화살표 ▾.
- 둘째 행: `phonetic`(IPA, `text-text-secondary`). `phonetic`이 빈 문자열이면 이 행 자체 생략(공간도 차지 안 함).

### 펼친 상태

```
┌──────────────────────────────────────────────────┐
│  make a good impression                  🔊  ▴  │
│  /meɪk ə ɡʊd ɪmˈprɛʃən/                          │
│  ─────────────────────────────────────────────── │
│  좋은 인상을 주다                                  │
│  ...explanation 한국어 설명...                     │
│  ┌────────────────────────────────────────────┐  │
│  │ "He always tries to make a good impression"│  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

- 헤더(첫 두 행) 아래 얇은 구분선(`border-t border-border-default`).
- 그 아래 meaning → explanation → example 박스 순서. 각 요소는 기존 expression-list의 스타일 그대로 재사용.

### 클릭 동작

- 카드 outer 요소: `<div role="button" tabIndex={0} aria-expanded={expanded} onClick={toggle} onKeyDown={onKey}>`.
  - `<button>`을 outer로 못 씀: 내부 🔊 버튼이 nested button이 되기 때문.
- `onClick`(outer): `if (e.target !== e.currentTarget && (e.target as HTMLElement).closest("button")) return;` — 내부 버튼 클릭이 outer로 버블해서 펼침이 트리거되는 걸 막는다. (🔊 버튼 자체에도 `onClick={(e) => { e.stopPropagation(); speak(...); }}`로 이중 보호.)
- `onKeyDown`(outer): `if (e.target !== e.currentTarget) return;` — 🔊 버튼에 포커스가 간 상태에서 Enter/Space를 누르면 outer까지 키 이벤트가 버블해 카드도 펼쳐지는 문제 방지. outer 자신이 포커스 받은 경우만 `Enter` 또는 `" "`(Space)에 대해 `e.preventDefault()` + 토글.
- ▾ 화살표: `transition-transform duration-200`으로 회전 애니메이션. 펼치면 `rotate-180`.

### 콘텐츠 전환

- 펼침/접힘은 `display`/조건부 렌더 단순 전환(콘텐츠 길이 가변이라 height transition은 깜빡임 위험).
- 화살표 아이콘만 부드러운 회전.

### 안내 문구

ExpressionList 헤더 좌측, voice 토글 반대편:

```
💡 카드를 눌러 자세한 설명을 볼 수 있어요
```

- 스타일: `text-caption text-text-tertiary mb-3`.
- 카드가 0개일 때(데이터 로딩 중)는 표시하지 않음(이미 페이지 차원 Loading 메시지가 있음).

### 헤더 레이아웃

```
┌─ ExpressionList ──────────────────────────────────┐
│  💡 카드를 눌러 자세한 설명을 볼 수 있어요   [👩][👨]│
│                                                   │
│  ┌─ Card 1 (collapsed) ─┐                         │
│  ┌─ Card 2 (collapsed) ─┐                         │
│  ...                                              │
└───────────────────────────────────────────────────┘
```

- `flex justify-between items-center` 한 행. 모바일 좁은 화면에선 `flex-wrap` + `gap`.

## ExpressionPopup 처리

`src/components/learning/expression-popup.tsx`(reading 페이지에서 형광펜 클릭 시 뜨는 팝업)에도 `phonetic`을 표시한다.

- 데이터 경로(자동): 같은 `Content.expressions` JSON을 reading 페이지에서도 사용하므로, `Expression` 인터페이스(`expression-matching.ts:2`)에 `phonetic?: string`를 추가하면 팝업이 받는 데이터에 IPA가 자동으로 들어온다. 별도 fetch/매칭 변경 없음.
- 표시 코드(추가 필요): 팝업의 `expression` 행 아래(`expression-popup.tsx` L78과 L79 사이)에 IPA 렌더 한 줄을 **새로 추가**해야 한다. 데이터가 자동으로 흐른다고 화면에 자동으로 뜨는 게 아님 — UI 코드 수정 필요.
- 비어있으면 줄 생략(expression-list와 동일 규칙).
- 팝업에는 음성 토글을 추가하지 않는다(scope 외). reading 페이지 자체는 이번 작업 범위가 아니지만 같은 데이터 타입을 공유하므로 IPA만 표시 동기화.

## 테스트 계획

### 단위 테스트

- `src/lib/voice-picker.test.ts` (신규)
  - 화이트리스트 매칭(Samantha → female, Daniel → male).
  - "female"/"male" 키워드 매칭.
  - fallback 동작(en-US 우선, 빈 슬롯 채움).
  - 한쪽이 비는 경우 `null` 반환 — **female만 있고 male 없음**, **male만 있고 female 없음** 두 케이스 모두.
  - 영어 voice가 0개(en-* 매칭 없음)인데 voice 배열은 비어있지 않은 경우 둘 다 `null` (ttsAvailable=true 환경에서 영어 voice 누락 시나리오).
  - voice 배열 자체가 빈 배열인 경우 둘 다 `null`.

### 수동 검증 시나리오

1. 듣기 페이지에서 음성 토글 전환 시 voice가 바뀌는지(Mac Safari, Chrome, Android Chrome).
2. 한쪽 voice만 있는 환경(예: Windows 기본)에서 다른 쪽 버튼이 disabled 되는지.
3. voice 재생 중 토글하면 즉시 끊기고 다음 재생부터 새 voice 적용되는지.
4. 표현 페이지 진입 시 모든 카드가 접혀 있는지, 첫 행에 expression+IPA 보이는지.
5. 카드 클릭 → 펼침. 다른 카드도 클릭하면 둘 다 펼쳐짐.
6. 🔊 클릭 시 카드는 펼쳐지지 않고 음성만 재생.
7. 키보드 Tab으로 카드 포커스 이동 → Enter/Space로 토글.
8. IPA가 비어있는(백필 전) expression에선 IPA 줄이 사라지고 헤더 높이가 자연스럽게 줄어드는지.
9. 백필 스크립트 `--dry` 실행 시 대상 로깅만 되고 DB 변동 없는지.
10. 백필 실행 후 모든 글의 모든 난이도에서 IPA가 채워졌는지.

## 마이그레이션 / 롤아웃 순서

1. 코드 변경 PR 머지(main 단일 브랜치).
2. 백필 스크립트 `--dry` 실행 → 대상 글/표현 수 확인.
3. 백필 스크립트 본실행 → DB 업데이트.
4. PM2 restart.
5. 운영 페이지에서 수동 검증 시나리오 수행.

## 위험 / 미해결

- **Web Speech API voice 가용성**: 한국 사용자 다수가 쓰는 Windows Chrome 기본 환경에서 영어 voice가 1개만 있는 경우 토글의 한쪽이 항상 disabled로 보임. 이는 본 설계의 의도된 동작이며, 품질 이슈가 큰 경우 후속 작업에서 서버 TTS(섹션 1 비목표)로 이전 검토.
- **AI IPA 정확도**: 일반적인 영어 표현은 잘 나오나 신조어/고유명사 등에서 부정확할 수 있음. 어드민 콘텐츠 편집에서 수동 수정 가능한 경로가 이미 있다면 그쪽으로 보정. (콘텐츠 편집 UI에 IPA 필드 노출은 후속 작업.)
