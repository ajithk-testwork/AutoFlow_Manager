import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import { Feather } from "@expo/vector-icons"; // <-- Imported Icons
import { loginUser } from "../services/authService";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // <-- Added state for toggle

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Missing details", "Email and password enter pannunga.");
      return;
    }

    try {
      setLoading(true);

      await loginUser({
        email: email.trim().toLowerCase(),
        password,
      });

      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Login failed", error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        className="px-6 py-10"
      >
        <View className="mb-8">
          <Text className="text-3xl font-bold text-slate-900">AutoFlow</Text>
          <Text className="mt-2 text-base text-slate-500">
            Sign in to manage your car cleaning business.
          </Text>
        </View>

        <View className="rounded-3xl bg-white p-5 shadow-sm shadow-slate-200">
          <Text className="mb-2 font-semibold text-slate-800">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            className="mb-5 rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-blue-500"
          />

          <Text className="mb-2 font-semibold text-slate-800">Password</Text>

          {/* Password Input with Hide/Show Icon */}
          <View className="relative mb-6 justify-center">
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              editable={!loading}
              className="rounded-xl border border-slate-200 py-3 pl-4 pr-12 text-slate-900 focus:border-blue-500"
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              className="absolute right-0 h-full w-12 items-center justify-center rounded-r-xl"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather
                name={showPassword ? "eye" : "eye-off"}
                size={20}
                color="#64748b"
              />
            </Pressable>
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            className={`items-center rounded-xl py-4 ${loading ? "bg-blue-400" : "bg-blue-600 active:bg-blue-700"}`}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-bold text-white text-base">Login</Text>
            )}
          </Pressable>

          <View className="mt-6 flex-row justify-center">
            <Text className="text-slate-500">New to AutoFlow? </Text>
            <Link href="/register" className="font-bold text-blue-600">
              Create account
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
