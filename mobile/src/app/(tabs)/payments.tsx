import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
};

type DailyStatus = {
  date: string;
  status: string;
};

type Payment = {
  _id: string;
  customerId: Customer | string | null;
  month: string;
  baseAmount?: number;
  amount: number;
  status: "Paid" | "Pending" | "Cancelled";
  customerName?: string;
  customerPhone?: string;
  customerDoorNumber?: string;
  customerVehicleName?: string;
  customerGender?: string;
  paidDate?: string;
  dailyStatus?: DailyStatus[];
  missedDays?: number;
};

type PaymentCustomer = Customer & {
  paymentId: string | null;
  amount: number;
  status: string;
  paidDate: string | null;
  dailyStatus: DailyStatus[];
  missedDays: number;
  readOnly: boolean;
};

type FilterKey = "ALL" | "PENDING" | "PAID";

/* ───────────────────────────── Constants ───────────────────────────── */

/* ───────────────────────────── Helpers ───────────────────────────── */

const formatCurrency = (amount: number) =>
  `₹${(Number(amount) || 0).toLocaleString("en-IN")}`;

const getToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (date: string) =>
  new Date(`${date.split("T")[0]}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });

const isUnpaid = (status: string) =>
  status === "Pending" || status === "No Record";

/* ───────────────────────────── Screen ───────────────────────────── */

export default function PaymentsScreen() {
  const [customers, setCustomers] = useState<PaymentCustomer[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [waTracker, setWaTracker] = useState<Record<string, boolean>>({});

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  /* ── Load payments for the selected month ── */
  const loadPayments = useCallback(async () => {
    try {
      setError("");
      const [savedServiceId, savedMonth] = await Promise.all([
        SecureStore.getItemAsync("autoflow_service_id"),
        SecureStore.getItemAsync("autoflow_selected_month"),
      ]);
      if (!savedServiceId) throw new Error("Please select a service first.");

      const now = new Date();
      const currentMonth = `${now.toLocaleString("en-US", { month: "long" })} ${now.getFullYear()}`;
      const month = savedMonth || currentMonth;
      const readOnly = month !== currentMonth;

      setSelectedMonth(month);
      setIsReadOnly(readOnly);

      // Fetch payments for selected month
      const paymentResponse = await api.get("/payments", {
        params: { month, serviceId: savedServiceId },
      });

      // Support both old array response and new API response:
      // { success: true, count: 29, payments: [...] }
      const responseData = paymentResponse.data;

      const allPayments: Payment[] = Array.isArray(responseData)
        ? responseData
        : Array.isArray(responseData?.payments)
          ? responseData.payments
          : [];

      // Exclude cancelled payments and payments without
      // an existing populated customer document.
      const validPayments = allPayments.filter((payment) => {
        const linkedCustomer =
          payment.customerId && typeof payment.customerId === "object"
            ? payment.customerId
            : null;

        return (
          (payment.status === "Paid" || payment.status === "Pending") &&
          Boolean(linkedCustomer?._id) &&
          linkedCustomer.isActive !== false
        );
      });

      const mapped: PaymentCustomer[] = validPayments.map((payment) => {
        const linked =
          payment.customerId && typeof payment.customerId === "object"
            ? payment.customerId
            : ({} as Partial<Customer>);

        const customerId =
          typeof payment.customerId === "object"
            ? payment.customerId?._id
            : payment.customerId;

        return {
          _id: String(customerId || payment._id),

          name: payment.customerName || linked.name || "Customer",
          phone: payment.customerPhone || linked.phone || "",

          vehicleName: payment.customerVehicleName || linked.vehicleName || "",

          doorNumber: payment.customerDoorNumber || linked.doorNumber || "",

          monthlyAmount: Number(payment.baseAmount ?? payment.amount ?? 0),

          gender: payment.customerGender || linked.gender || "",
          isActive: linked.isActive ?? true,

          serviceId: savedServiceId,
          paymentId: payment._id,

          amount: Number(payment.amount || 0),
          status: payment.status || "Pending",

          paidDate: payment.paidDate || null,
          dailyStatus: payment.dailyStatus || [],
          missedDays: Number(payment.missedDays || 0),

          readOnly,
        };
      });

      setCustomers(mapped);

      const getSafeTrackerKey = (month: string) => {
        const safeMonth = month.trim().replace(/[^a-zA-Z0-9._-]/g, "_");

        return `autoflow_waTracker_${safeMonth}`;
      };

      const trackerKey = getSafeTrackerKey(month);

      const tracker = await SecureStore.getItemAsync(trackerKey);

      let parsedTracker: Record<string, boolean> = {};

      if (tracker) {
        try {
          const parsed: unknown = JSON.parse(tracker);

          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            parsedTracker = parsed as Record<string, boolean>;
          }
        } catch {
          // Ignore corrupted local tracker data and start with an empty tracker.
          parsedTracker = {};
        }
      }

      setWaTracker(parsedTracker);
    } catch (err: any) {
      console.log("Payment loading error:", err.response?.data || err.message);
      setError(
        err.response?.data?.message || err.message || "Unable to load payments",
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const load = async () => {
        setLoading(true);
        await loadPayments();

        if (mounted) {
          setLoading(false);
          setRefreshing(false);
        }
      };

      load();

      return () => {
        mounted = false;
      };
    }, [loadPayments]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadPayments();
    } finally {
      setRefreshing(false);
    }
  };

  /* ── Payment + daily status actions ── */
  const runToggle = async (customer: PaymentCustomer) => {
    if (!customer.paymentId || customer.status === "Cancelled") return;

    const wasPending = isUnpaid(customer.status);

    try {
      setActionId(customer.paymentId);
      await api.patch(`/payment/${customer.paymentId}/toggle`);
      await loadPayments();
      showToast(
        wasPending
          ? `${customer.name} marked as paid`
          : `${customer.name} moved back to pending`,
      );
    } catch (err: any) {
      Alert.alert(
        "Couldn’t update payment",
        err.response?.data?.message || "Please try again.",
      );
    } finally {
      setActionId("");
    }
  };

  const togglePayment = (customer: PaymentCustomer) => {
    if (customer.readOnly) {
      Alert.alert("Past month", "Previous month payments are read-only.");
      return;
    }

    if (!customer.paymentId) {
      Alert.alert(
        "Month not activated",
        "Activate this billing month from Home before updating payments.",
      );
      return;
    }

    // Marking as paid is one tap. Reverting asks first, since it undoes a collected payment.
    if (customer.status === "Paid") {
      Alert.alert(
        `Move ${customer.name} back to pending?`,
        `${formatCurrency(customer.amount)} will no longer count as collected.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Move to pending",
            style: "destructive",
            onPress: () => runToggle(customer),
          },
        ],
      );
      return;
    }

    runToggle(customer);
  };

  const updateDailyStatus = async (
    customer: PaymentCustomer,
    status: "Cleaned" | "Missed" | "None",
  ) => {
    if (customer.status === "Cancelled") {
      Alert.alert("Cancelled payment", "This payment cannot be changed.");
      return;
    }

    if (customer.readOnly) {
      Alert.alert("Past month", "Previous month records are read-only.");
      return;
    }
    if (!customer.paymentId) {
      Alert.alert(
        "Month not activated",
        "Activate this month before updating daily service.",
      );
      return;
    }

    try {
      setActionId(customer.paymentId);

      await api.post("/daily-status", {
        paymentId: customer.paymentId,
        date: getToday(),
        status,
        month: selectedMonth,
      });

      await loadPayments();
    } catch (err: any) {
      Alert.alert(
        "Couldn’t update service",
        err.response?.data?.message || "Please try again.",
      );
    } finally {
      setActionId("");
    }
  };

  const getTodayStatus = (dailyStatus: DailyStatus[]) =>
    dailyStatus.find((item) => item.date?.split("T")[0] === getToday())
      ?.status || null;

  /* ── WhatsApp ── */

  const sendWhatsApp = async (
    customer: PaymentCustomer,
    type: "request" | "reminder" | "thankyou",
  ) => {
    try {
      if (!customer.phone?.trim()) {
        Alert.alert("Phone missing", "This customer has no phone number.");
        return;
      }

      const [savedServiceId, savedMonth] = await Promise.all([
        SecureStore.getItemAsync("autoflow_service_id"),
        SecureStore.getItemAsync("autoflow_selected_month"),
      ]);
      if (!savedServiceId) throw new Error("Selected service not found.");

      if (
        customer.serviceId &&
        String(customer.serviceId) !== String(savedServiceId)
      ) {
        throw new Error("Customer and selected service do not match.");
      }

      // Always fetch the latest server-side template/payment details for this service.
      const response = await api.get(`/whatsapp-template/${savedServiceId}`);
      const body = response.data?.data ?? response.data ?? {};
      const savedTemplates = body?.template ?? body;

      const templateKey =
        type === "request"
          ? "requestTemplate"
          : type === "reminder"
            ? "reminderTemplate"
            : "thankyouTemplate";
      const rawTemplate = savedTemplates?.[templateKey];

      if (
        type !== "thankyou" &&
        !savedTemplates?.upiId?.trim() &&
        !savedTemplates?.phone?.trim()
      ) {
        Alert.alert(
          "Payment details missing",
          "Open Settings, enter your UPI ID or GPay / PhonePe number, and tap Save changes before sending the bill.",
        );
        return;
      }

      if (typeof rawTemplate !== "string" || !rawTemplate.trim()) {
        Alert.alert(
          "Template missing",
          `${type} message template is empty. Open Settings and save it first.`,
        );
        return;
      }

      const honorific =
        customer.gender?.toLowerCase() === "female" ? " Ma'am" : " Sir";
      const missedDates = (customer.dailyStatus || [])
        .filter((item) => item.status?.toLowerCase() === "missed")
        .map((item) => formatDate(item.date))
        .join(", ");

      const monthForMessage = savedMonth || selectedMonth;
      const replacements: Record<string, string> = {
        name: `${customer.name || "Customer"}${honorific}`,
        service: customer.vehicleName || "our service",
        month: monthForMessage,
        missedDays: String(Number(customer.missedDays || 0)),
        missedDates: missedDates || "None",
        amount: Number(customer.amount || 0).toLocaleString("en-IN"),
        upi: savedTemplates.upiId?.trim() || "Not Provided",
        phone: savedTemplates.phone?.trim() || "Not Provided",
      };

      // Match keys case-insensitively (e.g. missedDays -> misseddays).
      const normalizedReplacements = Object.fromEntries(
        Object.entries(replacements).map(([key, value]) => [
          key.toLowerCase(),
          value,
        ]),
      ) as Record<string, string>;

      const message = rawTemplate.replace(
        /{{\s*(name|service|month|missedDays|missedDates|amount|upi|phone)\s*}}/gi,
        (_match, key: string) =>
          normalizedReplacements[key.toLowerCase()] ?? _match,
      );

      // Do not silently send a template with unresolved placeholders.
      const unresolved = message.match(/{{\s*[^{}]+\s*}}/g);
      if (unresolved?.length) {
        Alert.alert(
          "Template placeholders",
          `Please check these placeholders in Settings: ${unresolved.join(", ")}`,
        );
        return;
      }

      let cleanPhone = customer.phone.replace(/\D/g, "");
      if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
      if (!/^\d{10,15}$/.test(cleanPhone)) {
        Alert.alert(
          "Invalid phone number",
          "Please check the customer's phone number.",
        );
        return;
      }

      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      await Linking.openURL(url);

      // This tracker means WhatsApp was opened with a prefilled message; it does NOT
      // confirm that the user pressed Send inside WhatsApp.
      const trackerKey = `${monthForMessage}-${customer._id}-${type}`;
      const updatedTracker = { ...waTracker, [trackerKey]: true };
      setWaTracker(updatedTracker);
      const safeMonth = monthForMessage.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
      await SecureStore.setItemAsync(
        `autoflow_waTracker_${safeMonth}`,
        JSON.stringify(updatedTracker),
      );
    } catch (err: any) {
      console.log("WHATSAPP OPEN ERROR:", err.response?.data || err.message);
      Alert.alert(
        "WhatsApp unavailable",
        err.response?.data?.message || err.message || "Please try again.",
      );
    }
  };

  /* ── Derived data ── */
  const stats = useMemo(() => {
    // Only valid, non-cancelled payment statuses contribute to totals.
    const validPayments = customers.filter(
      (customer) => customer.status === "Paid" || customer.status === "Pending",
    );

    const expected = validPayments.reduce(
      (sum, customer) => sum + (Number(customer.amount) || 0),
      0,
    );

    const collected = validPayments.reduce(
      (sum, customer) =>
        customer.status === "Paid" ? sum + (Number(customer.amount) || 0) : sum,
      0,
    );

    const pending = validPayments.reduce(
      (sum, customer) =>
        customer.status === "Pending"
          ? sum + (Number(customer.amount) || 0)
          : sum,
      0,
    );

    const paidCount = validPayments.filter(
      (customer) => customer.status === "Paid",
    ).length;

    const pendingCount = validPayments.filter(
      (customer) => customer.status === "Pending",
    ).length;

    return {
      expected,
      collected,
      pending,
      paidCount,
      pendingCount,
      rate:
        expected > 0
          ? Math.min(100, Math.round((collected / expected) * 100))
          : 0,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (
      customers
        .filter((customer) => {
          const matchesSearch =
            !term ||
            customer.name?.toLowerCase().includes(term) ||
            customer.phone?.toLowerCase().includes(term) ||
            customer.vehicleName?.toLowerCase().includes(term) ||
            customer.doorNumber?.toLowerCase().includes(term);

          const matchesStatus =
            filter === "ALL" ||
            (filter === "PAID" && customer.status === "Paid") ||
            (filter === "PENDING" && isUnpaid(customer.status));

          return matchesSearch && matchesStatus;
        })
        // Unpaid customers first so the work left to do is always at the top.
        .sort((a, b) => {
          const au = isUnpaid(a.status) ? 0 : 1;
          const bu = isUnpaid(b.status) ? 0 : 1;
          if (au !== bu) return au - bu;
          return a.name.localeCompare(b.name);
        })
    );
  }, [customers, search, filter]);

  const filterOptions: { key: FilterKey; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: customers.length },
    { key: "PENDING", label: "Pending", count: stats.pendingCount },
    { key: "PAID", label: "Paid", count: stats.paidCount },
  ];

  const openCustomer = (customer: PaymentCustomer) =>
    router.push({
      pathname: "/customer/[id]",
      params: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        vehicleName: customer.vehicleName || "",
        doorNumber: customer.doorNumber || "",
        monthlyAmount: String(customer.monthlyAmount || 0),
        gender: customer.gender || "",
        isActive: String(customer.isActive ?? true),
        isHistorical: String(customer.readOnly),
        billingAmount: String(customer.amount || 0),
        selectedMonth,
      },
    });

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

  if (error && customers.length === 0) {
    return (
      <AutoFlowFeedback
        mode="error"
        title="Unable to load payments"
        message={error}
        retryLabel="Try again"
        onRetry={() => {
          setLoading(true);
          loadPayments().finally(() => setLoading(false));
        }}
      />
    );
  }

  /* ───────────────────────── Month not activated ───────────────────────── */

  const monthNotActivated = customers.length === 0 && !isReadOnly;

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
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-2xl font-extrabold text-slate-900">
                Payments
              </Text>
              <View className="mt-1 flex-row items-center">
                <View
                  className={`mr-2 rounded-full px-2.5 py-0.5 ${
                    isReadOnly ? "bg-amber-100" : "bg-blue-100"
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      isReadOnly ? "text-amber-700" : "text-blue-700"
                    }`}
                  >
                    {selectedMonth}
                  </Text>
                </View>
                <Text className="text-xs text-slate-500">
                  {isReadOnly ? "Read-only" : "Current month"}
                </Text>
              </View>
            </View>
          </View>

          {/* Past-month notice */}
          {isReadOnly && (
            <View className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <Text className="text-sm font-bold text-amber-800">
                You’re viewing a past month
              </Text>
              <Text className="mt-1 text-xs leading-4 text-amber-700">
                Payments and daily service for {selectedMonth} can’t be changed.
                You can still send WhatsApp messages.
              </Text>
            </View>
          )}

          {/* Month not activated */}
          {monthNotActivated ? (
            <View className="mt-6 items-center rounded-3xl border border-amber-200 bg-white p-7">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                <Text className="text-3xl">🗓️</Text>
              </View>
              <Text className="mt-4 text-center text-lg font-extrabold text-slate-900">
                {selectedMonth} hasn’t started
              </Text>
              <Text className="mt-1 text-center text-sm leading-5 text-slate-500">
                Activate the month from Home to create a pending payment for
                each customer. They’ll appear here for collection.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)")}
                activeOpacity={0.85}
                className="mt-5 w-full items-center rounded-2xl bg-blue-600 py-4"
              >
                <Text className="font-bold text-white">Go to Home</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Collection summary */}
              <View className="mt-5 overflow-hidden rounded-3xl bg-blue-600 p-5">
                <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500 opacity-60" />
                <View className="absolute -bottom-12 right-10 h-32 w-32 rounded-full bg-blue-700 opacity-50" />

                <Text className="text-sm font-semibold text-blue-100">
                  Collected so far
                </Text>
                <Text className="mt-1 text-4xl font-extrabold text-white">
                  {formatCurrency(stats.collected)}
                </Text>
                <Text className="mt-1 text-xs text-blue-100">
                  of {formatCurrency(stats.expected)} expected
                </Text>

                <View className="mt-4 h-2.5 overflow-hidden rounded-full bg-blue-400/50">
                  <View
                    style={{ width: `${stats.rate}%` }}
                    className="h-full rounded-full bg-white"
                  />
                </View>

                <View className="mt-2 flex-row justify-between">
                  <Text className="text-xs font-bold text-white">
                    {stats.rate}% collected
                  </Text>
                  <Text className="text-xs text-blue-100">
                    {formatCurrency(stats.pending)} due
                  </Text>
                </View>
              </View>

              {/* Search */}
              <View className="mt-5 flex-row items-center rounded-2xl border border-slate-200 bg-white px-4">
                <Text className="mr-2 text-lg text-slate-400">⌕</Text>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search name, phone or vehicle"
                  placeholderTextColor="#94A3B8"
                  className="h-12 flex-1 text-sm text-slate-900"
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch("")} hitSlop={10}>
                    <Text className="text-base text-slate-400">✕</Text>
                  </Pressable>
                )}
              </View>

              {/* Filters */}
              <View className="mt-3 flex-row gap-2">
                {filterOptions.map((option) => {
                  const selected = filter === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      onPress={() => setFilter(option.key)}
                      className={`flex-row items-center rounded-full px-4 py-2 ${
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
                          {option.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="mb-3 mt-5 text-xs font-semibold text-slate-500">
                Showing {filteredCustomers.length} of {customers.length}
              </Text>

              {/* List */}
              {filteredCustomers.length === 0 ? (
                <View className="items-center rounded-3xl bg-white p-7">
                  <Text className="text-3xl">
                    {filter === "PENDING" && !search ? "🎉" : "💳"}
                  </Text>
                  <Text className="mt-3 font-bold text-slate-800">
                    {filter === "PENDING" && !search
                      ? "Everyone has paid"
                      : customers.length === 0
                        ? "No billing records"
                        : "No matches"}
                  </Text>
                  <Text className="mt-1 text-center text-xs text-slate-400">
                    {customers.length === 0
                      ? `${selectedMonth} has no payment records.`
                      : "Try a different search or filter."}
                  </Text>
                  {customers.length > 0 && (search || filter !== "ALL") && (
                    <TouchableOpacity
                      onPress={() => {
                        setSearch("");
                        setFilter("ALL");
                      }}
                      className="mt-4 rounded-xl bg-slate-200 px-5 py-3"
                    >
                      <Text className="font-semibold text-slate-700">
                        Clear filters
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                filteredCustomers.map((customer) => {
                  const todayStatus = getTodayStatus(customer.dailyStatus);
                  const missedDates = customer.dailyStatus
                    .filter((item) => item.status === "Missed")
                    .map((item) => formatDate(item.date));

                  const isBusy = actionId === customer.paymentId;
                  const paid = customer.status === "Paid";
                  const unpaid = isUnpaid(customer.status);

                  const statusBg = paid
                    ? "bg-green-50"
                    : customer.status === "Pending"
                      ? "bg-red-50"
                      : "bg-slate-100";
                  const statusText = paid
                    ? "text-green-700"
                    : customer.status === "Pending"
                      ? "text-red-600"
                      : "text-slate-500";

                  const tracked = (type: string) =>
                    waTracker[`${selectedMonth}-${customer._id}-${type}`];

                  return (
                    <View
                      key={customer._id}
                      className="mb-4 overflow-hidden rounded-3xl border border-slate-100 bg-white"
                    >
                      {/* Customer + amount */}
                      <Pressable
                        onPress={() => openCustomer(customer)}
                        android_ripple={{ color: "#E2E8F0" }}
                        className="p-4"
                      >
                        <View className="flex-row items-center">
                          <View
                            className={`h-12 w-12 items-center justify-center rounded-full ${
                              paid ? "bg-green-50" : "bg-blue-50"
                            }`}
                          >
                            <Text
                              className={`text-lg font-bold ${
                                paid ? "text-green-700" : "text-blue-700"
                              }`}
                            >
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
                              <Text
                                className="mt-0.5 text-xs text-slate-400"
                                numberOfLines={1}
                              >
                                {customer.vehicleName}
                              </Text>
                            ) : null}
                          </View>

                          <View className="items-end">
                            <Text className="text-lg font-extrabold text-slate-900">
                              {formatCurrency(customer.amount)}
                            </Text>
                            <View
                              className={`mt-1 rounded-full px-2.5 py-0.5 ${statusBg}`}
                            >
                              <Text
                                className={`text-[11px] font-bold ${statusText}`}
                              >
                                {customer.status === "No Record"
                                  ? "Not started"
                                  : customer.status}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </Pressable>

                      {/* Daily service */}
                      <View className="mx-4 rounded-2xl bg-slate-50 p-3">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-sm font-bold text-slate-800">
                            {customer.readOnly
                              ? "Service summary"
                              : "Today’s service"}
                          </Text>
                          {customer.missedDays > 0 && (
                            <View className="rounded-full bg-red-50 px-2.5 py-0.5">
                              <Text className="text-[11px] font-bold text-red-600">
                                {customer.missedDays} missed
                              </Text>
                            </View>
                          )}
                        </View>

                        {!customer.readOnly &&
                          (todayStatus ? (
                            <View className="mt-3 flex-row items-center justify-between">
                              <Text
                                className={`text-sm font-bold ${
                                  todayStatus === "Cleaned"
                                    ? "text-green-700"
                                    : "text-red-600"
                                }`}
                              >
                                {todayStatus === "Cleaned"
                                  ? "✓ Cleaned today"
                                  : "✕ Missed today"}
                              </Text>

                              <TouchableOpacity
                                disabled={isBusy}
                                onPress={() =>
                                  updateDailyStatus(customer, "None")
                                }
                                className="rounded-lg bg-white px-4 py-2"
                              >
                                <Text className="text-xs font-bold text-slate-600">
                                  Undo
                                </Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View className="mt-3 flex-row gap-2">
                              <TouchableOpacity
                                disabled={!customer.paymentId || isBusy}
                                onPress={() =>
                                  updateDailyStatus(customer, "Cleaned")
                                }
                                className="flex-1 items-center rounded-xl border border-green-200 bg-white py-3"
                              >
                                <Text className="text-xs font-bold text-green-700">
                                  ✨ Cleaned
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                disabled={!customer.paymentId || isBusy}
                                onPress={() =>
                                  updateDailyStatus(customer, "Missed")
                                }
                                className="flex-1 items-center rounded-xl border border-red-200 bg-white py-3"
                              >
                                <Text className="text-xs font-bold text-red-600">
                                  ✕ Missed
                                </Text>
                              </TouchableOpacity>
                            </View>
                          ))}

                        {customer.missedDays > 0 ? (
                          <Text className="mt-2 text-xs text-slate-500">
                            Missed on {missedDates.join(", ")}
                          </Text>
                        ) : customer.readOnly ? (
                          <Text className="mt-2 text-xs text-slate-500">
                            No missed days
                          </Text>
                        ) : null}
                      </View>

                      {/* Payment action */}
                      {!customer.readOnly && customer.paymentId ? (
                        <TouchableOpacity
                          disabled={isBusy}
                          onPress={() => togglePayment(customer)}
                          activeOpacity={0.85}
                          className={`mx-4 mt-3 items-center rounded-2xl py-3.5 ${
                            unpaid ? "bg-green-600" : "bg-slate-100"
                          }`}
                        >
                          {isBusy ? (
                            <ActivityIndicator
                              color={unpaid ? "#FFFFFF" : "#475569"}
                            />
                          ) : (
                            <Text
                              className={`font-bold ${
                                unpaid ? "text-white" : "text-slate-600"
                              }`}
                            >
                              {unpaid
                                ? `Mark ${formatCurrency(customer.amount)} as paid`
                                : "Move back to pending"}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ) : null}

                      {/* WhatsApp */}
                      <View className="mx-4 mb-4 mt-3 flex-row gap-2">
                        {paid ? (
                          <TouchableOpacity
                            onPress={() => sendWhatsApp(customer, "thankyou")}
                            className={`flex-1 items-center rounded-xl py-3 ${
                              tracked("thankyou") ? "bg-teal-100" : "bg-teal-50"
                            }`}
                          >
                            <Text className="text-xs font-bold text-teal-700">
                              {tracked("thankyou")
                                ? "Thanks sent ✓"
                                : "Send thanks"}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <>
                            <TouchableOpacity
                              onPress={() => sendWhatsApp(customer, "request")}
                              className={`flex-1 items-center rounded-xl py-3 ${
                                tracked("request")
                                  ? "bg-blue-100"
                                  : "bg-blue-50"
                              }`}
                            >
                              <Text className="text-xs font-bold text-blue-700">
                                {tracked("request")
                                  ? "Bill sent ✓"
                                  : "Send bill"}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => sendWhatsApp(customer, "reminder")}
                              className={`flex-1 items-center rounded-xl py-3 ${
                                tracked("reminder") ? "bg-red-100" : "bg-red-50"
                              }`}
                            >
                              <Text className="text-xs font-bold text-red-600">
                                {tracked("reminder")
                                  ? "Reminded ✓"
                                  : "Send reminder"}
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}
        </View>
      </ScrollView>

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
    </SafeAreaView>
  );
}
