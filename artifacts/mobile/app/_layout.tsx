import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Head from "expo-router/head";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HistoryProvider } from "@/context/HistoryContext";

if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
    mutations: { retry: 0 },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <Head>
        <title>SaveFlow — Social Media Video Downloader</title>
        <meta name="description" content="Download videos and audio from YouTube, TikTok, Instagram, Facebook, Twitter/X, and Reddit. Choose MP4 or MP3 in seconds." />
        <meta name="theme-color" content="#080B14" />
        <meta name="application-name" content="SaveFlow" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="SaveFlow — Social Media Video Downloader" />
        <meta property="og:description" content="Download videos and audio from YouTube, TikTok, Instagram, Facebook, Twitter/X, and Reddit. Choose MP4 1080p, 720p, or MP3 in one tap." />
        <meta property="og:site_name" content="SaveFlow" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="SaveFlow — Social Media Video Downloader" />
        <meta name="twitter:description" content="Download videos and audio from YouTube, TikTok, Instagram, Facebook, Twitter/X, and Reddit." />

        {/* Canonical & robots */}
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}`} />
      </Head>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <HistoryProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              </Stack>
            </GestureHandlerRootView>
          </HistoryProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
