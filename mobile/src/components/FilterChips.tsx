import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors } from "../utils/theme";

type FilterChipsProps<T extends string> = {
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
};

export function FilterChips<T extends string>({
  options,
  selected,
  onSelect,
}: FilterChipsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((item) => (
        <Pressable
          key={item}
          style={[styles.chip, selected === item && styles.chipActive]}
          onPress={() => onSelect(item)}
        >
          <Text
            style={[
              styles.chipText,
              selected === item && styles.chipTextActive,
            ]}
          >
            {item}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.white,
  },
});
