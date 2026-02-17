import { useEffect, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMobileAuth } from "../../store/auth-context";
import { useMarketData } from "../../hooks/useMarketData";
import { useOrders, type OrderFilters } from "../../hooks/useOrders";
import { api } from "../../services/api";
import { parseApiError } from "../../utils/formatters";
import { useTranslation } from "../../i18n/locale-context";
import { OrderbookDisplay } from "../../components/OrderbookDisplay";
import { SegmentControl } from "../../components/SegmentControl";
import { FilterChips } from "../../components/FilterChips";
import { OrderItem } from "../../components/OrderItem";
import { FeedStatus } from "../../components/feed-status";
import {
  SYMBOL_OPTIONS,
  ORDER_TYPES,
  ORDER_VIEW_TABS,
  ORDER_SORT_OPTIONS,
  ORDER_STATUS_FILTERS,
  type OrderViewTab,
  type OrderSortOption,
  type OrderStatusFilter,
} from "../../types/market";
import { colors, commonStyles } from "../../utils/theme";

export function TradeScreen() {
  const { isAuthenticated } = useMobileAuth();
  const { t } = useTranslation();

  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    SYMBOL_OPTIONS[0],
  );
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<
    "LIMIT" | "MARKET" | "STOP_LIMIT"
  >("LIMIT");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("0.001");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  // Order filters
  const [orderViewTab, setOrderViewTab] = useState<OrderViewTab>("OPEN");
  const [orderSymbolFilter, setOrderSymbolFilter] = useState<string>("ALL");
  const [orderStatusFilter, setOrderStatusFilter] =
    useState<OrderStatusFilter>("ALL");
  const [orderSort, setOrderSort] = useState<OrderSortOption>("NEWEST");
  const [orderFromCreatedAt, setOrderFromCreatedAt] = useState("");
  const [orderToCreatedAt, setOrderToCreatedAt] = useState("");

  const filters: OrderFilters = {
    orderViewTab,
    orderSymbolFilter,
    orderStatusFilter,
    orderSort,
    orderFromCreatedAt,
    orderToCreatedAt,
  };

  const { orderbook, candles, latestCandle, marketMessage, loadMarketSnapshot } =
    useMarketData(selectedSymbol);

  const {
    visibleOrders,
    ordersPage,
    ordersLoading,
    orderMessage,
    setOrderMessage,
    streamConnected,
    streamRetryInfo,
    openOrdersCount,
    historyOrdersCount,
    totalPages,
    canPrevPage,
    canNextPage,
    loadOrders,
    orders,
  } = useOrders(isAuthenticated, filters);

  // Auto-fill price from candles
  useEffect(() => {
    if (!price && candles.length > 0) {
      setPrice(candles[candles.length - 1]!.close);
    }
  }, [candles, price]);

  // Reset price on symbol change
  useEffect(() => {
    setPrice("");
    setSubmitMessage("");
  }, [selectedSymbol]);

  const handleCreateOrder = async () => {
    if (!isAuthenticated) {
      setSubmitMessage(t("common.signInRequired"));
      return;
    }

    const qty = quantity.trim();
    const px = price.trim();

    if (!qty) {
      setSubmitMessage(t("trade.quantityRequired"));
      return;
    }

    if (
      (orderType === "LIMIT" ||
        orderType === "STOP_LIMIT" ||
        side === "BUY") &&
      !px
    ) {
      setSubmitMessage(t("trade.priceRequired"));
      return;
    }

    setSubmittingOrder(true);
    setSubmitMessage("");

    const { data, error } = await api.POST("/orders", {
      body: {
        symbol: selectedSymbol,
        side,
        type: orderType,
        quantity: qty,
        price: px || undefined,
      },
    });

    setSubmittingOrder(false);

    if (error || !data) {
      setSubmitMessage(parseApiError(error, t("trade.placeOrder")));
      return;
    }

    const created = data as { orderId?: string; status?: string };
    setSubmitMessage(
      t("trade.orderSubmitted", {
        orderId: created.orderId ?? "unknown",
        status: created.status ?? "NEW",
      }),
    );
    await Promise.all([loadOrders({ page: 1 }), loadMarketSnapshot()]);
  };

  const handleCancelOrder = async (orderId: string) => {
    const { data, error } = await api.DELETE("/orders/{orderId}", {
      params: { path: { orderId } },
    });

    if (error || !data) {
      setOrderMessage(parseApiError(error, t("trade.cancelFailed")));
      return;
    }

    const payload = data as { status?: string };
    setOrderMessage(
      t("trade.orderCanceled", { status: payload.status ?? "CANCELED" }),
    );
    await Promise.all([loadOrders({ page: 1 }), loadMarketSnapshot()]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.header}>{t("trade.title")}</Text>

        <OrderbookDisplay
          symbol={selectedSymbol}
          orderbook={orderbook}
          latestCandle={latestCandle}
          errorMessage={marketMessage}
        />

        {isAuthenticated ? (
          <View style={styles.orderCard}>
            <Text style={commonStyles.sectionTitle}>{t("trade.orderTicket")}</Text>

            <SegmentControl
              options={SYMBOL_OPTIONS}
              selected={selectedSymbol}
              onSelect={setSelectedSymbol}
            />

            <SegmentControl
              options={["BUY", "SELL"] as const}
              selected={side}
              onSelect={setSide}
            />

            <SegmentControl
              options={ORDER_TYPES}
              selected={orderType}
              onSelect={setOrderType}
            />

            <TextInput
              style={commonStyles.input}
              value={price}
              onChangeText={setPrice}
              placeholder={t("trade.price")}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={commonStyles.input}
              value={quantity}
              onChangeText={setQuantity}
              placeholder={t("trade.quantity")}
              keyboardType="decimal-pad"
            />

            <Pressable
              style={[
                commonStyles.button,
                submittingOrder && styles.disabled,
              ]}
              onPress={handleCreateOrder}
              disabled={submittingOrder}
            >
              <Text style={commonStyles.buttonText}>
                {submittingOrder ? t("trade.submitting") : t("trade.placeOrder")}
              </Text>
            </Pressable>
            {submitMessage ? (
              <Text style={styles.submitMessage}>{submitMessage}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.authPrompt}>
            <Text style={styles.authPromptText}>
              {t("trade.signInToTrade")}
            </Text>
          </View>
        )}

        {isAuthenticated ? (
          <View style={styles.ordersSection}>
            <Text style={commonStyles.sectionTitle}>{t("trade.myOrders")}</Text>
            <FeedStatus
              connected={streamConnected}
              retryInfo={streamRetryInfo}
            />

            <SegmentControl
              options={ORDER_VIEW_TABS}
              selected={orderViewTab}
              onSelect={setOrderViewTab}
              labelFn={(tab) =>
                tab === "OPEN"
                  ? `${t("trade.open")} (${openOrdersCount})`
                  : tab === "HISTORY"
                    ? `${t("trade.history")} (${historyOrdersCount})`
                    : `${t("trade.all")} (${orders.length})`
              }
            />

            <SegmentControl
              options={["ALL", ...SYMBOL_OPTIONS] as const}
              selected={orderSymbolFilter}
              onSelect={setOrderSymbolFilter}
            />

            <FilterChips
              options={ORDER_STATUS_FILTERS}
              selected={orderStatusFilter}
              onSelect={setOrderStatusFilter}
            />

            <TextInput
              style={commonStyles.input}
              value={orderFromCreatedAt}
              onChangeText={setOrderFromCreatedAt}
              placeholder={t("trade.fromDate")}
              autoCapitalize="none"
            />
            <TextInput
              style={commonStyles.input}
              value={orderToCreatedAt}
              onChangeText={setOrderToCreatedAt}
              placeholder={t("trade.toDate")}
              autoCapitalize="none"
            />

            <SegmentControl
              options={ORDER_SORT_OPTIONS}
              selected={orderSort}
              onSelect={setOrderSort}
            />

            <Text style={styles.pageInfo}>
              {t("trade.page", {
                current: String(ordersPage),
                total: String(totalPages),
                count: String(orders.length),
              })}
            </Text>

            {visibleOrders.length === 0 ? (
              <View style={commonStyles.row}>
                <Text style={styles.value}>
                  {t("trade.noOrders")}
                </Text>
              </View>
            ) : (
              visibleOrders.map((item) => (
                <OrderItem
                  key={item.orderId}
                  order={item}
                  onCancel={(id) => void handleCancelOrder(id)}
                />
              ))
            )}

            <View style={styles.paginationRow}>
              <Pressable
                style={[
                  styles.pageButton,
                  !canPrevPage && styles.disabled,
                ]}
                onPress={() => void loadOrders({ page: ordersPage - 1 })}
                disabled={ordersLoading || !canPrevPage}
              >
                <Text style={styles.pageButtonText}>{t("common.prev")}</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.pageButton,
                  !canNextPage && styles.disabled,
                ]}
                onPress={() => void loadOrders({ page: ordersPage + 1 })}
                disabled={ordersLoading || !canNextPage}
              >
                <Text style={styles.pageButtonText}>
                  {ordersLoading ? t("common.loading") : t("common.next")}
                </Text>
              </Pressable>
            </View>

            {orderMessage ? (
              <Text style={styles.orderMsg}>{orderMessage}</Text>
            ) : null}
          </View>
        ) : null}
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
  orderCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  disabled: {
    opacity: 0.4,
  },
  submitMessage: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  authPrompt: {
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  authPromptText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  ordersSection: {
    gap: 8,
  },
  pageInfo: {
    color: colors.textSecondary,
  },
  value: {
    color: colors.textSecondary,
  },
  paginationRow: {
    flexDirection: "row",
    gap: 6,
  },
  pageButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  pageButtonText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 12,
  },
  orderMsg: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
