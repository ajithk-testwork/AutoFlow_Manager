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
import { registerUser } from "../services/authService";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=1200&q=85";

export default function RegisterScreen() {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  function renderField(
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    placeholder: string,
    icon: React.ComponentProps<typeof Feather>["name"],
    options: {
      secureTextEntry?: boolean;
      keyboardType?: "default" | "email-address" | "phone-pad";
      optional?: boolean;
    } = {},
  ) {
    const isPassword = options.secureTextEntry;

    return (
      <View className="mb-5">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-slate-700">{label}</Text>
          {options.optional && (
            <Text className="text-xs font-medium text-slate-400">OPTIONAL</Text>
          )}
        </View>

        <View className="h-[54px] flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-4">
          <Feather name={icon} size={19} color="#64748B" />

          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#94A3B8"
            secureTextEntry={isPassword ? !showPassword : false}
            keyboardType={options.keyboardType ?? "default"}
            autoCapitalize={
              options.keyboardType === "email-address" ? "none" : "words"
            }
            autoCorrect={false}
            editable={!loading}
            className="ml-3 flex-1 text-[15px] text-slate-900"
          />

          {isPassword && (
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={10}
            >
              <Feather
                name={showPassword ? "eye" : "eye-off"}
                size={19}
                color="#64748B"
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* Hero */}
        <ImageBackground
          source={{ uri: HERO_IMAGE }}
          resizeMode="cover"
          className="h-[250px] justify-end"
        >
          <View className="absolute inset-0 bg-slate-950/65" />

          <View className="px-6 pb-9">
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-blue-600">
              <Feather name="truck" size={25} color="white" />
            </View>

            <Text className="text-3xl font-extrabold text-white">
              Join AutoFlow
            </Text>

            <Text className="mt-2 max-w-[300px] text-sm leading-6 text-slate-200">
              Everything your car cleaning business needs, all in one place.
            </Text>

            <View className="mt-5 flex-row items-center">
              <Feather name="check-circle" size={15} color="#60A5FA" />
              <Text className="ml-2 text-xs font-medium text-white">
                Simple setup · Smart business management
              </Text>
            </View>
          </View>
        </ImageBackground>

        {/* Form */}
        <View className="-mt-5 rounded-t-[28px] bg-slate-50 px-6 pb-10 pt-8">
          <View className="mb-7">
            <Text className="text-2xl font-bold text-slate-900">
              Create your account
            </Text>
            <Text className="mt-2 text-sm text-slate-500">
              Enter your details to get started.
            </Text>
          </View>

          <View className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            {/* Business details */}
            <View className="mb-5 flex-row items-center">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                <Feather name="briefcase" size={17} color="#2563EB" />
              </View>
              <View className="ml-3">
                <Text className="font-bold text-slate-900">
                  Business details
                </Text>
                <Text className="text-xs text-slate-400">
                  Tell us about your business
                </Text>
              </View>
            </View>

            {renderField(
              "Business name *",
              businessName,
              setBusinessName,
              "Your business name",
              "home",
            )}

            {renderField(
              "Owner name *",
              ownerName,
              setOwnerName,
              "Full name",
              "user",
            )}

            <View className="mb-6 h-px bg-slate-100" />

            {/* Contact details */}
            <View className="mb-5 flex-row items-center">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                <Feather name="user" size={17} color="#2563EB" />
              </View>
              <View className="ml-3">
                <Text className="font-bold text-slate-900">
                  Account details
                </Text>
                <Text className="text-xs text-slate-400">
                  Your login and contact information
                </Text>
              </View>
            </View>

            {renderField(
              "Email address *",
              email,
              setEmail,
              "you@example.com",
              "mail",
              { keyboardType: "email-address" },
            )}

            {renderField(
              "WhatsApp number *",
              whatsapp,
              setWhatsapp,
              "Enter phone number",
              "phone",
              { keyboardType: "phone-pad" },
            )}

            {renderField(
              "Password *",
              password,
              setPassword,
              "Minimum 6 characters",
              "lock",
              { secureTextEntry: true },
            )}

            <View className="mb-6 h-px bg-slate-100" />

            {/* Payment details */}
            <View className="mb-5 flex-row items-center">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                <Feather name="credit-card" size={17} color="#2563EB" />
              </View>
              <View className="ml-3">
                <Text className="font-bold text-slate-900">
                  Payment details
                </Text>
                <Text className="text-xs text-slate-400">
                  Add your UPI information
                </Text>
              </View>
            </View>

            {renderField("UPI ID", upiId, setUpiId, "name@bank", "smartphone", {
              optional: true,
            })}

            {/* CTA */}
            <Pressable
              onPress={handleRegister}
              disabled={loading}
              className={`mt-2 h-14 flex-row items-center justify-center rounded-2xl ${
                loading ? "bg-blue-400" : "bg-blue-600"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text className="mr-2 text-base font-bold text-white">
                    Create My Account
                  </Text>
                  <Feather name="arrow-right" size={19} color="white" />
                </>
              )}
            </Pressable>

            <View className="mt-6 flex-row justify-center">
              <Text className="text-sm text-slate-500">
                Already have an account?{" "}
              </Text>
              <Link href="/login" className="text-sm font-bold text-blue-600">
                Sign in
              </Link>
            </View>
          </View>

          <View className="mt-7 flex-row items-center justify-center">
            <Feather name="shield-check" size={15} color="#64748B" />
            <Text className="ml-2 text-xs text-slate-400">
              Your business information is securely protected.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
