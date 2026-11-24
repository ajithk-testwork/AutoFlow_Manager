import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { api } from "../api/client";
import AutoFlowFeedback from "@/components/AutoFlowFeedback";

/* ───────────────────────────── Types ───────────────────────────── */

type Service = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  isActive: boolean;
};

/* ───────────────────────────── Helpers ───────────────────────────── */

const SERVICE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  car: "truck",
  carwash: "truck",
  bike: "activity",
  bikewash: "activity",
  wash: "droplet",
  cleaning: "wind",
  default: "briefcase",
};

function getServiceIcon(name: string): keyof typeof Feather.glyphMap {
  const value = name.toLowerCase().replace(/[\s_-]/g, "");

  if (value.includes("car")) return SERVICE_ICONS.car;
  if (value.includes("bike")) return SERVICE_ICONS.bike;
  if (value.includes("wash")) return SERVICE_ICONS.wash;
  if (value.includes("clean")) return SERVICE_ICONS.cleaning;

  return SERVICE_ICONS.default;
}

function normalizeServices(response: any): Service[] {
  const list = Array.isArray(response)
    ? response
    : Array.isArray(response?.services)
      ? response.services
      : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.services)
          ? response.data.services
          : [];

  return list
    .map((item: any) => ({
      id: String(item._id ?? item.id ?? item.documentId ?? ""),
      name:
        item.serviceName ??
        item.name ??
        item.title ??
        item.service ??
        "Unnamed service",
      description:
        item.description ??
        item.details ??
        "Manage your customers and monthly billing.",
      monthlyPrice: Number(item.monthlyPrice ?? item.price ?? 0) || 0,
      isActive: item.isActive !== false && item.active !== false,
    }))
    .filter((service: Service) => service.id && service.isActive);
}

/* ─────────────────────── Line-art illustration ─────────────────────── */

const BLUE = "#2563EB";
const BLUE_SOFT = "#DBEAFE";
const SLATE = "#64748B";

function CarWashIllustration() {
  const stroke = {
    stroke: BLUE,
    strokeWidth: 2.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Svg width="100%" height={150} viewBox="0 0 312 150">
      {/* soft backdrop */}
      <Circle cx={156} cy={86} r={64} fill={BLUE_SOFT} />

      {/* ground */}
      <Line
        x1={14}
        y1={134}
        x2={298}
        y2={134}
        stroke={SLATE}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="2 8"
      />

      {/* car body */}
      <Path
        {...stroke}
        fill="#FFFFFF"
        d="M36 112 L36 98 Q36 90 46 88 L84 80 L106 58 Q109 55 114 55 L196 55 Q201 55 204 58 L228 80 L262 88 Q276 90 276 100 L276 112 L268 112 A24 24 0 0 0 220 112 L96 112 A24 24 0 0 0 48 112 Z"
      />

      {/* windows + door line */}
      <Path {...stroke} d="M93 80 L110 62 L150 62 L150 80 Z" />
      <Path {...stroke} d="M158 62 L196 62 L213 80 L158 80 Z" />
      <Path {...stroke} d="M154 62 L154 108" />
      <Path {...stroke} d="M130 92 L142 92" />

      {/* headlight */}
      <Path {...stroke} d="M262 96 L270 96" />

      {/* wheels */}
      <Circle cx={72} cy={112} r={17} {...stroke} fill="#FFFFFF" />
      <Circle cx={72} cy={112} r={6} {...stroke} />
      <Circle cx={244} cy={112} r={17} {...stroke} fill="#FFFFFF" />
      <Circle cx={244} cy={112} r={6} {...stroke} />

      {/* water drops */}
      <Path {...stroke} d="M120 20 Q127 30 120 35 Q113 30 120 20 Z" />
      <Path {...stroke} d="M158 12 Q165 22 158 27 Q151 22 158 12 Z" />
      <Path {...stroke} d="M196 22 Q203 32 196 37 Q189 32 196 22 Z" />

      {/* bubbles */}
      <Circle cx={92} cy={38} r={6} {...stroke} strokeWidth={2} />
      <Circle cx={80} cy={52} r={3.5} {...stroke} strokeWidth={2} />
      <Circle cx={232} cy={44} r={5} {...stroke} strokeWidth={2} />

      {/* sparkles */}
      <Path
        stroke={SLATE}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        d="M270 22 L272 29 L279 31 L272 33 L270 40 L268 33 L261 31 L268 29 Z"
      />
      <Path
        stroke={SLATE}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        d="M40 66 L41.5 71 L46.5 72.5 L41.5 74 L40 79 L38.5 74 L33.5 72.5 L38.5 71 Z"
      />
    </Svg>
  );
}

/* ───────────────────────────── Screen ───────────────────────────── */

export default function ServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [lastUsedId, setLastUsedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceNameInput, setServiceNameInput] = useState("");
  const [monthlyPriceInput, setMonthlyPriceInput] = useState("0");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [serviceFormError, setServiceFormError] = useState("");
  const [serviceSaving, setServiceSaving] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    try {
      setError("");

      const response = await api.get("/services");
      const serviceList = normalizeServices(response.data);

      setServices(serviceList);

      if (serviceList.length === 0) {
        setSelectedService(null);
        setLastUsedId(null);
        return;
      }

      const savedServiceId = await SecureStore.getItemAsync(
        "autoflow_service_id",
      );

      const savedServiceExists = serviceList.some(
        (service) => service.id === savedServiceId,
      );

      if (savedServiceExists && savedServiceId) {
        setSelectedService(savedServiceId);
        setLastUsedId(savedServiceId);
      } else {
        setLastUsedId(null);
        // With only one service there is nothing to choose, so preselect it.
        setSelectedService(serviceList.length === 1 ? serviceList[0].id : null);
      }
    } catch (err: any) {
      console.log("Fetch services error:", err?.response?.data || err.message);

      if (err?.response?.status === 401 || err?.response?.status === 403) {
        await SecureStore.deleteItemAsync("autoflow_token");
        router.replace("/login");
        return;
      }

      setError(
        err?.response?.data?.message ||
          "We couldn’t load your services. Check your internet connection and try again.",
      );
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      await fetchServices();

      if (mounted) {
        setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [fetchServices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchServices();
    setRefreshing(false);
  };

  const openCreateService = () => {
    setEditingService(null);
    setServiceNameInput("");
    setMonthlyPriceInput("0");
    setDescriptionInput("");
    setServiceFormError("");
    setServiceModalVisible(true);
  };

  const openEditService = (service: Service) => {
    setEditingService(service);
    setServiceNameInput(service.name);
    setMonthlyPriceInput(String(service.monthlyPrice ?? 0));
    setDescriptionInput(service.description || "");
    setServiceFormError("");
    setServiceModalVisible(true);
  };

  const handleSaveService = async () => {
    const cleanName = serviceNameInput.trim();
    const cleanDescription = descriptionInput.trim();
    const priceText = monthlyPriceInput.trim();
    const price = Number(priceText);

    if (!cleanName) {
      setServiceFormError("Service name is required.");
      return;
    }

    if (!priceText || !Number.isFinite(price) || price < 0) {
      setServiceFormError("Enter a valid monthly price (0 or above).");
      return;
    }

    try {
      setServiceSaving(true);
      setServiceFormError("");

      const payload = {
        serviceName: cleanName,
        monthlyPrice: price,
        description: cleanDescription,
      };

      if (editingService) {
        await api.put(`/services/${editingService.id}`, payload);
      } else {
        await api.post("/services", payload);
      }

      setServiceModalVisible(false);
      await fetchServices();

      if (editingService && selectedService === editingService.id) {
        await SecureStore.setItemAsync("autoflow_service_name", cleanName);
      }

      Alert.alert(
        "Success",
        editingService ? "Service updated successfully." : "Service created successfully.",
      );
    } catch (err: any) {
      console.log("Save service error:", err?.response?.data || err?.message);
      setServiceFormError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to save service. Please try again.",
      );
    } finally {
      setServiceSaving(false);
    }
  };

  const confirmDeleteService = (service: Service) => {
    Alert.alert(
      "Delete service?",
      `“${service.name}” will be removed from the active service list. Existing customer and payment history will not be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingServiceId(service.id);
              await api.delete(`/services/${service.id}`);

              if (selectedService === service.id) {
                setSelectedService(null);
              }
              if (lastUsedId === service.id) {
                setLastUsedId(null);
              }

              const savedId = await SecureStore.getItemAsync("autoflow_service_id");
              if (savedId === service.id) {
                await SecureStore.deleteItemAsync("autoflow_service_id");
                await SecureStore.deleteItemAsync("autoflow_service_name");
              }

              await fetchServices();
              Alert.alert("Deleted", "Service was removed from active services.");
            } catch (err: any) {
              console.log("Delete service error:", err?.response?.data || err?.message);
              Alert.alert(
                "Delete failed",
                err?.response?.data?.message || "Unable to delete service. Please try again.",
              );
            } finally {
              setDeletingServiceId(null);
            }
          },
        },
      ],
    );
  };

  const handleContinue = async () => {
    if (!selectedService) {
      Alert.alert("Choose a service", "Select a service to continue.");
      return;
    }

    const selected = services.find((service) => service.id === selectedService);

    if (!selected) return;

    try {
      setSaving(true);

      await SecureStore.setItemAsync("autoflow_service_id", selected.id);
      await SecureStore.setItemAsync("autoflow_service_name", selected.name);

      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert(
        "Couldn’t save your choice",
        "Your selected service wasn’t saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Log out?", "You’ll need to sign in again to continue.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await SecureStore.deleteItemAsync("autoflow_token");
          await SecureStore.deleteItemAsync("autoflow_service_id");
          await SecureStore.deleteItemAsync("autoflow_service_name");
          router.replace("/login");
        },
      },
    ]);
  };

  const selectedName = services.find((s) => s.id === selectedService)?.name;

  /* ───────────────────────── Loading ───────────────────────── */

if (loading) {
  return (
    <AutoFlowFeedback
      mode="loading"
      title="Loading dashboard"
      message="Preparing your dashboard. Please wait..."
    />
  );
}

  /* ───────────────────────────── Render ───────────────────────────── */

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 56,
          paddingBottom: 150,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2563EB"
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-blue-600">
              <Feather name="droplet" size={22} color="#FFFFFF" />
            </View>
            <View className="ml-3">
              <Text className="text-xl font-extrabold text-slate-900">
                AutoFlow
              </Text>
              <Text className="text-xs text-slate-500">
                Business management
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleLogout}
            hitSlop={8}
            accessibilityLabel="Log out"
            className="h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white"
          >
            <Feather name="log-out" size={18} color="#64748B" />
          </Pressable>
        </View>

        {/* Illustration */}
        <View className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white px-3 pt-3">
          <CarWashIllustration />
        </View>

        {/* Heading */}
        <View className="mt-6">
          <Text className="text-3xl font-extrabold text-slate-900">
            Choose your service
          </Text>
          <Text className="mt-2 text-sm leading-6 text-slate-500">
            Pick the service you want to manage. You can switch to a different
            one at any time.
          </Text>
        </View>

        {/* Count */}
        {!error && services.length > 0 && (
          <View className="mb-3 mt-6 flex-row items-center justify-between">
            <View>
              <Text className="font-bold text-slate-800">Your services</Text>
              <Text className="mt-1 text-xs text-slate-400">
                {services.length} {services.length === 1 ? "service" : "services"}
              </Text>
            </View>
            <Pressable
              onPress={openCreateService}
              className="flex-row items-center rounded-xl bg-blue-600 px-4 py-2.5"
            >
              <Feather name="plus" size={16} color="#FFFFFF" />
              <Text className="ml-2 text-sm font-bold text-white">Add service</Text>
            </Pressable>
          </View>
        )}

        {/* States */}
        {error ? (
          <View className="mt-6 items-center rounded-3xl bg-white p-6">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <Feather name="wifi-off" size={28} color="#DC2626" />
            </View>
            <Text className="mt-4 text-center text-base font-bold text-slate-800">
              Couldn’t load services
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-slate-500">
              {error}
            </Text>

            <Pressable
              onPress={() => {
                setLoading(true);
                fetchServices().finally(() => setLoading(false));
              }}
              className="mt-5 flex-row items-center rounded-xl bg-blue-600 px-6 py-3"
            >
              <Feather name="refresh-cw" size={15} color="#FFFFFF" />
              <Text className="ml-2 font-bold text-white">Try again</Text>
            </Pressable>
          </View>
        ) : services.length === 0 ? (
          <View className="mt-6 items-center rounded-3xl bg-white p-7">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Feather name="briefcase" size={28} color="#94A3B8" />
            </View>
            <Text className="mt-4 text-lg font-bold text-slate-800">
              No services yet
            </Text>
            <Text className="mt-2 text-center text-sm leading-6 text-slate-500">
              You don’t have any active services yet. Create your first service to start managing customers and billing.
            </Text>
            <Pressable
              onPress={openCreateService}
              className="mt-5 flex-row items-center rounded-xl bg-blue-600 px-6 py-3"
            >
              <Feather name="plus" size={15} color="#FFFFFF" />
              <Text className="ml-2 font-bold text-white">Create service</Text>
            </Pressable>
            <Pressable onPress={handleRefresh} className="mt-3 py-2">
              <Text className="text-xs font-semibold text-slate-500">Refresh services</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-3">
            {services.map((service) => {
              const isSelected = selectedService === service.id;
              const isLastUsed = lastUsedId === service.id;
              const iconName = getServiceIcon(service.name);

              return (
                <View key={service.id} className="mb-1">
                <Pressable
                  onPress={() => setSelectedService(service.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  className={`rounded-3xl border-2 p-4 ${
                    isSelected
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-100 bg-white"
                  }`}
                >
                  <View className="flex-row items-center">
                    <View
                      className={`h-14 w-14 items-center justify-center rounded-2xl ${
                        isSelected ? "bg-blue-600" : "bg-slate-100"
                      }`}
                    >
                      <Feather
                        name={iconName}
                        size={24}
                        color={isSelected ? "#FFFFFF" : "#475569"}
                      />
                    </View>

                    <View className="ml-4 flex-1">
                      <View className="flex-row flex-wrap items-center">
                        <Text
                          className="mr-2 text-base font-bold text-slate-900"
                          numberOfLines={1}
                        >
                          {service.name}
                        </Text>
                        {isLastUsed && (
                          <View className="rounded-full bg-green-100 px-2 py-0.5">
                            <Text className="text-[10px] font-bold text-green-700">
                              Last used
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        numberOfLines={2}
                        className="mt-1 text-xs leading-5 text-slate-500"
                      >
                        {service.description}
                      </Text>
                      <Text className="mt-1 text-xs font-bold text-blue-700">
                        Monthly price: ₹{service.monthlyPrice.toLocaleString("en-IN")}
                      </Text>
                    </View>

                    <View
                      className={`ml-2 h-6 w-6 items-center justify-center rounded-full border-2 ${
                        isSelected
                          ? "border-blue-600 bg-blue-600"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && (
                        <Feather name="check" size={13} color="#FFFFFF" />
                      )}
                    </View>
                  </View>
                </Pressable>
                <View className="mt-2 flex-row justify-end gap-2">
                  <Pressable
                    onPress={() => openEditService(service)}
                    disabled={deletingServiceId === service.id}
                    className="flex-row items-center rounded-xl border border-blue-100 bg-white px-4 py-2"
                  >
                    <Feather name="edit-2" size={14} color="#2563EB" />
                    <Text className="ml-2 text-xs font-bold text-blue-700">Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDeleteService(service)}
                    disabled={deletingServiceId === service.id}
                    className="flex-row items-center rounded-xl border border-red-100 bg-white px-4 py-2"
                  >
                    {deletingServiceId === service.id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <Feather name="trash-2" size={14} color="#DC2626" />
                    )}
                    <Text className="ml-2 text-xs font-bold text-red-600">Delete</Text>
                  </Pressable>
                </View>
                </View>
              );
            })}
          </View>
        )}

        {/* What happens next */}
        {!error && services.length > 0 && (
          <View className="mt-6 flex-row items-start rounded-2xl bg-white p-4">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-amber-50">
              <Feather name="calendar" size={17} color="#B45309" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-bold text-slate-800">
                Next: start a billing month
              </Text>
              <Text className="mt-1 text-xs leading-5 text-slate-500">
                On the dashboard, activate the month to create payment records
                for your customers.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Create / Edit service modal */}
      <Modal
        visible={serviceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !serviceSaving && setServiceModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end bg-black/40"
        >
          <Pressable
            className="flex-1"
            onPress={() => !serviceSaving && setServiceModalVisible(false)}
          />
          <View className="rounded-t-3xl bg-white px-5 pb-8 pt-5">
            <View className="mb-5 flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-extrabold text-slate-900">
                  {editingService ? "Edit service" : "Create service"}
                </Text>
                <Text className="mt-1 text-xs text-slate-500">
                  Manage service name, monthly price and description.
                </Text>
              </View>
              <Pressable
                onPress={() => !serviceSaving && setServiceModalVisible(false)}
                className="h-9 w-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Feather name="x" size={18} color="#475569" />
              </Pressable>
            </View>

            <Text className="mb-2 text-sm font-semibold text-slate-700">Service name *</Text>
            <TextInput
              value={serviceNameInput}
              onChangeText={setServiceNameInput}
              placeholder="e.g. Car Cleaning"
              editable={!serviceSaving}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900"
              placeholderTextColor="#94A3B8"
              maxLength={80}
            />

            <Text className="mb-2 mt-4 text-sm font-semibold text-slate-700">Monthly price (₹) *</Text>
            <TextInput
              value={monthlyPriceInput}
              onChangeText={setMonthlyPriceInput}
              placeholder="0"
              editable={!serviceSaving}
              keyboardType="decimal-pad"
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900"
              placeholderTextColor="#94A3B8"
            />

            <Text className="mb-2 mt-4 text-sm font-semibold text-slate-700">Description</Text>
            <TextInput
              value={descriptionInput}
              onChangeText={setDescriptionInput}
              placeholder="Describe this service"
              editable={!serviceSaving}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="min-h-[88px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900"
              placeholderTextColor="#94A3B8"
              maxLength={500}
            />

            {serviceFormError ? (
              <View className="mt-3 rounded-xl bg-red-50 px-3 py-2.5">
                <Text className="text-xs font-semibold text-red-600">{serviceFormError}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleSaveService}
              disabled={serviceSaving}
              className={`mt-5 items-center rounded-2xl py-4 ${serviceSaving ? "bg-blue-400" : "bg-blue-600"}`}
            >
              {serviceSaving ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="#FFFFFF" />
                  <Text className="ml-2 font-bold text-white">Saving...</Text>
                </View>
              ) : (
                <Text className="text-base font-bold text-white">
                  {editingService ? "Save changes" : "Create service"}
                </Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom continue bar */}
      {!error && services.length > 0 && (
        <View className="absolute bottom-0 left-0 right-0 border-t border-slate-100 bg-white px-5 pb-8 pt-3">
          <Text
            className="mb-2 text-center text-xs text-slate-500"
            numberOfLines={1}
          >
            {selectedName
              ? `Selected: ${selectedName}`
              : "No service selected yet"}
          </Text>

          <Pressable
            onPress={handleContinue}
            disabled={!selectedService || saving}
            className={`flex-row items-center justify-center rounded-2xl py-4 ${
              selectedService ? "bg-blue-600" : "bg-slate-300"
            }`}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text className="mr-2 text-base font-bold text-white">
                  Continue to dashboard
                </Text>
                <Feather name="arrow-right" size={19} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}