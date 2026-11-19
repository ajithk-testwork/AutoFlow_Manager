import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import AutoFlowFeedback from "@/components/AutoFlowFeedback";

/* ───────────────────────────── Types ───────────────────────────── */

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

type MonthOption = {
  key: string; // "November 2026"
  short: string; // "Nov"
  year: number;
  index: number; // year * 12 + month
};

type SheetStep = "confirm" | "success";

/* ───────────────────────────── Helpers ───────────────────────────── */

const formatCurrency = (amount: number) =>
  `₹${(Number(amount) || 0).toLocaleString("en-IN")}`;

const getMonthKey = (date: Date) =>
  `${date.toLocaleString("en-US", { month: "long" })} ${date.getFullYear()}`;

const getAvailableMonths = (): MonthOption[] => {
  const months: MonthOption[] = [];
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 3);

  for (let i = 0; i < 10; i++) {
    months.push({
      key: getMonthKey(date),
      short: date.toLocaleString("en-US", { month: "short" }),
      year: date.getFullYear(),
      index: date.getFullYear() * 12 + date.getMonth(),
    });
    date.setMonth(date.getMonth() + 1);
  }

  return months;
};

const nowIndex = () => {
  const d = new Date();
  return d.getFullYear() * 12 + d.getMonth();
};

const statusStyle = (status: string) => {
  if (status === "Paid")
    return { bg: "bg-green-50", text: "text-green-700", label: "Paid" };
  if (status === "Pending")
    return { bg: "bg-amber-50", text: "text-amber-700", label: "Pending" };
  return { bg: "bg-slate-100", text: "text-slate-500", label: "Not started" };
};

/* ─────────────────────── Small UI building blocks ─────────────────────── */

function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Pick month", "Activate", "Collect"];

  return (
    <View className="flex-row items-center">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;

        return (
          <View key={label} className="flex-1 flex-row items-center">
            <View className="items-center">
              <View
                className={`h-7 w-7 items-center justify-center rounded-full ${
                  done
                    ? "bg-green-500"
                    : active
                      ? "bg-blue-600"
                      : "bg-slate-200"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    done || active ? "text-white" : "text-slate-500"
                  }`}
                >
                  {done ? "✓" : n}
                </Text>
              </View>
              <Text
                className={`mt-1 text-[11px] ${
                  active
                    ? "font-bold text-slate-900"
                    : done
                      ? "font-semibold text-green-700"
                      : "text-slate-400"
                }`}
              >
                {label}
              </Text>
            </View>

            {i < steps.length - 1 && (
              <View
                className={`mx-1 mb-4 h-[2px] flex-1 ${
                  n < current ? "bg-green-400" : "bg-slate-200"
                }`}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between py-2.5">
      <Text className="text-sm text-slate-500">{label}</Text>
      <Text
        className={`text-sm ${
          strong
            ? "font-extrabold text-slate-900"
            : "font-semibold text-slate-700"
        }`}
      >
        {value}
      </Text>
    </View>
  );
}

function BreakdownTile({
  label,
  count,
  dot,
}: {
  label: string;
  count: number;
  dot: string;
}) {
  return (
    <View className="flex-1 rounded-2xl bg-white p-3">
      <View className="flex-row items-center">
        <View className={`mr-2 h-2 w-2 rounded-full ${dot}`} />
        <Text className="text-xs text-slate-500">{label}</Text>
      </View>
      <Text className="mt-2 text-2xl font-extrabold text-slate-900">
        {count}
      </Text>
    </View>
  );
}

/* ───────────────────────────── Screen ───────────────────────────── */

export default function DashboardScreen() {
  const [serviceId, setServiceId] = useState("");
  const [serviceName, setServiceName] = useState("AutoFlow");
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));

  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardCustomer[]>([]);
  const [initializedMonths, setInitializedMonths] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthReady, setMonthReady] = useState(false);
  const [error, setError] = useState("");

  const [monthModalVisible, setMonthModalVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetStep, setSheetStep] = useState<SheetStep>("confirm");
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState("");

  const availableMonths = useMemo(() => getAvailableMonths(), []);
  const chipsRef = useRef<ScrollView>(null);
  const fade = useRef(new Animated.Value(0)).current;

  /* ── Restore service + last selected month ── */
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
        if (savedServiceName) setServiceName(savedServiceName);
        if (savedMonth) setSelectedMonth(savedMonth);
      } catch (err: any) {
        setError(err.message || "Unable to initialize dashboard");
        setLoading(false);
      } finally {
        setMonthReady(true);
      }
    };

    initialize();
  }, []);

  /* ── Months already activated in backend ── */
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

  /* ── Monthly customers + payments ── */
  const loadDashboard = useCallback(async () => {
    if (!serviceId || !selectedMonth) return;

    try {
      setError("");

      const [customersResponse, paymentsResponse] = await Promise.all([
        api.get("/getcustomer", { params: { serviceId } }),
        api.get("/payments", { params: { month: selectedMonth, serviceId } }),
      ]);

      const customers: Customer[] = Array.isArray(customersResponse.data)
        ? customersResponse.data
        : [];

      const payments: Payment[] = Array.isArray(paymentsResponse.data)
        ? paymentsResponse.data
        : [];

      setAllCustomers(customers);

      const paymentMap = new Map<string, Payment>();

      payments.forEach((payment) => {
        const customerId =
          typeof payment.customerId === "object"
            ? payment.customerId?._id
            : payment.customerId;

        if (customerId) paymentMap.set(customerId, payment);
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
        .filter((customer) =>
          isMonthStarted ? customer.paymentId !== null : true,
        );

      setDashboardData(mergedData);
    } catch (err: any) {
      console.log("Dashboard fetch error:", err.response?.data || err.message);
      setError(
        err.response?.data?.message || "Unable to load monthly dashboard data.",
      );
    }
  }, [serviceId, selectedMonth]);

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

  /* ── Actions ── */
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

  const openActivationSheet = () => {
    setActivationError("");
    setSheetStep("confirm");
    setSheetVisible(true);
  };

  const closeActivationSheet = () => {
    if (activating) return;
    setSheetVisible(false);
  };

  const activateMonth = async () => {
    setActivating(true);
    setActivationError("");

    try {
      await api.post("/start-month", { month: selectedMonth, serviceId });
      await Promise.all([fetchInitializedMonths(), loadDashboard()]);
      setSheetStep("success");
    } catch (err: any) {
      console.log("Month activation error:", err.response?.data || err.message);
      setActivationError(
        err.response?.data?.message ||
          "Could not activate this month. Check your connection and try again.",
      );
    } finally {
      setActivating(false);
    }
  };

  /* ── Derived values ── */
  const isMonthActivated = initializedMonths.includes(selectedMonth);
  const selectedOption = availableMonths.find((m) => m.key === selectedMonth);
  const isFutureMonth = selectedOption
    ? selectedOption.index > nowIndex()
    : false;

  const activeCustomers = allCustomers.filter((c) => c.isActive !== false);
  const activeCustomerCount = activeCustomers.length;
  const projectedAmount = activeCustomers.reduce(
    (sum, c) => sum + (Number(c.monthlyAmount) || 0),
    0,
  );

  const totalCustomers = dashboardData.length;

  const expected = dashboardData.reduce(
    (sum, c) => sum + (Number(c.amount) || 0),
    0,
  );
  const collected = dashboardData.reduce(
    (sum, c) => (c.status === "Paid" ? sum + (Number(c.amount) || 0) : sum),
    0,
  );
  const pending = dashboardData.reduce(
    (sum, c) =>
      c.status === "Pending" || c.status === "No Record"
        ? sum + (Number(c.amount) || 0)
        : sum,
    0,
  );

  const paidCount = dashboardData.filter((c) => c.status === "Paid").length;
  const pendingCount = dashboardData.filter(
    (c) => c.status === "Pending",
  ).length;
  const notStartedCount = dashboardData.filter(
    (c) => c.status === "No Record",
  ).length;

  const collectionRate =
    expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0;

  const openPayments = () => router.push("/(tabs)/payments");

  const recentCustomers = [...dashboardData]
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    )
    .slice(0, 5);

  /* Scroll the selected chip into view + soft fade on month change */
  useEffect(() => {
    const idx = availableMonths.findIndex((m) => m.key === selectedMonth);
    if (idx > -1) {
      chipsRef.current?.scrollTo({
        x: Math.max(0, idx * 92 - 80),
        animated: true,
      });
    }
  }, [selectedMonth, availableMonths]);

  useEffect(() => {
    if (loading) return;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [selectedMonth, loading, fade]);

  /* ───────────────────────── Loading / error ───────────────────────── */

  if (loading) {
    return (
      <AutoFlowFeedback
        mode="loading"
        title="Loading dashboard"
        message="Preparing your dashboard. Please wait..."
      />
    );
  }

  if (error && !dashboardData.length && !loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 px-5">
        <View className="w-full rounded-3xl bg-white p-6">
          <Text className="text-center text-4xl">📡</Text>
          <Text className="mt-3 text-center text-xl font-bold text-slate-900">
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
            <Text className="font-bold text-white">Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ───────────────────────────── Render ───────────────────────────── */

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
        <View className="pb-12 pt-3">
          {/* ───── Header ───── */}
          <View className="flex-row items-center justify-between px-5">
            <View className="flex-1 pr-3">
              <Text className="text-xs text-slate-500">Welcome back</Text>
              <Text
                className="mt-0.5 text-2xl font-extrabold text-slate-900"
                numberOfLines={1}
              >
                🚗 {serviceName}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push("/(tabs)/settings")}
              className="h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white"
            >
              <Text className="text-lg">⚙️</Text>
            </TouchableOpacity>
          </View>

          {/* ───── Month chips ───── */}
          <View className="mt-5">
            <View className="mb-2 flex-row items-center justify-between px-5">
              <Text className="text-sm font-bold text-slate-900">
                Billing month
              </Text>
              <TouchableOpacity onPress={() => setMonthModalVisible(true)}>
                <Text className="text-xs font-bold text-blue-600">
                  See all months
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={chipsRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              {availableMonths.map((m) => {
                const selected = m.key === selectedMonth;
                const active = initializedMonths.includes(m.key);

                return (
                  <TouchableOpacity
                    key={m.key}
                    activeOpacity={0.85}
                    onPress={() => handleMonthSelect(m.key)}
                    className={`mr-2 w-20 items-center rounded-2xl border px-2 py-3 ${
                      selected
                        ? "border-blue-600 bg-blue-600"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <Text
                      className={`text-base font-extrabold ${
                        selected ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {m.short}
                    </Text>
                    <Text
                      className={`text-[11px] ${
                        selected ? "text-blue-100" : "text-slate-400"
                      }`}
                    >
                      {m.year}
                    </Text>
                    <View className="mt-2 flex-row items-center">
                      <View
                        className={`mr-1 h-1.5 w-1.5 rounded-full ${
                          active
                            ? selected
                              ? "bg-green-300"
                              : "bg-green-500"
                            : selected
                              ? "bg-blue-300"
                              : "bg-slate-300"
                        }`}
                      />
                      <Text
                        className={`text-[10px] font-semibold ${
                          selected
                            ? "text-blue-100"
                            : active
                              ? "text-green-700"
                              : "text-slate-400"
                        }`}
                      >
                        {active ? "Active" : "Not started"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <Animated.View style={{ opacity: fade }} className="px-5">
            {/* ───── Activation workflow card (month not started) ───── */}
            {!isMonthActivated && (
              <View className="mt-5 overflow-hidden rounded-3xl border border-amber-200 bg-white">
                <View className="bg-amber-50 px-5 py-4">
                  <Text className="text-base font-extrabold text-slate-900">
                    {selectedMonth} hasn’t started
                  </Text>
                  <Text className="mt-1 text-xs leading-4 text-slate-600">
                    Activate the month to create a pending payment for each
                    active customer. You can then mark payments as they come in.
                  </Text>
                </View>

                <View className="px-5 pb-5 pt-4">
                  <Stepper current={2} />

                  <View className="mt-5 flex-row gap-3">
                    <View className="flex-1 rounded-2xl bg-slate-50 p-3">
                      <Text className="text-xs text-slate-500">
                        Active customers
                      </Text>
                      <Text className="mt-1 text-xl font-extrabold text-slate-900">
                        {activeCustomerCount}
                      </Text>
                    </View>
                    <View className="flex-1 rounded-2xl bg-slate-50 p-3">
                      <Text className="text-xs text-slate-500">
                        Expected to bill
                      </Text>
                      <Text className="mt-1 text-xl font-extrabold text-slate-900">
                        {formatCurrency(projectedAmount)}
                      </Text>
                    </View>
                  </View>

                  {isFutureMonth && (
                    <View className="mt-3 rounded-xl bg-blue-50 px-3 py-2">
                      <Text className="text-xs text-blue-700">
                        This is an upcoming month. You can activate it early if
                        billing starts sooner.
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={openActivationSheet}
                    disabled={activeCustomerCount === 0}
                    activeOpacity={0.85}
                    className={`mt-4 items-center rounded-2xl py-4 ${
                      activeCustomerCount === 0 ? "bg-slate-300" : "bg-blue-600"
                    }`}
                  >
                    <Text className="text-base font-bold text-white">
                      Activate {selectedMonth}
                    </Text>
                  </TouchableOpacity>

                  {activeCustomerCount === 0 && (
                    <TouchableOpacity
                      onPress={() => router.push("/(tabs)/customers")}
                      className="mt-3 items-center"
                    >
                      <Text className="text-xs font-bold text-blue-600">
                        Add a customer first
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* ───── Hero collection card (month active) ───── */}
            {isMonthActivated && (
              <View className="mt-5 overflow-hidden rounded-3xl bg-blue-600 p-5">
                {/* decorative circles */}
                <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500 opacity-60" />
                <View className="absolute -bottom-12 right-10 h-32 w-32 rounded-full bg-blue-700 opacity-50" />

                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-blue-100">
                    Collected in {selectedMonth}
                  </Text>
                  <View className="rounded-full bg-white/20 px-3 py-1">
                    <Text className="text-[11px] font-bold text-white">
                      ✓ Active
                    </Text>
                  </View>
                </View>

                <Text className="mt-2 text-4xl font-extrabold text-white">
                  {formatCurrency(collected)}
                </Text>
                <Text className="mt-1 text-xs text-blue-100">
                  of {formatCurrency(expected)} expected
                </Text>

                <View className="mt-5 h-2.5 overflow-hidden rounded-full bg-blue-400/50">
                  <View
                    style={{ width: `${collectionRate}%` }}
                    className="h-full rounded-full bg-white"
                  />
                </View>

                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-xs font-bold text-white">
                    {collectionRate}% collected
                  </Text>
                  <Text className="text-xs text-blue-100">
                    {formatCurrency(pending)} due
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={openPayments}
                  activeOpacity={0.9}
                  className="mt-5 items-center rounded-2xl bg-white py-3.5"
                >
                  <Text className="text-sm font-bold text-blue-700">
                    Collect payments
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ───── Status breakdown ───── */}
            {isMonthActivated && (
              <>
                <View className="mb-3 mt-7 flex-row items-end justify-between">
                  <View>
                    <Text className="text-lg font-extrabold text-slate-900">
                      Customer status
                    </Text>
                    <Text className="mt-0.5 text-xs text-slate-500">
                      {totalCustomers} billed this month
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <BreakdownTile
                    label="Paid"
                    count={paidCount}
                    dot="bg-green-500"
                  />
                  <BreakdownTile
                    label="Pending"
                    count={pendingCount}
                    dot="bg-amber-500"
                  />
                  {notStartedCount > 0 && (
                    <BreakdownTile
                      label="No record"
                      count={notStartedCount}
                      dot="bg-slate-400"
                    />
                  )}
                </View>
              </>
            )}

            {/* ───── Recent customers ───── */}
            <View className="mb-3 mt-8 flex-row items-end justify-between">
              <View>
                <Text className="text-lg font-extrabold text-slate-900">
                  Recent customers
                </Text>
                <Text className="mt-0.5 text-xs text-slate-500">
                  {isMonthActivated
                    ? `Billed in ${selectedMonth}`
                    : "Latest customers added"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => router.push("/(tabs)/customers")}
              >
                <Text className="text-sm font-bold text-blue-600">
                  View all
                </Text>
              </TouchableOpacity>
            </View>

            {recentCustomers.length === 0 ? (
              <View className="items-center rounded-3xl bg-white p-7">
                <Text className="text-3xl">👤</Text>
                <Text className="mt-3 font-bold text-slate-800">
                  No customers yet
                </Text>
                <Text className="mt-1 text-center text-xs text-slate-400">
                  Add your first customer to start billing.
                </Text>

                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/customers")}
                  className="mt-4 rounded-xl bg-blue-600 px-5 py-3"
                >
                  <Text className="font-semibold text-white">Add customer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              recentCustomers.map((customer) => {
                const s = statusStyle(customer.status);

                return (
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
                    className="mb-3 flex-row items-center rounded-2xl border border-slate-100 bg-white p-4"
                  >
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                      <Text className="text-lg font-bold text-blue-700">
                        {customer.name?.charAt(0)?.toUpperCase() || "C"}
                      </Text>
                    </View>

                    <View className="ml-3 flex-1">
                      <Text
                        className="text-base font-bold text-slate-900"
                        numberOfLines={1}
                      >
                        {customer.name}
                      </Text>
                      <Text className="mt-0.5 text-xs text-slate-500">
                        {customer.phone}
                      </Text>
                      {customer.vehicleName ? (
                        <Text className="mt-0.5 text-xs text-slate-400">
                          {customer.vehicleName}
                        </Text>
                      ) : null}
                    </View>

                    <View className="items-end">
                      <View className={`rounded-full px-3 py-1 ${s.bg}`}>
                        <Text className={`text-xs font-semibold ${s.text}`}>
                          {s.label}
                        </Text>
                      </View>
                      <Text className="mt-2 text-sm font-bold text-slate-700">
                        {formatCurrency(customer.amount)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            <Text className="mt-4 text-center text-xs text-slate-400">
              Pull down to refresh
            </Text>
          </Animated.View>
        </View>
      </ScrollView>

      {/* ═════════════ All-months modal ═════════════ */}
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
                Choose billing month
              </Text>
              <Text className="mt-1 text-xs text-slate-500">
                Green months are active and ready for collection.
              </Text>
            </View>

            <ScrollView className="max-h-96 px-3 py-2">
              {availableMonths.map((m) => {
                const active = initializedMonths.includes(m.key);
                const selected = selectedMonth === m.key;
                const upcoming = m.index > nowIndex();

                return (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => handleMonthSelect(m.key)}
                    className={`mb-1 flex-row items-center justify-between rounded-xl px-3 py-3 ${
                      selected ? "bg-blue-50" : "bg-white"
                    }`}
                  >
                    <View>
                      <Text
                        className={`text-sm ${
                          selected
                            ? "font-bold text-blue-700"
                            : "font-medium text-slate-700"
                        }`}
                      >
                        {m.key}
                      </Text>
                      {upcoming && (
                        <Text className="mt-0.5 text-[11px] text-slate-400">
                          Upcoming
                        </Text>
                      )}
                    </View>

                    <View
                      className={`rounded-full px-3 py-1 ${
                        active ? "bg-green-100" : "bg-slate-100"
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-bold ${
                          active ? "text-green-700" : "text-slate-500"
                        }`}
                      >
                        {active ? "Active" : "Not started"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setMonthModalVisible(false)}
              className="items-center border-t border-slate-100 py-4"
            >
              <Text className="text-sm font-semibold text-slate-500">
                Close
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═════════════ Activation bottom sheet ═════════════ */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeActivationSheet}
      >
        <Pressable
          onPress={closeActivationSheet}
          className="flex-1 justify-end bg-black/40"
        >
          <Pressable
            onPress={() => {}}
            className="rounded-t-3xl bg-white px-5 pb-8 pt-3"
          >
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-slate-200" />

            {sheetStep === "confirm" ? (
              <>
                <Text className="text-xl font-extrabold text-slate-900">
                  Activate {selectedMonth}?
                </Text>
                <Text className="mt-1 text-sm text-slate-500">
                  Review what will be created before you continue.
                </Text>

                <View className="mt-4 rounded-2xl bg-slate-50 px-4">
                  <SummaryRow
                    label="Payment records"
                    value={`${activeCustomerCount} pending`}
                  />
                  <View className="h-px bg-slate-200" />
                  <SummaryRow
                    label="Total expected"
                    value={formatCurrency(projectedAmount)}
                    strong
                  />
                </View>

                <Text className="mt-3 text-xs leading-4 text-slate-500">
                  Inactive customers are skipped. Once activated, a month can’t
                  be started again.
                </Text>

                {activationError ? (
                  <View className="mt-3 rounded-xl bg-red-50 px-3 py-2.5">
                    <Text className="text-xs font-semibold text-red-600">
                      {activationError}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={activateMonth}
                  disabled={activating}
                  activeOpacity={0.85}
                  className={`mt-5 items-center rounded-2xl py-4 ${
                    activating ? "bg-blue-400" : "bg-blue-600"
                  }`}
                >
                  {activating ? (
                    <View className="flex-row items-center">
                      <ActivityIndicator color="#FFFFFF" />
                      <Text className="ml-2 font-bold text-white">
                        Activating…
                      </Text>
                    </View>
                  ) : (
                    <Text className="font-bold text-white">
                      {activationError ? "Try again" : "Activate month"}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={closeActivationSheet}
                  disabled={activating}
                  className="mt-3 items-center py-2"
                >
                  <Text className="text-sm font-semibold text-slate-500">
                    Not now
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View className="items-center">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <Text className="text-3xl text-green-600">✓</Text>
                </View>
                <Text className="mt-4 text-xl font-extrabold text-slate-900">
                  {selectedMonth} is active
                </Text>
                <Text className="mt-1 text-center text-sm text-slate-500">
                  {activeCustomerCount} pending payments are ready. Start
                  marking them as customers pay.
                </Text>

                <View className="mt-5 w-full">
                  <Stepper current={3} />
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setSheetVisible(false);
                    openPayments();
                  }}
                  activeOpacity={0.85}
                  className="mt-6 w-full items-center rounded-2xl bg-blue-600 py-4"
                >
                  <Text className="font-bold text-white">Collect payments</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setSheetVisible(false)}
                  className="mt-3 items-center py-2"
                >
                  <Text className="text-sm font-semibold text-slate-500">
                    Stay on dashboard
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
