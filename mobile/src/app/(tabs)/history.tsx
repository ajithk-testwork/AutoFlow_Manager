import { View, Text } from "react-native";

export default function HistoryScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <Text className="text-2xl font-bold">Global History</Text>
      <Text className="mt-2 text-slate-500">
        Payment collection history
      </Text>
    </View>
  );
}