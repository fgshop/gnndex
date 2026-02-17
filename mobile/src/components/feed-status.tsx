import { StyleSheet, Text, View } from "react-native";
import type { SseRetryInfo } from "../utils/sse-stream";
import { useTranslation } from "../i18n/locale-context";

type FeedStatusProps = {
  connected: boolean;
  retryInfo: SseRetryInfo | null;
  style?: object;
};

export function FeedStatus({ connected, retryInfo, style }: FeedStatusProps) {
  const { t } = useTranslation();

  return (
    <View style={style}>
      <Text style={styles.feedText}>
        {connected ? t("feed.live") : t("feed.polling")}
      </Text>
      {retryInfo ? (
        <Text style={styles.noticeText}>
          {t("feed.reconnecting", {
            attempt: String(retryInfo.attempt),
            seconds: String(Math.max(1, Math.round(retryInfo.delayMs / 1000))),
          })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  feedText: {
    marginTop: 4,
    color: "#334155"
  },
  noticeText: {
    marginTop: 2,
    color: "#a16207",
    fontSize: 12,
    fontWeight: "600"
  }
});
