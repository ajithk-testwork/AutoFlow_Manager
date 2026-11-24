import { Stack, ThemeProvider, DarkTheme, DefaultTheme } from "expo-router";

import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />

        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: true,
            animationDuration: 250,
          }}
        >
          {/* Initial route */}
          <Stack.Screen name="index" />

          {/* Authentication */}
          <Stack.Screen
            name="login"
            options={{
              animation: "fade",
              gestureEnabled: false,
            }}
          />

          <Stack.Screen
            name="register"
            options={{
              animation: "slide_from_right",
            }}
          />

          {/* Service selection */}
          <Stack.Screen
            name="services"
            options={{
              animation: "slide_from_right",
            }}
          />

          {/* Main bottom tabs */}
          <Stack.Screen
            name="(tabs)"
            options={{
              gestureEnabled: false,
            }}
          />

          {/* Customer details - outside tabs */}
          <Stack.Screen
            name="customer/[id]"
            options={{
              headerShown: false,
              animation: "slide_from_right",
              gestureEnabled: true,
            }}
          />

          {/* Explore */}
          <Stack.Screen name="explore" />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
