import { describe, it, expect } from "vitest";
import { tokenizeParagraph, type Expression } from "./expression-matching";

const exp = (expression: string, meaning = "의미", explanation = "설명", example = "ex"): Expression => ({
  expression,
  meaning,
  explanation,
  example,
});

describe("tokenizeParagraph", () => {
  it("매칭 대상 없으면 토큰 1개 (paragraph 전체)", () => {
    const result = tokenizeParagraph("This is a plain sentence.", []);
    expect(result).toEqual([{ text: "This is a plain sentence." }]);
  });

  it("expression 1개가 본문에 1번 등장", () => {
    const result = tokenizeParagraph(
      "I plan ahead every morning.",
      [exp("plan ahead")]
    );
    expect(result).toEqual([
      { text: "I " },
      { text: "plan ahead", expressionKey: "plan ahead" },
      { text: " every morning." },
    ]);
  });

  it("같은 expression이 본문에 2번 등장하면 둘 다 매칭, 같은 expressionKey", () => {
    const result = tokenizeParagraph(
      "plan ahead and plan ahead again.",
      [exp("plan ahead")]
    );
    const matches = result.filter((t) => t.expressionKey);
    expect(matches.length).toBe(2);
    expect(matches[0].expressionKey).toBe("plan ahead");
    expect(matches[1].expressionKey).toBe("plan ahead");
  });

  it("overlap 시 longer-first 우선 (긴 expression이 짧은 걸 잡아먹음)", () => {
    const result = tokenizeParagraph(
      "make a good impression on them",
      [exp("good impression"), exp("make a good impression")]
    );
    const matches = result.filter((t) => t.expressionKey);
    expect(matches.length).toBe(1);
    expect(matches[0].expressionKey).toBe("make a good impression");
    expect(matches[0].text).toBe("make a good impression");
  });

  it("case-insensitive 매칭, 원본 대소문자는 보존", () => {
    const result = tokenizeParagraph(
      "Plan Ahead is important.",
      [exp("plan ahead")]
    );
    const match = result.find((t) => t.expressionKey);
    expect(match).toBeDefined();
    expect(match!.text).toBe("Plan Ahead");
    expect(match!.expressionKey).toBe("plan ahead");
  });

  it("길이 ≤ 2 expression은 매칭 안 됨", () => {
    const result = tokenizeParagraph(
      "I go to the store.",
      [exp("go")]
    );
    expect(result).toEqual([{ text: "I go to the store." }]);
  });

  it("길이 = 3 expression은 매칭됨 (boundary)", () => {
    const result = tokenizeParagraph(
      "I see the cat.",
      [exp("cat")]
    );
    const match = result.find((t) => t.expressionKey);
    expect(match).toBeDefined();
    expect(match!.text).toBe("cat");
  });

  it("구두점 인접 (plan ahead.) 정상 매칭", () => {
    const result = tokenizeParagraph(
      "Always plan ahead.",
      [exp("plan ahead")]
    );
    const match = result.find((t) => t.expressionKey);
    expect(match).toBeDefined();
    expect(match!.text).toBe("plan ahead");
  });

  it("부분 단어는 매칭 안 됨 (plan은 planet에 매칭되지 않음)", () => {
    const result = tokenizeParagraph(
      "I love planets.",
      [exp("plan")]
    );
    expect(result).toEqual([{ text: "I love planets." }]);
  });

  it("정규식 메타문자 escape (괄호/플러스)", () => {
    const result = tokenizeParagraph(
      "He used C++ today.",
      [exp("C++")]
    );
    const match = result.find((t) => t.expressionKey);
    expect(match).toBeDefined();
    expect(match!.text).toBe("C++");
  });

  it("비-단어 끝 표현 (C++) 이 구두점 앞에 와도 매칭", () => {
    const result = tokenizeParagraph(
      "Languages: C++, Python.",
      [exp("C++")]
    );
    const match = result.find((t) => t.expressionKey);
    expect(match).toBeDefined();
    expect(match!.text).toBe("C++");
  });
});
