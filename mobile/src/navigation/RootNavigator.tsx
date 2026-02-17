import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useMobileAuth } from "../store/auth-context";
import { useTranslation } from "../i18n/locale-context";
import { AuthStack } from "./AuthStack";
import { MainTabs } from "./MainTabs";
import type { RootStackParamList } from "./types";
import { SafeAreaView, StyleSheet, Text } from "react-native";
import { colors } from "../utils/theme";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isReady, isAuthenticated } = useMobileAuth();
  const { t } = useTranslation();

  if (!isReady) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t("common.loadingSession")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
});
