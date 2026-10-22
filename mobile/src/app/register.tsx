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
import { registerUser } from "../services/authService";

export default function RegisterScreen() {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // <-- Added state for toggle

  async function handleRegister() {
    if (
      !businessName.trim() ||
      !ownerName.trim() ||
      !email.trim() ||
      !whatsapp.trim() ||
      !password
    ) {
      Alert.alert("Missing details", "Required fields ellam fill pannunga.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Invalid password", "Minimum 6 characters use pannunga.");
      return;
    }

    try {
      setLoading(true);

      await registerUser({
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.trim(),
        password,
        ...(upiId.trim() ? { upiId: upiId.trim() } : {}),
      });

      Alert.alert(
        "Account created",
        "Registration successful. Existing login screen-la sign in pannunga.",
        [{ text: "Continue", onPress: () => router.replace("/login") }],
      );
    } catch (error: any) {
      Alert.alert("Registration failed", error.message);
    } finally {
      setLoading(false);
    }
  }

  function field(
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    placeholder: string,
    options: {
      secureTextEntry?: boolean;
      keyboardType?: "default" | "email-address" | "phone-pad";
    } = {},
  ) {
    const isPasswordField = options.secureTextEntry;

    return (
      <View className="mb-4">
        <Text className="mb-2 font-semibold text-slate-800">{label}</Text>
        <View className="relative justify-center">
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            secureTextEntry={isPasswordField ? !showPassword : false}
            keyboardType={options.keyboardType ?? "default"}
            autoCapitalize={
              options.keyboardType === "email-address" ? "none" : "words"
            }
            autoCorrect={false}
            editable={!loading}
            className={`rounded-xl border border-slate-200 py-3 pl-4 text-slate-900 focus:border-blue-500 ${
              isPasswordField ? "pr-12" : "pr-4"
            }`}
          />
          {isPasswordField && (
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
          )}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        className="px-6 py-8"
      >
        <Text className="mb-2 text-3xl font-bold text-slate-900">
          Create account
        </Text>
        <Text className="mb-6 text-slate-500">
          Set up your AutoFlow business account.
        </Text>

        <View className="rounded-3xl bg-white p-5 shadow-sm shadow-slate-200">
          {field(
            "Business name *",
            businessName,
            setBusinessName,
            "Your business name",
          )}
          {field("Owner name *", ownerName, setOwnerName, "Full name")}
          {field("Email *", email, setEmail, "you@example.com", {
            keyboardType: "email-address",
          })}
          {field("WhatsApp number *", whatsapp, setWhatsapp, "Phone number", {
            keyboardType: "phone-pad",
          })}
          {field("Password *", password, setPassword, "Minimum 6 characters", {
            secureTextEntry: true,
          })}
          {field("UPI ID (optional)", upiId, setUpiId, "name@bank")}

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            className={`mt-2 items-center rounded-xl py-4 ${loading ? "bg-blue-400" : "bg-blue-600 active:bg-blue-700"}`}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-bold text-white text-base">
                Create account
              </Text>
            )}
          </Pressable>

          <View className="mt-6 flex-row justify-center">
            <Text className="text-slate-500">Already have an account? </Text>
            <Link href="/login" className="font-bold text-blue-600">
              Login
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
