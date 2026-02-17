import { StyleSheet, Text, View } from "react-native";
import type { CandleRow, OrderbookPayload } from "../types/market";
import { formatNumber } from "../utils/formatters";
import { useTranslation } from "../i18n/locale-context";
import { colors } from "../utils/theme";

type OrderbookDisplayProps = {
  symbol: string;
  orderbook: OrderbookPayload | null;
  latestCandle: CandleRow | null;
  errorMessage?: string;
};

export function OrderbookDisplay({
  symbol,
  orderbook,
  latestCandle,
  errorMessage,
}: OrderbookDisplayProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {t("market.snapshot", { symbol })}
        </Text>
        <Text style={styles.meta}>
          {orderbook?.updatedAt
            ? new Date(orderbook.updatedAt).toLocaleTimeString()
            : "-"}
        </Text>
      </View>

      {errorMessage ? (
        <Text style={styles.error}>{errorMessage}</Text>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>{t("market.last")}</Text>
          <Text style={styles.statValue}>
            {formatNumber(latestCandle?.close ?? null, 6)}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>{t("market.high")}</Text>
          <Text style={styles.statValue}>
            {formatNumber(latestCandle?.high ?? null, 6)}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>{t("market.low")}</Text>
          <Text style={styles.statValue}>
            {formatNumber(latestCandle?.low ?? null, 6)}
          </Text>
        </View>
      </View>

      <View style={styles.bookRow}>
        <View style={styles.bookColumn}>
          <Text style={styles.bookTitleUp}>{t("market.bids")}</Text>
          {(orderbook?.bids ?? []).slice(0, 3).map((level) => (
            <Text key={`bid-${level.price}`} style={styles.bookText}>
              {formatNumber(level.price, 6)} /{" "}
              {formatNumber(level.quantity, 4)}
            </Text>
          ))}
        </View>
        <View style={styles.bookColumn}>
          <Text style={styles.bookTitleDown}>{t("market.asks")}</Text>
          {(orderbook?.asks ?? []).slice(0, 3).map((level) => (
            <Text key={`ask-${level.price}`} style={styles.bookText}>
              {formatNumber(level.price, 6)} /{" "}
              {formatNumber(level.quantity, 4)}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  meta: {
    fontSize: 11,
    color: colors.textMuted,
  },
  error: {
    fontSize: 12,
    color: colors.down,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  statValue: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  bookRow: {
    flexDirection: "row",
    gap: 8,
  },
  bookColumn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  bookTitleUp: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.up,
  },
  bookTitleDown: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.down,
  },
  bookText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
