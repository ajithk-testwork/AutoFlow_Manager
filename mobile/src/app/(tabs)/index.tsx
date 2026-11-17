import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { api } from "../../api/client";

type Customer = {
  _id: string;
  name: string;
  phone: string;
  vehicleName?: string;
  doorNumber?: string;
  monthlyAmount: number;
  gender?: string;
  isActive?: boolean;
  serviceId: string;
  createdAt?: string;
};

type Payment = {
  _id: string;
  customerId: Customer | string;
  status: string;
  amount: number;
  paidDate?: string;
  dailyStatus?: { date: string; status: string }[];
  missedDays?: number;
};

type DashboardCustomer = Customer & {
  paymentId: string | null;
  status: string;
  amount: number;
  paidDate?: string | null;
  dailyStatus: { date: string; status: string }[];
  missedDays: number;
};

const formatCurrency = (amount: number) =>
  `₹${(Number(amount) || 0).toLocaleString("en-IN")}`;

const getMonthKey = (date: Date) =>
  `${date.toLocaleString("en-US", { month: "long" })} ${date.getFullYear()}`;

const getAvailableMonths = () => {
  const months: string[] = [];
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 3);

  for (let i = 0; i < 10; i++) {
    months.push(getMonthKey(date));
    date.setMonth(date.getMonth() + 1);
  }

  return months;
};

export default function DashboardScreen() {
  const [serviceId, setServiceId] = useState("");
  const [serviceName, setServiceName] = useState("AutoFlow");
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));

  const [dashboardData, setDashboardData] = useState<DashboardCustomer[]>([]);
  const [initializedMonths, setInitializedMonths] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthReady, setMonthReady] = useState(false);
  const [error, setError] = useState("");
  const [monthModalVisible, setMonthModalVisible] = useState(false);
  const [activating, setActivating] = useState(false);

  const availableMonths = useMemo(() => getAvailableMonths(), []);

  // Restore selected service and previously selected month.
  useEffect(() => {
    const initialize = async () => {
      try {
        const [savedServiceId, savedServiceName, savedMonth] =
          await Promise.all([
            SecureStore.getItemAsync("autoflow_service_id"),
            SecureStore.getItemAsync("autoflow_service_name"),
            SecureStore.getItemAsync("autoflow_selected_month"),
          ]);

        if (!savedServiceId) {
          throw new Error("Please select a service first.");
        }

        setServiceId(savedServiceId);

        if (savedServiceName) {
          setServiceName(savedServiceName);
        }

        if (savedMonth) {
          setSelectedMonth(savedMonth);
        }
      } catch (err: any) {
        setError(err.message || "Unable to initialize dashboard");
        setLoading(false);
      } finally {
        setMonthReady(true);
      }
    };

    initialize();
  }, []);

  // Fetch months already activated in the backend.
  const fetchInitializedMonths = useCallback(async () => {
    if (!serviceId) return [];

    const response = await api.get("/global/history", {
      params: { serviceId },
    });

    const months = Array.isArray(response.data)
      ? response.data.map((item: any) => item.month)
      : [];

    setInitializedMonths(months);
    return months;
  }, [serviceId]);

  // Website-compatible monthly customer and payment calculation.
  const loadDashboard = useCallback(async () => {
    if (!serviceId || !selectedMonth) return;

    try {
      setError("");

      const [customersResponse, paymentsResponse] = await Promise.all([
        api.get("/getcustomer", {
          params: { serviceId },
        }),
        api.get("/payments", {
          params: { month: selectedMonth, serviceId },
        }),
      ]);

      const customers: Customer[] = Array.isArray(customersResponse.data)
        ? customersResponse.data
        : [];

      const payments: Payment[] = Array.isArray(paymentsResponse.data)
        ? paymentsResponse.data
        : [];

      const paymentMap = new Map<string, Payment>();

      payments.forEach((payment) => {
        const customerId =
          typeof payment.customerId === "object"
            ? payment.customerId?._id
            : payment.customerId;

        if (customerId) {
          paymentMap.set(customerId, payment);
        }
      });

      const isMonthStarted = payments.length > 0;

      const mergedData: DashboardCustomer[] = customers
        .map((customer) => {
          const payment = paymentMap.get(customer._id);

          if (payment) {
            return {
              ...customer,
              paymentId: payment._id,
              status: payment.status,
              paidDate: payment.paidDate || null,
              dailyStatus: payment.dailyStatus || [],
              missedDays: payment.missedDays || 0,
              amount: Number(payment.amount) || 0,
            };
          }

          return {
            ...customer,
            paymentId: null,
            status: "No Record",
            paidDate: null,
            dailyStatus: [],
            missedDays: 0,
            amount: Number(customer.monthlyAmount) || 0,
          };
        })
        .filter((customer) => {
          if (isMonthStarted) {
            return customer.paymentId !== null;
          }
          return true;
        });

      setDashboardData(mergedData);
    } catch (err: any) {
      console.log("Dashboard fetch error:", err.response?.data || err.message);

      setError(
        err.response?.data?.message || "Unable to load monthly dashboard data.",
      );
    }
  }, [serviceId, selectedMonth]);

  // Load dashboard whenever the selected month changes.
  useEffect(() => {
    if (!monthReady || !serviceId) return;

    const load = async () => {
      setLoading(true);

      try {
        await Promise.all([fetchInitializedMonths(), loadDashboard()]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    load();
  }, [
    monthReady,
    serviceId,
    selectedMonth,
    fetchInitializedMonths,
    loadDashboard,
  ]);

  const handleMonthSelect = async (month: string) => {
    setSelectedMonth(month);
    setMonthModalVisible(false);

    try {
      await SecureStore.setItemAsync("autoflow_selected_month", month);
    } catch (err) {
      console.log("Unable to save selected month:", err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await Promise.all([fetchInitializedMonths(), loadDashboard()]);
    } finally {
      setRefreshing(false);
    }
  };

  // Activate selected month using the existing website endpoint.
  const activateMonth = async () => {
    setActivating(true);

    try {
      await api.post("/start-month", {
        month: selectedMonth,
        serviceId,
      });

      await fetchInitializedMonths();
      await loadDashboard();

      setMonthModalVisible(false);

      Alert.alert(
        "Month Activated",
        `${selectedMonth} has been activated successfully.`,
      );
    } catch (err: any) {
      console.log("Month activation error:", err.response?.data || err.message);

      Alert.alert(
        "Activation Failed",
        err.response?.data?.message || "Unable to activate this month.",
      );
    } finally {
      setActivating(false);
    }
  };

  const confirmActivateMonth = () => {
    Alert.alert(
      `Start ${selectedMonth}?`,
      `This will generate pending payment records for all active customers for ${selectedMonth}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Activate Month",
          onPress: activateMonth,
        },
      ],
    );
  };

  // Website dashboard calculations.
  const totalCustomers = dashboardData.length;

  const expected = dashboardData.reduce(
    (sum, customer) => sum + (Number(customer.amount) || 0),
    0,
  );

  const collected = dashboardData.reduce(
    (sum, customer) =>
      customer.status === "Paid" ? sum + (Number(customer.amount) || 0) : sum,
    0,
  );

  const pending = dashboardData.reduce(
    (sum, customer) =>
      customer.status === "Pending" || customer.status === "No Record"
        ? sum + (Number(customer.amount) || 0)
        : sum,
    0,
  );

  const collectionRate =
    expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;

  const isMonthActivated = initializedMonths.includes(selectedMonth);

  const openPayments = () => {
    router.push("/(tabs)/payments");
  };

  const recentCustomers = [...dashboardData]
    .sort((a, b) => {
      return (
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
      );
    })
    .slice(0, 5);

  if (loading && !dashboardData.length) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-3 text-sm text-slate-500">
          Loading dashboard...
        </Text>
      </SafeAreaView>
    );
  }

  if (error && !dashboardData.length && !loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 px-5">
        <View className="w-full rounded-3xl bg-white p-6">
          <Text className="text-center text-xl font-bold text-slate-900">
            Dashboard unavailable
          </Text>

          <Text className="mt-2 text-center text-sm text-slate-500">
            {error}
          </Text>

          <TouchableOpacity
            onPress={() => {
              setLoading(true);
              handleRefresh().finally(() => setLoading(false));
            }}
            className="mt-5 items-center rounded-xl bg-blue-600 py-4"
          >
            <Text className="font-bold text-white">Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2563EB"
          />
        }
      >
        <View className="px-5 pb-10 pt-4">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-extrabold text-slate-900">
                🚗 {serviceName}
              </Text>
              <Text className="mt-1 text-sm text-slate-500">
                Powered by AutoFlow
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push("/(tabs)/settings")}
              className="h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white"
            >
              <Text className="text-xl">⚙️</Text>
            </TouchableOpacity>
          </View>

          {/* Month selector */}
          <View className="mt-6">
            <Pressable
              onPress={() => setMonthModalVisible(true)}
              className="flex-row items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-4"
            >
              <View className="flex-row items-center">
                <Text className="mr-3 text-xl">📅</Text>
                <View>
                  <Text className="text-[10px] font-semibold uppercase text-slate-400">
                    Viewing
                  </Text>
                  <Text className="mt-1 text-base font-bold text-slate-900">
                    {selectedMonth}
                  </Text>
                </View>
              </View>

              <Text className="text-lg text-slate-400">⌄</Text>
            </Pressable>
          </View>

          {/* Month status */}
          <View
            className={`mt-3 flex-row items-center rounded-xl px-4 py-3 ${
              isMonthActivated ? "bg-green-50" : "bg-amber-50"
            }`}
          >
            <Text className="mr-2 text-base">
              {isMonthActivated ? "✓" : "ℹ️"}
            </Text>
            <Text
              className={`flex-1 text-xs font-semibold ${
                isMonthActivated ? "text-green-700" : "text-amber-700"
              }`}
            >
              {isMonthActivated
                ? `${selectedMonth} is activated`
                : `${selectedMonth} is not activated yet`}
            </Text>
          </View>

          {/* Month selection modal */}
          <Modal
            visible={monthModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setMonthModalVisible(false)}
          >
            <Pressable
              onPress={() => setMonthModalVisible(false)}
              className="flex-1 justify-center bg-black/40 px-5"
            >
              <Pressable
                onPress={() => {}}
                className="overflow-hidden rounded-3xl bg-white"
              >
                <View className="border-b border-slate-100 px-5 py-4">
                  <Text className="text-lg font-bold text-slate-900">
                    Select Billing Month
                  </Text>
                  <Text className="mt-1 text-xs text-slate-500">
                    Choose a month to view its collection
                  </Text>
                </View>

                {isMonthActivated ? (
                  <View className="flex-row items-center justify-center bg-green-50 px-4 py-3">
                    <Text className="text-sm font-bold text-green-700">
                      ✓ {selectedMonth} activated!
                    </Text>
                  </View>
                ) : (
                  <View className="bg-amber-50 px-4 py-3">
                    <Text className="text-center text-xs font-semibold text-amber-700">
                      This month has not been activated
                    </Text>
                  </View>
                )}

                <ScrollView className="max-h-72 px-3 py-2">
                  {availableMonths.map((month) => {
                    const active = initializedMonths.includes(month);
                    const selected = selectedMonth === month;

                    return (
                      <TouchableOpacity
                        key={month}
                        onPress={() => handleMonthSelect(month)}
                        className={`mb-1 flex-row items-center justify-between rounded-xl px-3 py-3 ${
                          selected ? "bg-blue-50" : "bg-white"
                        }`}
                      >
                        <Text
                          className={`text-sm ${
                            selected
                              ? "font-bold text-blue-700"
                              : "font-medium text-slate-700"
                          }`}
                        >
                          {month}
                        </Text>

                        <View
                          className={`rounded-full px-3 py-1 ${
                            active ? "bg-green-100" : "bg-slate-100"
                          }`}
                        >
                          <Text
                            className={`text-[10px] font-bold ${
                              active ? "text-green-700" : "text-slate-500"
                            }`}
                          >
                            {active ? "Active" : "Inactive"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {!isMonthActivated && (
                  <View className="border-t border-slate-100 p-4">
                    <TouchableOpacity
                      onPress={confirmActivateMonth}
                      disabled={activating}
                      className="items-center rounded-xl bg-blue-600 py-3.5"
                    >
                      {activating ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text className="font-bold text-white">
                          + Start {selectedMonth}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => setMonthModalVisible(false)}
                  className="items-center pb-4"
                >
                  <Text className="text-sm font-semibold text-slate-500">
                    Close
                  </Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Overview heading */}
          <View className="mb-4 mt-8">
            <Text className="text-xl font-extrabold text-slate-900">
              Business Overview
            </Text>
            <Text className="mt-1 text-xs text-slate-500">
              Your collection summary for {selectedMonth}
            </Text>
          </View>

          {/* Customers and Expected */}
          <View className="flex-row gap-3">
            <View className="flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <Text className="text-xs font-semibold text-slate-500">
                CUSTOMERS
              </Text>
              <Text className="mt-3 text-3xl font-extrabold text-slate-900">
                {totalCustomers}
              </Text>
              <Text className="mt-1 text-[10px] text-slate-400">
                Billed customers
              </Text>
            </View>

            <Pressable
              onPress={openPayments}
              className="flex-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <Text className="text-xs font-semibold text-slate-500">
                EXPECTED
              </Text>
              <Text className="mt-3 text-2xl font-extrabold text-slate-900">
                {formatCurrency(expected)}
              </Text>
              <Text className="mt-1 text-[10px] font-semibold text-blue-600">
                View collection →
              </Text>
            </Pressable>
          </View>

          {/* Collected and Pending */}
          <View className="mt-3 flex-row gap-3">
            <Pressable
              onPress={openPayments}
              className="flex-1 rounded-2xl border border-green-100 bg-green-50 p-4"
            >
              <Text className="text-xs font-bold text-green-700">
                COLLECTED
              </Text>
              <Text className="mt-3 text-xl font-extrabold text-green-700">
                {formatCurrency(collected)}
              </Text>
              <Text className="mt-1 text-[10px] font-semibold text-green-700">
                View payments →
              </Text>
            </Pressable>

            <Pressable
              onPress={openPayments}
              className="flex-1 rounded-2xl border border-red-100 bg-red-50 p-4"
            >
              <Text className="text-xs font-bold text-red-600">PENDING</Text>
              <Text className="mt-3 text-xl font-extrabold text-red-600">
                {formatCurrency(pending)}
              </Text>
              <Text className="mt-1 text-[10px] font-semibold text-red-600">
                View dues →
              </Text>
            </Pressable>
          </View>

          {/* Collection progress */}
          <View className="mt-4 rounded-2xl border border-slate-100 bg-white p-5">
            <View className="flex-row items-center justify-between">
              <Text className="font-bold text-slate-900">
                Collection Progress
              </Text>
              <Text className="font-bold text-blue-600">{collectionRate}%</Text>
            </View>

            <View className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <View
                style={{ width: `${collectionRate}%` }}
                className="h-full rounded-full bg-blue-600"
              />
            </View>

            <View className="mt-3 flex-row justify-between">
              <Text className="text-[10px] text-slate-500">
                {formatCurrency(collected)} collected
              </Text>
              <Text className="text-[10px] text-slate-500">
                {formatCurrency(expected)} expected
              </Text>
            </View>
          </View>

          {/* Recent customers */}
          <View className="mb-4 mt-8 flex-row items-center justify-between">
            <View>
              <Text className="text-xl font-extrabold text-slate-900">
                Recent Customers
              </Text>
              <Text className="mt-1 text-xs text-slate-500">
                Customers in {selectedMonth}
              </Text>
            </View>

            <TouchableOpacity onPress={() => router.push("/(tabs)/customers")}>
              <Text className="text-sm font-bold text-blue-600">
                View All →
              </Text>
            </TouchableOpacity>
          </View>

          {recentCustomers.length === 0 ? (
            <View className="items-center rounded-2xl bg-white p-7">
              <Text className="text-3xl">👤</Text>
              <Text className="mt-3 font-bold text-slate-800">
                No customers found
              </Text>
              <Text className="mt-1 text-center text-xs text-slate-400">
                No customer records available for this month.
              </Text>

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/customers")}
                className="mt-4 rounded-xl bg-blue-600 px-5 py-3"
              >
                <Text className="font-semibold text-white">
                  Manage Customers
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentCustomers.map((customer) => (
              <TouchableOpacity
                key={customer._id}
                activeOpacity={0.8}
                onPress={() =>
                  router.push({
                    pathname: "/customer/[id]",
                    params: {
                      id: customer._id,
                      name: customer.name || "",
                      phone: customer.phone || "",
                      vehicleName: customer.vehicleName || "",
                      doorNumber: customer.doorNumber || "",
                      monthlyAmount: String(customer.monthlyAmount ?? 0),
                      gender: customer.gender || "",
                      isActive: String(customer.isActive ?? true),
                    },
                  })
                }
                className="mb-3 flex-row items-center rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
                  <Text className="text-lg font-bold text-blue-700">
                    {customer.name?.charAt(0)?.toUpperCase() || "C"}
                  </Text>
                </View>

                <View className="ml-3 flex-1">
                  <Text className="text-base font-bold text-slate-900">
                    {customer.name}
                  </Text>
                  <Text className="mt-1 text-xs text-slate-500">
                    {customer.phone}
                  </Text>
                  {customer.vehicleName ? (
                    <Text className="mt-1 text-xs text-slate-400">
                      {customer.vehicleName}
                    </Text>
                  ) : null}
                </View>

                <View className="items-end">
                  <View
                    className={`rounded-full px-3 py-1 ${
                      customer.status === "Paid" ? "bg-green-50" : "bg-red-50"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        customer.status === "Paid"
                          ? "text-green-700"
                          : "text-red-600"
                      }`}
                    >
                      {customer.status === "No Record"
                        ? "Not Started"
                        : customer.status}
                    </Text>
                  </View>

                  <Text className="mt-2 text-sm font-bold text-slate-700">
                    {formatCurrency(customer.amount)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          <Text className="mt-5 text-center text-xs text-slate-400">
            Pull down to refresh your dashboard
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
