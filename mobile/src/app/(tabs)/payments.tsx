import { useCallback, useState } from "react";
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
  customerId: Customer | string;
  month: string;
  amount: number;
  status: "Paid" | "Pending";
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
};

type WhatsAppTemplates = {
  requestTemplate: string;
  reminderTemplate: string;
  thankyouTemplate: string;
  upiId: string;
  phone: string;
};

const DEFAULT_TEMPLATES: WhatsAppTemplates = {
  requestTemplate:
    "Hello {{name}},\n\n📅 Billing Month: {{month}}\n\n🚗 Service Report:\nMissed Days: {{missedDays}}\nDates Missed: {{missedDates}}\n\n✅ Final Amount Due: ₹{{amount}}\n\n💳 Payment Options:\n\n🔹 UPI ID:\n{{upi}}\n\n🔹 GPay / PhonePe:\n{{phone}}\n\nThank you! 🚗✨",

  reminderTemplate:
    "Hello {{name}},\n\nThis is a gentle reminder that your payment for {{month}} is still pending.\n\n💰 Final Amount Due: ₹{{amount}}\n\n💳 Payment Options:\n\n🔹 UPI ID:\n{{upi}}\n\n🔹 GPay / PhonePe:\n{{phone}}\n\nThank you! 🚗",

  thankyouTemplate:
    "Hello {{name}},\n\nWe have received your payment of ₹{{amount}} for {{month}}.\n\nThank you for choosing us! 🚗✨",

  upiId: "",
  phone: "",
};

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

export default function PaymentsScreen() {
  const [customers, setCustomers] = useState<PaymentCustomer[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [serviceId, setServiceId] = useState("");

  const [templates, setTemplates] =
    useState<WhatsAppTemplates>(DEFAULT_TEMPLATES);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PAID" | "PENDING">("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");

  const [waTracker, setWaTracker] = useState<Record<string, boolean>>({});

  const loadPayments = useCallback(async () => {
    try {
      setError("");

      const [savedServiceId, savedMonth] = await Promise.all([
        SecureStore.getItemAsync("autoflow_service_id"),
        SecureStore.getItemAsync("autoflow_selected_month"),
      ]);

      if (!savedServiceId) {
        throw new Error("Please select a service first.");
      }

      const month =
        savedMonth ||
        `${new Date().toLocaleString("en-US", {
          month: "long",
        })} ${new Date().getFullYear()}`;

      setServiceId(savedServiceId);
      setSelectedMonth(month);

      const [customerResponse, paymentResponse] = await Promise.all([
        api.get("/getcustomer", {
          params: { serviceId: savedServiceId },
        }),
        api.get("/payments", {
          params: { month },
        }),
      ]);

      const allCustomers: Customer[] = Array.isArray(customerResponse.data)
        ? customerResponse.data
        : [];

      const allPayments: Payment[] = Array.isArray(paymentResponse.data)
        ? paymentResponse.data
        : [];

      // Backend currently returns tenant-wide payments.
      // Match populated customer serviceId to selected workspace.
      const servicePayments = allPayments.filter((payment) => {
        const paymentCustomer = payment.customerId;

        if (!paymentCustomer || typeof paymentCustomer !== "object") {
          return false;
        }

        return String(paymentCustomer.serviceId) === String(savedServiceId);
      });

      const paymentMap = new Map<string, Payment>();

      servicePayments.forEach((payment) => {
        const customerId =
          typeof payment.customerId === "object"
            ? payment.customerId._id
            : payment.customerId;

        if (customerId) {
          paymentMap.set(String(customerId), payment);
        }
      });

      const monthStarted = servicePayments.length > 0;

      const merged: PaymentCustomer[] = allCustomers
        .filter(
          (customer) => String(customer.serviceId) === String(savedServiceId),
        )
        .map((customer) => {
          const payment = paymentMap.get(customer._id);

          if (payment) {
            return {
              ...customer,
              paymentId: payment._id,
              amount: Number(payment.amount) || 0,
              status: payment.status,
              paidDate: payment.paidDate || null,
              dailyStatus: payment.dailyStatus || [],
              missedDays: Number(payment.missedDays) || 0,
            };
          }

          return {
            ...customer,
            paymentId: null,
            amount: Number(customer.monthlyAmount) || 0,
            status: "No Record",
            paidDate: null,
            dailyStatus: [],
            missedDays: 0,
          };
        })
        .filter((customer) =>
          monthStarted ? customer.paymentId !== null : true,
        );

      setCustomers(merged);

      // Load service-specific WhatsApp templates.
      try {
        const templateResponse = await api.get(
          `/whatsapp-template/${savedServiceId}`,
        );

        const saved = templateResponse.data;

        if (saved) {
          setTemplates({
            requestTemplate:
              saved.requestTemplate || DEFAULT_TEMPLATES.requestTemplate,
            reminderTemplate:
              saved.reminderTemplate || DEFAULT_TEMPLATES.reminderTemplate,
            thankyouTemplate:
              saved.thankyouTemplate || DEFAULT_TEMPLATES.thankyouTemplate,
            upiId: saved.upiId || "",
            phone: saved.phone || "",
          });
        } else {
          setTemplates(DEFAULT_TEMPLATES);
        }
      } catch (templateError) {
        console.log("Template loading failed:", templateError);
        setTemplates(DEFAULT_TEMPLATES);
      }

      // Restore WhatsApp sent indicators for selected month.
      const trackerKey = `autoflow_waTracker_${month}`;
      const tracker = await SecureStore.getItemAsync(trackerKey);

      setWaTracker(tracker ? JSON.parse(tracker) : {});
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
    await loadPayments();
    setRefreshing(false);
  };

  const togglePayment = async (customer: PaymentCustomer) => {
    if (!customer.paymentId) {
      Alert.alert(
        "Payment Not Available",
        "Activate this billing month from Home before updating payment.",
      );
      return;
    }

    const nextStatus = customer.status === "Pending" ? "Paid" : "Pending";

    Alert.alert(
      nextStatus === "Paid" ? "Confirm Payment" : "Revert Payment",
      nextStatus === "Paid"
        ? `Mark ${customer.name}'s payment as Paid?`
        : `Change ${customer.name}'s payment back to Pending?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setActionId(customer.paymentId!);

              await api.patch(`/payment/${customer.paymentId}/toggle`, {});

              await loadPayments();
            } catch (err: any) {
              Alert.alert(
                "Update Failed",
                err.response?.data?.message ||
                  "Unable to update payment status.",
              );
            } finally {
              setActionId("");
            }
          },
        },
      ],
    );
  };

  const updateDailyStatus = async (
    customer: PaymentCustomer,
    status: "Cleaned" | "Missed" | "None",
  ) => {
    if (!customer.paymentId) {
      Alert.alert(
        "No Payment Record",
        "Activate this month before updating daily status.",
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
        "Update Failed",
        err.response?.data?.message || "Unable to update daily status.",
      );
    } finally {
      setActionId("");
    }
  };

  const getTodayStatus = (dailyStatus: DailyStatus[]) => {
    return (
      dailyStatus.find((item) => item.date?.split("T")[0] === getToday())
        ?.status || null
    );
  };

  const sendWhatsApp = async (
    customer: PaymentCustomer,
    type: "request" | "reminder" | "thankyou",
  ) => {
    if (!customer.phone) {
      Alert.alert("Phone Missing", "This customer has no phone number.");
      return;
    }

    const rawTemplate =
      type === "request"
        ? templates.requestTemplate
        : type === "reminder"
          ? templates.reminderTemplate
          : templates.thankyouTemplate;

    const honorific =
      customer.gender?.toLowerCase() === "female" ? " Ma'am" : " Sir";

    const missedDates = customer.dailyStatus
      .filter((item) => item.status === "Missed")
      .map((item) => formatDate(item.date))
      .join(", ");

    const message = rawTemplate
      .replace(/{{name}}/g, `${customer.name}${honorific}`)
      .replace(/{{month}}/g, selectedMonth)
      .replace(/{{missedDays}}/g, String(customer.missedDays))
      .replace(/{{missedDates}}/g, missedDates || "None")
      .replace(
        /{{amount}}/g,
        Number(customer.amount || customer.monthlyAmount).toLocaleString(
          "en-IN",
        ),
      )
      .replace(/{{upi}}/g, templates.upiId || "Not Provided")
      .replace(/{{phone}}/g, templates.phone || "Not Provided");

    let cleanPhone = customer.phone.replace(/\D/g, "");

    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    if (cleanPhone.length < 10) {
      Alert.alert("Invalid Phone", "Please check the customer's phone number.");
      return;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    try {
      await Linking.openURL(url);

      const trackerKey = `${selectedMonth}-${customer._id}-${type}`;
      const updatedTracker = {
        ...waTracker,
        [trackerKey]: true,
      };

      setWaTracker(updatedTracker);

      await SecureStore.setItemAsync(
        `autoflow_waTracker_${selectedMonth}`,
        JSON.stringify(updatedTracker),
      );
    } catch (err) {
      Alert.alert(
        "WhatsApp Unavailable",
        "Unable to open WhatsApp on this device.",
      );
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const term = search.trim().toLowerCase();

    const matchesSearch =
      customer.name?.toLowerCase().includes(term) ||
      customer.phone?.toLowerCase().includes(term) ||
      customer.vehicleName?.toLowerCase().includes(term) ||
      customer.doorNumber?.toLowerCase().includes(term);

    const matchesStatus =
      filter === "ALL" ||
      (filter === "PAID" && customer.status === "Paid") ||
      (filter === "PENDING" &&
        (customer.status === "Pending" || customer.status === "No Record"));

    return matchesSearch && matchesStatus;
  });

  const expected = customers.reduce(
    (sum, customer) => sum + customer.amount,
    0,
  );

  const collected = customers.reduce(
    (sum, customer) =>
      customer.status === "Paid" ? sum + customer.amount : sum,
    0,
  );

  const pending = customers.reduce(
    (sum, customer) =>
      customer.status === "Pending" || customer.status === "No Record"
        ? sum + customer.amount
        : sum,
    0,
  );

  const paidCount = customers.filter(
    (customer) => customer.status === "Paid",
  ).length;

  const pendingCount = customers.length - paidCount;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-3 text-sm text-slate-500">
          Loading payment collection...
        </Text>
      </SafeAreaView>
    );
  }

  if (error && customers.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-50 px-5">
        <View className="w-full rounded-2xl bg-white p-6">
          <Text className="text-center text-xl font-bold text-slate-900">
            Payments unavailable
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
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-extrabold text-slate-900">
                Payment Collection
              </Text>
              <Text className="mt-1 text-sm text-slate-500">
                {selectedMonth} · {customers.length} customers
              </Text>
            </View>

            <View className="rounded-xl bg-blue-50 px-3 py-2">
              <Text className="text-xs font-bold text-blue-700">
                {selectedMonth.split(" ")[0]}
              </Text>
            </View>
          </View>

          {/* Summary */}
          <View className="mt-6 rounded-2xl bg-blue-600 p-5">
            <Text className="text-xs font-semibold text-blue-100">
              EXPECTED COLLECTION
            </Text>
            <Text className="mt-2 text-3xl font-extrabold text-white">
              {formatCurrency(expected)}
            </Text>
            <View className="mt-4 flex-row justify-between border-t border-blue-400 pt-4">
              <View>
                <Text className="text-xs text-blue-100">Collected</Text>
                <Text className="mt-1 font-bold text-white">
                  {formatCurrency(collected)}
                </Text>
              </View>
              <View>
                <Text className="text-xs text-blue-100">Pending</Text>
                <Text className="mt-1 font-bold text-white">
                  {formatCurrency(pending)}
                </Text>
              </View>
            </View>
          </View>

          {/* Counts */}
          <View className="mt-3 flex-row gap-3">
            <View className="flex-1 rounded-2xl border border-green-100 bg-green-50 p-4">
              <Text className="text-xs font-bold text-green-700">PAID</Text>
              <Text className="mt-2 text-2xl font-extrabold text-green-700">
                {paidCount}
              </Text>
            </View>
            <View className="flex-1 rounded-2xl border border-red-100 bg-red-50 p-4">
              <Text className="text-xs font-bold text-red-600">PENDING</Text>
              <Text className="mt-2 text-2xl font-extrabold text-red-600">
                {pendingCount}
              </Text>
            </View>
          </View>

          {/* Search */}
          <View className="mt-6 rounded-xl border border-slate-200 bg-white px-4">
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search customer or vehicle..."
              placeholderTextColor="#94A3B8"
              className="py-4 text-sm text-slate-900"
            />
          </View>

          {/* Filters */}
          <View className="mt-4 flex-row gap-2">
            {(["ALL", "PAID", "PENDING"] as const).map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setFilter(item)}
                className={`flex-1 items-center rounded-xl py-3 ${
                  filter === item ? "bg-blue-600" : "bg-white"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    filter === item ? "text-white" : "text-slate-600"
                  }`}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Customer list */}
          <View className="mb-3 mt-7 flex-row items-center justify-between">
            <Text className="text-lg font-extrabold text-slate-900">
              Customers
            </Text>
            <Text className="text-xs text-slate-500">
              {filteredCustomers.length} records
            </Text>
          </View>

          {filteredCustomers.length === 0 ? (
            <View className="items-center rounded-2xl bg-white p-7">
              <Text className="text-3xl">💳</Text>
              <Text className="mt-3 font-bold text-slate-800">
                No payments found
              </Text>
              <Text className="mt-1 text-center text-xs text-slate-400">
                Try changing your search or filter.
              </Text>
            </View>
          ) : (
            filteredCustomers.map((customer) => {
              const todayStatus = getTodayStatus(customer.dailyStatus);

              const missedDates = customer.dailyStatus
                .filter((item) => item.status === "Missed")
                .map((item) => formatDate(item.date));

              const isBusy = actionId === customer.paymentId;

              return (
                <View
                  key={customer._id}
                  className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                >
                  {/* Customer info */}
                  <Pressable
                    onPress={() =>
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
                        },
                      })
                    }
                    className="flex-row items-center"
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

                    <Text className="text-slate-400">›</Text>
                  </Pressable>

                  {/* Amount and status */}
                  <View className="mt-4 flex-row items-center justify-between border-t border-slate-100 pt-3">
                    <View>
                      <Text className="text-xs text-slate-400">
                        Final Amount
                      </Text>
                      <Text className="mt-1 text-xl font-extrabold text-slate-900">
                        {formatCurrency(customer.amount)}
                      </Text>
                    </View>

                    <View
                      className={`rounded-full px-3 py-2 ${
                        customer.status === "Paid"
                          ? "bg-green-50"
                          : customer.status === "Pending"
                            ? "bg-red-50"
                            : "bg-amber-50"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          customer.status === "Paid"
                            ? "text-green-700"
                            : customer.status === "Pending"
                              ? "text-red-600"
                              : "text-amber-700"
                        }`}
                      >
                        {customer.status === "No Record"
                          ? "Not Started"
                          : customer.status}
                      </Text>
                    </View>
                  </View>

                  {/* Daily status */}
                  <View className="mt-4 rounded-xl bg-slate-50 p-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-bold text-slate-800">
                        Daily Service
                      </Text>
                      <Text className="text-xs text-slate-500">Today</Text>
                    </View>

                    {todayStatus ? (
                      <View className="mt-3 flex-row items-center justify-between">
                        <Text
                          className={`text-sm font-bold ${
                            todayStatus === "Cleaned"
                              ? "text-green-700"
                              : "text-red-600"
                          }`}
                        >
                          {todayStatus} Today
                        </Text>

                        <TouchableOpacity
                          disabled={isBusy}
                          onPress={() => updateDailyStatus(customer, "None")}
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
                          onPress={() => updateDailyStatus(customer, "Cleaned")}
                          className="flex-1 items-center rounded-lg border border-green-200 bg-white py-3"
                        >
                          <Text className="text-xs font-bold text-green-700">
                            ✨ Clean
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          disabled={!customer.paymentId || isBusy}
                          onPress={() => updateDailyStatus(customer, "Missed")}
                          className="flex-1 items-center rounded-lg border border-red-200 bg-white py-3"
                        >
                          <Text className="text-xs font-bold text-red-600">
                            ✕ Miss
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {customer.missedDays > 0 && (
                      <View className="mt-3">
                        <Text className="text-xs font-bold text-red-600">
                          Missed: {customer.missedDays} days
                        </Text>
                        <Text className="mt-1 text-xs text-slate-500">
                          {missedDates.join(", ")}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Payment action */}
                  {customer.paymentId ? (
                    <TouchableOpacity
                      disabled={isBusy}
                      onPress={() => togglePayment(customer)}
                      className={`mt-3 items-center rounded-xl py-3.5 ${
                        customer.status === "Pending"
                          ? "bg-green-600"
                          : "bg-amber-100"
                      }`}
                    >
                      {isBusy ? (
                        <ActivityIndicator
                          color={
                            customer.status === "Pending"
                              ? "#FFFFFF"
                              : "#92400E"
                          }
                        />
                      ) : (
                        <Text
                          className={`font-bold ${
                            customer.status === "Pending"
                              ? "text-white"
                              : "text-amber-800"
                          }`}
                        >
                          {customer.status === "Pending"
                            ? "✓ Mark as Paid"
                            : "↩ Revert to Pending"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View className="mt-3 rounded-xl bg-amber-50 p-3">
                      <Text className="text-center text-xs font-semibold text-amber-700">
                        Activate {selectedMonth} from Home to enable payment
                        updates.
                      </Text>
                    </View>
                  )}

                  {/* WhatsApp actions */}
                  <View className="mt-3 flex-row gap-2">
                    {customer.status === "Paid" ? (
                      <TouchableOpacity
                        onPress={() => sendWhatsApp(customer, "thankyou")}
                        className={`flex-1 items-center rounded-xl py-3 ${
                          waTracker[`${selectedMonth}-${customer._id}-thankyou`]
                            ? "bg-teal-100"
                            : "bg-teal-50"
                        }`}
                      >
                        <Text className="text-xs font-bold text-teal-700">
                          {waTracker[
                            `${selectedMonth}-${customer._id}-thankyou`
                          ]
                            ? "Thanks Sent ✓"
                            : "Send Thanks"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity
                          onPress={() => sendWhatsApp(customer, "request")}
                          className={`flex-1 items-center rounded-xl py-3 ${
                            waTracker[
                              `${selectedMonth}-${customer._id}-request`
                            ]
                              ? "bg-blue-100"
                              : "bg-blue-50"
                          }`}
                        >
                          <Text className="text-xs font-bold text-blue-700">
                            {waTracker[
                              `${selectedMonth}-${customer._id}-request`
                            ]
                              ? "Bill Sent ✓"
                              : "Send Bill"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => sendWhatsApp(customer, "reminder")}
                          className={`flex-1 items-center rounded-xl py-3 ${
                            waTracker[
                              `${selectedMonth}-${customer._id}-reminder`
                            ]
                              ? "bg-red-100"
                              : "bg-red-50"
                          }`}
                        >
                          <Text className="text-xs font-bold text-red-600">
                            {waTracker[
                              `${selectedMonth}-${customer._id}-reminder`
                            ]
                              ? "Reminded ✓"
                              : "Reminder"}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
