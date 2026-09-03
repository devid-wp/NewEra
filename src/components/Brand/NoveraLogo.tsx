export function NoveraMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="45%" stopColor="#5b5cf6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="g2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* folded ribbon N — inspired by provided logo */}
      <path
        d="M18 12 L44 12 L84 68 L84 88 L58 88 L18 32 L18 88 L42 88 L42 18 L18 48 Z"
        fill="url(#g)"
        filter="url(#glow)"
      />
      {/* highlight */}
      <path d="M44 12 L62 12 L62 38 L44 12 Z" fill="#3b82f6" opacity="0.95" />
      <path d="M18 48 L38 48 L38 72 L18 92 Z" fill="#6d28d9" opacity="0.85" />
    </svg>
  );
}

export function NoveraLogo({ compact = false }: { compact?: boolean }) {
  if (compact) return <NoveraMark size={36} />;
  return (
    <div className="flex items-center gap-3">
      <NoveraMark size={36} />
      <div className="flex flex-col leading-none">
        <span className="tracking-[0.28em] font-light text-white text-[18px]">NOVERA</span>
        <span className="tracking-[0.32em] text-[7px] text-zinc-400 mt-0.5">
          YOUR <span className="text-sky-400">AI</span>. YOUR <span className="text-violet-400">SPACE</span>.
        </span>
      </div>
    </div>
  );
}
