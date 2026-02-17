import { Pressable, StyleSheet, Text, View } from "react-native";
import type { OrderRow } from "../types/market";
import { formatNumber } from "../utils/formatters";
import { useTranslation } from "../i18n/locale-context";
import { colors } from "../utils/theme";

type OrderItemProps = {
  order: OrderRow;
  onCancel?: (orderId: string) => void;
};

export function OrderItem({ order, onCancel }: OrderItemProps) {
  const { t } = useTranslation();
  const canCancel =
    order.status === "NEW" || order.status === "PARTIALLY_FILLED";

  return (
    <View style={styles.row}>
      <Text style={styles.asset}>
        {order.side} {order.type}
      </Text>
      <Text style={styles.value}>
        {t("trade.time")}:{" "}
        {order.createdAt
          ? new Date(order.createdAt).toLocaleString()
          : "-"}
      </Text>
      <Text style={styles.value}>
        {t("trade.orderPrice")}: {formatNumber(order.price, 6)}
      </Text>
      <Text style={styles.value}>
        {t("trade.qty")}: {formatNumber(order.quantity, 6)}
      </Text>
      <Text style={styles.value}>{t("trade.status")}: {order.status}</Text>
      {canCancel && onCancel ? (
        <Pressable
          style={styles.cancelButton}
          onPress={() => onCancel(order.orderId)}
        >
          <Text style={styles.cancelButtonText}>{t("trade.cancelOrder")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
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
  cancelButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 12,
  },
});
