import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { api } from "../../api/client";

type TemplateData = {
  welcomeTemplate: string;
  requestTemplate: string;
  reminderTemplate: string;
  thankyouTemplate: string;
  upiId: string;
};

const defaultTemplates: TemplateData = {
  welcomeTemplate:
    "Hi {{name}}, welcome to our service! Thank you for choosing us. We are happy to serve you.",

  requestTemplate:
    "Hi {{name}}, your payment for {{month}} is ₹{{amount}}. Please pay using UPI: {{upi}}",

  reminderTemplate:
    "Hi {{name}}, your payment of ₹{{amount}} for {{month}} is pending. Please complete your payment. UPI: {{upi}}",

  thankyouTemplate:
    "Hi {{name}}, thank you for your payment of ₹{{amount}} for {{month}}!",

  upiId: "",
};

export default function SettingsScreen() {
  const [serviceId, setServiceId] = useState("");
  const [serviceName, setServiceName] = useState("");

  const [template, setTemplate] = useState<TemplateData>(defaultTemplates);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load Settings
  const loadSettings = async () => {
    try {
      setLoading(true);

      const [storedServiceId, storedServiceName] = await Promise.all([
        SecureStore.getItemAsync("autoflow_service_id"),
        SecureStore.getItemAsync("autoflow_service_name"),
      ]);

      if (!storedServiceId) {
        Alert.alert("Service not selected", "Please select a service.");

        router.replace("/services");
        return;
      }

      setServiceId(storedServiceId);
      setServiceName(storedServiceName || "My Service");

      const response = await api.get(`/whatsapp-template/${storedServiceId}`);

      if (response.data) {
        setTemplate({
          welcomeTemplate:
            response.data.welcomeTemplate || defaultTemplates.welcomeTemplate,

          requestTemplate:
            response.data.requestTemplate || defaultTemplates.requestTemplate,

          reminderTemplate:
            response.data.reminderTemplate || defaultTemplates.reminderTemplate,

          thankyouTemplate:
            response.data.thankyouTemplate || defaultTemplates.thankyouTemplate,

          upiId: response.data.upiId || "",
        });
      } else {
        setTemplate(defaultTemplates);
      }
    } catch (error: any) {
      console.log("Settings loading error:", error.response?.data || error);

      if (error.response?.status === 404) {
        setTemplate(defaultTemplates);
      } else {
        Alert.alert("Error", "Settings load panna mudiyala. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, []),
  );

  // Update template fields
  const updateField = (key: keyof TemplateData, value: string) => {
    setTemplate((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  // Save Settings
  const saveSettings = async () => {
    if (!serviceId) return;

    try {
      setSaving(true);

      await api.post("/whatsapp-template/save", {
        serviceId,
        ...template,
      });

      Alert.alert("Success", "Settings saved successfully!");
    } catch (error: any) {
      console.log("Save settings error:", error.response?.data || error);

      Alert.alert(
        "Save failed",
        error.response?.data?.message || "Settings save panna mudiyala.",
      );
    } finally {
      setSaving(false);
    }
  };

  // Logout
  const logout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await SecureStore.deleteItemAsync("autoflow_token");
            await SecureStore.deleteItemAsync("autoflow_service_id");
            await SecureStore.deleteItemAsync("autoflow_service_name");
            await SecureStore.deleteItemAsync("autoflow_selected_month");

            router.replace("/login");
          } catch {
            Alert.alert("Error", "Unable to logout. Please try again.");
          }
        },
      },
    ]);
  };

  // Reusable Input Field
  const Field = ({
    label,
    value,
    onChangeText,
    placeholder,
    multiline = false,
  }: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
    multiline?: boolean;
  }) => (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-gray-700">{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        className={`rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 ${
          multiline ? "min-h-28" : ""
        }`}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );

  // Loading
  if (loading) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-gray-50"
        edges={["top", "bottom"]}
      >
        <ActivityIndicator size="large" color="#4F46E5" />

        <Text className="mt-3 text-gray-500">Loading settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900">Settings</Text>

          <Text className="mt-1 text-sm text-gray-500">
            Manage your service and preferences
          </Text>
        </View>

        {/* Service Details */}
        <View className="mb-5 rounded-2xl border border-gray-100 bg-white p-5">
          <Text className="mb-4 text-lg font-bold text-gray-900">
            Service Details
          </Text>

          <Text className="mb-1 text-xs font-medium text-gray-500">
            SELECTED SERVICE
          </Text>

          <Text className="text-base font-semibold text-indigo-600">
            {serviceName}
          </Text>
        </View>

        {/* Payment Settings */}
        <View className="mb-5 rounded-2xl border border-gray-100 bg-white p-5">
          <Text className="mb-1 text-lg font-bold text-gray-900">
            Payment Settings
          </Text>

          <Text className="mb-4 text-sm text-gray-500">
            Configure your payment collection details
          </Text>

          <Field
            label="UPI ID"
            value={template.upiId}
            onChangeText={(value) => updateField("upiId", value)}
            placeholder="example@upi"
          />
        </View>

        {/* WhatsApp Templates */}
        <View className="mb-5 rounded-2xl border border-gray-100 bg-white p-5">
          <Text className="mb-1 text-lg font-bold text-gray-900">
            WhatsApp Templates
          </Text>

          <Text className="mb-5 text-sm text-gray-500">
            Customize messages sent to your customers
          </Text>

          {/* Welcome Message */}
          <View className="mb-5 rounded-xl border border-green-100 bg-green-50 p-3">
            <Text className="mb-1 font-bold text-green-800">
              Welcome Message
            </Text>

            <Text className="mb-3 text-xs text-green-700">
              Sent to newly added customers only
            </Text>

            <Field
              label="Welcome Template"
              value={template.welcomeTemplate}
              onChangeText={(value) => updateField("welcomeTemplate", value)}
              placeholder="Enter welcome message"
              multiline
            />
          </View>

          {/* Payment Request */}
          <Field
            label="Payment Request"
            value={template.requestTemplate}
            onChangeText={(value) => updateField("requestTemplate", value)}
            multiline
          />

          {/* Payment Reminder */}
          <Field
            label="Payment Reminder"
            value={template.reminderTemplate}
            onChangeText={(value) => updateField("reminderTemplate", value)}
            multiline
          />

          {/* Thank You Message */}
          <Field
            label="Thank You Message"
            value={template.thankyouTemplate}
            onChangeText={(value) => updateField("thankyouTemplate", value)}
            multiline
          />

          {/* Available Placeholders */}
          <View className="rounded-xl bg-indigo-50 p-3">
            <Text className="mb-2 text-xs font-bold text-indigo-800">
              AVAILABLE PLACEHOLDERS
            </Text>

            <Text className="text-xs leading-6 text-indigo-700">
              {"{{name}}"} · {"{{month}}"} · {"{{amount}}"}
              {"\n"}
              {"{{missedDays}}"} · {"{{missedDates}}"}
              {"\n"}
              {"{{upi}}"} · {"{{phone}}"}
            </Text>
          </View>
        </View>

        {/* Save Settings */}
        <TouchableOpacity
          onPress={saveSettings}
          disabled={saving}
          className={`mb-5 items-center rounded-xl py-4 ${
            saving ? "bg-indigo-300" : "bg-indigo-600"
          }`}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="font-bold text-white">Save Settings</Text>
          )}
        </TouchableOpacity>

        {/* Account */}
        <View className="rounded-2xl border border-red-100 bg-white p-5">
          <Text className="mb-2 text-lg font-bold text-gray-900">Account</Text>

          <Text className="mb-4 text-sm text-gray-500">
            Sign out from your AutoFlow Manager account
          </Text>

          <TouchableOpacity
            onPress={logout}
            className="items-center rounded-xl border border-red-200 bg-red-50 py-3"
          >
            <Text className="font-bold text-red-600">Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text className="mt-6 text-center text-xs text-gray-400">
          AutoFlow Manager
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
