import { cn } from "@/lib/utils";

type CoinIconProps = {
  symbol: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const SIZE_MAP = {
  xs: "h-4 w-4 text-[7px]",
  sm: "h-5 w-5 text-[8px]",
  md: "h-6 w-6 text-[10px]",
  lg: "h-8 w-8 text-xs",
  xl: "h-10 w-10 text-sm",
};

type CoinBrand = {
  bg: string;
  label: string;
  /** Optional secondary color for gradient effects */
  bg2?: string;
};

const COIN_BRANDS: Record<string, CoinBrand> = {
  BTC: { bg: "#F7931A", label: "₿" },
  ETH: { bg: "#627EEA", label: "Ξ" },
  SOL: { bg: "#9945FF", bg2: "#14F195", label: "◎" },
  XRP: { bg: "#0085C0", label: "✕" },
  USDT: { bg: "#26A17B", label: "₮" },
  USDC: { bg: "#2775CA", label: "$" },
  BNB: { bg: "#F3BA2F", label: "B" },
  ADA: { bg: "#0033AD", label: "₳" },
  DOGE: { bg: "#C3A634", label: "Ð" },
  DOT: { bg: "#E6007A", label: "●" },
  AVAX: { bg: "#E84142", label: "A" },
  MATIC: { bg: "#8247E5", label: "M" },
  LINK: { bg: "#2A5ADA", label: "⬡" },
  UNI: { bg: "#FF007A", label: "U" },
  ATOM: { bg: "#2E3148", label: "⚛" },
  SBK: { bg: "#FF6B35", label: "S" },
  G99: { bg: "#8B5CF6", label: "G" },
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
  const brand = COIN_BRANDS[coin];
  const bg = brand?.bg ?? `hsl(${hashToHue(coin)}, 55%, 50%)`;
  const label = brand?.label ?? coin.charAt(0);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none",
        SIZE_MAP[size],
        className
      )}
      style={{
        background: brand?.bg2
          ? `linear-gradient(135deg, ${bg}, ${brand.bg2})`
          : bg,
      }}
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
