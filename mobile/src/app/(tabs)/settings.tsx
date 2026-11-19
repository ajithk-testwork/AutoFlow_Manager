import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { useFocusEffect, router } from "expo-router";

import * as SecureStore from "expo-secure-store";

import { Feather } from "@expo/vector-icons";

import { api } from "../../api/client";
import AutoFlowFeedback from "@/components/AutoFlowFeedback";

/* ───────────────────────────── Types ───────────────────────────── */

type TemplateData = {
  welcomeTemplate: string;

  requestTemplate: string;

  reminderTemplate: string;

  thankyouTemplate: string;

  upiId: string;

  phone: string;
};

type TemplateKey =
  | "welcomeTemplate"
  | "requestTemplate"
  | "reminderTemplate"
  | "thankyouTemplate";

/* ───────────────────────────── Constants ───────────────────────────── */

const defaultTemplates: TemplateData = {
  welcomeTemplate: `Hi {{name}}! 👋



Welcome to our vehicle care service.



Thank you for choosing us. We look forward to serving you!



Team AutoFlow`,

  requestTemplate: `Hello {{name}},\n\n📅 Billing Month: {{month}}\n\n🚗 Service Report:\nMissed Days: {{missedDays}}\nDates Missed: {{missedDates}}\n\n✅ Final Amount Due: ₹{{amount}}\n\n💳 Payment Options:\n\n🔹 UPI ID:\n{{upi}}\n\n🔹 GPay / PhonePe:\n{{phone}}\n\nThank you! 🚗✨`,

  reminderTemplate: `Hi {{name}},



Your {{month}} payment of ₹{{amount}} is still pending.



Kindly make the payment at your convenience.



UPI: {{upi}}



Thank you!`,

  thankyouTemplate: `Hi {{name}}!



We have received your payment of ₹{{amount}} for {{month}}.



Thank you for your timely payment and continued trust!



Team AutoFlow`,

  upiId: "",

  phone: "",
};

const ALL_PLACEHOLDERS = [
  "{{name}}",

  "{{month}}",

  "{{amount}}",

  "{{missedDays}}",

  "{{missedDates}}",

  "{{upi}}",

  "{{phone}}",
];

const TEMPLATE_TABS: {
  key: TemplateKey;

  label: string;

  icon: keyof typeof Feather.glyphMap;

  title: string;

  hint: string;

  placeholders: string[];
}[] = [
  {
    key: "welcomeTemplate",

    label: "Welcome",

    icon: "user-plus",

    title: "Welcome message",

    hint: "Sent to newly added customers only.",

    // The welcome flow only fills in the customer's name.

    placeholders: ["{{name}}"],
  },

  {
    key: "requestTemplate",

    label: "Bill",

    icon: "file-text",

    title: "Payment request",

    hint: "Sent when you ask a customer to pay for the month.",

    placeholders: ALL_PLACEHOLDERS,
  },

  {
    key: "reminderTemplate",

    label: "Reminder",

    icon: "bell",

    title: "Payment reminder",

    hint: "Sent to customers who haven’t paid yet.",

    placeholders: ALL_PLACEHOLDERS,
  },

  {
    key: "thankyouTemplate",

    label: "Thanks",

    icon: "heart",

    title: "Thank-you message",

    hint: "Sent after a customer’s payment is marked as paid.",

    placeholders: ALL_PLACEHOLDERS,
  },
];

/* ───────────────────────────── Ready-made templates ───────────────────────────── */

type Preset = { id: string; label: string; description: string; text: string };

const PRESETS: Record<TemplateKey, Preset[]> = {
  welcomeTemplate: [
    {
      id: "friendly",

      label: "Friendly",

      description: "Warm and casual, with an emoji.",

      text: "Hi {{name}}! 👋 Welcome aboard. We’re happy to take care of your vehicle. Message us anytime if you need anything.",
    },

    {
      id: "formal",

      label: "Formal",

      description: "Polite and professional.",

      text: "Dear {{name}}, welcome to our service. Thank you for choosing us. We look forward to serving you.",
    },

    {
      id: "short",

      label: "Short",

      description: "One quick line.",

      text: "Hi {{name}}, welcome! Thanks for choosing us.",
    },

    {
      id: "tamil",

      label: "Tamil + English",

      description: "Mixed language, in English letters.",

      text: "Vanakkam {{name}}! 🙏 Engal service-ku welcome. Ungalukku best service tharuvom. Nandri!",
    },
  ],

  requestTemplate: [
    {
      id: "friendly",

      label: "Friendly",

      description: "Bill with missed days and both payment options.",

      text: "Hi {{name}} 👋\n\nYour {{month}} bill is ready.\n\n🚗 Missed days: {{missedDays}}\n💰 Amount due: ₹{{amount}}\n\nPay by UPI: {{upi}}\nGPay / PhonePe: {{phone}}\n\nThank you! 🙏",
    },

    {
      id: "formal",

      label: "Formal",

      description: "Detailed, with the dates that were missed.",

      text: "Dear {{name}},\n\nYour bill for {{month}} is ₹{{amount}}.\nMissed days: {{missedDays}} ({{missedDates}}).\n\nPayment options:\nUPI ID: {{upi}}\nGPay / PhonePe: {{phone}}\n\nThank you.",
    },

    {
      id: "short",

      label: "Short",

      description: "Just the amount and UPI ID.",

      text: "Hi {{name}}, {{month}} bill: ₹{{amount}}. UPI: {{upi}}",
    },

    {
      id: "tamil",

      label: "Tamil + English",

      description: "Mixed language, in English letters.",

      text: "Vanakkam {{name}} 🙏\n\n{{month}} matha bill: ₹{{amount}}\nMissed days: {{missedDays}}\n\nUPI: {{upi}}\nGPay / PhonePe: {{phone}}\n\nNandri!",
    },
  ],

  reminderTemplate: [
    {
      id: "friendly",

      label: "Friendly",

      description: "A gentle nudge.",

      text: "Hi {{name}}, just a gentle reminder 😊 Your payment of ₹{{amount}} for {{month}} is still pending.\n\nUPI: {{upi}}\nGPay / PhonePe: {{phone}}\n\nThank you!",
    },

    {
      id: "formal",

      label: "Formal",

      description: "Polite but clear.",

      text: "Dear {{name}}, this is a reminder that your payment of ₹{{amount}} for {{month}} is pending. Kindly pay at your earliest convenience.\n\nUPI ID: {{upi}}",
    },

    {
      id: "short",

      label: "Short",

      description: "One quick line.",

      text: "Hi {{name}}, ₹{{amount}} for {{month}} is pending. UPI: {{upi}}",
    },

    {
      id: "tamil",

      label: "Tamil + English",

      description: "Mixed language, in English letters.",

      text: "Vanakkam {{name}} 🙏 {{month}} matha ₹{{amount}} innum pending. Please pay panna mudiyuma?\n\nUPI: {{upi}}\nNandri!",
    },
  ],

  thankyouTemplate: [
    {
      id: "friendly",

      label: "Friendly",

      description: "Cheerful thank-you.",

      text: "Thank you {{name}}! 🎉 We received your ₹{{amount}} for {{month}}. Have a great day!",
    },

    {
      id: "formal",

      label: "Formal",

      description: "Polite acknowledgement.",

      text: "Dear {{name}}, we have received your payment of ₹{{amount}} for {{month}}. Thank you for your prompt payment.",
    },

    {
      id: "short",

      label: "Short",

      description: "One quick line.",

      text: "Thanks {{name}}! ₹{{amount}} received for {{month}}.",
    },

    {
      id: "tamil",

      label: "Tamil + English",

      description: "Mixed language, in English letters.",

      text: "Nandri {{name}}! 🙏 {{month}} matha ₹{{amount}} payment kedaichiduchu. Have a nice day!",
    },
  ],
};

/* ───────────────────────────── Helpers ───────────────────────────── */

const getCurrentMonth = () => {
  const date = new Date();

  return `${date.toLocaleString("en-US", { month: "long" })} ${date.getFullYear()}`;
};

const renderPreview = (text: string, template: TemplateData) => {
  const values: Record<string, string> = {
    name: "Ajith K Sir",
    service: "Vehicle service",
    month: getCurrentMonth(),
    amount: "2,500",
    missedDays: "0",
    missedDates: "None",
    upi: template.upiId?.trim() || "Not Provided",
    phone: template.phone?.trim() || "Not Provided",
  };

  return text.replace(
    /{{\s*(name|service|month|amount|missedDays|missedDates|upi|phone)\s*}}/gi,
    (_match, key: string) => values[key.toLowerCase()] ?? _match,
  );
};

const isValidUpi = (value: string) =>
  /^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9.-]{2,}$/.test(value);

/* ─────────────────────── Reusable input (outside screen) ─────────────────────── */

type FieldProps = {
  label: string;

  value: string;

  onChangeText: (value: string) => void;

  placeholder?: string;

  hint?: string;

  error?: string;

  icon?: keyof typeof Feather.glyphMap;

  keyboardType?: "default" | "number-pad" | "email-address";

  maxLength?: number;

  autoCapitalize?: "none" | "sentences";
};

function Field({
  label,

  value,

  onChangeText,

  placeholder,

  hint,

  error,

  icon,

  keyboardType = "default",

  maxLength,

  autoCapitalize = "none",
}: FieldProps) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-semibold text-slate-700">
        {label}
      </Text>

      <View
        className={`flex-row items-center rounded-xl border bg-white px-4 ${
          error ? "border-red-400" : "border-slate-200"
        }`}
      >
        {icon ? (
          <Feather
            name={icon}

            size={16}

            color="#94A3B8"

            style={{ marginRight: 10 }}
          />
        ) : null}

        <TextInput
          value={value}

          onChangeText={onChangeText}

          placeholder={placeholder}

          placeholderTextColor="#94A3B8"

          keyboardType={keyboardType}

          maxLength={maxLength}

          autoCapitalize={autoCapitalize}

          autoCorrect={false}

          className="h-14 flex-1 text-slate-900"
        />
      </View>

      {error ? (
        <Text className="mt-1 text-xs text-red-500">{error}</Text>
      ) : hint ? (
        <Text className="mt-1 text-xs text-slate-400">{hint}</Text>
      ) : null}
    </View>
  );
}

/* ───────────────────────────── Screen ───────────────────────────── */

export default function SettingsScreen() {
  const [serviceId, setServiceId] = useState("");

  const [serviceName, setServiceName] = useState("");

  const [selectedMonth, setSelectedMonth] = useState("");

  const [template, setTemplate] = useState<TemplateData>(defaultTemplates);

  const [saved, setSaved] = useState<TemplateData>(defaultTemplates);

  const [activeTab, setActiveTab] = useState<TemplateKey>("welcomeTemplate");

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editorSelection, setEditorSelection] = useState({ start: 0, end: 0 });

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [errors, setErrors] = useState<{ upiId?: string; phone?: string }>({});

  const [toast, setToast] = useState("");

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    setToast(message);

    if (toastTimer.current) clearTimeout(toastTimer.current);

    toastTimer.current = setTimeout(() => setToast(""), 2500);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  /* ── Load ── */

  const loadSettings = async () => {
    try {
      setLoading(true);

      const [storedServiceId, storedServiceName, storedMonth] =
        await Promise.all([
          SecureStore.getItemAsync("autoflow_service_id"),

          SecureStore.getItemAsync("autoflow_service_name"),

          SecureStore.getItemAsync("autoflow_selected_month"),
        ]);

      if (!storedServiceId) {
        Alert.alert("Service not selected", "Please select a service.");

        router.replace("/services");

        return;
      }

      setServiceId(storedServiceId);

      setServiceName(storedServiceName || "My service");

      setSelectedMonth(storedMonth || getCurrentMonth());

      const response = await api.get(`/whatsapp-template/${storedServiceId}`);

      // Support direct response and { success, data } / { data: { template } }.
      const responseBody = response.data?.data ?? response.data ?? {};
      const savedTemplate = responseBody?.template ?? responseBody;

      const loaded: TemplateData = {
        welcomeTemplate:
          savedTemplate.welcomeTemplate || defaultTemplates.welcomeTemplate,
        requestTemplate:
          savedTemplate.requestTemplate || defaultTemplates.requestTemplate,
        reminderTemplate:
          savedTemplate.reminderTemplate || defaultTemplates.reminderTemplate,
        thankyouTemplate:
          savedTemplate.thankyouTemplate || defaultTemplates.thankyouTemplate,
        upiId: savedTemplate.upiId || "",
        phone: savedTemplate.phone || "",
      };

      setTemplate(loaded);

      setSaved(loaded);

      setErrors({});
    } catch (error: any) {
      console.log("Settings loading error:", error.response?.data || error);

      if (error.response?.status === 404) {
        setTemplate(defaultTemplates);

        setSaved(defaultTemplates);
      } else {
        Alert.alert(
          "Couldn’t load settings",

          "Check your internet connection and try again.",
        );
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

  /* ── Editing ── */

  const updateField = (key: keyof TemplateData, value: string) => {
    setTemplate((previous) => ({ ...previous, [key]: value }));

    if (key === "upiId" || key === "phone") {
      setErrors((previous) => ({ ...previous, [key]: undefined }));
    }
  };

  // Insert a placeholder at the current cursor/selection position.
  const insertPlaceholder = (placeholder: string) => {
    const current = template[activeTab];
    const start = Math.max(0, Math.min(editorSelection.start, current.length));
    const end = Math.max(start, Math.min(editorSelection.end, current.length));

    const before = current.slice(0, start);
    const after = current.slice(end);
    const leadingSpace = before.length > 0 && !/\s$/.test(before) ? " " : "";
    const trailingSpace = after.length > 0 && !/^\s/.test(after) ? " " : "";
    const inserted = `${leadingSpace}${placeholder}${trailingSpace}`;
    const nextText = `${before}${inserted}${after}`;
    const cursor = before.length + inserted.length;

    setTemplate((previous) => ({ ...previous, [activeTab]: nextText }));
    setEditorSelection({ start: cursor, end: cursor });
  };

  const resetActiveTemplate = () => {
    Alert.alert(
      "Reset this message?",

      "It will go back to the default wording. Your other messages stay as they are.",

      [
        { text: "Cancel", style: "cancel" },

        {
          text: "Reset",

          style: "destructive",

          onPress: () =>
            setTemplate((previous) => ({
              ...previous,

              [activeTab]: defaultTemplates[activeTab],
            })),
        },
      ],
    );
  };

  const applyPreset = (preset: Preset) => {
    setTemplate((previous) => ({ ...previous, [activeTab]: preset.text }));

    setSheetVisible(false);

    showToast(`${preset.label} template added. Save to keep it.`);
  };

  const isDirty = useMemo(
    () => JSON.stringify(template) !== JSON.stringify(saved),

    [template, saved],
  );

  /* ── Save ── */

  const validate = () => {
    const next: { upiId?: string; phone?: string } = {};

    const upi = template.upiId.trim();

    const phone = template.phone.trim();

    if (upi && !isValidUpi(upi)) {
      next.upiId = "Enter a valid UPI ID, like name@bank.";
    }

    if (phone && !/^[0-9]{10}$/.test(phone)) {
      next.phone = "Phone number must be exactly 10 digits.";
    }

    setErrors(next);

    return Object.keys(next).length === 0;
  };

  const saveSettings = async () => {
    if (!serviceId) return;

    if (!validate()) return;

    const payload: TemplateData = {
      ...template,

      upiId: template.upiId.trim(),

      phone: template.phone.trim(),
    };

    try {
      setSaving(true);

      const saveResponse = await api.post("/whatsapp-template/save", {
        serviceId: serviceId.trim(),
        ...payload,
      });

      if (saveResponse.data?.success === false) {
        throw new Error(saveResponse.data?.message || "Template save failed.");
      }

      // Read back from the server so UI only reports success for persisted values.
      const verifyResponse = await api.get(
        `/whatsapp-template/${serviceId.trim()}`,
      );
      const verifyBody = verifyResponse.data?.data ?? verifyResponse.data ?? {};
      const db = verifyBody?.template ?? verifyBody;
      const keys: (keyof TemplateData)[] = [
        "welcomeTemplate",
        "requestTemplate",
        "reminderTemplate",
        "thankyouTemplate",
        "upiId",
        "phone",
      ];
      const mismatches = keys.filter((key) => (db[key] ?? "") !== payload[key]);
      if (mismatches.length) {
        throw new Error(
          `Saved values could not be verified: ${mismatches.join(", ")}`,
        );
      }

      const confirmed: TemplateData = {
        welcomeTemplate: db.welcomeTemplate,
        requestTemplate: db.requestTemplate,
        reminderTemplate: db.reminderTemplate,
        thankyouTemplate: db.thankyouTemplate,
        upiId: db.upiId ?? "",
        phone: db.phone ?? "",
      };
      setTemplate(confirmed);
      setSaved(confirmed);
      showToast("Templates and payment details saved");
    } catch (error: any) {
      console.log("Save settings error:", error.response?.data || error);

      Alert.alert(
        "Couldn’t save settings",

        error.response?.data?.message || error.message || "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  /* ── Navigation ── */

  const switchService = () => {
    if (isDirty) {
      Alert.alert(
        "Discard unsaved changes?",

        "You have changes that haven’t been saved.",

        [
          { text: "Keep editing", style: "cancel" },

          {
            text: "Discard and switch",

            style: "destructive",

            onPress: () => router.push("/services"),
          },
        ],
      );

      return;
    }

    router.push("/services");
  };

  const logout = () => {
    Alert.alert("Log out?", "You’ll need to sign in again to continue.", [
      { text: "Cancel", style: "cancel" },

      {
        text: "Log out",

        style: "destructive",

        onPress: async () => {
          try {
            await SecureStore.deleteItemAsync("autoflow_token");

            await SecureStore.deleteItemAsync("autoflow_service_id");

            await SecureStore.deleteItemAsync("autoflow_service_name");

            await SecureStore.deleteItemAsync("autoflow_selected_month");

            router.replace("/login");
          } catch {
            Alert.alert("Couldn’t log out", "Please try again.");
          }
        },
      },
    ]);
  };

  /* ───────────────────────── Loading ───────────────────────── */

if (loading) {
  return (
    <AutoFlowFeedback
      mode="loading"
      title="Loading payments"
      message="Fetching your customer payments. Please wait..."
    />
  );
}

  const activeConfig = TEMPLATE_TABS.find((tab) => tab.key === activeTab)!;

  const isDefaultText = template[activeTab] === defaultTemplates[activeTab];

  /* ───────────────────────────── Render ───────────────────────────── */

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"

        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"

          contentContainerStyle={{
            paddingHorizontal: 20,

            paddingTop: 16,

            paddingBottom: 220,
          }}

          keyboardShouldPersistTaps="handled"

          showsVerticalScrollIndicator={false}
        >
          {/* Header */}

          <View>
            <Text className="text-2xl font-extrabold text-slate-900">
              Settings
            </Text>

            <Text className="mt-1 text-sm text-slate-500">
              Your service, payment details and WhatsApp messages
            </Text>
          </View>

          {/* Service card */}

          <View className="mt-5 rounded-3xl border border-slate-100 bg-white p-4">
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-blue-600">
                <Feather name="briefcase" size={22} color="#FFFFFF" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-xs text-slate-500">Current service</Text>

                <Text
                  className="mt-0.5 text-base font-extrabold text-slate-900"

                  numberOfLines={1}
                >
                  {serviceName}
                </Text>
              </View>

              <TouchableOpacity
                onPress={switchService}

                className="flex-row items-center rounded-xl bg-blue-50 px-3 py-2.5"
              >
                <Feather name="repeat" size={14} color="#1D4ED8" />

                <Text className="ml-1.5 text-xs font-bold text-blue-700">
                  Switch
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mt-4 flex-row items-center rounded-xl bg-slate-50 px-3 py-2.5">
              <Feather name="calendar" size={14} color="#64748B" />

              <Text className="ml-2 flex-1 text-xs text-slate-600">
                Viewing {selectedMonth}
              </Text>

              <Text className="text-[11px] text-slate-400">
                Change it on Home
              </Text>
            </View>
          </View>

          {/* Payment details */}

          <View className="mt-4 rounded-3xl border border-slate-100 bg-white p-5">
            <View className="mb-4 flex-row items-center">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-green-50">
                <Feather name="credit-card" size={16} color="#15803D" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-slate-900">
                  Payment details
                </Text>

                <Text className="text-xs text-slate-500">
                  Customers see these in your bills and reminders.
                </Text>
              </View>
            </View>

            <Field
              label="UPI ID"

              value={template.upiId}

              onChangeText={(value) => updateField("upiId", value)}

              placeholder="name@bank"

              icon="at-sign"

              error={errors.upiId}

              hint="Fills in {{upi}} in your messages."
            />

            <Field
              label="GPay / PhonePe number"

              value={template.phone}

              onChangeText={(value) => updateField("phone", value)}

              placeholder="10-digit mobile number"

              icon="smartphone"

              keyboardType="number-pad"

              maxLength={10}

              error={errors.phone}

              hint="Fills in {{phone}} in your messages."
            />
          </View>

          {/* WhatsApp templates */}

          <View className="mt-4 rounded-3xl border border-slate-100 bg-white p-5">
            <View className="mb-4 flex-row items-center">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-green-50">
                <Feather name="message-circle" size={16} color="#15803D" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-slate-900">
                  WhatsApp messages
                </Text>

                <Text className="text-xs text-slate-500">
                  Choose a message to edit.
                </Text>
              </View>
            </View>

            {/* Tabs */}

            <View className="flex-row rounded-xl bg-slate-100 p-1">
              {TEMPLATE_TABS.map((tab) => {
                const selected = tab.key === activeTab;

                const edited = template[tab.key] !== saved[tab.key];

                return (
                  <Pressable
                    key={tab.key}

                    onPress={() => setActiveTab(tab.key)}

                    className={`flex-1 items-center rounded-lg py-2.5 ${
                      selected ? "bg-white" : ""
                    }`}
                  >
                    <Feather
                      name={tab.icon}

                      size={15}

                      color={selected ? "#1D4ED8" : "#64748B"}
                    />

                    <View className="mt-1 flex-row items-center">
                      <Text
                        className={`text-[11px] font-semibold ${
                          selected ? "text-blue-700" : "text-slate-500"
                        }`}
                      >
                        {tab.label}
                      </Text>

                      {edited && (
                        <View className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Editor */}

            <View className="mt-4 flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-sm font-bold text-slate-900">
                  {activeConfig.title}
                </Text>

                <Text className="mt-0.5 text-xs text-slate-500">
                  {activeConfig.hint}
                </Text>
              </View>

              {!isDefaultText && (
                <TouchableOpacity onPress={resetActiveTemplate} hitSlop={8}>
                  <Text className="text-xs font-bold text-blue-600">
                    Reset to default
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => setSheetVisible(true)}

              activeOpacity={0.85}

              className="mt-3 flex-row items-center justify-center rounded-xl border border-blue-200 bg-blue-50 py-3"
            >
              <Feather name="layout" size={15} color="#1D4ED8" />

              <Text className="ml-2 text-sm font-bold text-blue-700">
                Change template
              </Text>
            </TouchableOpacity>

            <TextInput
              value={template[activeTab]}

              onChangeText={(value) => updateField(activeTab, value)}
              selection={editorSelection}
              onSelectionChange={({ nativeEvent }) =>
                setEditorSelection(nativeEvent.selection)
              }
              multiline

              textAlignVertical="top"

              placeholder="Write your message"

              placeholderTextColor="#94A3B8"

              className="mt-3 min-h-32 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-5 text-slate-900"
            />

            {/* Placeholder chips */}

            <Text className="mb-2 mt-4 text-xs font-semibold text-slate-600">
              Tap to add details that fill in automatically
            </Text>

            <View className="flex-row flex-wrap">
              {activeConfig.placeholders.map((placeholder) => (
                <TouchableOpacity
                  key={placeholder}

                  onPress={() => insertPlaceholder(placeholder)}

                  className="mb-2 mr-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5"
                >
                  <Text className="text-xs font-semibold text-blue-700">
                    {placeholder}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-[11px] text-slate-400">
              Place the cursor in your message, then tap a placeholder to insert
              it there.
            </Text>

            {/* Preview */}

            <Text className="mb-2 mt-5 text-xs font-semibold text-slate-600">
              How it looks to a customer
            </Text>

            <View className="rounded-2xl bg-emerald-50 p-3">
              <View className="self-start rounded-2xl rounded-tl-sm bg-white px-3.5 py-3">
                <Text className="text-sm leading-5 text-slate-800">
                  {renderPreview(template[activeTab], template) || "—"}
                </Text>
              </View>

              <Text className="mt-2 text-[11px] text-emerald-800">
                Sample details are shown here.
              </Text>
            </View>
          </View>

          {/* Account */}

          <View className="mt-4 rounded-3xl border border-slate-100 bg-white p-5">
            <Text className="text-base font-bold text-slate-900">Account</Text>

            <Text className="mb-4 mt-1 text-sm text-slate-500">
              Sign out of AutoFlow Manager on this device.
            </Text>

            <TouchableOpacity
              onPress={logout}

              className="flex-row items-center justify-center rounded-xl border border-red-200 bg-red-50 py-3.5"
            >
              <Feather name="log-out" size={16} color="#DC2626" />

              <Text className="ml-2 font-bold text-red-600">Log out</Text>
            </TouchableOpacity>
          </View>

          <Text className="mt-6 text-center text-xs text-slate-400">
            AutoFlow Manager
          </Text>
        </ScrollView>

        {/* Change template sheet */}

        <Modal
          visible={sheetVisible}

          transparent

          animationType="slide"

          onRequestClose={() => setSheetVisible(false)}
        >
          <Pressable
            onPress={() => setSheetVisible(false)}

            className="flex-1 justify-end bg-black/40"
          >
            <Pressable
              onPress={() => {}}

              className="max-h-[85%] rounded-t-3xl bg-slate-50 pt-3"
            >
              <View className="mb-3 h-1 w-10 self-center rounded-full bg-slate-300" />

              <View className="flex-row items-start justify-between px-5 pb-3">
                <View className="flex-1 pr-3">
                  <Text className="text-xl font-extrabold text-slate-900">
                    Change template
                  </Text>

                  <Text className="mt-1 text-xs leading-4 text-slate-500">
                    {activeConfig.title}. Pick a style to replace your current
                    message. You can still edit it afterwards.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setSheetVisible(false)}

                  className="h-9 w-9 items-center justify-center rounded-full bg-slate-200"
                >
                  <Feather name="x" size={16} color="#475569" />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={{
                  paddingHorizontal: 20,

                  paddingBottom: 32,
                }}

                showsVerticalScrollIndicator={false}
              >
                {PRESETS[activeTab].map((preset) => {
                  const inUse = template[activeTab] === preset.text;

                  return (
                    <View
                      key={preset.id}

                      className={`mb-3 rounded-2xl border-2 bg-white p-4 ${
                        inUse ? "border-blue-600" : "border-slate-100"
                      }`}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 pr-2">
                          <Text className="text-base font-bold text-slate-900">
                            {preset.label}
                          </Text>

                          <Text className="mt-0.5 text-xs text-slate-500">
                            {preset.description}
                          </Text>
                        </View>

                        {inUse && (
                          <View className="rounded-full bg-blue-100 px-2.5 py-1">
                            <Text className="text-[11px] font-bold text-blue-700">
                              In use
                            </Text>
                          </View>
                        )}
                      </View>

                      <View className="mt-3 rounded-2xl bg-emerald-50 p-2.5">
                        <View className="self-start rounded-2xl rounded-tl-sm bg-white px-3 py-2.5">
                          <Text className="text-[13px] leading-5 text-slate-800">
                            {renderPreview(preset.text, template)}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={() => applyPreset(preset)}

                        disabled={inUse}

                        activeOpacity={0.85}

                        className={`mt-3 items-center rounded-xl py-3 ${
                          inUse ? "bg-slate-100" : "bg-blue-600"
                        }`}
                      >
                        <Text
                          className={`text-sm font-bold ${
                            inUse ? "text-slate-400" : "text-white"
                          }`}
                        >
                          {inUse ? "Already using this" : "Use this template"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Toast */}

        {toast ? (
          <View
            pointerEvents="none"

            className="absolute bottom-28 left-5 right-5 items-center"
          >
            <View className="flex-row items-center rounded-full bg-slate-900 px-5 py-3">
              <Feather name="check-circle" size={15} color="#4ADE80" />

              <Text className="ml-2 text-sm font-semibold text-white">
                {toast}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Sticky save bar */}

        {/* Keep the save action above the floating tab bar so it is always visible. */}
        <View
          style={{ bottom: 96, elevation: 12, zIndex: 30 }}
          className="absolute left-0 right-0 border-t border-slate-100 bg-white px-5 pb-3 pt-3"
        >
          <View className="mb-2 flex-row items-center justify-center">
            <View
              className={`mr-2 h-2 w-2 rounded-full ${
                isDirty ? "bg-amber-500" : "bg-green-500"
              }`}
            />

            <Text className="text-xs text-slate-500">
              {isDirty ? "You have unsaved changes" : "All changes saved"}
            </Text>
          </View>

          <TouchableOpacity
            onPress={saveSettings}

            disabled={!isDirty || saving}

            activeOpacity={0.85}

            className={`items-center rounded-2xl py-4 ${
              isDirty && !saving
                ? "bg-blue-600"
                : saving
                  ? "bg-blue-300"
                  : "bg-slate-300"
            }`}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-bold text-white">Save changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
