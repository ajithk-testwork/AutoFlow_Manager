import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
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
import AutoFlowFeedback from "@/components/AutoFlowFeedback";

/* ───────────────────────────── Types ───────────────────────────── */

type HistoryCustomer = {
  _id: string;
  name?: string;
  phone?: string;
  vehicleName?: string;
  doorNumber?: string;
  monthlyAmount?: number;
  gender?: string;
  isActive?: boolean;
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

type ViewMonth = MonthlyHistory & { matchedByCustomer: boolean };

type StatusFilter = "ALL" | "PENDING" | "PAID";

/* ───────────────────────────── Helpers ───────────────────────────── */

const currency = (amount: number) =>
  `₹${(Number(amount) || 0).toLocaleString("en-IN")}`;

const getMonthDate = (month: string) => {
  const [monthName, year] = month.split(" ");
  const date = new Date(`${monthName} 1, ${year}`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getCurrentMonth = () => {
  const date = new Date();
  return `${date.toLocaleString("en-US", { month: "long" })} ${date.getFullYear()}`;
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

const rateOf = (collected: number, pending: number) => {
  const total = (Number(collected) || 0) + (Number(pending) || 0);
  return total > 0 ? Math.round(((Number(collected) || 0) / total) * 100) : 0;
};

/* ───────────────────────────── Screen ───────────────────────────── */

export default function HistoryScreen() {
  const [history, setHistory] = useState<MonthlyHistory[]>([]);
  const [serviceId, setServiceId] = useState("");

  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const currentMonth = getCurrentMonth();

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
      result.sort((a, b) => getMonthDate(b.month) - getMonthDate(a.month));

      setHistory(result);
    } catch (err: any) {
      console.log("History loading error:", err.response?.data || err.message);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load payment history.",
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
    }, [loadHistory]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  /* ── Overall totals ── */
  const totals = useMemo(() => {
    const collected = history.reduce(
      (sum, item) => sum + (Number(item.collected) || 0),
      0,
    );
    const pending = history.reduce(
      (sum, item) => sum + (Number(item.pending) || 0),
      0,
    );
    const payments = history.reduce(
      (sum, item) => sum + (item.payments?.length || 0),
      0,
    );

    return {
      collected,
      pending,
      payments,
      months: history.length,
      rate: rateOf(collected, pending),
    };
  }, [history]);

  /* ── Search + status filter ── */
  const filteredHistory = useMemo<ViewMonth[]>(() => {
    const term = search.trim().toLowerCase();

    const byStatus = (payments: HistoryPayment[]) =>
      payments.filter((p) =>
        statusFilter === "ALL"
          ? true
          : statusFilter === "PAID"
            ? p.status === "Paid"
            : p.status !== "Paid",
      );

    return history
      .map((monthItem): ViewMonth | null => {
        const monthMatches = term
          ? monthItem.month.toLowerCase().includes(term)
          : false;

        if (!term || monthMatches) {
          const payments = byStatus(monthItem.payments || []);
          if (statusFilter !== "ALL" && payments.length === 0) return null;
          return { ...monthItem, payments, matchedByCustomer: false };
        }

        const matching = byStatus(
          (monthItem.payments || []).filter((payment) => {
            const customer = payment.customerId;
            if (!customer || typeof customer !== "object") return false;

            return (
              customer.name?.toLowerCase().includes(term) ||
              customer.phone?.toLowerCase().includes(term) ||
              customer.vehicleName?.toLowerCase().includes(term) ||
              customer.doorNumber?.toLowerCase().includes(term)
            );
          }),
        );

        if (matching.length > 0) {
          return { ...monthItem, payments: matching, matchedByCustomer: true };
        }

        return null;
      })
      .filter((item): item is ViewMonth => item !== null);
  }, [history, search, statusFilter]);

  /* ── Navigation ── */
  const openCustomer = (payment: HistoryPayment, month: string) => {
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
        gender: customer.gender || "",
        isActive: String(customer.isActive ?? true),
        isHistorical: String(month !== currentMonth),
        billingAmount: String(payment.amount || 0),
        selectedMonth: month,
      },
    });
  };

  // Make a month the active one across the app, then jump to Payments.
  const openMonthInPayments = async (month: string) => {
    try {
      await SecureStore.setItemAsync("autoflow_selected_month", month);
    } catch (err) {
      console.log("Unable to save selected month:", err);
    }
    router.push("/(tabs)/payments");
  };

  /* ───────────────────────── Loading / error ───────────────────────── */

  if (loading) {
  return (
    <AutoFlowFeedback
      mode="loading"
      title="Loading payments"
      message="Fetching your customer payments. Please wait..."
    />
  );
}

 if (error && history.length === 0) {
  return (
    <AutoFlowFeedback
      mode="error"
      title="Unable to load payments"
      message={error}
      retryLabel="Try again"
      onRetry={() => {
        setLoading(true);
        loadHistory().finally(() => setLoading(false));
      }}
    />
  );
}

  const filterOptions: { key: StatusFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "PENDING", label: "Unpaid" },
    { key: "PAID", label: "Paid" },
  ];

  /* ───────────────────────────── Render ───────────────────────────── */

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2563EB"
          />
        }
      >
        <View className="px-5 pb-12 pt-4">
          {/* Header */}
          <View>
            <Text className="text-2xl font-extrabold text-slate-900">
              History
            </Text>
            <Text className="mt-1 text-sm text-slate-500">
              Every month you’ve billed, in one place
            </Text>
          </View>

          {/* Overall summary */}
          <View className="mt-5 overflow-hidden rounded-3xl bg-slate-900 p-5">
            <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-slate-800" />
            <View className="absolute -bottom-12 right-12 h-28 w-28 rounded-full bg-slate-800 opacity-70" />

            <Text className="text-sm font-semibold text-slate-300">
              Total collected
            </Text>
            <Text className="mt-1 text-4xl font-extrabold text-white">
              {currency(totals.collected)}
            </Text>
            <Text className="mt-1 text-xs text-slate-400">
              across {totals.months} {totals.months === 1 ? "month" : "months"}
              {" "}and {totals.payments} payments
            </Text>

            <View className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-700">
              <View
                style={{ width: `${totals.rate}%` }}
                className="h-full rounded-full bg-green-400"
              />
            </View>

            <View className="mt-2 flex-row justify-between">
              <Text className="text-xs font-bold text-green-400">
                {totals.rate}% collected overall
              </Text>
              <Text className="text-xs font-bold text-amber-400">
                {currency(totals.pending)} outstanding
              </Text>
            </View>
          </View>

          {/* Search */}
          <View className="mt-5 flex-row items-center rounded-2xl border border-slate-200 bg-white px-4">
            <Text className="mr-2 text-lg text-slate-400">⌕</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search a customer or month"
              placeholderTextColor="#94A3B8"
              className="h-12 flex-1 text-sm text-slate-900"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={10}>
                <Text className="text-base text-slate-400">✕</Text>
              </Pressable>
            )}
          </View>

          {/* Status filter */}
          <View className="mt-3 flex-row gap-2">
            {filterOptions.map((option) => {
              const selected = statusFilter === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setStatusFilter(option.key)}
                  className={`rounded-full px-4 py-2 ${
                    selected
                      ? "bg-blue-600"
                      : "border border-slate-200 bg-white"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      selected ? "text-white" : "text-slate-600"
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text className="mb-3 mt-5 text-xs font-semibold text-slate-500">
            Showing {filteredHistory.length} of {history.length} months
          </Text>

          {error ? (
            <View className="mb-3 rounded-2xl bg-red-50 p-4">
              <Text className="text-sm text-red-600">{error}</Text>
              <Pressable onPress={handleRefresh}>
                <Text className="mt-2 font-bold text-red-700">Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Month list */}
          {filteredHistory.length === 0 ? (
            <View className="items-center rounded-3xl bg-white p-8">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                <Text className="text-3xl">📁</Text>
              </View>

              <Text className="mt-4 font-bold text-slate-800">
                {history.length === 0 ? "No history yet" : "No matches"}
              </Text>

              <Text className="mt-1 text-center text-xs leading-4 text-slate-400">
                {history.length === 0
                  ? "Activate a billing month from Home. Its records will show up here."
                  : "Try a different search or filter."}
              </Text>

              {history.length === 0 ? (
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)")}
                  className="mt-5 rounded-xl bg-blue-600 px-6 py-3"
                >
                  <Text className="font-semibold text-white">Go to Home</Text>
                </TouchableOpacity>
              ) : (
                (search || statusFilter !== "ALL") && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearch("");
                      setStatusFilter("ALL");
                    }}
                    className="mt-5 rounded-xl bg-slate-200 px-6 py-3"
                  >
                    <Text className="font-semibold text-slate-700">
                      Clear filters
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          ) : (
            filteredHistory.map((monthItem) => {
              const isExpanded =
                expandedMonth === monthItem.month || monthItem.matchedByCustomer;
              const isCurrent = monthItem.month === currentMonth;

              const rate = rateOf(monthItem.collected, monthItem.pending);
              const fullyCollected =
                monthItem.pending <= 0 && monthItem.collected > 0;

              const paidCount = monthItem.payments.filter(
                (p) => p.status === "Paid",
              ).length;
              const unpaidCount = monthItem.payments.length - paidCount;

              // Unpaid first, then by customer name.
              const sortedPayments = [...monthItem.payments].sort((a, b) => {
                const au = a.status === "Paid" ? 1 : 0;
                const bu = b.status === "Paid" ? 1 : 0;
                if (au !== bu) return au - bu;
                const an =
                  a.customerId && typeof a.customerId === "object"
                    ? a.customerId.name || ""
                    : "";
                const bn =
                  b.customerId && typeof b.customerId === "object"
                    ? b.customerId.name || ""
                    : "";
                return an.localeCompare(bn);
              });

              return (
                <View
                  key={monthItem.month}
                  className="mb-4 overflow-hidden rounded-3xl border border-slate-100 bg-white"
                >
                  {/* Month summary */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      setExpandedMonth(isExpanded ? null : monthItem.month)
                    }
                    className="p-4"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-3">
                        <View className="flex-row flex-wrap items-center">
                          <Text className="mr-2 text-base font-extrabold text-slate-900">
                            {monthItem.month}
                          </Text>
                          {isCurrent && (
                            <View className="rounded-full bg-blue-100 px-2 py-0.5">
                              <Text className="text-[10px] font-bold text-blue-700">
                                Current
                              </Text>
                            </View>
                          )}
                          {fullyCollected && !isCurrent && (
                            <View className="rounded-full bg-green-100 px-2 py-0.5">
                              <Text className="text-[10px] font-bold text-green-700">
                                Fully collected
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className="mt-1 text-xs text-slate-500">
                          {monthItem.payments.length} payments · {paidCount} paid
                          {unpaidCount > 0 ? ` · ${unpaidCount} unpaid` : ""}
                        </Text>
                      </View>

                      <Text className="text-lg text-slate-400">
                        {isExpanded ? "⌃" : "⌄"}
                      </Text>
                    </View>

                    <View className="mt-4 flex-row items-end justify-between">
                      <View>
                        <Text className="text-xs text-slate-500">Collected</Text>
                        <Text className="mt-0.5 text-xl font-extrabold text-green-700">
                          {currency(monthItem.collected)}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-xs text-slate-500">Pending</Text>
                        <Text
                          className={`mt-0.5 text-xl font-extrabold ${
                            monthItem.pending > 0
                              ? "text-red-600"
                              : "text-slate-300"
                          }`}
                        >
                          {currency(monthItem.pending)}
                        </Text>
                      </View>
                    </View>

                    <View className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <View
                        style={{ width: `${rate}%` }}
                        className="h-full rounded-full bg-green-500"
                      />
                    </View>
                    <Text className="mt-1.5 text-[11px] font-semibold text-slate-500">
                      {rate}% collected
                    </Text>
                  </TouchableOpacity>

                  {/* Expanded records */}
                  {isExpanded && (
                    <View className="border-t border-slate-100 bg-slate-50 p-3">
                      <TouchableOpacity
                        onPress={() => openMonthInPayments(monthItem.month)}
                        activeOpacity={0.85}
                        className="mb-3 items-center rounded-xl bg-blue-600 py-3"
                      >
                        <Text className="text-sm font-bold text-white">
                          {isCurrent
                            ? "Open in Payments"
                            : "View in Payments (read-only)"}
                        </Text>
                      </TouchableOpacity>

                      {sortedPayments.length === 0 ? (
                        <Text className="py-4 text-center text-sm text-slate-500">
                          No payment records in this month.
                        </Text>
                      ) : (
                        sortedPayments.map((payment) => {
                          const customer = payment.customerId;
                          const hasCustomer =
                            !!customer && typeof customer === "object";

                          const customerName = hasCustomer
                            ? (customer as HistoryCustomer).name ||
                              "Unknown customer"
                            : "Customer details unavailable";

                          const customerPhone = hasCustomer
                            ? (customer as HistoryCustomer).phone || ""
                            : "";

                          const paid = payment.status === "Paid";

                          return (
                            <TouchableOpacity
                              key={payment._id}
                              activeOpacity={0.8}
                              disabled={!hasCustomer}
                              onPress={() =>
                                openCustomer(payment, monthItem.month)
                              }
                              className="mb-2 rounded-2xl border border-slate-100 bg-white p-3"
                            >
                              <View className="flex-row items-center">
                                <View
                                  className={`h-10 w-10 items-center justify-center rounded-full ${
                                    paid ? "bg-green-50" : "bg-red-50"
                                  }`}
                                >
                                  <Text
                                    className={`font-bold ${
                                      paid ? "text-green-700" : "text-red-600"
                                    }`}
                                  >
                                    {customerName.charAt(0).toUpperCase()}
                                  </Text>
                                </View>

                                <View className="ml-3 flex-1 pr-2">
                                  <Text
                                    className="font-bold text-slate-900"
                                    numberOfLines={1}
                                  >
                                    {customerName}
                                  </Text>
                                  <Text className="mt-0.5 text-xs text-slate-500">
                                    {customerPhone}
                                  </Text>
                                </View>

                                <View className="items-end">
                                  <Text className="font-extrabold text-slate-900">
                                    {currency(payment.amount)}
                                  </Text>
                                  <View
                                    className={`mt-1 rounded-full px-2.5 py-0.5 ${
                                      paid ? "bg-green-50" : "bg-red-50"
                                    }`}
                                  >
                                    <Text
                                      className={`text-[11px] font-bold ${
                                        paid ? "text-green-700" : "text-red-600"
                                      }`}
                                    >
                                      {payment.status}
                                    </Text>
                                  </View>
                                </View>
                              </View>

                              <View className="mt-3 flex-row items-center justify-between border-t border-slate-100 pt-2">
                                <Text className="text-xs text-slate-400">
                                  {paid
                                    ? `Paid on ${formatDate(payment.paidDate)}`
                                    : "Payment not received"}
                                </Text>

                                {(payment.missedDays || 0) > 0 && (
                                  <Text className="text-xs font-semibold text-red-600">
                                    {payment.missedDays} missed{" "}
                                    {payment.missedDays === 1 ? "day" : "days"}
                                  </Text>
                                )}
                              </View>
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