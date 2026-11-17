import { api } from "../api/client";

export interface DashboardSummary {
  success: boolean;
  service: {
    id: string;
    name: string;
  };
  month: string;
  customers: {
    total: number;
    active: number;
    inactive: number;
  };
  payments: {
    expected: number;
    collected: number;
    pending: number;
    totalPayments: number;
  };
  recentCustomers: {
    _id: string;
    name: string;
    phone: string;
    vehicleName?: string;
    monthlyAmount?: number;
    isActive: boolean;
  }[];
}

export function getCurrentMonthKey(): string {
  const date = new Date();

  return `${date.toLocaleString("en-US", {
    month: "long",
  })} ${date.getFullYear()}`;
}

export async function fetchDashboardSummary(
  serviceId: string,
  month: string = getCurrentMonthKey(),
): Promise<DashboardSummary> {
  try {
    const response = await api.get("/dashboard-summary", {
      params: {
        serviceId,
        month,
      },
    });

    return response.data;
  } catch (error: any) {
    console.log("DASHBOARD API ERROR:", error.response?.data ?? error.message);

    throw new Error(
      error.response?.data?.message ??
        error.message ??
        "Dashboard loading failed",
    );
  }
}
