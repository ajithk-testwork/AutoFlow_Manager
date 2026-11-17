import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Feather } from "@expo/vector-icons";
import { api } from "../api/client";

type Service = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
};

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
        "Unnamed Service",
      description:
        item.description ??
        item.details ??
        "Manage your customers and business activities.",
      isActive: item.isActive !== false && item.active !== false,
    }))
    .filter((service: Service) => service.id && service.isActive);
}

export default function ServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchServices = useCallback(async () => {
    try {
      setError("");

      const response = await api.get("/services");
      const serviceList = normalizeServices(response.data);

      setServices(serviceList);

      if (serviceList.length === 0) {
        setSelectedService(null);
      } else {
        const savedServiceId = await SecureStore.getItemAsync(
          "autoflow_service_id",
        );

        const savedServiceExists = serviceList.some(
          (service) => service.id === savedServiceId,
        );

        if (savedServiceExists && savedServiceId) {
          setSelectedService(savedServiceId);
        } else {
          setSelectedService(null);
        }
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
          "Services load panna mudiyala. Internet check pannunga.",
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

  const handleContinue = async () => {
    if (!selectedService) {
      Alert.alert("Select Service", "Please select a service to continue.");
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
      Alert.alert("Error", "Selected service save panna mudiyala.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-4 text-sm font-medium text-slate-500">
          Loading your services...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 60,
          paddingBottom: 130,
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
        <View className="mb-8 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-extrabold text-slate-900">
              AutoFlow
            </Text>
            <Text className="mt-1 text-sm text-slate-500">
              Business Management
            </Text>
          </View>

          <Pressable
            onPress={handleLogout}
            className="h-11 w-11 items-center justify-center rounded-xl bg-white"
          >
            <Feather name="log-out" size={20} color="#64748b" />
          </Pressable>
        </View>

        {/* Heading */}
        <View className="mb-6">
          <Text className="text-3xl font-extrabold text-slate-900">
            Choose Your
          </Text>
          <Text className="text-3xl font-extrabold text-blue-600">Service</Text>
          <Text className="mt-3 text-sm leading-6 text-slate-500">
            Select the service you want to manage. You can switch services
            whenever you need.
          </Text>
        </View>

        {/* Service count */}
        {!error && (
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="font-bold text-slate-800">Available Services</Text>

            <View className="rounded-full bg-blue-50 px-3 py-1">
              <Text className="text-xs font-bold text-blue-600">
                {services.length} Services
              </Text>
            </View>
          </View>
        )}

        {/* Error */}
        {error ? (
          <View className="items-center rounded-2xl bg-white p-6">
            <Feather name="wifi-off" size={35} color="#DC2626" />
            <Text className="mt-4 text-center font-bold text-slate-800">
              Unable to load services
            </Text>
            <Text className="mt-2 text-center text-sm text-slate-500">
              {error}
            </Text>

            <Pressable
              onPress={fetchServices}
              className="mt-5 rounded-xl bg-blue-600 px-6 py-3"
            >
              <Text className="font-bold text-white">Try Again</Text>
            </Pressable>
          </View>
        ) : services.length === 0 ? (
          <View className="items-center rounded-2xl bg-white p-7">
            <Feather name="briefcase" size={38} color="#94A3B8" />
            <Text className="mt-4 text-lg font-bold text-slate-800">
              No Services Found
            </Text>
            <Text className="mt-2 text-center text-sm leading-6 text-slate-500">
              Your account currently has no active services. Please add a
              service from your business account.
            </Text>
            <Pressable
              onPress={fetchServices}
              className="mt-5 rounded-xl bg-blue-600 px-6 py-3"
            >
              <Text className="font-bold text-white">Refresh</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-4">
            {services.map((service) => {
              const isSelected = selectedService === service.id;
              const iconName = getServiceIcon(service.name);

              return (
                <Pressable
                  key={service.id}
                  onPress={() => setSelectedService(service.id)}
                  className={`rounded-2xl border-2 p-5 ${
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
                        size={25}
                        color={isSelected ? "#FFFFFF" : "#475569"}
                      />
                    </View>

                    <View className="ml-4 flex-1">
                      <Text className="text-base font-bold text-slate-900">
                        {service.name}
                      </Text>
                      <Text
                        numberOfLines={2}
                        className="mt-1 text-xs leading-5 text-slate-500"
                      >
                        {service.description}
                      </Text>
                    </View>

                    <View
                      className={`h-6 w-6 items-center justify-center rounded-full border ${
                        isSelected
                          ? "border-blue-600 bg-blue-600"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && (
                        <Feather name="check" size={15} color="#FFFFFF" />
                      )}
                    </View>
                  </View>

                  {isSelected && (
                    <View className="mt-4 flex-row items-center">
                      <Feather name="check-circle" size={14} color="#2563EB" />
                      <Text className="ml-2 text-xs font-bold text-blue-600">
                        Selected Service
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <Text className="mt-7 text-center text-xs text-slate-400">
          AutoFlow Manager · Manage your business smarter
        </Text>
      </ScrollView>

      {/* Bottom Continue Button */}
      {!error && services.length > 0 && (
        <View className="absolute bottom-0 left-0 right-0 border-t border-slate-100 bg-white px-5 pb-8 pt-4">
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
                  Continue to Dashboard
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
