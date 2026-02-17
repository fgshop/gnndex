import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MarketListScreen } from "../screens/market/MarketListScreen";
import { TradeScreen } from "../screens/trade/TradeScreen";
import { WalletScreen } from "../screens/wallet/WalletScreen";
import { MyPageScreen } from "../screens/mypage/MyPageScreen";
import { useTranslation } from "../i18n/locale-context";
import { colors } from "../utils/theme";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopColor: colors.border,
        },
      }}
    >
      <Tab.Screen
        name="Markets"
        component={MarketListScreen}
        options={{ tabBarLabel: t("tab.markets") }}
      />
      <Tab.Screen
        name="Trade"
        component={TradeScreen}
        options={{ tabBarLabel: t("tab.trade") }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ tabBarLabel: t("tab.wallet") }}
      />
      <Tab.Screen
        name="MyPage"
        component={MyPageScreen}
        options={{ tabBarLabel: t("tab.my") }}
      />
    </Tab.Navigator>
  );
}
