import { StyleSheet } from "react-native";

export const colors = {
  background: "#f8fafc",
  card: "#ffffff",
  primary: "#0f172a",
  textPrimary: "#0f172a",
  textSecondary: "#334155",
  textTertiary: "#475569",
  textMuted: "#64748b",
  border: "#e2e8f0",
  borderLight: "#cbd5e1",
  up: "#15803d",
  down: "#be123c",
  warning: "#a16207",
  white: "#ffffff",
  transparent: "transparent",
} as const;

export const commonStyles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  button: {
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: colors.white,
    fontWeight: "700",
  },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: 9,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
});
