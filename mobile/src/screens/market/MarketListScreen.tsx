import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMarketData } from "../../hooks/useMarketData";
import { TickerList } from "../../components/TickerList";
import { OrderbookDisplay } from "../../components/OrderbookDisplay";
import { SegmentControl } from "../../components/SegmentControl";
import { SYMBOL_OPTIONS } from "../../types/market";
import { formatNumber } from "../../utils/formatters";
import { useTranslation } from "../../i18n/locale-context";
import { colors, commonStyles } from "../../utils/theme";
import { useState } from "react";

export function MarketListScreen() {
  const { t } = useTranslation();
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    SYMBOL_OPTIONS[0],
  );
  const { tickers, orderbook, candles, latestCandle, marketMessage } =
    useMarketData(selectedSymbol);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.header}>{t("market.title")}</Text>

        <TickerList tickers={tickers} />

        <SegmentControl
          options={SYMBOL_OPTIONS}
          selected={selectedSymbol}
          onSelect={setSelectedSymbol}
        />

        <OrderbookDisplay
          symbol={selectedSymbol}
          orderbook={orderbook}
          latestCandle={latestCandle}
          errorMessage={marketMessage}
        />

        <View style={styles.candlesSection}>
          <Text style={commonStyles.sectionTitle}>
            {t("market.recentCandles", { symbol: selectedSymbol })}
          </Text>
          {candles.length === 0 ? (
            <View style={commonStyles.row}>
              <Text style={styles.value}>{t("market.noCandleData")}</Text>
            </View>
          ) : (
            candles
              .slice(-5)
              .reverse()
              .map((item) => (
                <View key={item.openTime} style={commonStyles.row}>
                  <Text style={styles.asset}>
                    {new Date(item.openTime).toLocaleTimeString()}
                  </Text>
                  <Text style={styles.value}>
                    O {formatNumber(item.open, 6)} / H{" "}
                    {formatNumber(item.high, 6)}
                  </Text>
                  <Text style={styles.value}>
                    L {formatNumber(item.low, 6)} / C{" "}
                    {formatNumber(item.close, 6)}
                  </Text>
                </View>
              ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  header: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  candlesSection: {
    gap: 8,
  },
  asset: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  value: {
    marginTop: 4,
    color: colors.textSecondary,
  },
});
