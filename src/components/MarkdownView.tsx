import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/typography';

/**
 * Minimal markdown renderer for the legal documents.
 *
 * Deliberately not a dependency: the documents only use headings, paragraphs,
 * bullets, tables and bold, and adding a markdown library would pull in a tree
 * of transitive packages whose licences we would then have to audit — for a
 * feature that is a hundred lines.
 */

/** Splits a line on **bold** and renders the segments. */
function inline(line: string, key: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={`${key}-${i}`} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    // Inline code marks (`lifter_7f3a91`) render as plain text.
    return (
      <Text key={`${key}-${i}`}>{part.replace(/`/g, '')}</Text>
    );
  });
}

export function MarkdownView({ source }: { source: string }) {
  const lines = source.split('\n');
  const out: React.ReactNode[] = [];

  let tableRows: string[][] = [];

  const flushTable = (key: string) => {
    if (tableRows.length === 0) return;
    const [head, ...body] = tableRows;
    out.push(
      <View key={key} style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeadRow]}>
          {head.map((c, i) => (
            <Text key={i} style={[styles.cell, styles.cellHead]}>
              {c}
            </Text>
          ))}
        </View>
        {body.map((row, ri) => (
          <View key={ri} style={styles.tableRow}>
            {row.map((c, i) => (
              <Text key={i} style={styles.cell}>
                {c}
              </Text>
            ))}
          </View>
        ))}
      </View>,
    );
    tableRows = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const key = `l-${i}`;

    // Table rows collect until a non-table line ends the block.
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      // Skip the |---|---| separator.
      if (!cells.every((c) => /^-+$/.test(c))) tableRows.push(cells);
      return;
    }
    flushTable(`t-${i}`);

    if (line.trim() === '') {
      out.push(<View key={key} style={styles.gap} />);
    } else if (line.startsWith('### ')) {
      out.push(
        <Text key={key} style={styles.h3}>
          {line.slice(4)}
        </Text>,
      );
    } else if (line.startsWith('## ')) {
      out.push(
        <Text key={key} style={styles.h2}>
          {line.slice(3)}
        </Text>,
      );
    } else if (line.startsWith('# ')) {
      out.push(
        <Text key={key} style={styles.h1}>
          {line.slice(2)}
        </Text>,
      );
    } else if (line.startsWith('- ')) {
      out.push(
        <View key={key} style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.body}>{inline(line.slice(2), key)}</Text>
        </View>,
      );
    } else {
      out.push(
        <Text key={key} style={styles.body}>
          {inline(line, key)}
        </Text>,
      );
    }
  });

  flushTable('t-end');

  return <View style={styles.wrap}>{out}</View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  h1: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: spacing.md },
  h2: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  h3: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: 2,
  },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  bold: { color: colors.text, fontWeight: '700' },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.xs },
  bullet: { color: colors.textFaint, fontSize: 14, lineHeight: 21 },
  gap: { height: spacing.sm },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  tableHeadRow: { borderTopWidth: 0, backgroundColor: colors.surfaceRaised },
  cell: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    padding: spacing.sm,
    lineHeight: 17,
  },
  cellHead: { color: colors.text, fontWeight: '700' },
});
