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
}






export interface Customer {
  _id: string;
  name: string;
  phone: string;
  isActive?: boolean;
}

export async function fetchCustomers(): Promise<Customer[]> {
  try {
    const response = await api.get("/getcustomer");

    console.log("CUSTOMER API STATUS:", response.status);
    console.log("CUSTOMER API DATA:", response.data);

    if (!Array.isArray(response.data)) {
      throw new Error("API customer data array format-la illa");
    }

    return response.data;
  } catch (error: any) {
    console.log("CUSTOMER API STATUS:", error.response?.status);
    console.log("CUSTOMER API ERROR:", error.response?.data ?? error.message);
    throw new Error(
      error.response?.data?.message ?? error.message ?? "Customer loading failed"
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
  const response = await api.put(`/${id}`, customer);
  return response.data;
}

export async function removeCustomer(id: string) {
  const response = await api.delete(`/${id}`);
  return response.data;
}
