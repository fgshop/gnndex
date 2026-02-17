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
import { api } from "../../services/api";
import { parseApiError } from "../../utils/formatters";
import { useTranslation } from "../../i18n/locale-context";
import { colors, commonStyles } from "../../utils/theme";
import type { AuthStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      setMessage(t("auth.emailRequired"));
      return;
    }

    if (password !== confirmPassword) {
      setMessage(t("auth.passwordMismatch"));
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await api.POST("/auth/register", {
      body: { email, password },
    });

    setLoading(false);

    if (error) {
      setMessage(parseApiError(error, t("auth.register")));
      return;
    }

    setMessage(t("auth.registerSuccess"));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{t("auth.createAccount")}</Text>
        <Text style={styles.subtitle}>{t("auth.joinGnndex")}</Text>

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
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t("auth.confirmPassword")}
          />

          <Pressable
            style={[commonStyles.button, loading && styles.disabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={commonStyles.buttonText}>
              {loading ? t("auth.registering") : t("auth.register")}
            </Text>
          </Pressable>

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>

        <Pressable
          style={styles.loginLink}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.loginText}>
            {t("auth.hasAccount")}
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
  message: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
  },
  loginLink: {
    marginTop: 16,
    alignItems: "center",
  },
  loginText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
