import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import {
  useGetVideoInfo,
  useStartDownload,
  useGetDownloadProgress,
  getGetDownloadProgressQueryKey,
} from "@workspace/api-client-react";
import { useHistory } from "@/context/HistoryContext";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const PLATFORMS: {
  id: string;
  label: string;
  icon: IoniconName;
  color: string;
}[] = [
  { id: "youtube", label: "YouTube", icon: "logo-youtube", color: "#FF0000" },
  { id: "tiktok", label: "TikTok", icon: "musical-notes", color: "#00f2ea" },
  { id: "instagram", label: "Instagram", icon: "logo-instagram", color: "#E1306C" },
  { id: "facebook", label: "Facebook", icon: "logo-facebook", color: "#1877F2" },
  { id: "twitter", label: "Twitter/X", icon: "logo-twitter", color: "#1DA1F2" },
  { id: "reddit", label: "Reddit", icon: "logo-reddit", color: "#FF4500" },
];

const FORMATS = [
  { format: "mp4", quality: "1080", label: "MP4", sub: "1080p HD", isAudio: false },
  { format: "mp4", quality: "720", label: "MP4", sub: "720p", isAudio: false },
  { format: "mp4", quality: "480", label: "MP4", sub: "480p", isAudio: false },
  { format: "mp3", quality: "320", label: "MP3", sub: "320kbps", isAudio: true },
  { format: "mp3", quality: "128", label: "MP3", sub: "128kbps", isAudio: true },
];

function detectPlatform(url: string): string | null {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("facebook.com") || url.includes("fb.watch")) return "facebook";
  if (url.includes("twitter.com") || url.includes("x.com")) return "twitter";
  if (url.includes("reddit.com")) return "reddit";
  return null;
}

type DownloadState = "idle" | "downloading" | "saving" | "done" | "error";

export default function DownloadScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addRecord } = useHistory();

  const [url, setUrl] = useState("");
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<{
    title: string;
    duration: string;
    thumbnail?: string;
    platform: string;
    uploader: string;
  } | null>(null);
  const [selectedFormat, setSelectedFormat] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");
  const [localError, setLocalError] = useState("");

  const infoFadeAnim = useRef(new Animated.Value(0)).current;
  const orb1Scale = useRef(new Animated.Value(1)).current;
  const orb2Scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1Scale, { toValue: 1.15, duration: 3000, useNativeDriver: true }),
        Animated.timing(orb1Scale, { toValue: 1, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2Scale, { toValue: 1.12, duration: 3500, useNativeDriver: true }),
        Animated.timing(orb2Scale, { toValue: 1, duration: 3500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const infoMutation = useGetVideoInfo();
  const downloadMutation = useStartDownload();

  const { data: progressData } = useGetDownloadProgress(jobId ?? "", {
    query: {
      enabled: !!jobId && downloadState === "downloading",
      refetchInterval: 1000,
      queryKey: getGetDownloadProgressQueryKey(jobId ?? ""),
    },
  });

  useEffect(() => {
    if (!progressData || downloadState !== "downloading") return;
    if (progressData.status === "done") {
      setDownloadState("saving");
      const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
      const fileUrl = `https://${domain}/api/video/file/${jobId}`;
      Linking.openURL(fileUrl)
        .then(() => {
          setDownloadState("done");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (videoInfo) {
            const fmt = FORMATS[selectedFormat];
            addRecord({
              title: videoInfo.title,
              platform: videoInfo.platform,
              format: fmt?.format ?? "mp4",
              quality: fmt?.quality ?? "1080",
              thumbnail: videoInfo.thumbnail,
              uploader: videoInfo.uploader,
              duration: videoInfo.duration,
            });
          }
        })
        .catch(() => setDownloadState("done"));
    } else if (progressData.status === "error") {
      setDownloadState("error");
      setLocalError(progressData.error ?? "Download failed on server.");
    }
  }, [progressData, downloadState]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setUrl(text);
        const platform = detectPlatform(text);
        if (platform) setActivePlatform(platform);
        setLocalError("");
        setVideoInfo(null);
        setDownloadState("idle");
        setJobId(null);
      }
    } catch {
      setLocalError("Clipboard access failed. Paste manually.");
    }
  }, []);

  const handleUrlChange = useCallback((text: string) => {
    setUrl(text);
    const platform = detectPlatform(text);
    if (platform) setActivePlatform(platform);
    setLocalError("");
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!url.trim()) {
      setLocalError("Please enter a URL");
      return;
    }
    setLocalError("");
    setVideoInfo(null);
    setDownloadState("idle");
    setJobId(null);
    infoFadeAnim.setValue(0);

    try {
      const data = await infoMutation.mutateAsync({ data: { url: url.trim() } });
      setVideoInfo({
        title: data.title,
        duration: data.duration,
        thumbnail: data.thumbnail,
        platform: data.platform,
        uploader: data.uploader,
      });
      Animated.timing(infoFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!activePlatform) setActivePlatform(data.platform);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to fetch video info. Check the URL.";
      setLocalError(msg);
    }
  }, [url, infoMutation, activePlatform, infoFadeAnim]);

  const handleDownload = useCallback(async () => {
    if (!videoInfo) return;
    const fmt = FORMATS[selectedFormat];
    if (!fmt) return;
    setDownloadState("downloading");
    setLocalError("");

    try {
      const data = await downloadMutation.mutateAsync({
        data: { url: url.trim(), format: fmt.format, quality: fmt.quality },
      });
      setJobId(data.jobId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to start download.";
      setLocalError(msg);
      setDownloadState("error");
    }
  }, [videoInfo, selectedFormat, url, downloadMutation]);

  const handleReset = useCallback(() => {
    setUrl("");
    setVideoInfo(null);
    setDownloadState("idle");
    setJobId(null);
    setLocalError("");
    setActivePlatform(null);
    infoFadeAnim.setValue(0);
  }, [infoFadeAnim]);

  const progress = progressData?.status === "done" ? 100 : (progressData?.percent ?? 0);
  const speed = progressData?.speed ?? "";
  const circumference = 2 * Math.PI * 34;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 100) / 100);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 84);

  const muted = "#13172A";
  const border = colors.border;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Background orbs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View
          style={[
            styles.orb,
            { top: -60, left: -60, width: 240, height: 240, transform: [{ scale: orb1Scale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.orb2,
            { top: 120, right: -60, width: 200, height: 200, transform: [{ scale: orb2Scale }] },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad, paddingBottom: botPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={["#7C3AED", "#00D4FF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoBox}
          >
            <Ionicons name="flash" size={22} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={[styles.logoTitle, { color: colors.foreground }]}>SaveFlow</Text>
            <Text style={[styles.logoSub, { color: colors.mutedForeground }]}>VIDEO DOWNLOADER</Text>
          </View>
        </View>

        {/* Platform Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.platformRow}
        >
          {PLATFORMS.map((p) => {
            const active = activePlatform === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setActivePlatform(p.id)}
                style={[
                  styles.pill,
                  {
                    borderColor: active ? p.color : border,
                    backgroundColor: active ? p.color + "18" : colors.card,
                  },
                ]}
              >
                <Ionicons name={p.icon} size={14} color={active ? p.color : colors.mutedForeground} />
                <Text style={[styles.pillText, { color: active ? p.color : colors.mutedForeground }]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* URL Input */}
        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: border }]}>
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>PASTE VIDEO URL</Text>
          <View style={[styles.inputRow, { backgroundColor: muted }]}>
            <Ionicons name="link-outline" size={16} color={colors.mutedForeground} />
            <TextInput
              value={url}
              onChangeText={handleUrlChange}
              placeholder="https://youtube.com/watch?v=..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.textInput, { color: colors.foreground }]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleAnalyze}
            />
            <Pressable
              onPress={handlePaste}
              style={[styles.pasteBtn, { backgroundColor: colors.primary + "33", borderColor: colors.primary + "66" }]}
            >
              <Text style={[styles.pasteBtnText, { color: colors.primary }]}>Paste</Text>
            </Pressable>
          </View>
        </View>

        {/* Error */}
        {!!localError && (
          <View style={[styles.errorCard, { backgroundColor: "#ef444418", borderColor: "#ef444455" }]}>
            <Ionicons name="warning-outline" size={14} color="#f87171" />
            <Text style={styles.errorText}>{localError}</Text>
          </View>
        )}

        {/* Analyze Button */}
        <Pressable
          onPress={handleAnalyze}
          disabled={infoMutation.isPending || !url.trim()}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginTop: 12 })}
        >
          <LinearGradient
            colors={["#7C3AED", "#5B21B6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.primaryBtn, { opacity: !url.trim() || infoMutation.isPending ? 0.5 : 1 }]}
          >
            {infoMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="search" size={16} color="#fff" />
            )}
            <Text style={styles.primaryBtnText}>
              {infoMutation.isPending ? "Analyzing..." : "Analyze Video"}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Video Info Card */}
        {videoInfo && (
          <Animated.View
            style={[styles.infoCard, { backgroundColor: colors.card, borderColor: border, opacity: infoFadeAnim }]}
          >
            <View style={styles.infoRow}>
              {videoInfo.thumbnail ? (
                <Image source={{ uri: videoInfo.thumbnail }} style={styles.thumbnail} />
              ) : (
                <View style={[styles.thumbnail, styles.thumbPlaceholder, { backgroundColor: colors.muted }]}>
                  <Ionicons name="videocam" size={24} color={colors.mutedForeground} />
                </View>
              )}
              <View style={styles.infoText}>
                <Text style={[styles.infoTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {videoInfo.title}
                </Text>
                <Text style={[styles.infoMeta, { color: colors.mutedForeground }]}>
                  {videoInfo.uploader} · {videoInfo.duration}
                </Text>
                <View
                  style={[
                    styles.platformBadge,
                    { backgroundColor: colors.primary + "22", borderColor: colors.primary + "55" },
                  ]}
                >
                  <Text style={[styles.platformBadgeText, { color: colors.primary }]}>
                    {videoInfo.platform}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Format Selector */}
        {videoInfo &&
          downloadState !== "downloading" &&
          downloadState !== "saving" &&
          downloadState !== "done" && (
            <View style={styles.formatSection}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CHOOSE FORMAT</Text>
              <View style={styles.formatGrid}>
                {FORMATS.map((fmt, i) => {
                  const active = selectedFormat === i;
                  const accent = fmt.isAudio ? colors.accent : colors.primary;
                  return (
                    <Pressable
                      key={i}
                      onPress={() => {
                        setSelectedFormat(i);
                        Haptics.selectionAsync();
                      }}
                      style={[
                        styles.formatCard,
                        {
                          backgroundColor: active ? accent + "18" : colors.card,
                          borderColor: active ? accent : border,
                        },
                      ]}
                    >
                      {active && (
                        <View style={[styles.formatCheck, { backgroundColor: accent }]}>
                          <Ionicons name="checkmark" size={10} color="#fff" />
                        </View>
                      )}
                      <Ionicons
                        name={fmt.isAudio ? "musical-notes" : "videocam"}
                        size={20}
                        color={active ? accent : colors.mutedForeground}
                      />
                      <Text style={[styles.formatLabel, { color: active ? colors.foreground : colors.mutedForeground }]}>
                        {fmt.label}
                      </Text>
                      <Text style={[styles.formatSub, { color: active ? accent : colors.mutedForeground }]}>
                        {fmt.sub}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

        {/* Progress */}
        {(downloadState === "downloading" || downloadState === "saving") && (
          <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: border }]}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, { color: colors.foreground }]} numberOfLines={1}>
                {videoInfo?.title}
              </Text>
              <Text style={[styles.progressPct, { color: colors.primary }]}>
                {Math.round(downloadState === "saving" ? 100 : progress)}%
              </Text>
            </View>
            <View style={styles.progressCircleRow}>
              <Svg width={80} height={80} viewBox="0 0 80 80">
                <Circle cx="40" cy="40" r="34" fill="none" stroke={border} strokeWidth="4" />
                <Circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke={downloadState === "saving" ? colors.accent : colors.primary}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={downloadState === "saving" ? 0 : strokeDashoffset}
                  transform="rotate(-90 40 40)"
                />
              </Svg>
              <View style={{ gap: 4 }}>
                <Text style={[styles.progressSpeed, { color: colors.primary }]}>
                  {downloadState === "saving" ? "Opening..." : speed || "Starting..."}
                </Text>
                {progressData?.eta ? (
                  <Text style={[styles.progressEta, { color: colors.mutedForeground }]}>
                    ETA {progressData.eta}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
              <LinearGradient
                colors={["#7C3AED", "#00D4FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressFill,
                  { width: `${downloadState === "saving" ? 100 : progress}%` as `${number}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Success */}
        {downloadState === "done" && (
          <View style={[styles.successCard, { backgroundColor: "#05966918", borderColor: "#059669aa" }]}>
            <Ionicons name="checkmark-circle" size={44} color="#34d399" />
            <Text style={[styles.successTitle, { color: "#34d399" }]}>Download Complete</Text>
            <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
              The file was opened for download. Check your browser or Files app.
            </Text>
            <Pressable
              onPress={handleReset}
              style={({ pressed }) => [
                styles.resetBtn,
                { backgroundColor: colors.secondary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.foreground} />
              <Text style={[styles.resetBtnText, { color: colors.foreground }]}>Download Another</Text>
            </Pressable>
          </View>
        )}

        {/* Download Button */}
        {videoInfo && downloadState === "idle" && (
          <Pressable
            onPress={handleDownload}
            disabled={downloadMutation.isPending}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginTop: 12 })}
          >
            <LinearGradient
              colors={["#0891B2", "#00D4FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              <Ionicons name="download" size={18} color="#000" />
              <Text style={[styles.primaryBtnText, { color: "#000" }]}>Download Now</Text>
            </LinearGradient>
          </Pressable>
        )}

        {/* Error state button */}
        {downloadState === "error" && (
          <Pressable
            onPress={() => setDownloadState("idle")}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, marginTop: 12 })}
          >
            <View style={[styles.secondaryBtn, { backgroundColor: colors.secondary }]}>
              <Ionicons name="refresh" size={16} color={colors.foreground} />
              <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Try Again</Text>
            </View>
          </Pressable>
        )}

        {/* Hint */}
        {!videoInfo && downloadState === "idle" && (
          <View style={styles.hintBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.mutedForeground} />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Paste a video URL from YouTube, TikTok, Instagram, Facebook, Twitter, or Reddit to get started.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  orb: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#7C3AED33",
  },
  orb2: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#00D4FF22",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 8 },
  logoBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  logoTitle: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  logoSub: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 2, marginTop: 1 },
  platformRow: { gap: 8, paddingVertical: 12 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
  },
  pillText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  inputCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  inputLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  textInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", minHeight: 24 },
  pasteBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  pasteBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  errorCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 8,
  },
  errorText: { color: "#f87171", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  primaryBtn: {
    borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  secondaryBtn: {
    borderRadius: 14, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  secondaryBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  infoCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 16 },
  infoRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  thumbnail: { width: 72, height: 72, borderRadius: 10 },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  infoText: { flex: 1, gap: 4 },
  infoTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  infoMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  platformBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, marginTop: 2,
  },
  platformBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  formatSection: { marginTop: 16, gap: 8 },
  sectionLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  formatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  formatCard: {
    flex: 1, minWidth: "45%",
    borderRadius: 14, borderWidth: 1, padding: 12, gap: 4,
    position: "relative",
  },
  formatCheck: {
    position: "absolute", top: 8, right: 8,
    width: 16, height: 16, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  formatLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  formatSub: { fontSize: 11, fontFamily: "Inter_500Medium" },
  progressCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 16, gap: 12 },
  progressHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  progressTitle: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1, marginRight: 8 },
  progressPct: { fontSize: 15, fontFamily: "Inter_700Bold" },
  progressCircleRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  progressSpeed: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  progressEta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  progressBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  successCard: {
    borderRadius: 16, borderWidth: 1, padding: 20, marginTop: 16,
    alignItems: "center", gap: 8,
  },
  successTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  successSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  resetBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 8,
  },
  resetBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  hintBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 16, marginTop: 8 },
  hintText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 20 },
});
