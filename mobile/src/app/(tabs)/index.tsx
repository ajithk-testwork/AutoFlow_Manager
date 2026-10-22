import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { fetchCustomers } from "../../services/customerService";

export default function DashboardScreen() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    fetchCustomers()
      .then((customers) => {
        if (mounted) setCount(customers.length);
      })
      .catch((err: any) => {
        console.log("Dashboard customer error:", err.message);
        if (mounted) {
          setError(err.message || "Customers load panna mudiyala");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="p-5 pt-12">
        <Text className="text-2xl font-bold text-slate-900">AutoFlow</Text>
        <Text className="mt-1 text-slate-500">Business Dashboard</Text>

        <View className="mt-6 rounded-2xl bg-white p-5">
          <Text className="text-sm text-slate-500">Total Active Customers</Text>

          {count === null && !error ? (
            <ActivityIndicator className="mt-4 self-start" color="#2563EB" />
          ) : error ? (
            <Text className="mt-3 text-red-600">{error}</Text>
          ) : (
            <Text className="mt-2 text-3xl font-bold text-slate-900">
              {count}
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
