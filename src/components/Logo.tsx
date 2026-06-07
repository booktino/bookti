type LogoProps = {
  showWordmark?: boolean;
  size?: "sm" | "md";
};

export function Logo({ showWordmark = true, size = "md" }: LogoProps) {
  const box = size === "sm" ? 32 : 36;
  const fontSize = size === "sm" ? 12 : 14;
  const wordmarkSize = size === "sm" ? 15 : 17;

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex items-center justify-center rounded-lg bg-[#0F6E56] font-extrabold"
        style={{ width: box, height: box, fontSize }}
      >
        <span className="text-white">B</span>
        <span className="text-[#5DCAA5]">ti</span>
      </div>
      {showWordmark && (
        <span
          className="font-bold tracking-tight text-[#0D3B2E]"
          style={{ fontSize: wordmarkSize }}
        >
          Bookti
        </span>
      )}
    </div>
  );
}
