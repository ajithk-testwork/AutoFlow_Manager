import { View, Text } from "react-native";

export default function SettingsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <Text className="text-2xl font-bold">Settings</Text>
      <Text className="mt-2 text-slate-500">
        Business settings
      </Text>
    </View>
  );
}