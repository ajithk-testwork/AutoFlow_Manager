import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type FeedbackMode = "loading" | "error" | "empty" | "success";

type AutoFlowFeedbackProps = {
  mode: FeedbackMode;
  title?: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
  onSecondaryAction?: () => void;
  secondaryLabel?: string;
};

export default function AutoFlowFeedback({
  mode,
  title,
  message,
  retryLabel = "Try again",
  onRetry,
  onSecondaryAction,
  secondaryLabel,
}: AutoFlowFeedbackProps) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const appear = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    appear.setValue(0);
    Animated.spring(appear, {
      toValue: 1,
      friction: 7,
      tension: 55,
      useNativeDriver: true,
    }).start();

    if (mode === "loading") {
      spin.setValue(0);
      const rotation = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );

      pulse.setValue(1);
      const pulsing = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.08,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
      );

      rotation.start();
      pulsing.start();
      return () => {
        rotation.stop();
        pulsing.stop();
      };
    }

    if (mode === "error") {
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, {
          toValue: 1,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: -1,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: 0.6,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: 0,
          duration: 70,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [mode, appear, pulse, shake, spin]);

  const rotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const shakeX = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: [-7, 7],
  });

  const translateY = appear.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  const content = {
    loading: {
      icon: "↻",
      iconBg: "#EAF2FF",
      iconColor: "#2563EB",
      heading: title || "Loading your data",
      description: message || "Please wait while we get everything ready.",
    },
    error: {
      icon: "!",
      iconBg: "#FFF0F0",
      iconColor: "#DC2626",
      heading: title || "Something went wrong",
      description:
        message ||
        "We couldn't load your data. Check your connection and try again.",
    },
    empty: {
      icon: "—",
      iconBg: "#F1F5F9",
      iconColor: "#64748B",
      heading: title || "Nothing here yet",
      description: message || "There is no data to display right now.",
    },
    success: {
      icon: "✓",
      iconBg: "#EAFBF1",
      iconColor: "#16A34A",
      heading: title || "All done!",
      description: message || "Your action was completed successfully.",
    },
  }[mode];

  return (
    <View style={styles.screen}>
      <Animated.View
        style={[
          styles.card,
          {
            opacity: appear,
            transform: [
              { translateY },
              ...(mode === "loading" ? [{ scale: pulse }] : []),
            ],
          },
        ]}
      >
        <View style={styles.artwork}>
          {mode === "loading" ? (
            <>
              <View style={styles.outerRing} />
              <Animated.View
                style={[
                  styles.spinnerRing,
                  { transform: [{ rotate: rotation }] },
                ]}
              >
                <View style={styles.spinnerDot} />
              </Animated.View>
              <View
                style={[styles.iconCircle, { backgroundColor: content.iconBg }]}
              >
                <Text style={[styles.iconText, { color: content.iconColor }]}>
                  ↻
                </Text>
              </View>
            </>
          ) : (
            <Animated.View
              style={[
                styles.iconCircle,
                styles.largeIconCircle,
                {
                  backgroundColor: content.iconBg,
                  transform: [{ translateX: shakeX }],
                },
              ]}
            >
              <Text
                style={[
                  styles.iconText,
                  styles.largeIconText,
                  { color: content.iconColor },
                ]}
              >
                {content.icon}
              </Text>
            </Animated.View>
          )}
        </View>

        <Text style={styles.title}>{content.heading}</Text>
        <Text style={styles.message}>{content.description}</Text>

        {mode === "loading" ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.loadingText}>Please wait…</Text>
          </View>
        ) : null}

        {mode === "error" && onRetry ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>{retryLabel}</Text>
          </Pressable>
        ) : null}

        {onSecondaryAction && secondaryLabel ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSecondaryAction}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.brand}>AUTOFLOW MANAGER</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 26,
    paddingTop: 34,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: "#E9EEF5",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  artwork: {
    height: 142,
    width: 142,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  outerRing: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  spinnerRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#BFDBFE",
    borderTopColor: "#2563EB",
    borderRightColor: "#2563EB",
  },
  spinnerDot: {
    position: "absolute",
    top: -5,
    left: 52,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },
  iconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
  },
  largeIconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  iconText: {
    fontSize: 38,
    fontWeight: "800",
  },
  largeIconText: {
    fontSize: 58,
  },
  title: {
    color: "#0F172A",
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    marginTop: 10,
    maxWidth: 300,
    color: "#64748B",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 24,
  },
  loadingText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "700",
  },
  primaryButton: {
    width: "100%",
    minHeight: 52,
    marginTop: 26,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    paddingVertical: 15,
    paddingHorizontal: 18,
    marginTop: 5,
  },
  secondaryButtonText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  brand: {
    marginTop: 28,
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
});
