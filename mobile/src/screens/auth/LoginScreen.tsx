import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMobileAuth } from "../../store/auth-context";
import { useTranslation } from "../../i18n/locale-context";
import { colors, commonStyles } from "../../utils/theme";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { login } = useMobileAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState("trader@gnndex.com");
  const [password, setPassword] = useState("GlobalDEX!2345");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setMessage("");
    const success = await login({
      email,
      password,
      twoFactorCode: twoFactorCode || undefined,
    });
    setLoading(false);

    if (!success) {
      setMessage(t("auth.loginFailed"));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>GlobalDEX</Text>
        <Text style={styles.subtitle}>{t("auth.signInSubtitle")}</Text>

        <View style={styles.form}>
          <TextInput
            style={commonStyles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.email")}
          />
          <TextInput
            style={commonStyles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth.password")}
          />
          <TextInput
            style={commonStyles.input}
            value={twoFactorCode}
            onChangeText={setTwoFactorCode}
            placeholder={t("auth.twoFactorCode")}
          />

          <Pressable
            style={[commonStyles.button, loading && styles.disabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={commonStyles.buttonText}>
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </Text>
          </Pressable>

          {message ? <Text style={styles.error}>{message}</Text> : null}
        </View>

        <Pressable
          style={styles.registerLink}
          onPress={() => navigation.navigate("Register")}
        >
          <Text style={styles.registerText}>
            {t("auth.noAccount")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "88%",
    padding: 24,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: colors.textTertiary,
    textAlign: "center",
  },
  form: {
    marginTop: 24,
    gap: 10,
  },
  disabled: {
    opacity: 0.6,
  },
  error: {
    marginTop: 4,
    fontSize: 13,
    color: colors.down,
    textAlign: "center",
  },
  registerLink: {
    marginTop: 16,
    alignItems: "center",
  },
  registerText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
