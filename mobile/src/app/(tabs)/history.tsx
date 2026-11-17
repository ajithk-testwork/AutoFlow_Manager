
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
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

type HistoryCustomer = {
  _id: string;
  name?: string;
  phone?: string;
  vehicleName?: string;
  doorNumber?: string;
  monthlyAmount?: number;
};

type HistoryPayment = {
  _id: string;
  customerId: HistoryCustomer | string | null;
  month: string;
  amount: number;
  status: "Paid" | "Pending" | string;
  paidDate?: string;
  missedDays?: number;
  dailyStatus?: {
    date: string;
    status: string;
  }[];
};

type MonthlyHistory = {
  month: string;
  collected: number;
  pending: number;
  payments: HistoryPayment[];
};

const currency = (amount: number) =>
  `₹${(Number(amount) || 0).toLocaleString("en-IN")}`;

const getMonthDate = (month: string) => {
  const [monthName, year] = month.split(" ");
  const date = new Date(`${monthName} 1, ${year}`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const formatDate = (value?: string) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function HistoryScreen() {
  const [history, setHistory] = useState<MonthlyHistory[]>([]);
  const [serviceId, setServiceId] = useState("");

  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      setError("");

      const savedServiceId =
        await SecureStore.getItemAsync("autoflow_service_id");

      if (!savedServiceId) {
        throw new Error("Please select a service first.");
      }

      setServiceId(savedServiceId);

      const response = await api.get("/global/history", {
        params: { serviceId: savedServiceId },
      });

      const result: MonthlyHistory[] = Array.isArray(response.data)
        ? response.data
        : [];

      // Newest month first
      result.sort(
        (a, b) => getMonthDate(b.month) - getMonthDate(a.month)
      );

      setHistory(result);
    } catch (err: any) {
      console.log(
        "History loading error:",
        err.response?.data || err.message
      );

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load payment history."
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const load = async () => {
        setLoading(true);
        await loadHistory();

        if (mounted) {
          setLoading(false);
          setRefreshing(false);
        }
      };

      load();

      return () => {
        mounted = false;
      };
    }, [loadHistory])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const totalCollected = useMemo(
    () =>
      history.reduce(
        (sum, item) => sum + (Number(item.collected) || 0),
        0
      ),
    [history]
  );

  const totalPending = useMemo(
    () =>
      history.reduce(
        (sum, item) => sum + (Number(item.pending) || 0),
        0
      ),
    [history]
  );

  const totalPayments = useMemo(
    () =>
      history.reduce(
        (sum, item) => sum + (item.payments?.length || 0),
        0
      ),
    [history]
  );

  const filteredHistory = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return history;

    return history
      .map((monthItem) => {
        const matchingPayments = monthItem.payments.filter((payment) => {
          const customer = payment.customerId;

          if (!customer || typeof customer !== "object") {
            return false;
          }

          return (
            customer.name?.toLowerCase().includes(term) ||
            customer.phone?.toLowerCase().includes(term) ||
            customer.vehicleName?.toLowerCase().includes(term) ||
            customer.doorNumber?.toLowerCase().includes(term)
          );
        });

        if (monthItem.month.toLowerCase().includes(term)) {
          return monthItem;
        }

        if (matchingPayments.length > 0) {
          return {
            ...monthItem,
            payments: matchingPayments,
          };
        }

        return null;
      })
      .filter((item): item is MonthlyHistory => item !== null);
  }, [history, search]);

  const openCustomer = (payment: HistoryPayment) => {
    const customer = payment.customerId;

    if (!customer || typeof customer !== "object") return;

    router.push({
      pathname: "/customer/[id]",
      params: {
        id: customer._id,
        name: customer.name || "Customer",
        phone: customer.phone || "",
        vehicleName: customer.vehicleName || "",
        doorNumber: customer.doorNumber || "",
        monthlyAmount: String(customer.monthlyAmount || 0),
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-3 text-sm text-slate-500">
          Loading payment history...
        </Text>
      </SafeAreaView>
    );
  }

  if (error && history.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 px-5">
        <View className="w-full rounded-2xl bg-white p-6">
          <Text className="text-center text-xl font-bold text-slate-900">
            History unavailable
          </Text>

          <Text className="mt-2 text-center text-sm text-slate-500">
            {error}
          </Text>

          <TouchableOpacity
            onPress={handleRefresh}
            className="mt-5 items-center rounded-xl bg-blue-600 py-3"
          >
            <Text className="font-bold text-white">Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
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
          <View>
            <Text className="text-2xl font-extrabold text-slate-900">
              Payment History
            </Text>
            <Text className="mt-1 text-sm text-slate-500">
              Your complete monthly collection records
            </Text>
          </View>

          {/* Overall summary */}
          <View className="mt-6 rounded-2xl bg-slate-900 p-5">
            <Text className="text-xs font-semibold text-slate-300">
              TOTAL COLLECTION
            </Text>

            <Text className="mt-2 text-3xl font-extrabold text-white">
              {currency(totalCollected)}
            </Text>

            <View className="mt-5 flex-row justify-between border-t border-slate-700 pt-4">
              <View>
                <Text className="text-xs text-slate-400">
                  Total Pending
                </Text>
                <Text className="mt-1 font-bold text-amber-400">
                  {currency(totalPending)}
                </Text>
              </View>

              <View>
                <Text className="text-xs text-slate-400">
                  Total Payments
                </Text>
                <Text className="mt-1 font-bold text-white">
                  {totalPayments}
                </Text>
              </View>

              <View>
                <Text className="text-xs text-slate-400">
                  Months
                </Text>
                <Text className="mt-1 font-bold text-white">
                  {history.length}
                </Text>
              </View>
            </View>
          </View>

          {/* Search */}
          <View className="mt-6 rounded-xl border border-slate-200 bg-white px-4">
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search customer or month..."
              placeholderTextColor="#94A3B8"
              className="py-4 text-sm text-slate-900"
            />
          </View>

          {/* Month heading */}
          <View className="mb-3 mt-7 flex-row items-center justify-between">
            <Text className="text-lg font-extrabold text-slate-900">
              Monthly Records
            </Text>

            <Text className="text-xs text-slate-500">
              {filteredHistory.length} months
            </Text>
          </View>

          {filteredHistory.length === 0 ? (
            <View className="items-center rounded-2xl bg-white p-8">
              <Text className="text-3xl">📁</Text>

              <Text className="mt-3 font-bold text-slate-800">
                No history found
              </Text>

              <Text className="mt-1 text-center text-xs text-slate-400">
                Payment records will appear here after billing months are created.
              </Text>
            </View>
          ) : (
            filteredHistory.map((monthItem) => {
              const isExpanded = expandedMonth === monthItem.month;

              const monthPaidCount = monthItem.payments.filter(
                (payment) => payment.status === "Paid"
              ).length;

              const monthPendingCount = monthItem.payments.filter(
                (payment) => payment.status === "Pending"
              ).length;

              return (
                <View
                  key={monthItem.month}
                  className="mb-4 overflow-hidden rounded-2xl border border-slate-100 bg-white"
                >
                  {/* Month card */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      setExpandedMonth(
                        isExpanded ? null : monthItem.month
                      )
                    }
                    className="p-4"
                  >
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-base font-extrabold text-slate-900">
                          {monthItem.month}
                        </Text>

                        <Text className="mt-1 text-xs text-slate-500">
                          {monthItem.payments.length} payment records
                        </Text>
                      </View>

                      <View
                        className={`rounded-full px-3 py-2 ${
                          isExpanded ? "bg-blue-600" : "bg-blue-50"
                        }`}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            isExpanded ? "text-white" : "text-blue-700"
                          }`}
                        >
                          {isExpanded ? "Close −" : "View +"}
                        </Text>
                      </View>
                    </View>

                    <View className="mt-4 flex-row gap-3">
                      <View className="flex-1 rounded-xl bg-green-50 p-3">
                        <Text className="text-xs text-green-700">
                          Collected
                        </Text>
                        <Text className="mt-1 font-extrabold text-green-700">
                          {currency(monthItem.collected)}
                        </Text>
                      </View>

                      <View className="flex-1 rounded-xl bg-red-50 p-3">
                        <Text className="text-xs text-red-600">
                          Pending
                        </Text>
                        <Text className="mt-1 font-extrabold text-red-600">
                          {currency(monthItem.pending)}
                        </Text>
                      </View>
                    </View>

                    <View className="mt-3 flex-row gap-4">
                      <Text className="text-xs font-semibold text-green-700">
                        Paid: {monthPaidCount}
                      </Text>

                      <Text className="text-xs font-semibold text-red-600">
                        Pending: {monthPendingCount}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded payment records */}
                  {isExpanded && (
                    <View className="border-t border-slate-100 bg-slate-50 p-3">
                      {monthItem.payments.length === 0 ? (
                        <Text className="py-4 text-center text-sm text-slate-500">
                          No payment records in this month.
                        </Text>
                      ) : (
                        monthItem.payments.map((payment) => {
                          const customer = payment.customerId;

                          const customerName =
                            customer && typeof customer === "object"
                              ? customer.name || "Unknown Customer"
                              : "Customer details unavailable";

                          const customerPhone =
                            customer && typeof customer === "object"
                              ? customer.phone || ""
                              : "";

                          return (
                            <TouchableOpacity
                              key={payment._id}
                              activeOpacity={0.8}
                              onPress={() => openCustomer(payment)}
                              className="mb-2 rounded-xl border border-slate-100 bg-white p-3"
                            >
                              <View className="flex-row items-center justify-between">
                                <View className="flex-1 pr-2">
                                  <Text className="font-bold text-slate-900">
                                    {customerName}
                                  </Text>

                                  <Text className="mt-1 text-xs text-slate-500">
                                    {customerPhone}
                                  </Text>
                                </View>

                                <View className="items-end">
                                  <Text className="font-extrabold text-slate-900">
                                    {currency(payment.amount)}
                                  </Text>

                                  <View
                                    className={`mt-1 rounded-full px-2 py-1 ${
                                      payment.status === "Paid"
                                        ? "bg-green-50"
                                        : "bg-red-50"
                                    }`}
                                  >
                                    <Text
                                      className={`text-xs font-bold ${
                                        payment.status === "Paid"
                                          ? "text-green-700"
                                          : "text-red-600"
                                      }`}
                                    >
                                      {payment.status}
                                    </Text>
                                  </View>
                                </View>
                              </View>

                              <View className="mt-3 flex-row justify-between border-t border-slate-100 pt-2">
                                <Text className="text-xs text-slate-400">
                                  {payment.status === "Paid"
                                    ? `Paid: ${formatDate(payment.paidDate)}`
                                    : "Payment not received"}
                                </Text>

                                <Text className="text-xs font-semibold text-blue-600">
                                  View Customer ›
                                </Text>
                              </View>

                              {(payment.missedDays || 0) > 0 && (
                                <Text className="mt-2 text-xs font-semibold text-red-600">
                                  {payment.missedDays} missed days
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
