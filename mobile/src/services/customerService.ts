import { api } from "../api/client";

export interface Customer {
  _id: string;
  name: string;
  phone: string;
  doorNumber?: string;
  vehicleName?: string;
  monthlyAmount: number;
  gender?: string;
  serviceId: string;
  isActive?: boolean;
  welcomeMessageEligible?: boolean;
  welcomeMessageSent?: boolean;
  welcomeMessageSentAt?: string | null;
}

export async function fetchCustomers(serviceId: string): Promise<Customer[]> {
  try {
    const response = await api.get("/getcustomer", {
      params: { serviceId },
    });

    console.log("CUSTOMER API STATUS:", response.status);
    console.log("CUSTOMER API DATA:", response.data);

    if (!Array.isArray(response.data)) {
      throw new Error("API customer data array format-la illa");
    }

    return response.data;
  } catch (error: any) {
    console.log("CUSTOMER API ERROR:", error.response?.data ?? error.message);

    throw new Error(
      error.response?.data?.message ??
        error.message ??
        "Customer loading failed",
    );
  }
}

export async function createCustomer(
  customer: Omit<Customer, "_id"> & { month: string },
) {
  const response = await api.post("/", customer);
  return response.data;
}

export async function updateCustomer(
  id: string,
  customer: Partial<Customer> & { month?: string },
) {
  try {
    console.log("========== UPDATE CUSTOMER ==========");
    console.log("CUSTOMER ID:", id);
    console.log("UPDATE PAYLOAD:", customer);
    console.log("API URL:", `${api.defaults.baseURL}/${id}`);

    const response = await api.put(`/${id}`, customer);

    console.log("UPDATE STATUS:", response.status);
    console.log("UPDATE RESPONSE:", response.data);

    return response.data;
  } catch (error: any) {
    console.log("========== UPDATE ERROR ==========");
    console.log("MESSAGE:", error.message);
    console.log("ERROR CODE:", error.code);
    console.log("REQUEST URL:", error.config?.url);
    console.log("REQUEST METHOD:", error.config?.method);
    console.log("BASE URL:", error.config?.baseURL);
    console.log("SERVER STATUS:", error.response?.status);
    console.log("SERVER RESPONSE:", error.response?.data);

    throw error;
  }
}

export async function removeCustomer(id: string) {
  const response = await api.delete(`/${id}`);
  return response.data;
}
