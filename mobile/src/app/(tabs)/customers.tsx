import { useCallback, useEffect, useMemo, useState } from "react";
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
import { router } from "expo-router";

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

const getCurrentMonth = () => {
  const date = new Date();

  return `${date.toLocaleString("en-US", {
    month: "long",
  })} ${date.getFullYear()}`;
};

const initialForm = {
  name: "",
  phone: "",
  doorNumber: "",
  vehicleName: "",
  monthlyAmount: "",
  gender: "male",
};

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [serviceId, setServiceId] = useState("");

  const [status, setStatus] = useState<CustomerStatus>("all");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sendingWelcomeId, setSendingWelcomeId] = useState<string | null>(null);

  const [error, setError] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [form, setForm] = useState(initialForm);

  // Fetch customers for selected service
  const loadCustomers = useCallback(async () => {
    try {
      setError("");

      const savedServiceId = await SecureStore.getItemAsync(
        "autoflow_service_id",
      );

      if (!savedServiceId) {
        throw new Error("Please select a service first.");
      }

      setServiceId(savedServiceId);

      const data = await fetchCustomers(savedServiceId, status);

      setCustomers(data);
    } catch (err: any) {
      console.log("CUSTOMERS ERROR:", err.message);
      setError(err.message || "Unable to load customers");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => {
    setLoading(true);
    loadCustomers();
  }, [loadCustomers]);

  // Search customers
  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return customers;

    return customers.filter((customer) => {
      return (
        customer.name?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query) ||
        customer.vehicleName?.toLowerCase().includes(query) ||
        customer.doorNumber?.toLowerCase().includes(query)
      );
    });
  }, [customers, search]);

  // Form input handler
  const updateField = (key: keyof typeof initialForm, value: string) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  // Open Add Customer
  const openAddModal = () => {
    setEditingCustomer(null);
    setForm(initialForm);
    setModalVisible(true);
  };

  // Open Edit Customer
  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);

    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      doorNumber: customer.doorNumber || "",
      vehicleName: customer.vehicleName || "",
      monthlyAmount: String(customer.monthlyAmount ?? ""),
      gender: customer.gender || "male",
    });

    setModalVisible(true);
  };

  // Save Customer
  const handleSave = async () => {
    const name = form.name.trim();
    const phone = form.phone.trim();
    const amount = Number(form.monthlyAmount);

    if (!name || !phone || !form.monthlyAmount.trim()) {
      Alert.alert(
        "Required fields",
        "Name, phone number and monthly amount are required.",
      );
      return;
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      Alert.alert(
        "Invalid phone number",
        "Enter a valid 10-digit phone number.",
      );
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid monthly amount.");
      return;
    }

    if (!serviceId) {
      Alert.alert("Error", "Selected service not found.");
      return;
    }

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

        Alert.alert("Success", "Customer updated successfully.");
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

        Alert.alert("Success", "Customer added successfully.");
      }

      setModalVisible(false);
      setEditingCustomer(null);
      setForm(initialForm);

      await loadCustomers();
    } catch (err: any) {
      console.log("SAVE CUSTOMER ERROR:", err);

      Alert.alert(
        "Save failed",
        err.response?.data?.message || err.message || "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  // Send Welcome Message to newly added customers only
  const handleWelcomeMessage = async (customer: Customer) => {
    // Existing customers and already initiated customers cannot use this
    if (customer.welcomeMessageSent !== false) {
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

      // Get saved welcome template
      const response = await api.get(`/whatsapp-template/${savedServiceId}`);

      const template = response.data?.welcomeTemplate;

      if (!template?.trim()) {
        Alert.alert(
          "Template Missing",
          "Please create a Welcome Message template in Settings.",
        );
        return;
      }

      // Replace customer name
      const message = template.replace(
        /{{name}}/g,
        customer.name || "Customer",
      );

      // Format Indian phone number
      const phone = customer.phone.replace(/\D/g, "");

      const formattedPhone = phone.length === 10 ? `91${phone}` : phone;

      if (formattedPhone.length < 10) {
        Alert.alert("Invalid Phone", "Customer phone number is invalid.");
        return;
      }

      const whatsappUrl =
        `https://wa.me/${formattedPhone}?text=` + encodeURIComponent(message);

      // Open WhatsApp first
      await Linking.openURL(whatsappUrl);

      // Mark welcome message as initiated in backend
      await api.patch(`/${customer._id}/welcome-sent`, {
        serviceId: savedServiceId,
      });

      // Update local customer state immediately
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

      Alert.alert(
        "WhatsApp Opened",
        "Welcome message opened in WhatsApp. Please press Send there.",
      );
    } catch (err: any) {
      console.log("WELCOME MESSAGE ERROR:", err.response?.data || err);

      Alert.alert(
        "Welcome Message Error",
        err.response?.data?.message ||
          err.message ||
          "Unable to open WhatsApp.",
      );

      // Reload backend status
      await loadCustomers();
    } finally {
      setSendingWelcomeId(null);
    }
  };

  // Delete Customer
  const handleDelete = (customer: Customer) => {
    Alert.alert(
      "Delete Customer",
      `Are you sure you want to delete ${customer.name}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removeCustomer(customer._id);

              Alert.alert("Deleted", "Customer deleted successfully.");

              await loadCustomers();
            } catch (err: any) {
              Alert.alert(
                "Delete failed",
                err.response?.data?.message ||
                  err.message ||
                  "Unable to delete customer.",
              );
            }
          },
        },
      ],
    );
  };

  // Customer Card
  const renderCustomer = ({ item }: { item: Customer }) => (
    <View className="mb-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <Pressable
        onPress={() =>
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
            },
          })
        }
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-base font-bold text-slate-900">
              {item.name}
            </Text>

            <Text className="mt-1 text-sm text-slate-500">{item.phone}</Text>

            {item.vehicleName ? (
              <Text className="mt-1 text-sm text-slate-600">
                {item.vehicleName}
              </Text>
            ) : null}

            {item.doorNumber ? (
              <Text className="mt-1 text-xs text-slate-400">
                Door: {item.doorNumber}
              </Text>
            ) : null}
          </View>

          <View
            className={`rounded-full px-3 py-1 ${
              item.isActive ? "bg-green-50" : "bg-red-50"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                item.isActive ? "text-green-700" : "text-red-600"
              }`}
            >
              {item.isActive ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row items-center justify-between border-t border-slate-100 pt-3">
          <View>
            <Text className="text-xs text-slate-400">Monthly Amount</Text>

            <Text className="mt-1 text-base font-bold text-slate-900">
              ₹{Number(item.monthlyAmount || 0).toLocaleString("en-IN")}
            </Text>
          </View>

          <Text className="text-sm font-semibold text-blue-600">
            View Overview →
          </Text>
        </View>
      </Pressable>

      {/* Welcome Message - only for new unsent customers */}
      {item.welcomeMessageSent === false && (
        <Pressable
          disabled={sendingWelcomeId === item._id}
          onPress={() => handleWelcomeMessage(item)}
          className={`mb-3 mt-3 flex-row items-center justify-center rounded-xl px-4 py-3 ${
            sendingWelcomeId === item._id ? "bg-green-300" : "bg-green-600"
          }`}
        >
          {sendingWelcomeId === item._id ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="font-semibold text-white">
              Send Welcome Message
            </Text>
          )}
        </Pressable>
      )}

      {/* Edit and Delete */}
      <View className="mt-3 flex-row justify-end gap-2">
        <Pressable
          onPress={() => openEditModal(item)}
          className="rounded-lg bg-blue-50 px-4 py-2"
        >
          <Text className="text-xs font-semibold text-blue-700">Edit</Text>
        </Pressable>

        <Pressable
          onPress={() => handleDelete(item)}
          className="rounded-lg bg-red-50 px-4 py-2"
        >
          <Text className="text-xs font-semibold text-red-600">Delete</Text>
        </Pressable>
      </View>
    </View>
  );

  // Loading Screen
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#2563EB" />

        <Text className="mt-3 text-sm text-slate-500">
          Loading customers...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="px-5 pb-3 pt-14">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-slate-900">Customers</Text>

            <Text className="mt-1 text-sm text-slate-500">
              Manage your customers
            </Text>
          </View>

          <Pressable
            onPress={openAddModal}
            className="rounded-xl bg-blue-600 px-4 py-3"
          >
            <Text className="font-semibold text-white">+ Add</Text>
          </Pressable>
        </View>

        {/* Search */}
        <View className="mt-5 flex-row items-center rounded-xl border border-slate-200 bg-white px-4">
          <Text className="mr-2 text-lg text-slate-400">⌕</Text>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, phone or vehicle"
            placeholderTextColor="#94A3B8"
            className="h-12 flex-1 text-sm text-slate-900"
          />
        </View>

        {/* Filters */}
        <View className="mt-4 flex-row gap-2">
          {(["all", "active", "inactive"] as CustomerStatus[]).map((filter) => (
            <Pressable
              key={filter}
              onPress={() => setStatus(filter)}
              className={`rounded-full px-5 py-2 ${
                status === filter ? "bg-blue-600" : "bg-white"
              }`}
            >
              <Text
                className={`text-sm font-semibold capitalize ${
                  status === filter ? "text-white" : "text-slate-600"
                }`}
              >
                {filter}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="mb-2 mt-4 text-sm font-semibold text-slate-600">
          {filteredCustomers.length} customers found
        </Text>

        {error ? (
          <View className="mb-3 rounded-xl bg-red-50 p-3">
            <Text className="text-sm text-red-600">{error}</Text>

            <Pressable onPress={loadCustomers}>
              <Text className="mt-2 font-bold text-red-700">Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Customer List */}
      <FlatList
        data={filteredCustomers}
        keyExtractor={(item) => item._id}
        renderItem={renderCustomer}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 30,
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
          <View className="flex-1 items-center justify-center py-16">
            <Text className="text-lg font-bold text-slate-700">
              No customers found
            </Text>

            <Text className="mt-2 text-center text-sm text-slate-400">
              Try another filter or add a new customer.
            </Text>
          </View>
        }
      />

      {/* Add / Edit Modal */}
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
          <View className="flex-1 px-5 pt-5">
            <View className="mb-5 flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-bold text-slate-900">
                  {editingCustomer ? "Edit Customer" : "Add Customer"}
                </Text>

                <Text className="mt-1 text-sm text-slate-500">
                  Enter customer details
                </Text>
              </View>

              <Pressable
                onPress={() => setModalVisible(false)}
                className="rounded-full bg-slate-200 px-3 py-2"
              >
                <Text className="font-bold text-slate-700">✕</Text>
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {[
                {
                  key: "name",
                  label: "Customer Name",
                  required: true,
                },
                {
                  key: "phone",
                  label: "Phone Number",
                  required: true,
                },
                {
                  key: "doorNumber",
                  label: "Door Number",
                },
                {
                  key: "vehicleName",
                  label: "Vehicle Name",
                },
                {
                  key: "monthlyAmount",
                  label: "Monthly Amount (₹)",
                  required: true,
                },
              ].map((field) => (
                <View key={field.key} className="mb-4">
                  <Text className="mb-2 text-sm font-semibold text-slate-700">
                    {field.label}
                    {field.required ? " *" : ""}
                  </Text>

                  <TextInput
                    value={form[field.key as keyof typeof initialForm]}
                    onChangeText={(value) =>
                      updateField(field.key as keyof typeof initialForm, value)
                    }
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    placeholderTextColor="#94A3B8"
                    keyboardType={
                      field.key === "phone" || field.key === "monthlyAmount"
                        ? "numeric"
                        : "default"
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-slate-900"
                  />
                </View>
              ))}

              <Text className="mb-2 text-sm font-semibold text-slate-700">
                Gender
              </Text>

              <View className="mb-6 flex-row gap-3">
                {["male", "female", "other"].map((gender) => (
                  <Pressable
                    key={gender}
                    onPress={() => updateField("gender", gender)}
                    className={`rounded-xl px-5 py-3 ${
                      form.gender === gender
                        ? "bg-blue-600"
                        : "border border-slate-200 bg-white"
                    }`}
                  >
                    <Text
                      className={`font-semibold capitalize ${
                        form.gender === gender ? "text-white" : "text-slate-600"
                      }`}
                    >
                      {gender}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                disabled={saving}
                onPress={handleSave}
                className={`mb-10 items-center rounded-xl py-4 ${
                  saving ? "bg-blue-300" : "bg-blue-600"
                }`}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="font-bold text-white">
                    {editingCustomer ? "Update Customer" : "Save Customer"}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
