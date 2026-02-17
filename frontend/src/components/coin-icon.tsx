import { cn } from "@/lib/utils";

type CoinIconProps = {
  symbol: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZE_PX: Record<string, number> = {
  xs: 16, sm: 20, md: 24, lg: 32, xl: 40,
};

const SIZE_MAP = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
};

/* ── SVG coin logos ──
   Each entry: [bgColor, svgPathData, viewBox(optional)]
   Paths are drawn as white (#fff) on the bg circle.
*/
type CoinDef = { bg: string; path: string; vb?: string };

const COIN_SVGS: Record<string, CoinDef> = {
  BTC: {
    bg: "#F7931A",
    // Bitcoin "₿" stylized
    path: "M14.5 10.3c.2-1.3-.8-2-2.2-2.5l.4-1.8-1-.3-.4 1.7c-.3-.1-.5-.1-.8-.2l.4-1.7-1-.3-.5 1.8c-.2-.1-.4-.1-.7-.2l-1.3-.3-.3 1.1s.7.2.7.2c.4.1.5.3.5.6l-.6 2.3c0 0 .1 0 .1 0l-.1 0-.8 3.2c-.1.1-.2.3-.6.2 0 0-.7-.2-.7-.2l-.5 1.2 1.2.3c.2.1.5.1.7.2l-.5 1.8 1 .3.4-1.8c.3.1.5.2.8.2l-.4 1.8 1 .3.5-1.8c1.8.3 3.2.2 3.8-1.5.5-1.3 0-2.1-1-2.6.7-.2 1.3-.7 1.4-1.7zm-2.5 3.5c-.3 1.4-2.7.6-3.5.4l.6-2.5c.8.2 3.2.6 2.9 2.1zm.4-3.5c-.3 1.2-2.3.6-2.9.5l.6-2.3c.7.2 2.7.5 2.3 1.8z",
  },
  ETH: {
    bg: "#627EEA",
    // Ethereum diamond
    path: "M12 1.5l-6.5 10.7 6.5 3.8 6.5-3.8L12 1.5zm-6.5 12l6.5 9 6.5-9-6.5 3.8-6.5-3.8z",
  },
  SOL: {
    bg: "#000000",
    // Solana triple-bar
    path: "M5.5 17.1l1.3-1.3c.1-.1.3-.2.4-.2h11.5c.3 0 .4.3.2.5l-1.3 1.3c-.1.1-.3.2-.4.2H5.7c-.3 0-.4-.3-.2-.5zm1.3-5.3c.1-.1.3-.2.4-.2h11.5c.3 0 .4.3.2.5l-1.3 1.3c-.1.1-.3.2-.4.2H5.7c-.3 0-.4-.3-.2-.5l1.3-1.3zm11.9-2.5l-1.3-1.3c-.1-.1-.3-.2-.4-.2H5.5c-.3 0-.4.3-.2.5l1.3 1.3c.1.1.3.2.4.2h11.5c.3 0 .4-.3.2-.5z",
  },
  XRP: {
    bg: "#23292F",
    // XRP "X" lines
    path: "M17.2 5h2.1l-4.8 4.7c-1.4 1.3-3.6 1.3-5 0L4.7 5h2.1l3.8 3.7c.8.8 2 .8 2.8 0L17.2 5zM6.8 19H4.7l4.8-4.7c1.4-1.3 3.6-1.3 5 0L19.3 19h-2.1l-3.8-3.7c-.8-.8-2-.8-2.8 0L6.8 19z",
  },
  USDT: {
    bg: "#26A17B",
    // Tether "₮"
    path: "M12 14.5c-3.7 0-6.7-.8-6.7-1.8s3-1.8 6.7-1.8 6.7.8 6.7 1.8-3 1.8-6.7 1.8zm3.3-5.6v-2h4v-2.4h-14.6v2.4h4v2c-3.8.2-6.7 1.2-6.7 2.4s2.9 2.2 6.7 2.4v5.8h2.6v-5.8c3.8-.2 6.7-1.2 6.7-2.4s-2.9-2.2-6.7-2.4z",
  },
  USDC: {
    bg: "#2775CA",
    // USDC dollar sign in circle
    path: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-.2 15.5v1h-1.3v-1c-1.5-.2-2.6-.9-3-1.5l1.1-.9c.4.5 1.1 1 2 1 .8 0 1.5-.3 1.5-1 0-.6-.4-.9-1.7-1.3-1.7-.5-2.9-1.1-2.9-2.6 0-1.3 1-2.2 2.6-2.5V7.5h1.3v1c1.1.1 2 .6 2.6 1.2l-1 1c-.4-.4-1-.8-1.7-.8-.8 0-1.3.4-1.3.9s.5.9 1.8 1.3c1.8.6 2.8 1.2 2.8 2.7 0 1.3-1 2.3-2.8 2.6z",
  },
  BNB: {
    bg: "#F3BA2F",
    // BNB diamond shape
    path: "M12 4.5l-2.2 2.2 2.2 2.2 2.2-2.2L12 4.5zM6.3 10.2L4.1 12.4l2.2 2.2 2.2-2.2-2.2-2.2zm11.4 0l-2.2 2.2 2.2 2.2 2.2-2.2-2.2-2.2zM12 15.1l-2.2 2.2L12 19.5l2.2-2.2L12 15.1zm0-5.3L9.8 12 12 14.2 14.2 12 12 9.8z",
  },
  ADA: {
    bg: "#0033AD",
    // Cardano circles pattern
    path: "M12 7a1 1 0 110-2 1 1 0 010 2zm0 12a1 1 0 110-2 1 1 0 010 2zm-4.3-2.5a1 1 0 110-2 1 1 0 010 2zm8.6 0a1 1 0 110-2 1 1 0 010 2zm-8.6-9a1 1 0 110-2 1 1 0 010 2zm8.6 0a1 1 0 110-2 1 1 0 010 2zM12 13.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM6 12a1 1 0 110-2 1 1 0 010 2zm12 0a1 1 0 110-2 1 1 0 010 2z",
  },
  DOGE: {
    bg: "#C2A633",
    // Doge "D"
    path: "M9.5 7h2.5c3 0 5 2 5 5s-2 5-5 5H9.5V7zm2 2v6h.5c1.7 0 3-1.3 3-3s-1.3-3-3-3h-.5zM8 10v4h1v-4H8z",
  },
  DOT: {
    bg: "#E6007A",
    // Polkadot circles
    path: "M12 5a2.5 2.5 0 110 5 2.5 2.5 0 010-5zm0 9a2.5 2.5 0 110 5 2.5 2.5 0 010-5zm-5-3a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm10 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z",
  },
  AVAX: {
    bg: "#E84142",
    // Avalanche "A" triangle
    path: "M12 5l-7.5 13h4.5l3-5.2 3 5.2h4.5L12 5zm0 4.2L14.3 14h-4.6L12 9.2z",
  },
  MATIC: {
    bg: "#8247E5",
    // Polygon shape
    path: "M16.5 8.3l-3-1.7c-.3-.2-.7-.2-1 0l-3 1.7c-.3.2-.5.5-.5.9v3.4c0 .4.2.7.5.9l3 1.7c.3.2.7.2 1 0l3-1.7c.3-.2.5-.5.5-.9V9.2c0-.4-.2-.7-.5-.9zm-4.5 6.4l-3-1.7V9.6l3-1.7 3 1.7v3.4l-3 1.7z",
  },
  LINK: {
    bg: "#2A5ADA",
    // Chainlink hexagon
    path: "M12 3l-1.5.9-5 2.9L4 7.6v8.8l1.5.9 5 2.9 1.5.8 1.5-.9 5-2.9 1.5-.8V7.6l-1.5-.9-5-2.9L12 3zm0 2.5l4.1 2.4v4.7L12 15.1 7.9 12.6V8L12 5.5z",
  },
  UNI: {
    bg: "#FF007A",
    // Uniswap unicorn simplified
    path: "M10.5 4c-.4 0-.8.3-.8.8 0 .2.1.3.2.5.5.6.8 1.4.8 2.2 0 1.8-1.5 3.3-3.3 3.3-.8 0-1.6-.3-2.2-.8-.2-.1-.3-.2-.5-.2-.4 0-.8.3-.8.8 0 .2.1.4.2.5C5.5 12.3 7.2 13 9 13c3.3 0 6-2.7 6-6 0-1.8-.7-3.5-2-4.8-.1-.1-.3-.2-.5-.2zM15 12c-.8 0-1.5.3-2 .8l-.6.7c-.5.6-.8 1.3-.8 2 0 1.8 1.5 3.3 3.3 3.3s3.3-1.5 3.3-3.3c0-2-1.5-3.5-3.2-3.5z",
  },
  ATOM: {
    bg: "#2E3148",
    // Cosmos atom orbits
    path: "M12 10.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM12 6c-1 0-2 .2-2.8.5C10.1 5 11 4.5 12 4.5s1.9.5 2.8 1.5c-.8-.3-1.8-.5-2.8-.5zm0 12c1 0 2-.2 2.8-.5-.9 1-1.8 1.5-2.8 1.5s-1.9-.5-2.8-1.5c.8.3 1.8.5 2.8.5zM7.2 8.5c-.5.9-.7 1.8-.7 2.6 0 .7.2 1.3.5 1.8-.7-.8-1-1.8-1-2.8 0-1.1.4-2 1.2-1.6zm9.6 0c.8-.4 1.2.5 1.2 1.6 0 1-.3 2-1 2.8.3-.5.5-1.1.5-1.8 0-.8-.2-1.7-.7-2.6zM7.2 15.5c-.8.4-1.2-.5-1.2-1.6 0-1 .3-2 1-2.8-.3.5-.5 1.1-.5 1.8 0 .9.2 1.8.7 2.6zm9.6 0c.5-.8.7-1.7.7-2.6 0-.7-.2-1.3-.5-1.8.7.8 1 1.8 1 2.8 0 1.1-.4 2-1.2 1.6z",
  },
  TRX: {
    bg: "#EF0027",
    // Tron triangle
    path: "M12 4L4 9.5l3 9.5h10l3-9.5L12 4zm0 2.5l5.2 3.6-2 6.4H8.8l-2-6.4L12 6.5z",
  },
  BCH: {
    bg: "#8DC351",
    // Bitcoin Cash "₿" rotated
    path: "M14.8 10.5c.2-1.2-.7-1.8-2-2.2l.4-1.6-.9-.2-.4 1.5c-.2-.1-.5-.1-.7-.2l.4-1.5-.9-.2-.4 1.6c-.2 0-.4-.1-.6-.1l-1.2-.3-.3 1s.7.2.7.2c.4.1.4.3.4.5l-.5 2.1v.1l-.7 2.8c0 .1-.2.3-.5.2l-.7-.2-.4 1 1.1.3.6.2-.4 1.6.9.2.4-1.6c.2.1.5.1.7.2l-.4 1.6.9.2.4-1.6c1.6.3 2.9.2 3.4-1.3.4-1.2 0-1.9-.9-2.3.6-.2 1.1-.6 1.2-1.5zm-2.3 3.2c-.3 1.2-2.4.5-3 .4l.5-2.2c.7.2 2.8.5 2.5 1.8zm.3-3.2c-.3 1.1-2 .5-2.5.4l.5-2c.6.1 2.3.4 2 1.6z",
  },
  XLM: {
    bg: "#14B6E7",
    // Stellar rocket simplified
    path: "M18.6 5.4l-1.6.5C15.3 4.5 13.1 4 12 4S8.7 4.5 7 5.9l-1.6-.5c-.2-.1-.4.1-.3.3L6 7.2C4.8 8.7 4 10.5 4 12.4c0 .4.2.6.5.5l1.3-.4c.5 2 2.3 3.5 4.5 3.5h3.4c2.2 0 4-1.5 4.5-3.5l1.3.4c.3.1.5-.1.5-.5 0-1.9-.8-3.7-2-5.2l.9-1.5c.1-.2-.1-.4-.3-.3zM12 14h-1.7c-1.2 0-2.2-.8-2.5-2h8.4c-.3 1.2-1.3 2-2.5 2H12z",
  },
  SBK: {
    bg: "#FF6B35",
    // SBK custom "S" shape
    path: "M15.2 8.5c0-1.8-1.5-3-3.7-3-2.1 0-3.6 1-3.6 2.6 0 1.3.9 2 2.6 2.5l1.3.4c1.1.3 1.5.6 1.5 1.2 0 .7-.7 1.2-1.7 1.2-1.1 0-1.9-.5-2.1-1.4l-1.8.5c.4 1.6 1.8 2.6 3.8 2.6 2.2 0 3.8-1.1 3.8-2.8 0-1.3-.9-2.1-2.7-2.5l-1.3-.4c-1-.3-1.4-.6-1.4-1.1 0-.6.6-1 1.6-1 .9 0 1.5.4 1.8 1.1l1.7-.5c-.2-.3-.5-.7-.8-.9z",
  },
  G99: {
    bg: "#8B5CF6",
    // G99 custom "G" shape
    path: "M12 5C8.1 5 5 8.1 5 12s3.1 7 7 7c2.8 0 5.2-1.6 6.3-4h-2.4c-.8 1.2-2.2 2-3.9 2-2.8 0-5-2.2-5-5s2.2-5 5-5c1.4 0 2.6.6 3.5 1.5L13 11h6V5l-2.1 2.1C15.6 5.8 13.9 5 12 5z",
  },
};

function hashToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 360);
}

export function CoinIcon({ symbol, size = "md", className }: CoinIconProps) {
  const coin = symbol.split("-")[0].toUpperCase();
  const def = COIN_SVGS[coin];
  const px = SIZE_PX[size] ?? 24;

  if (def) {
    return (
      <svg
        className={cn("shrink-0 rounded-full select-none", SIZE_MAP[size], className)}
        viewBox="0 0 24 24"
        fill="none"
        aria-label={coin}
      >
        <circle cx="12" cy="12" r="12" fill={def.bg} />
        <path d={def.path} fill="#fff" />
      </svg>
    );
  }

  // Fallback for unknown coins
  const bg = `hsl(${hashToHue(coin)}, 55%, 50%)`;
  const label = coin.charAt(0);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none",
        SIZE_MAP[size],
        "text-[10px]",
        className,
      )}
      style={{ background: bg }}
      aria-label={coin}
    >
      {label}
    </span>
  );
}

/** Show base + quote pair icons overlapping */
export function CoinPairIcon({
  base,
  quote,
  size = "md",
  className,
}: {
  base: string;
  quote: string;
  size?: CoinIconProps["size"];
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <CoinIcon symbol={base} size={size} className="z-10" />
      <CoinIcon symbol={quote} size={size} className="-ml-1.5 opacity-80" />
    </span>
  );
}
