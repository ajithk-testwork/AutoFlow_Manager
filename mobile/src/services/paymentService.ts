import { api } from "../api/client";

export async function fetchPayments(month: string) {
  const response = await api.get("/payments", {
    params: { month },
  });

  return response.data;
}

export async function togglePayment(paymentId: string) {
  const response = await api.patch(`/payment/${paymentId}/toggle`);

  return response.data;
}

export async function startMonth(month: string) {
  const response = await api.post("/start-month", {
    month,
  });

  return response.data;
}

export async function updateDailyStatus(data: {
  paymentId: string;
  date: string;
  status: "Cleaned" | "Missed" | "None";
  month?: string;
}) {
  const response = await api.post("/daily-status", data);
  return response.data;
}

export async function fetchGlobalHistory(serviceId: string) {
  const response = await api.get("/global/history", {
    params: { serviceId },
  });

  return response.data;
}
