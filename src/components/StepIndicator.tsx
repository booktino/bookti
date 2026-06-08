type Step = { id: number; label: string };

type StepIndicatorProps = {
  steps: Step[];
  current: number;
};

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {steps.map((step, i) => {
        const done = step.id < current;
        const active = step.id === current;
        return (
          <div key={step.id} className="flex items-center gap-1 sm:gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  active
                    ? "bg-[#0F6E56] text-white"
                    : done
                      ? "bg-[#0F6E56]/15 text-[#0F6E56]"
                      : "bg-[#EFF8F4] text-[#7A9A8E] border border-[#C8E6D8]"
                }`}
              >
                {done ? "✓" : step.id}
              </div>
              <span
                className={`hidden text-[10px] font-semibold sm:block ${
                  active ? "text-[#0F6E56]" : "text-[#7A9A8E]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mb-0 h-px w-4 sm:mb-4 sm:w-8 ${done ? "bg-[#0F6E56]/30" : "bg-[#C8E6D8]"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
