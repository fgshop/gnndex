import { StyleSheet, Text, View } from "react-native";
import type { TickerRow } from "../types/market";
import { formatNumber } from "../utils/formatters";
import { colors } from "../utils/theme";

type TickerListProps = {
  tickers: TickerRow[];
};

export function TickerList({ tickers }: TickerListProps) {
  if (tickers.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {tickers.map((item) => {
        const raw = item.changePercent24h ?? "0";
        const num = Number(raw);
        const sign = Number.isFinite(num) && num > 0 ? "+" : "";
        const changeLabel = Number.isFinite(num)
          ? `${sign}${num.toFixed(2)}%`
          : raw;

        return (
          <View key={item.symbol} style={styles.row}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <Text style={styles.price}>
              {formatNumber(item.lastPrice, 4)}
            </Text>
            <Text
              style={[
                styles.change,
                Number.isFinite(num) && num >= 0 ? styles.up : styles.down,
              ]}
            >
              {changeLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  symbol: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  price: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  change: {
    fontSize: 13,
    fontWeight: "700",
  },
  up: {
    color: colors.up,
  },
  down: {
    color: colors.down,
  },
});
