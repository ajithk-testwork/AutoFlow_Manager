import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { loginUser } from "../services/authService";

const HERO_IMAGE =
  "https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https%3A/assets.cdn.filesafe.space/nQdWxd33c8H3izCjRmAf/media/69c809889fc63a61273ccdc8.png";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(
    null,
  );

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
      router.replace("/services");
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* Hero section */}
        <ImageBackground
          source={{ uri: HERO_IMAGE }}
          resizeMode="cover"
          className="h-[310px] justify-end overflow-hidden"
        >
          <View className="absolute inset-0 bg-slate-950/65" />

          <View className="px-7 pb-9">
            <View className="mb-5 h-14 w-14 items-center justify-center rounded-2xl bg-blue-600">
              <Feather name="truck" size={28} color="#FFFFFF" />
            </View>

            <Text className="text-3xl font-extrabold text-white">AutoFlow</Text>

            <Text className="mt-2 text-base leading-6 text-slate-200">
              Manage your car cleaning business{"\n"}
              smarter, faster and easier.
            </Text>

            <View className="mt-5 flex-row items-center">
              <View className="h-1 w-10 rounded-full bg-blue-500" />
              <View className="ml-2 h-1 w-5 rounded-full bg-white/50" />
              <View className="ml-2 h-1 w-5 rounded-full bg-white/50" />
            </View>
          </View>
        </ImageBackground>

        {/* Login form */}
        <View className="-mt-5 flex-1 rounded-t-[28px] bg-slate-50 px-6 pb-10 pt-8">
          <View className="mb-7">
            <Text className="text-2xl font-bold text-slate-900">
              Welcome back!
            </Text>
            <Text className="mt-2 text-sm text-slate-500">
              Sign in to continue to your dashboard.
            </Text>
          </View>

          <View className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            {/* Email */}
            <Text className="mb-2 text-sm font-semibold text-slate-700">
              Email address
            </Text>

            <View
              className={`mb-5 h-14 flex-row items-center rounded-xl border px-4 ${
                focusedField === "email"
                  ? "border-blue-500 bg-white"
                  : "border-slate-300 bg-white"
              }`}
            >
              <Feather
                name="mail"
                size={19}
                color={focusedField === "email" ? "#2563EB" : "#64748B"}
              />

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                selectionColor="#2563EB"
                cursorColor="#2563EB"
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                style={{
                  flex: 1,
                  marginLeft: 12,
                  fontSize: 16,
                  color: "#0F172A",
                  fontWeight: "500",
                  paddingVertical: 0,
                  includeFontPadding: false,
                }}
              />
            </View>

            {/* Password */}
            <Text className="mb-2 text-sm font-semibold text-slate-700">
              Password
            </Text>

            <View
              className={`mb-6 h-14 flex-row items-center rounded-xl border px-4 ${
                focusedField === "password"
                  ? "border-blue-500 bg-white"
                  : "border-slate-300 bg-white"
              }`}
            >
              <Feather
                name="lock"
                size={19}
                color={focusedField === "password" ? "#2563EB" : "#64748B"}
              />

              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                editable={!loading}
                selectionColor="#2563EB"
                cursorColor="#2563EB"
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                style={{
                  flex: 1,
                  marginLeft: 12,
                  fontSize: 16,
                  color: "#0F172A",
                  fontWeight: "500",
                  paddingVertical: 0,
                  includeFontPadding: false,
                }}
              />

              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={10}
              >
                <Feather
                  name={showPassword ? "eye" : "eye-off"}
                  size={20}
                  color="#64748B"
                />
              </Pressable>
            </View>

            {/* Login button */}
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              className={`h-14 flex-row items-center justify-center rounded-xl ${
                loading ? "bg-blue-400" : "bg-blue-600"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text className="mr-2 text-base font-bold text-white">
                    Sign In
                  </Text>
                  <Feather name="arrow-right" size={19} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            <View className="mt-6 flex-row justify-center">
              <Text className="text-sm text-slate-500">New to AutoFlow? </Text>

              <Link
                href="/register"
                className="text-sm font-bold text-blue-600"
              >
                Create account
              </Link>
            </View>
          </View>

          {/* Bottom trust text */}
          <View className="mt-7 flex-row items-center justify-center">
            <Feather name="shield-check" size={15} color="#64748B" />
            <Text className="ml-2 text-xs text-slate-400">
              Secure login · AutoFlow Manager
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
