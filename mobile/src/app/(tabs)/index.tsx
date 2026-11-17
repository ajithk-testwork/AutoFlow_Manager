import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import {
  DashboardSummary,
  fetchDashboardSummary,
  getCurrentMonthKey,
} from "../../services/dashboardService";

const formatCurrency = (amount: number) =>
  `₹${(Number(amount) || 0).toLocaleString("en-IN")}`;

export default function DashboardScreen() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setError("");

      const serviceId = await SecureStore.getItemAsync("autoflow_service_id");

      if (!serviceId) {
        throw new Error("Please select a service first.");
      }

      const data = await fetchDashboardSummary(serviceId, getCurrentMonthKey());

      setDashboard(data);
    } catch (err: any) {
      console.log("Dashboard error:", err.message);
      setError(err.message || "Unable to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-3 text-sm text-slate-500">
          Loading your dashboard...
        </Text>
      </View>
    );
  }

  if (error && !dashboard) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 px-6">
        <View className="w-full rounded-2xl bg-white p-6">
          <Text className="text-center text-lg font-bold text-slate-900">
            Dashboard unavailable
          </Text>

          <Text className="mt-2 text-center text-sm text-slate-500">
            {error}
          </Text>

          <TouchableOpacity
            onPress={() => {
              setLoading(true);
              loadDashboard();
            }}
            className="mt-5 items-center rounded-xl bg-blue-600 py-3"
          >
            <Text className="font-semibold text-white">Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!dashboard) return null;

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#2563EB"
        />
      }
    >
      <View className="px-5 pb-10 pt-14">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-slate-900">AutoFlow</Text>

            <Text className="mt-1 text-sm text-slate-500">
              Business Overview
            </Text>

            <Text className="mt-2 text-xs font-semibold text-blue-600">
              {dashboard.service.name}
            </Text>
          </View>

          <View className="h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Text className="text-lg font-bold text-blue-700">AF</Text>
          </View>
        </View>

        {/* Month */}
        <View className="mt-7 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-slate-900">Overview</Text>

          <View className="rounded-lg bg-blue-50 px-3 py-2">
            <Text className="text-xs font-semibold text-blue-700">
              {dashboard.month}
            </Text>
          </View>
        </View>

        {/* Customer Stats */}
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-white p-4 shadow-sm">
            <Text className="text-xs font-medium text-slate-500">
              Total Customers
            </Text>

            <Text className="mt-3 text-3xl font-bold text-slate-900">
              {dashboard.customers.total}
            </Text>

            <Text className="mt-1 text-xs text-slate-400">All customers</Text>
          </View>

          <View className="flex-1 rounded-2xl bg-white p-4 shadow-sm">
            <Text className="text-xs font-medium text-slate-500">Active</Text>

            <Text className="mt-3 text-3xl font-bold text-green-600">
              {dashboard.customers.active}
            </Text>

            <Text className="mt-1 text-xs text-slate-400">
              Currently active
            </Text>
          </View>
        </View>

        <View className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-medium text-slate-500">
                Inactive Customers
              </Text>

              <Text className="mt-2 text-2xl font-bold text-orange-600">
                {dashboard.customers.inactive}
              </Text>
            </View>

            <View className="h-11 w-11 items-center justify-center rounded-full bg-orange-50">
              <Text className="text-xl">👤</Text>
            </View>
          </View>
        </View>

        {/* Payment Overview */}
        <Text className="mb-3 mt-8 text-lg font-bold text-slate-900">
          Payment Overview
        </Text>

        <View className="rounded-2xl bg-white p-5 shadow-sm">
          <Text className="text-sm text-slate-500">Expected Amount</Text>

          <Text className="mt-2 text-3xl font-bold text-slate-900">
            {formatCurrency(dashboard.payments.expected)}
          </Text>
        </View>

        <View className="mt-3 flex-row gap-3">
          <View className="flex-1 rounded-2xl border border-green-100 bg-green-50 p-4">
            <Text className="text-xs font-semibold text-green-700">
              COLLECTED
            </Text>

            <Text className="mt-3 text-xl font-bold text-green-700">
              {formatCurrency(dashboard.payments.collected)}
            </Text>
          </View>

          <View className="flex-1 rounded-2xl border border-red-100 bg-red-50 p-4">
            <Text className="text-xs font-semibold text-red-600">PENDING</Text>

            <Text className="mt-3 text-xl font-bold text-red-600">
              {formatCurrency(dashboard.payments.pending)}
            </Text>
          </View>
        </View>

        {/* Payment Info */}
        <View className="mt-3 rounded-xl bg-white px-4 py-3">
          <Text className="text-sm text-slate-500">
            Monthly payment records:{" "}
            <Text className="font-bold text-slate-900">
              {dashboard.payments.totalPayments}
            </Text>
          </Text>
        </View>

        {/* Recent Customers */}
        <View className="mb-4 mt-8 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-slate-900">
            Recent Customers
          </Text>

          <Text className="text-sm font-medium text-blue-600">
            {dashboard.recentCustomers.length} shown
          </Text>
        </View>

        {dashboard.recentCustomers.length === 0 ? (
          <View className="rounded-2xl bg-white p-6">
            <Text className="text-center text-sm text-slate-500">
              No customers available
            </Text>
          </View>
        ) : (
          dashboard.recentCustomers.map((customer) => (
            <View
              key={customer._id}
              className="mb-3 flex-row items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
            >
              <View className="flex-1 pr-3">
                <Text className="text-base font-semibold text-slate-900">
                  {customer.name}
                </Text>

                <Text className="mt-1 text-sm text-slate-500">
                  {customer.phone}
                </Text>

                {customer.vehicleName ? (
                  <Text className="mt-1 text-xs text-slate-400">
                    {customer.vehicleName}
                  </Text>
                ) : null}
              </View>

              <View
                className={`rounded-full px-3 py-2 ${
                  customer.isActive ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    customer.isActive ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {customer.isActive ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>
          ))
        )}

        <Text className="mt-5 text-center text-xs text-slate-400">
          Pull down to refresh dashboard
        </Text>
      </View>
    </ScrollView>
  );
}
