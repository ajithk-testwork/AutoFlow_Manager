import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { fetchCustomers, Customer } from "../../services/customerService";

export default function DashboardScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setError("");

      const serviceId = await SecureStore.getItemAsync("autoflow_service_id");

      if (!serviceId) {
        throw new Error("Service select pannunga. Service ID kidaikkala.");
      }

      const data = await fetchCustomers(serviceId);
      setCustomers(data);
    } catch (err: any) {
      console.log("Dashboard error:", err.message);
      setError(err.message || "Dashboard load panna mudiyala");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const activeCustomers = customers.filter(
    (customer) => customer.isActive !== false,
  ).length;

  const monthlyAmount = customers.reduce(
    (total, customer) => total + (Number(customer.monthlyAmount) || 0),
    0,
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-3 text-slate-500">Dashboard loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="px-5 pb-8 pt-14">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-slate-900">AutoFlow</Text>
            <Text className="mt-1 text-sm text-slate-500">
              Business Overview
            </Text>
          </View>

          <View className="h-11 w-11 items-center justify-center rounded-full bg-blue-100">
            <Text className="font-bold text-blue-700">AF</Text>
          </View>
        </View>

        {/* Overview */}
        <Text className="mb-3 mt-8 text-lg font-bold text-slate-900">
          Overview
        </Text>

        {error ? (
          <View className="rounded-2xl bg-red-50 p-4">
            <Text className="font-medium text-red-600">{error}</Text>
            <Text
              onPress={loadDashboard}
              className="mt-3 font-bold text-red-700"
            >
              Retry
            </Text>
          </View>
        ) : (
          <>
            {/* Active Customers */}
            <View className="rounded-2xl bg-white p-5 shadow-sm">
              <Text className="text-sm font-medium text-slate-500">
                Active Customers
              </Text>

              <Text className="mt-3 text-3xl font-bold text-slate-900">
                {activeCustomers}
              </Text>

              <Text className="mt-2 text-xs text-green-600">
                Currently active customers
              </Text>
            </View>

            {/* Monthly Collection Estimate */}
            <View className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
              <Text className="text-sm font-medium text-slate-500">
                Monthly Amount
              </Text>

              <Text className="mt-3 text-3xl font-bold text-slate-900">
                ₹{monthlyAmount.toLocaleString("en-IN")}
              </Text>

              <Text className="mt-2 text-xs text-slate-500">
                Sum of customer monthly amounts
              </Text>
            </View>

            {/* Recent Customers */}
            <View className="mt-7">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-lg font-bold text-slate-900">
                  Customers
                </Text>

                <Text className="text-sm text-blue-600">
                  {customers.length} Active
                </Text>
              </View>

              {customers.length === 0 ? (
                <View className="rounded-2xl bg-white p-6">
                  <Text className="text-center text-slate-500">
                    No customers found
                  </Text>
                </View>
              ) : (
                customers.slice(0, 5).map((customer) => (
                  <View
                    key={customer._id}
                    className="mb-3 flex-row items-center justify-between rounded-2xl bg-white p-4"
                  >
                    <View className="flex-1">
                      <Text className="font-semibold text-slate-900">
                        {customer.name}
                      </Text>
                      <Text className="mt-1 text-sm text-slate-500">
                        {customer.phone}
                      </Text>
                    </View>

                    <View className="rounded-full bg-green-50 px-3 py-1">
                      <Text className="text-xs font-semibold text-green-700">
                        Active
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
