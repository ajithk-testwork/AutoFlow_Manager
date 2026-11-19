import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { router, useFocusEffect } from "expo-router";

import { api } from "../../api/client";

import {
  Customer,
  CustomerInput,
  CustomerStatus,
  fetchCustomers,
  createCustomer,
  updateCustomer,
  removeCustomer,
} from "../../services/customerService";
import AutoFlowFeedback from "@/components/AutoFlowFeedback";

/* ───────────────────────────── Helpers ───────────────────────────── */

const getCurrentMonth = () => {
  const date = new Date();
  return `${date.toLocaleString("en-US", { month: "long" })} ${date.getFullYear()}`;
};

const formatCurrency = (amount: number) =>
  `₹${(Number(amount) || 0).toLocaleString("en-IN")}`;

const initialForm = {
  name: "",
  phone: "",
  doorNumber: "",
  vehicleName: "",
  monthlyAmount: "",
  gender: "male",
};

type FormKey = keyof typeof initialForm;

const FORM_FIELDS: {
  key: FormKey;
  label: string;
  placeholder: string;
  required?: boolean;
  numeric?: boolean;
  maxLength?: number;
  prefix?: string;
}[] = [
  {
    key: "name",
    label: "Customer name",
    placeholder: "e.g. Ravi Kumar",
    required: true,
  },
  {
    key: "phone",
    label: "Phone number",
    placeholder: "10-digit mobile number",
    required: true,
    numeric: true,
    maxLength: 10,
  },
  { key: "doorNumber", label: "Door number", placeholder: "e.g. 12A" },
  {
    key: "vehicleName",
    label: "Vehicle",
    placeholder: "e.g. Swift, TN 09 AB 1234",
  },
  {
    key: "monthlyAmount",
    label: "Monthly amount",
    placeholder: "0",
    required: true,
    numeric: true,
    prefix: "₹",
  },
];

const FILTERS: { key: CustomerStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

const paymentBadge = (status?: string) => {
  if (status === "Paid")
    return { bg: "bg-green-50", text: "text-green-700", label: "Paid" };
  return { bg: "bg-amber-50", text: "text-amber-700", label: "Pending" };
};

/* ───────────────────────────── Screen ───────────────────────────── */

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [isHistorical, setIsHistorical] = useState(false);

  const [status, setStatus] = useState<CustomerStatus>("all");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingWelcomeId, setSendingWelcomeId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(initialForm);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<FormKey, string>>
  >({});

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

  /* ── Load customers for the month chosen on the dashboard ── */
  const loadCustomers = useCallback(async () => {
    try {
      setError("");
      const [savedServiceId, savedMonth] = await Promise.all([
        SecureStore.getItemAsync("autoflow_service_id"),
        SecureStore.getItemAsync("autoflow_selected_month"),
      ]);

      if (!savedServiceId) throw new Error("Please select a service first.");

      const month = savedMonth || getCurrentMonth();
      const historical = month !== getCurrentMonth();
      setServiceId(savedServiceId);
      setSelectedMonth(month);
      setIsHistorical(historical);

      if (historical) {
        const response = await api.get("/payments", {
          params: { serviceId: savedServiceId, month },
        });
        const records = Array.isArray(response.data) ? response.data : [];
        const mapped = records.map((payment: any) => {
          const linked =
            payment.customerId && typeof payment.customerId === "object"
              ? payment.customerId
              : {};
          const customerId =
            typeof payment.customerId === "object"
              ? payment.customerId?._id
              : payment.customerId;

          return {
            _id: String(customerId || payment._id),
            name: payment.customerName || linked.name || "Customer",
            phone: payment.customerPhone || linked.phone || "",
            doorNumber: payment.customerDoorNumber || linked.doorNumber || "",
            vehicleName:
              payment.customerVehicleName || linked.vehicleName || "",
            monthlyAmount: Number(payment.baseAmount ?? payment.amount ?? 0),
            gender: payment.customerGender || linked.gender || "",
            isActive: linked.isActive ?? true,
            serviceId: savedServiceId,
            paymentId: payment._id,
            amount: Number(payment.amount || 0),
            status: payment.status || "Pending",
            missedDays: Number(payment.missedDays || 0),
          };
        });
        setCustomers(mapped as Customer[]);
      } else {
        // Fetch everything once; filtering and counts are done on the device.
        const data = await fetchCustomers(savedServiceId, "all");
        setCustomers(data);
      }
    } catch (err: any) {
      console.log("CUSTOMERS ERROR:", err.response?.data || err.message);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load customers",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload whenever the tab is focused, so a month change on the dashboard shows up here.
  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [loadCustomers]),
  );

  /* ── Counts, filtering, search ── */
  const counts = useMemo(() => {
    const active = customers.filter((c) => c.isActive !== false).length;
    return {
      all: customers.length,
      active,
      inactive: customers.length - active,
    };
  }, [customers]);

  const monthlyTotal = useMemo(
    () =>
      customers.reduce((sum, c) => {
        const value = isHistorical
          ? ((c as any).amount ?? c.monthlyAmount)
          : c.monthlyAmount;
        return sum + (Number(value) || 0);
      }, 0),
    [customers, isHistorical],
  );

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const isActive = customer.isActive !== false;
      if (status === "active" && !isActive) return false;
      if (status === "inactive" && isActive) return false;

      if (!query) return true;

      return (
        customer.name?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query) ||
        customer.vehicleName?.toLowerCase().includes(query) ||
        customer.doorNumber?.toLowerCase().includes(query)
      );
    });
  }, [customers, search, status]);

  /* ── Form ── */
  const updateField = (key: FormKey, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (formErrors[key]) {
      setFormErrors((previous) => ({ ...previous, [key]: undefined }));
    }
  };

  const openAddModal = () => {
    if (isHistorical) return;
    setEditingCustomer(null);
    setForm(initialForm);
    setFormErrors({});
    setModalVisible(true);
  };

  const openEditModal = (customer: Customer) => {
    if (isHistorical) return;
    setEditingCustomer(customer);
    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      doorNumber: customer.doorNumber || "",
      vehicleName: customer.vehicleName || "",
      monthlyAmount: String(customer.monthlyAmount ?? ""),
      gender: customer.gender || "male",
    });
    setFormErrors({});
    setModalVisible(true);
  };

  const validateForm = () => {
    const errors: Partial<Record<FormKey, string>> = {};
    const phone = form.phone.trim();
    const amount = Number(form.monthlyAmount);

    if (!form.name.trim()) errors.name = "Enter the customer’s name.";

    if (!phone) errors.phone = "Enter a phone number.";
    else if (!/^[0-9]{10}$/.test(phone))
      errors.phone = "Phone number must be exactly 10 digits.";

    if (!form.monthlyAmount.trim())
      errors.monthlyAmount = "Enter the monthly amount.";
    else if (!Number.isFinite(amount) || amount <= 0)
      errors.monthlyAmount = "Amount must be greater than 0.";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (isHistorical) return;
    if (!validateForm()) return;

    if (!serviceId) {
      Alert.alert("Service not found", "Select a service in Settings first.");
      return;
    }

    const name = form.name.trim();
    const phone = form.phone.trim();
    const amount = Number(form.monthlyAmount);

    try {
      setSaving(true);

      if (editingCustomer) {
        await updateCustomer(editingCustomer._id, {
          name,
          phone,
          doorNumber: form.doorNumber.trim(),
          vehicleName: form.vehicleName.trim(),
          monthlyAmount: amount,
          gender: form.gender,
          month: getCurrentMonth(),
        });
      } else {
        const payload: CustomerInput = {
          name,
          phone,
          doorNumber: form.doorNumber.trim(),
          vehicleName: form.vehicleName.trim(),
          monthlyAmount: amount,
          gender: form.gender,
          serviceId,
          month: getCurrentMonth(),
        };
        await createCustomer(payload);
      }

      setModalVisible(false);
      setEditingCustomer(null);
      setForm(initialForm);
      showToast(editingCustomer ? "Customer updated" : "Customer added");

      await loadCustomers();
    } catch (err: any) {
      console.log("SAVE CUSTOMER ERROR:", err);
      Alert.alert(
        "Couldn’t save customer",
        err.response?.data?.message || err.message || "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  /* ── Welcome message (new customers only) ── */
  const handleWelcomeMessage = async (customer: Customer) => {
    if (isHistorical) return;
    if (
      customer.welcomeMessageEligible !== true ||
      customer.welcomeMessageSent !== false
    ) {
      return;
    }
    if (sendingWelcomeId) return;

    try {
      setSendingWelcomeId(customer._id);

      const savedServiceId = await SecureStore.getItemAsync(
        "autoflow_service_id",
      );

      if (!savedServiceId) {
        throw new Error("Selected service not found.");
      }

      // Check service ID
      console.log("CUSTOMER SERVICE ID:", customer.serviceId);
      console.log("STORED SERVICE ID:", savedServiceId);

      // Fetch WhatsApp template
      const response = await api.get(`/whatsapp-template/${savedServiceId}`);

      // Check actual backend response
      console.log("TEMPLATE API RESPONSE:", response.data);

      // Support both direct response and nested data response
      const template =
        response.data?.welcomeTemplate ||
        response.data?.data?.welcomeTemplate ||
        "";

      console.log("FINAL WELCOME TEMPLATE:", template);

      if (typeof template !== "string" || !template.trim()) {
        Alert.alert(
          "Welcome template missing",
          "Template not found for this service. Please check Settings.",
        );
        return;
      }

      const message = template.replace(
        /{{name}}/g,
        customer.name || "Customer",
      );

      const phone = customer.phone.replace(/\D/g, "");
      const formattedPhone = phone.length === 10 ? `91${phone}` : phone;

      if (formattedPhone.length < 10) {
        Alert.alert(
          "Invalid phone number",
          "This customer’s phone number is invalid.",
        );
        return;
      }

      const whatsappUrl =
        `https://wa.me/${formattedPhone}?text=` + encodeURIComponent(message);

      await Linking.openURL(whatsappUrl);

      await api.patch(`/${customer._id}/welcome-sent`, {
        serviceId: savedServiceId,
      });

      setCustomers((previous) =>
        previous.map((item) =>
          item._id === customer._id
            ? {
                ...item,
                welcomeMessageSent: true,
                welcomeMessageSentAt: new Date().toISOString(),
              }
            : item,
        ),
      );

      showToast("WhatsApp opened. Press Send there.");
    } catch (err: any) {
      console.log("WELCOME MESSAGE ERROR:", err.response?.data || err);
      Alert.alert(
        "Couldn’t open WhatsApp",
        err.response?.data?.message || err.message || "Please try again.",
      );
      await loadCustomers();
    } finally {
      setSendingWelcomeId(null);
    }
  };

  /* ── Delete ── */
  const handleDelete = (customer: Customer) => {
    if (isHistorical) return;
    Alert.alert(
      `Delete ${customer.name}?`,
      "This removes the customer from your list.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removeCustomer(customer._id);
              showToast("Customer deleted");
              await loadCustomers();
            } catch (err: any) {
              Alert.alert(
                "Couldn’t delete customer",
                err.response?.data?.message ||
                  err.message ||
                  "Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  /* ── Switch back to the current month ── */
  const switchToCurrentMonth = async () => {
    try {
      await SecureStore.setItemAsync(
        "autoflow_selected_month",
        getCurrentMonth(),
      );
    } catch (err) {
      console.log("Unable to save selected month:", err);
    }
    setLoading(true);
    loadCustomers();
  };

  const openCustomer = (item: Customer) =>
    router.push({
      pathname: "/customer/[id]",
      params: {
        id: item._id,
        name: item.name || "",
        phone: item.phone || "",
        vehicleName: item.vehicleName || "",
        doorNumber: item.doorNumber || "",
        monthlyAmount: String(item.monthlyAmount ?? 0),
        gender: item.gender || "",
        isActive: String(item.isActive ?? true),
        isHistorical: String(isHistorical),
        billingAmount: String(
          isHistorical
            ? ((item as any).amount ?? item.monthlyAmount)
            : (item.monthlyAmount ?? 0),
        ),
        selectedMonth,
      },
    });

  /* ───────────────────────── Customer card ───────────────────────── */

  const renderCustomer = ({ item }: { item: Customer }) => {
    const isActive = item.isActive !== false;
    const amount = isHistorical
      ? ((item as any).amount ?? item.monthlyAmount)
      : item.monthlyAmount;
    const badge = paymentBadge((item as any).status);
    const needsWelcome =
      !isHistorical &&
      item.welcomeMessageEligible === true &&
      item.welcomeMessageSent === false;

    return (
      <View className="mb-3 overflow-hidden rounded-3xl border border-slate-100 bg-white">
        <Pressable
          onPress={() => openCustomer(item)}
          android_ripple={{ color: "#E2E8F0" }}
          className="p-4"
        >
          <View className="flex-row items-center">
            <View
              className={`h-12 w-12 items-center justify-center rounded-full ${
                isActive ? "bg-blue-50" : "bg-slate-100"
              }`}
            >
              <Text
                className={`text-lg font-bold ${
                  isActive ? "text-blue-700" : "text-slate-400"
                }`}
              >
                {item.name?.charAt(0)?.toUpperCase() || "C"}
              </Text>
            </View>

            <View className="ml-3 flex-1">
              <Text
                className="text-base font-bold text-slate-900"
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text className="mt-0.5 text-sm text-slate-500">
                {item.phone}
              </Text>
              {item.vehicleName || item.doorNumber ? (
                <Text
                  className="mt-0.5 text-xs text-slate-400"
                  numberOfLines={1}
                >
                  {[
                    item.vehicleName,
                    item.doorNumber ? `Door ${item.doorNumber}` : "",
                  ]
                    .filter(Boolean)
                    .join("  •  ")}
                </Text>
              ) : null}
            </View>

            <View className="items-end">
              <Text className="text-base font-extrabold text-slate-900">
                {formatCurrency(Number(amount) || 0)}
              </Text>
              <Text className="text-[11px] text-slate-400">
                {isHistorical ? "billed" : "per month"}
              </Text>

              {isHistorical ? (
                <View
                  className={`mt-1.5 rounded-full px-2.5 py-0.5 ${badge.bg}`}
                >
                  <Text className={`text-[11px] font-semibold ${badge.text}`}>
                    {badge.label}
                  </Text>
                </View>
              ) : (
                <View
                  className={`mt-1.5 rounded-full px-2.5 py-0.5 ${
                    isActive ? "bg-green-50" : "bg-slate-100"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-semibold ${
                      isActive ? "text-green-700" : "text-slate-500"
                    }`}
                  >
                    {isActive ? "Active" : "Inactive"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>

        {needsWelcome && (
          <Pressable
            disabled={sendingWelcomeId === item._id}
            onPress={() => handleWelcomeMessage(item)}
            className={`mx-4 mb-3 flex-row items-center justify-center rounded-xl py-3 ${
              sendingWelcomeId === item._id ? "bg-green-300" : "bg-green-600"
            }`}
          >
            {sendingWelcomeId === item._id ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-sm font-semibold text-white">
                Send welcome message on WhatsApp
              </Text>
            )}
          </Pressable>
        )}

        {!isHistorical && (
          <View className="flex-row border-t border-slate-100">
            <Pressable
              onPress={() => openCustomer(item)}
              className="flex-1 items-center py-3"
            >
              <Text className="text-xs font-semibold text-slate-600">
                Overview
              </Text>
            </Pressable>
            <View className="w-px bg-slate-100" />
            <Pressable
              onPress={() => openEditModal(item)}
              className="flex-1 items-center py-3"
            >
              <Text className="text-xs font-semibold text-blue-700">Edit</Text>
            </Pressable>
            <View className="w-px bg-slate-100" />
            <Pressable
              onPress={() => handleDelete(item)}
              className="flex-1 items-center py-3"
            >
              <Text className="text-xs font-semibold text-red-600">Delete</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
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

  /* ───────────────────────── Render ───────────────────────── */

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="px-5 pb-2 pt-14">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-2xl font-extrabold text-slate-900">
              Customers
            </Text>
            <View className="mt-1 flex-row items-center">
              <View
                className={`mr-2 rounded-full px-2.5 py-0.5 ${
                  isHistorical ? "bg-amber-100" : "bg-blue-100"
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    isHistorical ? "text-amber-700" : "text-blue-700"
                  }`}
                >
                  {selectedMonth}
                </Text>
              </View>
              <Text className="text-xs text-slate-500">
                {isHistorical ? "Past billing" : "Current month"}
              </Text>
            </View>
          </View>

          {!isHistorical && (
            <Pressable
              onPress={openAddModal}
              className="flex-row items-center rounded-2xl bg-blue-600 px-4 py-3"
            >
              <Text className="mr-1 text-base font-bold text-white">+</Text>
              <Text className="font-semibold text-white">Add customer</Text>
            </Pressable>
          )}
        </View>

        {/* Summary strip */}
        <View className="mt-4 flex-row rounded-2xl bg-white p-4">
          <View className="flex-1">
            <Text className="text-xs text-slate-500">Customers</Text>
            <Text className="mt-1 text-xl font-extrabold text-slate-900">
              {counts.all}
            </Text>
          </View>
          <View className="w-px bg-slate-100" />
          <View className="flex-1 pl-4">
            <Text className="text-xs text-slate-500">Active</Text>
            <Text className="mt-1 text-xl font-extrabold text-green-700">
              {counts.active}
            </Text>
          </View>
          <View className="w-px bg-slate-100" />
          <View className="flex-1 pl-4">
            <Text className="text-xs text-slate-500">
              {isHistorical ? "Billed" : "Monthly total"}
            </Text>
            <Text className="mt-1 text-xl font-extrabold text-slate-900">
              {formatCurrency(monthlyTotal)}
            </Text>
          </View>
        </View>

        {/* Past-month notice */}
        {isHistorical && (
          <View className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <Text className="text-sm font-bold text-amber-800">
              You’re viewing {selectedMonth}
            </Text>
            <Text className="mt-1 text-xs leading-4 text-amber-700">
              Past months are read-only. Switch to {getCurrentMonth()} to add,
              edit or delete customers.
            </Text>
            <Pressable
              onPress={switchToCurrentMonth}
              className="mt-3 self-start rounded-xl bg-amber-600 px-4 py-2.5"
            >
              <Text className="text-xs font-bold text-white">
                Go to {getCurrentMonth()}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Search */}
        <View className="mt-4 flex-row items-center rounded-2xl border border-slate-200 bg-white px-4">
          <Text className="mr-2 text-lg text-slate-400">⌕</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, phone, vehicle or door"
            placeholderTextColor="#94A3B8"
            className="h-12 flex-1 text-sm text-slate-900"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={10}>
              <Text className="text-base text-slate-400">✕</Text>
            </Pressable>
          )}
        </View>

        {/* Filters with counts */}
        <View className="mt-3 flex-row gap-2">
          {FILTERS.map((filter) => {
            const selected = status === filter.key;
            return (
              <Pressable
                key={filter.key}
                onPress={() => setStatus(filter.key)}
                className={`flex-row items-center rounded-full px-4 py-2 ${
                  selected ? "bg-blue-600" : "border border-slate-200 bg-white"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selected ? "text-white" : "text-slate-600"
                  }`}
                >
                  {filter.label}
                </Text>
                <View
                  className={`ml-2 rounded-full px-2 ${
                    selected ? "bg-blue-500" : "bg-slate-100"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      selected ? "text-white" : "text-slate-500"
                    }`}
                  >
                    {counts[filter.key]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <View className="mt-3 rounded-2xl bg-red-50 p-4">
            <Text className="text-sm text-red-600">{error}</Text>
            <Pressable onPress={loadCustomers}>
              <Text className="mt-2 font-bold text-red-700">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        <Text className="mb-1 mt-4 text-xs font-semibold text-slate-500">
          Showing {filteredCustomers.length} of {counts.all}
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item._id}
        renderItem={renderCustomer}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 40,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadCustomers();
            }}
            tintColor="#2563EB"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-6 py-14">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <Text className="text-3xl">👤</Text>
            </View>
            <Text className="mt-4 text-lg font-bold text-slate-800">
              {counts.all === 0
                ? isHistorical
                  ? "No billing records"
                  : "No customers yet"
                : "No matches"}
            </Text>
            <Text className="mt-1 text-center text-sm text-slate-400">
              {counts.all === 0
                ? isHistorical
                  ? `${selectedMonth} hasn’t been activated, so there’s nothing to show.`
                  : "Add your first customer to start billing."
                : "Try a different search or filter."}
            </Text>

            {counts.all === 0 && !isHistorical && (
              <Pressable
                onPress={openAddModal}
                className="mt-5 rounded-xl bg-blue-600 px-6 py-3"
              >
                <Text className="font-semibold text-white">Add customer</Text>
              </Pressable>
            )}
            {counts.all > 0 && (search || status !== "all") && (
              <Pressable
                onPress={() => {
                  setSearch("");
                  setStatus("all");
                }}
                className="mt-5 rounded-xl bg-slate-200 px-6 py-3"
              >
                <Text className="font-semibold text-slate-700">
                  Clear filters
                </Text>
              </Pressable>
            )}
          </View>
        }
      />

      {/* Toast */}
      {toast ? (
        <View
          pointerEvents="none"
          className="absolute bottom-8 left-5 right-5 items-center"
        >
          <View className="rounded-full bg-slate-900 px-5 py-3">
            <Text className="text-sm font-semibold text-white">{toast}</Text>
          </View>
        </View>
      ) : null}

      {/* Add / Edit modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          className="flex-1 bg-slate-50"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View className="flex-1">
            <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-5 pb-4 pt-5">
              <View>
                <Text className="text-xl font-extrabold text-slate-900">
                  {editingCustomer ? "Edit customer" : "Add customer"}
                </Text>
                <Text className="mt-0.5 text-xs text-slate-500">
                  {editingCustomer
                    ? "Changes apply from this month."
                    : `Billing starts in ${getCurrentMonth()}.`}
                </Text>
              </View>

              <Pressable
                onPress={() => setModalVisible(false)}
                className="h-9 w-9 items-center justify-center rounded-full bg-slate-100"
              >
                <Text className="font-bold text-slate-600">✕</Text>
              </Pressable>
            </View>

            <ScrollView
              className="flex-1 px-5"
              contentContainerStyle={{ paddingTop: 20, paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {FORM_FIELDS.map((field) => {
                const err = formErrors[field.key];
                return (
                  <View key={field.key} className="mb-4">
                    <Text className="mb-1.5 text-sm font-semibold text-slate-700">
                      {field.label}
                      {field.required ? (
                        <Text className="text-red-500"> *</Text>
                      ) : (
                        <Text className="font-normal text-slate-400">
                          {" "}
                          (optional)
                        </Text>
                      )}
                    </Text>

                    <View
                      className={`flex-row items-center rounded-xl border bg-white px-4 ${
                        err ? "border-red-400" : "border-slate-200"
                      }`}
                    >
                      {field.prefix ? (
                        <Text className="mr-1 text-base font-semibold text-slate-500">
                          {field.prefix}
                        </Text>
                      ) : null}
                      <TextInput
                        value={form[field.key]}
                        onChangeText={(value) => updateField(field.key, value)}
                        placeholder={field.placeholder}
                        placeholderTextColor="#94A3B8"
                        keyboardType={field.numeric ? "number-pad" : "default"}
                        maxLength={field.maxLength}
                        className="h-14 flex-1 text-slate-900"
                      />
                    </View>

                    {err ? (
                      <Text className="mt-1 text-xs text-red-500">{err}</Text>
                    ) : null}
                  </View>
                );
              })}

              <Text className="mb-1.5 text-sm font-semibold text-slate-700">
                Gender
              </Text>
              <View className="flex-row rounded-xl bg-slate-200 p-1">
                {["male", "female", "other"].map((gender) => {
                  const selected = form.gender === gender;
                  return (
                    <Pressable
                      key={gender}
                      onPress={() => updateField("gender", gender)}
                      className={`flex-1 items-center rounded-lg py-3 ${
                        selected ? "bg-white" : ""
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold capitalize ${
                          selected ? "text-blue-700" : "text-slate-500"
                        }`}
                      >
                        {gender}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View className="border-t border-slate-200 bg-white px-5 pb-8 pt-3">
              <Pressable
                disabled={saving}
                onPress={handleSave}
                className={`items-center rounded-2xl py-4 ${
                  saving ? "bg-blue-300" : "bg-blue-600"
                }`}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="font-bold text-white">
                    {editingCustomer ? "Save changes" : "Add customer"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
