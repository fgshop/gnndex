import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMobileAuth } from "../../store/auth-context";
import { useTranslation } from "../../i18n/locale-context";
import { LOCALE_META, type Locale } from "../../i18n/locale-context";
import { colors, commonStyles } from "../../utils/theme";

export function MyPageScreen() {
  const { isAuthenticated, session, logout } = useMobileAuth();
  const { t, locale, setLocale } = useTranslation();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.header}>{t("mypage.title")}</Text>

        {!isAuthenticated ? (
          <View style={styles.authPrompt}>
            <Text style={styles.authPromptText}>
              {t("mypage.signInToView")}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <Text style={commonStyles.sectionTitle}>{t("mypage.profile")}</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>{t("mypage.email")}</Text>
                <Text style={styles.value}>
                  {session?.user?.email ?? "-"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>{t("mypage.userId")}</Text>
                <Text style={styles.value}>
                  {session?.user?.userId ?? "-"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.label}>{t("mypage.role")}</Text>
                <Text style={styles.value}>
                  {session?.user?.role ?? "-"}
                </Text>
              </View>
            </View>

            <View style={styles.securityCard}>
              <Text style={commonStyles.sectionTitle}>{t("mypage.security")}</Text>
              <View style={styles.infoRow}>
                <Text style={styles.label}>{t("mypage.twoFactor")}</Text>
                <Text style={styles.value}>
                  {t("mypage.configureViaWeb")}
                </Text>
              </View>
            </View>

            <View style={styles.languageCard}>
              <Text style={commonStyles.sectionTitle}>{t("mypage.language")}</Text>
              <View style={styles.languageGrid}>
                {LOCALE_META.map((item) => (
                  <Pressable
                    key={item.code}
                    style={[
                      styles.languageOption,
                      locale === item.code && styles.languageOptionActive,
                    ]}
                    onPress={() => setLocale(item.code as Locale)}
                  >
                    <Text style={styles.languageFlag}>{item.flag}</Text>
                    <Text
                      style={[
                        styles.languageLabel,
                        locale === item.code && styles.languageLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              style={commonStyles.secondaryButton}
              onPress={() => void handleLogout()}
            >
              <Text style={commonStyles.secondaryButtonText}>{t("auth.logout")}</Text>
            </Pressable>
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
  profileCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  securityCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  languageCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  languageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  languageOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
  },
  languageOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  languageFlag: {
    fontSize: 16,
  },
  languageLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  languageLabelActive: {
    color: colors.white,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
  },
  value: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
});
