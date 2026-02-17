import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMobileAuth } from "../../store/auth-context";
import { useBalancesStream } from "../../hooks/useBalancesStream";
import { BalanceCard } from "../../components/BalanceCard";
import { FeedStatus } from "../../components/feed-status";
import { useTranslation } from "../../i18n/locale-context";
import { colors, commonStyles } from "../../utils/theme";

export function WalletScreen() {
  const { isAuthenticated } = useMobileAuth();
  const { t } = useTranslation();
  const { balances, connected, retryInfo, message, loading } =
    useBalancesStream(isAuthenticated);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.header}>{t("wallet.title")}</Text>

        {!isAuthenticated ? (
          <View style={styles.authPrompt}>
            <Text style={styles.authPromptText}>
              {t("wallet.signInToView")}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.caption}>
              {loading ? t("common.loading") : message}
            </Text>

            <FeedStatus connected={connected} retryInfo={retryInfo} />

            <View style={styles.balancesSection}>
              <Text style={commonStyles.sectionTitle}>{t("wallet.balances")}</Text>
              {balances.length === 0 ? (
                <View style={commonStyles.row}>
                  <Text style={styles.emptyText}>{t("wallet.noBalances")}</Text>
                </View>
              ) : (
                balances.map((item) => (
                  <BalanceCard key={item.asset} balance={item} />
                ))
              )}
            </View>
          </>
        )}
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
  caption: {
    fontSize: 14,
    color: colors.textTertiary,
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
  balancesSection: {
    gap: 8,
  },
  emptyText: {
    color: colors.textSecondary,
  },
});
