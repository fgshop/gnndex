import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../utils/theme";

type SegmentControlProps<T extends string> = {
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  labelFn?: (value: T) => string;
};

export function SegmentControl<T extends string>({
  options,
  selected,
  onSelect,
  labelFn,
}: SegmentControlProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((item) => (
        <Pressable
          key={item}
          style={[styles.button, selected === item && styles.active]}
          onPress={() => onSelect(item)}
        >
          <Text
            style={[styles.text, selected === item && styles.textActive]}
          >
            {labelFn ? labelFn(item) : item}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
  },
  button: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  active: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  textActive: {
    color: colors.white,
  },
});
