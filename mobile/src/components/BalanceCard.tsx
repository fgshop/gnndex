import { StyleSheet, Text, View } from "react-native";
import type { BalanceRow } from "../types/market";
import { useTranslation } from "../i18n/locale-context";
import { colors } from "../utils/theme";

type BalanceCardProps = {
  balance: BalanceRow;
};

export function BalanceCard({ balance }: BalanceCardProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <Text style={styles.asset}>{balance.asset}</Text>
      <Text style={styles.value}>{t("wallet.available")}: {balance.available}</Text>
      <Text style={styles.value}>{t("wallet.locked")}: {balance.locked}</Text>
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
});
