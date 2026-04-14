import Link from "next/link";

type StepStatus = "locked" | "active" | "completed" | "skipped";

interface StepCardProps {
  label: string;
  description: string;
  status: StepStatus;
  href?: string;
}

const statusStyles: Record<StepStatus, string> = {
  locked: "opacity-40 cursor-not-allowed",
  active: "shadow-ring-blue cursor-pointer hover:bg-white/5",
  completed: "border border-green-500/30 bg-green-500/5",
  skipped: "border border-yellow-500/30 bg-yellow-500/5 opacity-70",
};

export function StepCard({ label, description, status, href }: StepCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[15px] font-medium text-white tracking-[-0.15px]">
          {label}
        </span>
        {status === "completed" && (
          <span className="text-green-400 text-[13px]">&#10003; 완료</span>
        )}
        {status === "skipped" && (
          <span className="text-yellow-400 text-[13px]">건너뜀</span>
        )}
        {status === "locked" && (
          <span className="text-white/30 text-[13px]">&#128274;</span>
        )}
      </div>
      <p className="text-[13px] text-muted-silver leading-[1.6]">
        {description}
      </p>
    </>
  );

  const className = `block bg-near-black rounded-xl p-5 transition-all ${statusStyles[status]}`;

  if (status === "active" && href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
