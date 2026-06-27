interface JerseyPreviewProps {
  number: string;
  nickname: string;
  themeColor: string;
}

export default function JerseyPreview({ number, nickname, themeColor }: JerseyPreviewProps) {
  if (!number && !nickname) return null;

  return (
    <div className="flex justify-center py-4" data-testid="jersey-preview">
      <div className="relative w-44 h-52">
        <svg viewBox="0 0 160 200" className="w-full h-full drop-shadow-lg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={`grad-${themeColor.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={themeColor} stopOpacity="1" />
              <stop offset="100%" stopColor={themeColor} stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <path
            d="M 40 10 L 10 40 L 10 60 L 30 55 L 30 180 C 30 185 35 190 40 190 L 120 190 C 125 190 130 185 130 180 L 130 55 L 150 60 L 150 40 L 120 10 C 110 5 100 0 80 0 C 60 0 50 5 40 10 Z"
            fill={`url(#grad-${themeColor.replace("#","")})`}
          />
          <path
            d="M 40 10 C 50 5 60 0 80 0 C 100 0 110 5 120 10"
            fill="none"
            stroke="white"
            strokeWidth="1"
            opacity="0.3"
          />
          <path
            d="M 55 0 C 60 15 70 20 80 20 C 90 20 100 15 105 0"
            fill={themeColor}
            stroke="white"
            strokeWidth="1"
            opacity="0.5"
          />
          <line x1="10" y1="40" x2="30" y2="55" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <line x1="150" y1="40" x2="130" y2="55" stroke="white" strokeWidth="0.5" opacity="0.3" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {number && (
            <span
              className="text-5xl font-black text-white leading-none"
              style={{ textShadow: "0 2px 10px rgba(0,0,0,0.35)" }}
            >
              {number}
            </span>
          )}
          {nickname && (
            <span
              className="text-xs font-bold text-white uppercase tracking-widest mt-1.5 max-w-28 truncate"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.35)" }}
            >
              {nickname}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
