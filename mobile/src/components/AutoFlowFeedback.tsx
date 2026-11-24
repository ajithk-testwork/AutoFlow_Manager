
import React, { useEffect, useRef } from "react";

import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";

import { MaterialCommunityIcons } from "@expo/vector-icons";

type FeedbackMode = "loading" | "error" | "success" | "empty";

interface AutoFlowFeedbackProps {
  mode?: FeedbackMode;
  title?: string;
  message?: string;
  visible?: boolean;
}

const BLUE = "#2563EB";
const NAVY = "#172554";
const MUTED = "#64748B";

export default function AutoFlowFeedback({
  mode = "loading",
  title,
  message,
  visible = true,
}: AutoFlowFeedbackProps) {
  // Animation values
  const orbitRotation = useRef(new Animated.Value(0)).current;
  const reverseRotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const particleMovement = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!visible || mode !== "loading") {
      orbitRotation.stopAnimation();
      reverseRotation.stopAnimation();
      pulse.stopAnimation();
      particleMovement.stopAnimation();

      return;
    }

    orbitRotation.setValue(0);
    reverseRotation.setValue(0);
    pulse.setValue(1);
    particleMovement.setValue(0);

    const outerOrbit = Animated.loop(
      Animated.timing(orbitRotation, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const innerOrbit = Animated.loop(
      Animated.timing(reverseRotation, {
        toValue: 1,
        duration: 6500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Very subtle light pulse. The car itself never moves.
    const glowPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.045,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const particles = Animated.loop(
      Animated.timing(particleMovement, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    outerOrbit.start();
    innerOrbit.start();
    glowPulse.start();
    particles.start();

    return () => {
      outerOrbit.stop();
      innerOrbit.stop();
      glowPulse.stop();
      particles.stop();
    };
  }, [
    visible,
    mode,
    orbitRotation,
    reverseRotation,
    pulse,
    particleMovement,
  ]);

  useEffect(() => {
    if (!visible || mode !== "success") return;

    successScale.setValue(0.6);

    const animation = Animated.spring(successScale, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [visible, mode, successScale]);

  if (!visible) return null;

  const rotate = orbitRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const reverseRotate = reverseRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  const particleX = particleMovement.interpolate({
    inputRange: [0, 1],
    outputRange: [-85, 85],
  });

  const particleOpacity = particleMovement.interpolate({
    inputRange: [0, 0.1, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });

  const getContent = () => {
    switch (mode) {
      case "error":
        return {
          title: title || "Something went wrong",
          message: message || "Please try again in a moment.",
        };

      case "success":
        return {
          title: title || "All Done!",
          message: message || "Your action completed successfully.",
        };

      case "empty":
        return {
          title: title || "Nothing here yet",
          message: message || "Your data will appear here.",
        };

      default:
        return {
          title: title || "Preparing your workspace",
          message: message || "Syncing your business data securely...",
        };
    }
  };

  const content = getContent();

  return (
    <View style={styles.container}>
      {mode === "loading" && (
        <>
          <View style={styles.visualContainer}>
            {/* Ambient background glow */}
            <View style={styles.ambientGlow} />

            {/* Outer orbit */}
            <Animated.View
              style={[
                styles.outerOrbit,
                { transform: [{ rotate }] },
              ]}
            >
              <View style={styles.orbitDot} />
              <View style={styles.orbitDotSecondary} />
            </Animated.View>

            {/* Middle orbit */}
            <Animated.View
              style={[
                styles.middleOrbit,
                { transform: [{ rotate: reverseRotate }] },
              ]}
            >
              <View style={styles.middleOrbitDot} />
            </Animated.View>

            {/* Inner orbital circle */}
            <View style={styles.innerOrbit} />

            {/* Static vehicle */}
            <Animated.View
              style={[
                styles.vehicleContainer,
                { transform: [{ scale: pulse }] },
              ]}
            >
              <View style={styles.vehicleGlow} />

              <MaterialCommunityIcons
                name="car-sports"
                size={76}
                color={BLUE}
              />
            </Animated.View>

            {/* Moving light particle */}
            <Animated.View
              style={[
                styles.particle,
                {
                  opacity: particleOpacity,
                  transform: [{ translateX: particleX }],
                },
              ]}
            />

            {/* Bottom decorative line */}
            <View style={styles.baseLine} />
          </View>

          <View style={styles.loadingBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.loadingBadgeText}>
              AUTO FLOW ENGINE
            </Text>
          </View>
        </>
      )}

      {mode === "error" && (
        <View style={[styles.statusIcon, styles.errorIcon]}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color="#DC2626"
          />
        </View>
      )}

      {mode === "success" && (
        <Animated.View
          style={[
            styles.statusIcon,
            styles.successIcon,
            { transform: [{ scale: successScale }] },
          ]}
        >
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={48}
            color="#16A34A"
          />
        </Animated.View>
      )}

      {mode === "empty" && (
        <View style={[styles.statusIcon, styles.emptyIcon]}>
          <MaterialCommunityIcons
            name="database-search-outline"
            size={48}
            color="#64748B"
          />
        </View>
      )}

      <Text style={styles.title}>{content.title}</Text>

      <Text style={styles.message}>{content.message}</Text>

      {mode === "loading" && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressHighlight,
                { transform: [{ translateX: particleX }] },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>PLEASE WAIT</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#F8FAFF",
  },

  visualContainer: {
    width: 260,
    height: 250,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  ambientGlow: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 100,
    backgroundColor: "#DBEAFE",
    opacity: 0.55,
  },

  outerOrbit: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    borderStyle: "dashed",
  },

  orbitDot: {
    position: "absolute",
    top: 20,
    right: 30,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2563EB",
    borderWidth: 3,
    borderColor: "#DBEAFE",
  },

  orbitDotSecondary: {
    position: "absolute",
    bottom: 20,
    left: 30,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#38BDF8",
  },

  middleOrbit: {
    position: "absolute",
    width: 174,
    height: 174,
    borderRadius: 87,
    borderWidth: 2,
    borderColor: "#93C5FD",
    borderLeftColor: "transparent",
    borderBottomColor: "transparent",
  },

  middleOrbitDot: {
    position: "absolute",
    bottom: 15,
    right: 22,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#0EA5E9",
  },

  innerOrbit: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    backgroundColor: "rgba(255,255,255,0.65)",
  },

  vehicleContainer: {
    width: 112,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 56,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },

  vehicleGlow: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#EFF6FF",
  },

  particle: {
    position: "absolute",
    bottom: 28,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0EA5E9",
    shadowColor: "#0EA5E9",
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },

  baseLine: {
    position: "absolute",
    bottom: 15,
    width: 80,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#BFDBFE",
  },

  loadingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    marginBottom: 14,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#16A34A",
  },

  loadingBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: "#2563EB",
  },

  title: {
    fontSize: 20,
    fontWeight: "800",
    color: NAVY,
    textAlign: "center",
    marginTop: 8,
    letterSpacing: -0.4,
  },

  message: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 280,
  },

  progressContainer: {
    width: 150,
    alignItems: "center",
    marginTop: 22,
  },

  progressTrack: {
    width: 150,
    height: 4,
    borderRadius: 5,
    backgroundColor: "#DBEAFE",
    overflow: "hidden",
  },

  progressHighlight: {
    width: 55,
    height: 4,
    borderRadius: 5,
    backgroundColor: BLUE,
  },

  progressLabel: {
    marginTop: 10,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#94A3B8",
  },

  statusIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  errorIcon: {
    backgroundColor: "#FEF2F2",
  },

  successIcon: {
    backgroundColor: "#F0FDF4",
  },

  emptyIcon: {
    backgroundColor: "#F1F5F9",
  },
});
