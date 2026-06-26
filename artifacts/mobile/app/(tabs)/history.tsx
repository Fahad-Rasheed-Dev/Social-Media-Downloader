import React, { useCallback } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useHistory, type DownloadRecord } from "@/context/HistoryContext";

function formatDate(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function HistoryItem({
  item,
  onRemove,
  colors,
}: {
  item: DownloadRecord;
  onRemove: (id: string) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const isAudio = item.format === "mp3";
  const accentColor = isAudio ? colors.accent : colors.primary;
  const iconName: React.ComponentProps<typeof Ionicons>["name"] = isAudio
    ? "musical-notes"
    : "videocam";

  const handleDelete = useCallback(() => {
    Alert.alert("Remove", "Remove this item from history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onRemove(item.id);
        },
      },
    ]);
  }, [item.id, onRemove]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconBox, { backgroundColor: accentColor + "22" }]}>
        <Ionicons name={iconName} size={22} color={accentColor} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {item.platform}
          </Text>
          <View style={[styles.dot, { backgroundColor: colors.mutedForeground }]} />
          <View style={[styles.badge, { backgroundColor: accentColor + "22", borderColor: accentColor + "55" }]}>
            <Text style={[styles.badgeText, { color: accentColor }]}>
              {item.format.toUpperCase()} {item.quality}{item.format === "mp3" ? "kbps" : "p"}
            </Text>
          </View>
          <View style={[styles.dot, { backgroundColor: colors.mutedForeground }]} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {formatDate(item.savedAt)}
          </Text>
        </View>
        {item.uploader && (
          <Text style={[styles.uploaderText, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.uploader}
            {item.duration ? ` · ${item.duration}` : ""}
          </Text>
        )}
      </View>
      <Pressable
        onPress={handleDelete}
        style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
        hitSlop={8}
      >
        <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { history, removeRecord, clearHistory } = useHistory();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 84);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      "Clear History",
      "This will remove all download history. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            clearHistory();
          },
        },
      ]
    );
  }, [clearHistory]);

  const renderItem = useCallback(
    ({ item }: { item: DownloadRecord }) => (
      <HistoryItem item={item} onRemove={removeRecord} colors={colors} />
    ),
    [removeRecord, colors]
  );

  const keyExtractor = useCallback((item: DownloadRecord) => item.id, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerLeft}>
          <Ionicons name="time" size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>History</Text>
        </View>
        {history.length > 0 && (
          <Pressable
            onPress={handleClearAll}
            style={({ pressed }) => [styles.clearBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="trash" size={16} color={colors.destructive} />
          </Pressable>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <LinearGradient
            colors={[colors.primary + "33", colors.accent + "22"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.emptyIcon}
          >
            <Ionicons name="time-outline" size={40} color={colors.primary} />
          </LinearGradient>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No downloads yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Your download history will appear here after you save a video.
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.list,
            { paddingTop: 8, paddingBottom: botPad, paddingHorizontal: 16 },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          scrollEnabled={history.length > 0}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  clearBtn: {
    width: 36, height: 36,
    borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  list: {},
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 12,
  },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  uploaderText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  deleteBtn: { padding: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
});
