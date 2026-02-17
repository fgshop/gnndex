import { StatusBar } from "expo-status-bar";
import { MobileAuthProvider } from "./src/store/auth-context";
import { LocaleProvider } from "./src/i18n/locale-context";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <LocaleProvider>
      <MobileAuthProvider>
        <RootNavigator />
        <StatusBar style="dark" />
      </MobileAuthProvider>
    </LocaleProvider>
  );
}
