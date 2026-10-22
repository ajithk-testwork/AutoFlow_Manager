import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { api } from "../api/client";
import "../global.css"

export default function Index() {
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  const checkSession = useCallback(async () => {
    setChecking(true);
    setError("");

    try {
      const token = await SecureStore.getItemAsync("autoflow_token");

      if (!token) {
        router.replace("/login");
        return;
      }

      // Validate saved token using a protected backend endpoint.
      await api.get("/services");
      router.replace("/(tabs)");
    } catch (err: any) {
      const status = err?.response?.status;

      if (status === 401 || status === 403) {
        await SecureStore.deleteItemAsync("autoflow_token");
        router.replace("/login");
      } else {
        // Network/server errors do not automatically delete the saved token.
        setError("Server connect aagala. Internet check panni retry pannunga.");
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  if (checking) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-3 text-slate-500">Checking session...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="mb-4 text-center text-slate-600">{error}</Text>
        <Pressable
          onPress={checkSession}
          className="rounded-xl bg-blue-600 px-6 py-3"
        >
          <Text className="font-bold text-white">Retry</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            await SecureStore.deleteItemAsync("autoflow_token");
            router.replace("/login");
          }}
          className="mt-4 p-2"
        >
          <Text className="text-blue-600">Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}
