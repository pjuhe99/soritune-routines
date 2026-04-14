export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-[110px] font-bold leading-[0.85] tracking-[-5.5px] text-white text-center">
        Routines
      </h1>
      <p className="mt-6 text-lg text-muted-silver tracking-[-0.01px] leading-[1.6]">
        매일 하나의 영어 콘텐츠로 학습 루틴을 만드세요
      </p>
      <button className="mt-10 bg-white text-black px-6 py-3 rounded-pill text-[15px] font-medium tracking-[-0.15px] hover:opacity-90 transition-opacity">
        시작하기
      </button>
    </main>
  );
}
