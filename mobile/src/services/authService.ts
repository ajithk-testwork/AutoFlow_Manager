import * as SecureStore from "expo-secure-store";
import { api } from "../api/client";

const TOKEN_KEY = "autoflow_token";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  businessName: string;
  ownerName: string;
  email: string;
  whatsapp: string;
  password: string;
  upiId?: string;
}

export async function registerUser(input: RegisterInput) {
  try {
    const response = await api.post("/register", input);
    return response.data;
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message || "Registration failed. Try again.",
    );
  }
}

export async function loginUser(input: LoginInput) {
  try {
    const response = await api.post("/login", input);
    const { token, tenant } = response.data;

    if (!token) {
      throw new Error("Login response-la token kidaikkala");
    }

    await SecureStore.setItemAsync(TOKEN_KEY, token);

    return {
      token,
      user: {
        id: tenant?._id,
        businessName: tenant?.businessName,
        ownerName: tenant?.ownerName,
        email: tenant?.email,
        whatsapp: tenant?.whatsapp,
      },
    };
  } catch (error: any) {
    throw new Error(
      error.response?.data?.message ||
        error.message ||
        "Login failed. Try again.",
    );
  }
}

export async function getSavedToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function logoutUser() {
  try {
    await api.post("/logout");
  } finally {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}
