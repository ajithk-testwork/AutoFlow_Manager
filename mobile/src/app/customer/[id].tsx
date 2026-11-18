import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { api } from "../../api/client";
import { SafeAreaView } from "react-native-safe-area-context";

type PaymentRecord = {
  _id?: string;
  month?: string;
  amount?: number;
  status?: string;
  dailyStatus?: string;
  missedDays?: number;
  paidDate?: string;
};

export default function CustomerOverviewScreen() {
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    phone?: string;
    vehicleName?: string;
    doorNumber?: string;
    monthlyAmount?: string;
    gender?: string;
    isActive?: string;
  }>();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

 
const customer = {
  id: params.id,
  name: params.name || "Customer",
  phone: params.phone || "",
  vehicleName: params.vehicleName || "",
  doorNumber: params.doorNumber || "",
  monthlyAmount: Number(params.monthlyAmount || 0),
  gender: params.gender || "",
  isActive: params.isActive === "true",
  isHistorical: params.isHistorical === "true",
  billingAmount: Number(
    params.billingAmount || params.monthlyAmount || 0
  ),
  selectedMonth: params.selectedMonth || "",
};


  const loadHistory = useCallback(async () => {
    try {
      setError("");

      const response = await api.get(`/${customer.id}/history`);

      const result = response.data;

      const records = Array.isArray(result)
        ? result
        : Array.isArray(result?.payments)
          ? result.payments
          : Array.isArray(result?.history)
            ? result.history
            : Array.isArray(result?.data)
              ? result.data
              : [];

      setPayments(records);
    } catch (err: any) {
      console.log("CUSTOMER HISTORY ERROR:", err.response?.data ?? err.message);
      setError(
        err.response?.data?.message || "Unable to load payment history.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customer.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const collected = payments
    .filter((payment) => payment.status?.toLowerCase() === "paid")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const pending = payments
    .filter((payment) => payment.status?.toLowerCase() === "pending")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const formatAmount = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

  const callCustomer = async () => {
    if (!customer.phone) {
      Alert.alert("Phone unavailable", "Customer phone number is missing.");
      return;
    }

    try {
      await Linking.openURL(`tel:${customer.phone}`);
    } catch {
      Alert.alert("Unable to call", "Phone app could not be opened.");
    }
  };

  const editCustomer = () => {
    router.push({
      pathname: "/(tabs)/customers",
      params: { editCustomerId: customer.id },
    });
  };

  return (
    <>
      <SafeAreaView className="flex-1 bg-slate-50" edges={["top", "bottom"]}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />

        <ScrollView
          className="flex-1 bg-slate-50"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadHistory();
              }}
            />
          }
        >
          <View className="px-5 pb-10 pt-5">
            {/* Profile */}
            <View className="rounded-2xl bg-white p-5 shadow-sm">
              <View className="flex-row items-center">
                <View className="h-16 w-16 items-center justify-center rounded-2xl bg-blue-100">
                  <Text className="text-2xl font-bold text-blue-700">
                    {customer.name.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View className="ml-4 flex-1">
                  <Text className="text-xl font-bold text-slate-900">
                    {customer.name}
                  </Text>

                  <Text className="mt-1 text-sm text-slate-500">
                    {customer.phone || "Phone not available"}
                  </Text>

                  <View
                    className={`mt-2 self-start rounded-full px-3 py-1 ${
                      customer.isActive ? "bg-green-50" : "bg-red-50"
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        customer.isActive ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {customer.isActive
                        ? "Active Customer"
                        : "Inactive Customer"}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="mt-5 flex-row gap-3">
                <Pressable
                  onPress={callCustomer}
                  className="flex-1 flex-row items-center justify-center rounded-xl bg-green-600 py-3"
                >
                  <Text className="font-semibold text-white">
                    Call Customer
                  </Text>
                </Pressable>

                <Pressable
                  onPress={editCustomer}
                  className="flex-1 items-center justify-center rounded-xl bg-blue-50 py-3"
                >
                  <Text className="font-semibold text-blue-700">
                    Edit Details
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Customer Information */}
            <Text className="mb-3 mt-7 text-lg font-bold text-slate-900">
              Customer Information
            </Text>

            <View className="rounded-2xl bg-white p-4">
              {[
                ["Phone Number", customer.phone],
                ["Vehicle", customer.vehicleName],
                ["Door Number", customer.doorNumber],
                ["Gender", customer.gender],
                [customer.isHistorical ? "Billed Amount" : "Monthly Amount", formatAmount(customer.billingAmount)],
              ].map(([label, value]) => (
                <View
                  key={label}
                  className="flex-row justify-between border-b border-slate-100 py-3"
                >
                  <Text className="text-sm text-slate-500">{label}</Text>
                  <Text className="max-w-[60%] text-right text-sm font-semibold text-slate-900">
                    {value || "Not provided"}
                  </Text>
                </View>
              ))}
            </View>

            {/* Payment Summary */}
            <Text className="mb-3 mt-7 text-lg font-bold text-slate-900">
              Payment Overview
            </Text>

            <View className="flex-row gap-3">
              <View className="flex-1 rounded-2xl bg-green-50 p-4">
                <Text className="text-xs font-semibold text-green-700">
                  COLLECTED
                </Text>
                <Text className="mt-2 text-xl font-bold text-green-700">
                  {formatAmount(collected)}
                </Text>
              </View>

              <View className="flex-1 rounded-2xl bg-red-50 p-4">
                <Text className="text-xs font-semibold text-red-600">
                  PENDING
                </Text>
                <Text className="mt-2 text-xl font-bold text-red-600">
                  {formatAmount(pending)}
                </Text>
              </View>
            </View>

            {/* Payment History */}
            <View className="mb-3 mt-8 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-slate-900">
                Payment History
              </Text>
              <Text className="text-xs text-slate-500">
                {payments.length} records
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator
                className="mt-6"
                size="large"
                color="#2563EB"
              />
            ) : error ? (
              <View className="rounded-xl bg-red-50 p-4">
                <Text className="text-sm text-red-600">{error}</Text>
                <Pressable onPress={loadHistory}>
                  <Text className="mt-2 font-bold text-red-700">Retry</Text>
                </Pressable>
              </View>
            ) : payments.length === 0 ? (
              <View className="rounded-2xl bg-white p-6">
                <Text className="text-center font-semibold text-slate-700">
                  No payment history
                </Text>
                <Text className="mt-2 text-center text-sm text-slate-400">
                  Payment records will appear here.
                </Text>
              </View>
            ) : (
              payments.map((payment, index) => (
                <View
                  key={payment._id || `${payment.month}-${index}`}
                  className="mb-3 rounded-2xl bg-white p-4"
                >
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="font-bold text-slate-900">
                        {payment.month || "Payment"}
                      </Text>
                      <Text className="mt-1 text-xs text-slate-500">
                        {payment.dailyStatus || "Monthly payment"}
                      </Text>
                    </View>

                    <View
                      className={`rounded-full px-3 py-1 ${
                        payment.status?.toLowerCase() === "paid"
                          ? "bg-green-50"
                          : "bg-orange-50"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          payment.status?.toLowerCase() === "paid"
                            ? "text-green-700"
                            : "text-orange-700"
                        }`}
                      >
                        {payment.status || "Unknown"}
                      </Text>
                    </View>
                  </View>

                  <Text className="mt-3 text-lg font-bold text-slate-900">
                    {formatAmount(Number(payment.amount || 0))}
                  </Text>

                  {payment.missedDays ? (
                    <Text className="mt-1 text-xs text-slate-500">
                      Missed days: {payment.missedDays}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
