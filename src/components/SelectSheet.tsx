import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ModalScreen } from './ModalScreen';
import { colors } from '@/theme/colors';
import { radius, spacing, text } from '@/theme/typography';

export interface Option {
  id: string;
  label: string;
  sublabel?: string;
}

interface SelectSheetProps {
  visible: boolean;
  title: string;
  options: Option[];
  onSelect: (id: string) => void;
  onClose: () => void;
  /** Footer action, e.g. "＋ New exercise". */
  onCreate?: (query: string) => void;
  createLabel?: string;
}

export function SelectSheet({
  visible,
  title,
  options,
  onSelect,
  onClose,
  onCreate,
  createLabel = 'Add new',
}: SelectSheetProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <ModalScreen visible={visible} onRequestClose={onClose}>
        <View style={styles.header}>
          <Text style={text.heading}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search…"
          placeholderTextColor={colors.textFaint}
          style={styles.search}
          autoCorrect={false}
        />

        <FlatList
          data={filtered}
          keyExtractor={(o) => o.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => {
                onSelect(item.id);
                setQuery('');
              }}
            >
              <Text style={text.body}>{item.label}</Text>
              {item.sublabel ? <Text style={text.caption}>{item.sublabel}</Text> : null}
            </Pressable>
          )}
          ListFooterComponent={
            onCreate ? (
              <Pressable
                style={({ pressed }) => [styles.create, pressed && styles.rowPressed]}
                onPress={() => {
                  onCreate(query.trim());
                  setQuery('');
                }}
              >
                <Text style={styles.createText}>
                  ＋ {createLabel}
                  {query.trim() ? ` “${query.trim()}”` : ''}
                </Text>
              </Pressable>
            ) : null
          }
        />
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  close: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  search: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  create: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  createText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});
