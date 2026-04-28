import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
    Users, IndianRupee, AlertCircle, Plus, X, Save, MessageCircle,
    CheckCircle2, Clock, Edit, Trash2, Search, History, CalendarDays,
    Check, XCircle, ChevronDown, AlertTriangle, Database, ArrowLeft,
    FileText
} from 'lucide-react';

const API_URL = 'https://autoflow-manager.onrender.com/api/customers';

const Dashboard = () => {
    const [currentView, setCurrentView] = useState('dashboard');

    const [dashboardData, setDashboardData] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerHistory, setCustomerHistory] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPaymentDetails, setSelectedPaymentDetails] = useState(null);

    const [globalHistoryData, setGlobalHistoryData] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '', phone: '', amount: '', gender: 'male'
    });

    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'danger' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    const getMonthKey = () => {
        const date = new Date();
        return `${date.toLocaleString("en-US", { month: "long" })} ${date.getFullYear()}`;
    };

    const [selectedMonth, setSelectedMonth] = useState(() => {
        const savedMonth = localStorage.getItem("autoflow_selectedMonth");
        return savedMonth || getMonthKey();
    });

    const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    const availableMonths = useMemo(() => {
        const months = [];
        const date = new Date();
        date.setMonth(date.getMonth() - 3);

        for (let i = 0; i < 10; i++) {
            months.push(`${date.toLocaleString("en-US", { month: "long" })} ${date.getFullYear()}`);
            date.setMonth(date.getMonth() + 1);
        }
        return months;
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsMonthDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (currentView === 'dashboard') {
            localStorage.setItem("autoflow_selectedMonth", selectedMonth);
            fetchDashboardData();
        }
    }, [selectedMonth, currentView]);

    const fetchDashboardData = async () => {
        try {
            const [customersRes, paymentsRes] = await Promise.all([
                axios.get(API_URL), // Only returns active customers now
                axios.get(`${API_URL}/payments?month=${selectedMonth}`)
            ]);

            const activeCustomers = customersRes.data;
            const currentPayments = paymentsRes.data;

            let mergedData = [];

            // ✅ FIX: If the month has been initialized, ONLY show customers mapped to this specific month.
            if (currentPayments.length > 0) {
                mergedData = currentPayments.map(paymentRecord => {
                    const customer = paymentRecord.customerId;
                    if (!customer) return null; // Catch orphans
                    
                    return {
                        ...customer,
                        _id: customer._id, // Ensure ID binds to global customer
                        paymentId: paymentRecord._id,
                        status: paymentRecord.status,
                        paidDate: paymentRecord.paidDate,
                        dailyStatus: paymentRecord.dailyStatus || [],
                        missedDays: paymentRecord.missedDays || 0,
                        amount: paymentRecord.amount
                    };
                }).filter(Boolean); // removes null orphans
            } else {
                // If month hasn't been initialized, preview the active roster
                mergedData = activeCustomers.map(customer => ({
                    ...customer,
                    paymentId: null,
                    status: 'No Record',
                    paidDate: null,
                    dailyStatus: [],
                    missedDays: 0,
                    amount: customer.monthlyAmount
                }));
            }

            setDashboardData(mergedData);
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
            showToast("Failed to connect to the server.", "error");
        }
    };

    const navigateToGlobalHistory = async () => {
        setCurrentView('history');
        setIsHistoryLoading(true);
        try {
            const res = await axios.get(API_URL.replace('/customers', '/customers/global/history'));
            setGlobalHistoryData(res.data);
        } catch (error) {
            console.error("Failed to load global history:", error);
            showToast("Failed to load DB history", "error");
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const getTodayStatus = (dailyStatusArray) => {
        if (!dailyStatusArray || !Array.isArray(dailyStatusArray)) return null;
        const today = new Date().toLocaleDateString('en-CA');
        const record = dailyStatusArray.find(d => {
            const recordDate = typeof d.date === 'string' ? d.date.split('T')[0] : d.date;
            return recordDate === today;
        });
        return record ? record.status : null;
    };

    const totalCustomers = dashboardData.length;
    const expectedRevenue = dashboardData.reduce((sum, c) => sum + (c.amount || c.monthlyAmount || 0), 0);
    const collectedRevenue = dashboardData.reduce((sum, c) => c.status === 'Paid' ? sum + (c.amount || c.monthlyAmount || 0) : sum, 0);
    const pendingDues = dashboardData.reduce((sum, c) => (c.status === 'Pending' || c.status === 'No Record') ? sum + (c.amount || c.monthlyAmount || 0) : sum, 0);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const resetForm = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ name: '', phone: '', amount: '', gender: 'male' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            name: formData.name,
            phone: formData.phone,
            monthlyAmount: Number(formData.amount),
            gender: formData.gender,
            month: selectedMonth
        };

        try {
            if (editingId) {
                await axios.put(`${API_URL}/${editingId}`, payload);
                showToast("Customer updated successfully!", "success");
            } else {
                await axios.post(API_URL, payload);
                showToast("New customer added!", "success");
            }
            resetForm();
            fetchDashboardData();
        } catch (error) {
            console.error("Failed to save customer:", error);
            showToast(error.response?.data?.message || "Failed to save customer.", "error");
        }
    };

    const handleEdit = (customer) => {
        setFormData({
            name: customer.name,
            phone: customer.phone,
            amount: customer.monthlyAmount,
            gender: customer.gender || 'male'
        });
        setEditingId(customer._id);
        setIsModalOpen(true);
    };

    const confirmDelete = (id) => {
        setConfirmDialog({
            isOpen: true,
            title: "Deactivate Customer",
            message: "Remove this customer? They will remain visible in past months where they already paid, but will not be billed in future months.",
            type: "danger",
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    await axios.delete(`${API_URL}/${id}`);
                    fetchDashboardData();
                    showToast("Customer deactivated.", "success");
                } catch (error) {
                    console.error("Failed to delete customer:", error);
                    showToast("Failed to delete customer.", "error");
                }
            }
        });
    };

    const confirmStartMonth = () => {
        setConfirmDialog({
            isOpen: true,
            title: "Initialize Billing Month",
            message: `Start the billing cycle for ${selectedMonth}? This will generate pending records for all active customers.`,
            type: "primary",
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                try {
                    await axios.post(`${API_URL}/start-month`, { month: selectedMonth });
                    setIsMonthDropdownOpen(false);
                    fetchDashboardData();
                    showToast(`${selectedMonth} billing cycle started!`, "success");
                } catch (error) {
                    console.error("Failed to start new month:", error);
                    showToast("Failed to start the new month. It might already exist.", "error");
                }
            }
        });
    };

    const updateDailyStatus = async (paymentId, status) => {
        if (!paymentId) {
            showToast("No payment record found. Please start the month first.", "error");
            return;
        }
        try {
            const today = new Date().toLocaleDateString('en-CA');
            await axios.post(`${API_URL}/daily-status`, {
                paymentId, date: today, status, month: selectedMonth
            });
            fetchDashboardData();
            if(status === 'None') showToast("Action undone.", "success");
            else showToast(`Marked as ${status}`, "success");
        } catch (error) {
            console.error("Error updating daily status", error);
            showToast("Failed to update status.", "error");
        }
    };

    const togglePaymentStatus = async (paymentId) => {
        if (!paymentId) {
            showToast("No payment record found for this month.", "error");
            return;
        }
        try {
            await axios.patch(`${API_URL}/payment/${paymentId}/toggle`);
            fetchDashboardData();
            showToast("Payment status updated!", "success");
        } catch (error) {
            console.error("Failed to toggle payment:", error);
            showToast("Failed to update payment status.", "error");
        }
    };

    const openHistory = async (customer) => {
        setSelectedCustomer(customer);
        setHistoryModalOpen(true);
        try {
            const res = await axios.get(`${API_URL}/${customer._id}/history`);
            setCustomerHistory(res.data);
            if (customer.paymentId) {
                const paymentRes = await axios.get(`${API_URL}/payment/${customer.paymentId}`);
                setSelectedPaymentDetails(paymentRes.data);
            } else {
                setSelectedPaymentDetails(null);
            }
        } catch (error) {
            console.error("Failed to fetch history:", error);
        }
    };

    const totalPaidBySelected = customerHistory
        .filter(record => record.status === 'Paid')
        .reduce((sum, record) => sum + record.amount, 0);

    const handleSendWhatsApp = (customer, type) => {
        const { name, phone, monthlyAmount, gender, dailyStatus = [], missedDays = 0 } = customer;
        const honorific = gender === 'female' ? " Ma'am" : " Sir";
        const upiId = "quicklyajithda3@okicici";
        const paymentNumber = "9566019538"; 

        const missedDates = dailyStatus
            .filter(d => d.status === "Missed")
            .map(d => new Date(d.date).toLocaleDateString())
            .join(", ");

        const [monthName, year] = selectedMonth.split(" ");
        const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

        const perDay = monthlyAmount / daysInMonth;
        const deduction = Math.round(missedDays * perDay);
        const finalAmount = Math.round(monthlyAmount - deduction);

        let message = "";

        if (type === 'request') {
            message = `Hello ${name}${honorific},\n\n📅 Billing Month: ${selectedMonth}\n\n🚗 Service Report:\nMissed Days: ${missedDays}\nDates Missed: ${missedDates || "None"}\n\n💰 Monthly Base: ₹${monthlyAmount}\n➖ Deduction: ₹${deduction}\n✅ Final Amount: ₹${finalAmount}\n\n💳 Payment Options (Long press below to copy):\n\n🔹 UPI ID:\n\`\`\`${upiId}\`\`\`\n\n🔹 GPay / PhonePe:\n\`\`\`${paymentNumber}\`\`\`\n\nThank you! 🚗✨`;
        } else if (type === 'reminder') {
            message = `Hello ${name}${honorific},\n\nThis is a gentle reminder that your payment for *${selectedMonth}* is still pending.\n\n💰 Final Amount Due: ₹${finalAmount}\n\n💳 Payment Options (Long press below to copy):\n\n🔹 UPI ID:\n\`\`\`${upiId}\`\`\`\n\n🔹 GPay / PhonePe:\n\`\`\`${paymentNumber}\`\`\`\n\nThank you! 🚗`;
        } else if (type === 'thankyou') {
            message = `Hello ${name}${honorific},\n\nWe have received your payment of ₹${finalAmount} for *${selectedMonth}*. \n\nThank you for choosing us! 🚗✨`;
        }

        let cleanPhone = phone.toString().replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    const filteredCustomers = dashboardData.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const StatusBadge = ({ status }) => {
        if (status === 'Paid') return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wide">Paid</span>;
        if (status === 'Pending') return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-wide">Pending</span>;
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">No Record</span>;
    };

    // ==========================================
    // RENDER: GLOBAL HISTORY PAGE VIEW
    // ==========================================
    if (currentView === 'history') {
        return (
            <div className="min-h-screen bg-slate-50 font-sans animate-in fade-in duration-300">
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setCurrentView('dashboard')} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors">
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                                <Database className="text-indigo-600" /> Global Ledger
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 font-medium">Complete database history across all months</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-8">
                    {isHistoryLoading ? (
                        <div className="text-center py-20">
                            <Clock className="mx-auto mb-4 text-indigo-300 animate-spin" size={48} />
                            <p className="text-slate-500 font-bold text-lg animate-pulse">Syncing Database...</p>
                        </div>
                    ) : globalHistoryData.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
                            <FileText className="mx-auto mb-4 text-slate-300" size={48} />
                            <p className="text-slate-500 font-bold text-lg">No billing history found.</p>
                        </div>
                    ) : (
                        globalHistoryData.map((data, idx) => (
                            <div key={idx} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                                <div className="bg-indigo-50/50 border-b border-indigo-100 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-2xl font-black text-indigo-900">{data.month}</h2>
                                        <p className="text-sm font-bold text-indigo-600 uppercase tracking-wider">{data.totalCustomers} Customers Billed</p>
                                    </div>
                                    <div className="flex flex-wrap gap-4 sm:gap-8 bg-white p-3 sm:p-4 rounded-2xl border border-indigo-100 shadow-sm">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest">Collected</span>
                                            <span className="font-black text-slate-900 text-lg">₹{data.collected}</span>
                                        </div>
                                        <div className="w-px bg-slate-200"></div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-widest">Pending</span>
                                            <span className="font-black text-slate-900 text-lg">₹{data.pending}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full overflow-x-auto">
                                    <table className="w-full text-left border-collapse whitespace-nowrap">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-1/4">Customer</th>
                                                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-1/5">Status</th>
                                                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-1/6">Missed Days</th>
                                                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-1/6">Amount</th>
                                                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-1/5">Paid Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {data.payments.map((p, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-slate-900 text-sm">{p.customerId?.name || 'Unknown'}</p>
                                                        <p className="text-xs text-slate-500 font-medium mt-0.5">{p.customerId?.phone ? `+91 ${p.customerId.phone}` : ''}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <StatusBadge status={p.status} />
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {p.missedDays > 0 ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                                                                {p.missedDays} Days
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 text-sm font-bold">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-slate-900">
                                                        ₹{p.amount}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {p.paidDate ? (
                                                            <span className="text-xs font-bold text-slate-500">{p.paidDate}</span>
                                                        ) : (
                                                            <span className="text-xs font-bold text-rose-400">Unpaid</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // ==========================================
    // RENDER: MAIN DASHBOARD VIEW
    // ==========================================
    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans relative w-full overflow-hidden animate-in fade-in duration-300">
            
            <div className={`fixed top-6 right-6 z-[70] transition-all duration-500 ease-out transform ${toast.show ? 'translate-x-0 opacity-100' : 'translate-x-32 opacity-0 pointer-events-none'}`}>
                <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border ${toast.type === 'error' ? 'bg-white border-rose-200' : 'bg-white border-emerald-200'}`}>
                    {toast.type === 'error' ? (
                        <div className="bg-rose-100 p-2 rounded-full text-rose-600 animate-pulse"><XCircle size={20} /></div>
                    ) : (
                        <div className="bg-emerald-100 p-2 rounded-full text-emerald-600"><CheckCircle2 size={20} /></div>
                    )}
                    <p className={`text-sm font-bold ${toast.type === 'error' ? 'text-rose-900' : 'text-emerald-900'}`}>{toast.message}</p>
                </div>
            </div>

            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-0 bg-slate-900/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform transition-all animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full mb-4 ${confirmDialog.type === 'danger' ? 'bg-rose-100' : 'bg-blue-100'}`}>
                                {confirmDialog.type === 'danger' ? <AlertTriangle className="h-6 w-6 text-rose-600" /> : <CalendarDays className="h-6 w-6 text-blue-600" />}
                            </div>
                            <div className="mt-3 text-center">
                                <h3 className="text-lg font-bold leading-6 text-slate-900">{confirmDialog.title}</h3>
                                <div className="mt-2">
                                    <p className="text-sm text-slate-500">{confirmDialog.message}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 px-4 py-4 sm:flex sm:flex-row-reverse sm:px-6 border-t border-slate-100 gap-2">
                            <button
                                onClick={confirmDialog.onConfirm}
                                className={`inline-flex w-full justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm sm:w-auto transition-all active:scale-95 ${confirmDialog.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                Confirm
                            </button>
                            <button
                                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                                className="mt-3 inline-flex w-full justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:mt-0 sm:w-auto transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 lg:mb-8 gap-4 lg:gap-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <span className="text-blue-600 text-3xl">🚗</span> AutoFlow
                    </h1>
                    <p className="text-sm sm:text-base text-slate-500 mt-1">Monthly Subscription & Payment Tracker</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                    <div className="relative w-full sm:w-auto" ref={dropdownRef}>
                        <button
                            onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                            className="w-full sm:w-56 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 px-4 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                            <div className="flex items-center gap-2">
                                <CalendarDays size={18} className="text-blue-600" />
                                <div className="flex flex-col items-start leading-tight">
                                    <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Viewing</span>
                                    <span>{selectedMonth}</span>
                                </div>
                            </div>
                            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isMonthDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isMonthDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-full sm:w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-30 flex flex-col overflow-hidden transform origin-top transition-all duration-200 animate-in fade-in zoom-in-95">
                                <div className="p-3 border-b border-slate-100 bg-blue-50/50">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Initialize Billing</p>
                                    <button
                                        onClick={confirmStartMonth}
                                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                                    >
                                        <Plus size={16} strokeWidth={3} /> Start {selectedMonth}
                                    </button>
                                </div>

                                <div className="max-h-60 overflow-y-auto py-2">
                                    <p className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Switch View</p>
                                    {availableMonths.map((month) => (
                                        <button
                                            key={month}
                                            onClick={() => {
                                                setSelectedMonth(month);
                                                setIsMonthDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${selectedMonth === month
                                                ? 'bg-blue-100 text-blue-800 font-bold border-l-4 border-blue-600'
                                                : 'text-slate-700 hover:bg-slate-50 border-l-4 border-transparent'
                                                }`}
                                        >
                                            {month}
                                            {selectedMonth === month && <Check size={16} className="inline float-right text-blue-600" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={navigateToGlobalHistory} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium shadow-md transition-all active:scale-95 flex items-center justify-center gap-2">
                        <Database size={18} strokeWidth={2.5} /> Global History
                    </button>

                    <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <Users size={18} strokeWidth={2.5} /> Add Customer
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center transition-all hover:shadow-md">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Users size={18} /></div>
                        <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customers</h2>
                    </div>
                    <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{totalCustomers}</p>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center transition-all hover:shadow-md">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-slate-50 p-2 rounded-lg text-slate-600"><IndianRupee size={18} /></div>
                        <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Expected</h2>
                    </div>
                    <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">₹{expectedRevenue}</p>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-center relative overflow-hidden transition-all hover:shadow-md">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><CheckCircle2 size={64} className="text-emerald-500" /></div>
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                        <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><CheckCircle2 size={18} /></div>
                        <h2 className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Collected</h2>
                    </div>
                    <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700 relative z-10">₹{collectedRevenue}</p>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-rose-100 flex flex-col justify-center relative overflow-hidden transition-all hover:shadow-md">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><AlertCircle size={64} className="text-rose-500" /></div>
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                        <div className="bg-rose-50 p-2 rounded-lg text-rose-600"><Clock size={18} /></div>
                        <h2 className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Pending</h2>
                    </div>
                    <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 relative z-10">₹{pendingDues}</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 w-full overflow-hidden flex flex-col">
                <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:justify-between md:items-center bg-slate-50/50 gap-4 shrink-0">
                    <h2 className="text-lg font-bold text-slate-900">Active Subscriptions</h2>
                    <div className="relative w-full md:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                    </div>
                </div>

                {filteredCustomers.length === 0 ? (
                    <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center w-full">
                        <div className="bg-slate-100 p-5 rounded-full mb-4 text-slate-400"><Users size={36} strokeWidth={1.5} /></div>
                        <h3 className="text-slate-900 font-bold text-lg sm:text-xl mb-2">No customers found</h3>
                        <p className="text-slate-500 text-sm sm:text-base max-w-sm mb-6 leading-relaxed">
                            {searchTerm ? "No customers match your search criteria." : "Add your first car cleaning customer to start tracking monthly payments."}
                        </p>
                    </div>
                ) : (
                    <div className="w-full">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4 p-4 sm:p-6 bg-slate-50/50 w-full">
                            {filteredCustomers.map((c) => {
                                const todayStatus = getTodayStatus(c.dailyStatus);
                                const hasActionToday = todayStatus === 'Cleaned' || todayStatus === 'Missed';

                                return (
                                    <div key={c._id} className="p-5 bg-white rounded-2xl shadow-sm border border-slate-200 hover:border-blue-200 transition-all w-full group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="truncate pr-2">
                                                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-1 truncate">
                                                    <span className="truncate">{c.name}</span>
                                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md ml-1 shrink-0">
                                                        {c.gender?.charAt(0).toUpperCase() || 'M'}
                                                    </span>
                                                </h3>
                                                <p className="text-slate-500 text-sm mt-0.5 truncate">+91 {c.phone}</p>
                                            </div>
                                            <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                                                <div className="font-black text-slate-900 text-lg">₹{c.amount || c.monthlyAmount}</div>
                                                <StatusBadge status={c.status} />
                                            </div>
                                        </div>

                                        {c.paymentId && (
                                            <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[11px] font-bold text-slate-500 uppercase">Today's Status</span>
                                                    {c.missedDays > 0 && (
                                                        <span className="text-[11px] text-rose-500 font-bold">Missed: {c.missedDays}</span>
                                                    )}
                                                </div>

                                                {hasActionToday ? (
                                                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200">
                                                        <span className={`text-xs font-bold ${todayStatus === 'Cleaned' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {todayStatus === 'Cleaned' ? '✨ Cleaned' : '❌ Missed'}
                                                        </span>
                                                        <button
                                                            onClick={() => updateDailyStatus(c.paymentId, "None")}
                                                            className="text-slate-400 hover:text-rose-600 p-1 bg-slate-50 hover:bg-rose-50 rounded-md transition-colors flex items-center gap-1 text-[11px] font-semibold"
                                                        >
                                                            <Trash2 size={12} /> Undo
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => updateDailyStatus(c.paymentId, "Cleaned")} className="flex-1 px-2 py-2 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all border border-emerald-200 active:scale-95">
                                                            <Check size={14} /> Clean
                                                        </button>
                                                        <button onClick={() => updateDailyStatus(c.paymentId, "Missed")} className="flex-1 px-2 py-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all border border-rose-200 active:scale-95">
                                                            <XCircle size={14} /> Miss
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2 justify-between items-center">
                                            <div className="flex flex-wrap gap-2 flex-1">
                                                {c.paymentId && (
                                                    <button onClick={() => togglePaymentStatus(c.paymentId)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all flex-1 text-center active:scale-95 ${c.status === 'Pending' ? 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-700'}`}>
                                                        {c.status === 'Pending' ? 'Mark Paid' : 'Mark Pending'}
                                                    </button>
                                                )}

                                                {c.status === 'Pending' || c.status === 'No Record' ? (
                                                    <>
                                                        <button onClick={() => handleSendWhatsApp(c, 'request')} className="flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold flex-1 active:scale-95 transition-all">
                                                            <MessageCircle size={12} /> Bill
                                                        </button>
                                                        <button onClick={() => handleSendWhatsApp(c, 'reminder')} className="flex items-center justify-center gap-1 px-2 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-[11px] font-bold flex-1 active:scale-95 transition-all">
                                                            <AlertCircle size={12} /> Nudge
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button onClick={() => handleSendWhatsApp(c, 'thankyou')} className="flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[11px] font-bold flex-1 active:scale-95 transition-all">
                                                        <MessageCircle size={12} /> Thanks
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-slate-200">
                                                <button onClick={() => openHistory(c)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><History size={14} /></button>
                                                <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={14} /></button>
                                                <button onClick={() => confirmDelete(c._id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* ✅ FIX: Fully responsive desktop table without max-width constraints */}
                        <div className="hidden lg:block w-full overflow-x-auto">
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
                                        <th className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Phone</th>
                                        <th className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                                        <th className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Daily Action</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Manage</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredCustomers.map((c) => {
                                        const todayStatus = getTodayStatus(c.dailyStatus);
                                        const hasActionToday = todayStatus === 'Cleaned' || todayStatus === 'Missed';

                                        return (
                                            <tr key={c._id} className="hover:bg-slate-50/50 transition-colors group bg-white">
                                                <td className="px-6 py-4 font-bold text-slate-900 text-sm">
                                                    {c.name} <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-1">{c.gender?.charAt(0).toUpperCase() || 'M'}</span>
                                                </td>
                                                <td className="px-4 py-4 text-slate-600 font-medium text-sm">+91 {c.phone}</td>
                                                <td className="px-4 py-4 font-black text-slate-900 text-sm">₹{c.amount || c.monthlyAmount}</td>
                                                <td className="px-4 py-4">
                                                    <StatusBadge status={c.status} />
                                                    {c.missedDays > 0 && (
                                                        <span className="block mt-1 text-[10px] font-bold text-rose-500">
                                                            {c.missedDays} missed
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4">
                                                    {c.paymentId ? (
                                                        hasActionToday ? (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <span className={`px-2 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide ${todayStatus === 'Cleaned' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                                    {todayStatus}
                                                                </span>
                                                                <button
                                                                    onClick={() => updateDailyStatus(c.paymentId, "None")}
                                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                                                    title="Undo action"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex gap-2 justify-center">
                                                               
                                                                <button onClick={() => updateDailyStatus(c.paymentId, "Missed")} className="px-3 py-1.5 bg-slate-100 hover:bg-rose-600 text-slate-600 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95">
                                                                    <XCircle size={14} strokeWidth={3} /> Miss
                                                                </button>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <div className="text-center">
                                                            <span className="text-slate-400 text-[10px] font-semibold bg-slate-100 px-2 py-1 rounded uppercase tracking-wide">No record</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {c.paymentId && (
                                                            <button onClick={() => togglePaymentStatus(c.paymentId)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${c.status === 'Pending' ? 'bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-700'}`}>
                                                                {c.status === 'Pending' ? 'Mark Paid' : 'Mark Pending'}
                                                            </button>
                                                        )}

                                                        {c.status === 'Pending' || c.status === 'No Record' ? (
                                                            <>
                                                                <button onClick={() => handleSendWhatsApp(c, 'request')} className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-all active:scale-95" title="Send Request">
                                                                    <MessageCircle size={14} /> Whatsapp
                                                                </button>
                                                                <button onClick={() => handleSendWhatsApp(c, 'reminder')} className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition-all active:scale-95" title="Send Reminder">
                                                                    <AlertCircle size={14} /> Reminder
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button onClick={() => handleSendWhatsApp(c, 'thankyou')} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all active:scale-95" title="Send Thank You">
                                                                <MessageCircle size={14} /> Thanks
                                                            </button>
                                                        )}

                                                        <div className="flex items-center gap-0.5 ml-2 pl-2 border-l border-slate-200">
                                                            <button onClick={() => openHistory(c)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View History"><History size={16} /></button>
                                                            <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Customer"><Edit size={16} /></button>
                                                            <button onClick={() => confirmDelete(c._id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Deactivate Customer"><Trash2 size={16} /></button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ADD/EDIT CUSTOMER MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[95%] sm:max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-bold text-slate-900">{editingId ? "Edit Customer" : "Add New Customer"}</h3>
                            <button onClick={resetForm} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-all"><X size={20} strokeWidth={2.5} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. Rahul Sharma" className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all" required />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gender</label>
                                <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all" required>
                                    <option value="male">Male (Sir)</option>
                                    <option value="female">Female (Ma'am)</option>
                                    <option value="other">Other (General)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                                <div className="flex border border-slate-300 rounded-xl overflow-hidden focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-600 transition-all bg-white">
                                    <span className="flex items-center justify-center px-3 sm:px-4 bg-slate-50 text-slate-500 font-medium border-r border-slate-300">+91</span>
                                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="98765 43210" className="w-full px-4 py-3 text-slate-900 outline-none bg-transparent" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Monthly Amount (₹)</label>
                                <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} placeholder="e.g. 500" className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all" required />
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
                                <button type="button" onClick={resetForm} className="px-5 py-2.5 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl font-bold transition-all w-full sm:w-auto text-center">Cancel</button>
                                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"><Save size={18} strokeWidth={3} /> {editingId ? 'Update' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SINGLE CUSTOMER HISTORY MODAL */}
            {historyModalOpen && selectedCustomer && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[95%] sm:max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Payment History</h3>
                                <p className="text-sm font-semibold text-slate-500">{selectedCustomer.name}</p>
                            </div>
                            <button onClick={() => setHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-2 rounded-full transition-all"><X size={20} strokeWidth={2.5} /></button>
                        </div>

                        <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center shrink-0">
                            <span className="font-bold text-indigo-800">Total Collected:</span>
                            <span className="text-xl font-black text-indigo-600">₹{totalPaidBySelected}</span>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto bg-white flex-1">
                            {customerHistory.length === 0 ? (
                                <div className="text-center py-6 text-slate-500">
                                    <Clock className="mx-auto mb-2 opacity-20" size={32} />
                                    <p className="font-medium">No payment history recorded yet.</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {customerHistory.map((record) => (
                                        <li key={record._id} className="flex flex-col p-3 rounded-xl border border-slate-100 bg-slate-50">
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex items-center gap-2">
                                                    {record.status === 'Paid' ? (
                                                        <div className="bg-emerald-100 text-emerald-600 p-1 rounded-full"><CheckCircle2 size={14} strokeWidth={3} /></div>
                                                    ) : (
                                                        <div className="bg-rose-100 text-rose-600 p-1 rounded-full"><AlertCircle size={14} strokeWidth={3} /></div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-slate-800">{record.month}</p>
                                                    </div>
                                                </div>
                                                <span className={`font-black ${record.status === 'Paid' ? 'text-emerald-600' : 'text-rose-600'}`}>₹{record.amount}</span>
                                            </div>
                                            {record.paidDate && <span className="text-xs font-semibold text-slate-400 ml-7">Paid on: {record.paidDate}</span>}
                                            {record.missedDays > 0 && (
                                                <div className="mt-2 ml-7">
                                                    <span className="text-xs text-rose-500 font-bold">Missed days that month: {record.missedDays}</span>
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
                            <button onClick={() => setHistoryModalOpen(false)} className="px-5 py-2.5 w-full text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl font-bold transition-all shadow-sm">Close History</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;