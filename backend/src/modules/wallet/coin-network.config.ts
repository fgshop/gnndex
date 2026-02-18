/**
 * Coin / Network configuration.
 *
 * - "native" coins have a single native blockchain → no network selector needed.
 * - "token" coins exist on multiple chains → network selector required.
 */

export type NetworkConfig = {
  /** Network identifier used in API calls (e.g. "Ethereum", "TRC20") */
  network: string;
  /** Display name shown in UI (e.g. "Ethereum (ERC-20)") */
  displayName: string;
  /** Address prefix for generated deposit addresses */
  addressPrefix: string;
  /** Number of hex chars after prefix for the generated address */
  addressLength: number;
  /** Required confirmations for deposits */
  confirmations: number;
  /** Minimum deposit amount (string decimal) */
  minDeposit: string;
  /** Estimated withdrawal fee (string decimal) */
  withdrawFee: string;
};

export type CoinConfig = {
  /** Coin ticker symbol */
  asset: string;
  /** Human-readable name */
  name: string;
  /** "native" = has own blockchain, "token" = exists on multiple chains */
  type: "native" | "token";
  /** Supported networks (native coins have exactly 1) */
  networks: NetworkConfig[];
};

/* ─────────────────────────────────────────────────────────
   Configuration Map
   ───────────────────────────────────────────────────────── */

export const COIN_NETWORK_CONFIG: CoinConfig[] = [
  {
    asset: "BTC",
    name: "Bitcoin",
    type: "native",
    networks: [
      {
        network: "Bitcoin",
        displayName: "Bitcoin",
        addressPrefix: "bc1q",
        addressLength: 38,
        confirmations: 3,
        minDeposit: "0.0001",
        withdrawFee: "0.0005",
      },
    ],
  },
  {
    asset: "ETH",
    name: "Ethereum",
    type: "native",
    networks: [
      {
        network: "Ethereum",
        displayName: "Ethereum (ERC-20)",
        addressPrefix: "0x",
        addressLength: 40,
        confirmations: 12,
        minDeposit: "0.001",
        withdrawFee: "0.005",
      },
    ],
  },
  {
    asset: "SOL",
    name: "Solana",
    type: "native",
    networks: [
      {
        network: "Solana",
        displayName: "Solana",
        addressPrefix: "",
        addressLength: 44,
        confirmations: 32,
        minDeposit: "0.01",
        withdrawFee: "0.01",
      },
    ],
  },
  {
    asset: "XRP",
    name: "Ripple",
    type: "native",
    networks: [
      {
        network: "Ripple",
        displayName: "Ripple",
        addressPrefix: "r",
        addressLength: 33,
        confirmations: 6,
        minDeposit: "0.1",
        withdrawFee: "0.25",
      },
    ],
  },
  {
    asset: "BNB",
    name: "BNB",
    type: "native",
    networks: [
      {
        network: "BSC",
        displayName: "BNB Smart Chain (BEP-20)",
        addressPrefix: "0x",
        addressLength: 40,
        confirmations: 15,
        minDeposit: "0.001",
        withdrawFee: "0.0005",
      },
    ],
  },
  {
    asset: "MATIC",
    name: "Polygon",
    type: "native",
    networks: [
      {
        network: "Polygon",
        displayName: "Polygon",
        addressPrefix: "0x",
        addressLength: 40,
        confirmations: 128,
        minDeposit: "0.1",
        withdrawFee: "0.1",
      },
    ],
  },
  {
    asset: "AVAX",
    name: "Avalanche",
    type: "native",
    networks: [
      {
        network: "Avalanche-C",
        displayName: "Avalanche C-Chain",
        addressPrefix: "0x",
        addressLength: 40,
        confirmations: 12,
        minDeposit: "0.01",
        withdrawFee: "0.01",
      },
    ],
  },
  {
    asset: "ADA",
    name: "Cardano",
    type: "native",
    networks: [
      {
        network: "Cardano",
        displayName: "Cardano",
        addressPrefix: "addr1",
        addressLength: 58,
        confirmations: 15,
        minDeposit: "1",
        withdrawFee: "1",
      },
    ],
  },
  {
    asset: "DOT",
    name: "Polkadot",
    type: "native",
    networks: [
      {
        network: "Polkadot",
        displayName: "Polkadot",
        addressPrefix: "1",
        addressLength: 47,
        confirmations: 25,
        minDeposit: "0.1",
        withdrawFee: "0.1",
      },
    ],
  },
  {
    asset: "SBK",
    name: "SBK Token",
    type: "native",
    networks: [
      {
        network: "Ethereum",
        displayName: "Ethereum (ERC-20)",
        addressPrefix: "0x",
        addressLength: 40,
        confirmations: 12,
        minDeposit: "10",
        withdrawFee: "5",
      },
    ],
  },
  {
    asset: "G99",
    name: "G99 Token",
    type: "native",
    networks: [
      {
        network: "Ethereum",
        displayName: "Ethereum (ERC-20)",
        addressPrefix: "0x",
        addressLength: 40,
        confirmations: 12,
        minDeposit: "10",
        withdrawFee: "5",
      },
    ],
  },

  /* ── Multi-network tokens ─────────────────────────────── */

  {
    asset: "USDT",
    name: "Tether",
    type: "token",
    networks: [
      {
        network: "ETH-ERC20",
        displayName: "Ethereum (ERC-20)",
        addressPrefix: "0x",
        addressLength: 40,
        confirmations: 12,
        minDeposit: "1",
        withdrawFee: "3.5",
      },
      {
        network: "TRC20",
        displayName: "Tron (TRC-20)",
        addressPrefix: "T",
        addressLength: 33,
        confirmations: 20,
        minDeposit: "1",
        withdrawFee: "1",
      },
      {
        network: "BSC-BEP20",
        displayName: "BNB Smart Chain (BEP-20)",
        addressPrefix: "0x",
        addressLength: 40,
        confirmations: 15,
        minDeposit: "1",
        withdrawFee: "0.5",
      },
      {
        network: "SOL",
        displayName: "Solana",
        addressPrefix: "",
        addressLength: 44,
        confirmations: 32,
        minDeposit: "1",
        withdrawFee: "1",
      },
      {
        network: "Polygon",
        displayName: "Polygon",
        addressPrefix: "0x",
        addressLength: 40,
        confirmations: 128,
        minDeposit: "1",
        withdrawFee: "0.5",
      },
      {
        network: "Avalanche-C",
        displayName: "Avalanche C-Chain",
        addressPrefix: "0x",
        addressLength: 40,
        confirmations: 12,
        minDeposit: "1",
        withdrawFee: "0.5",
      },
    ],
  },
  {
    asset: "USDC",
    name: "USD Coin",
    type: "token",
    networks: [
      {
        network: "ETH-ERC20",
        displayName: "Ethereum (ERC-20)",
        addressPrefix: "0x",
        addressLength: 40,
        confirmations: 12,
        minDeposit: "1",
        withdrawFee: "3.5",
      },
      {
        network: "TRC20",
        displayName: "Tron (TRC-20)",
        addressPrefix: "T",
        addressLength: 33,
        confirmations: 20,
        minDeposit: "1",
        withdrawFee: "1",
      },
      {
        network: "BSC-BEP20",
        displayName: "BNB Smart Chain (BEP-20)",
        addressPrefix: "0x",
        addressLength: 40,
        confirmations: 15,
        minDeposit: "1",
        withdrawFee: "0.5",
      },
      {
        network: "SOL",
        displayName: "Solana",
        addressPrefix: "",
        addressLength: 44,
        confirmations: 32,
        minDeposit: "1",
        withdrawFee: "1",
      },
      {
        network: "Polygon",
        displayName: "Polygon",
        addressPrefix: "0x",
        addressLength: 40,
        confirmations: 128,
        minDeposit: "1",
        withdrawFee: "0.5",
      },
    ],
  },
];

/* ── Lookup helpers ──────────────────────────────────────── */

const CONFIG_MAP = new Map(COIN_NETWORK_CONFIG.map((c) => [c.asset, c]));

export function getCoinConfig(asset: string): CoinConfig | undefined {
  return CONFIG_MAP.get(asset.toUpperCase());
}

export function getDefaultNetwork(asset: string): NetworkConfig | undefined {
  const coin = getCoinConfig(asset);
  if (!coin) return undefined;
  return coin.networks[0];
}

export function getNetworkConfig(asset: string, network: string): NetworkConfig | undefined {
  const coin = getCoinConfig(asset);
  if (!coin) return undefined;
  return coin.networks.find((n) => n.network === network);
}
