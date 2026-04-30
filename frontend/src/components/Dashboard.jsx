import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
    Users, IndianRupee, AlertCircle, Plus, X, Save, MessageCircle,
    CheckCircle2, Clock, Edit, Trash2, Search, History, CalendarDays,
    Check, XCircle, ChevronDown, ChevronUp, AlertTriangle, Database, ArrowLeft,
    FileText, Menu, X as XIcon
} from 'lucide-react';

const API_URL = 'https://autoflow-manager.onrender.com/api/customers';

const Dashboard = () => {
    // --- VIEW SWITCHER ---
    const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'history'

    const [dashboardData, setDashboardData] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerHistory, setCustomerHistory] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPaymentDetails, setSelectedPaymentDetails] = useState(null);

    // --- GLOBAL HISTORY STATES ---
    const [globalHistoryData, setGlobalHistoryData] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [monthSearchTerm, setMonthSearchTerm] = useState('');
    const [expandedMonth, setExpandedMonth] = useState(null);
    const [initializedMonths, setInitializedMonths] = useState([]);

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

    const fetchInitializedMonths = async () => {
        try {
            const res = await axios.get(API_URL.replace('/customers', '/customers/global/history'));
            const months = res.data.map(d => d.month);
            setInitializedMonths(months);
        } catch (error) {
            console.error("Failed to load initialized months:", error);
        }
    };

    useEffect(() => {
        fetchInitializedMonths();
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
                axios.get(API_URL), 
                axios.get(`${API_URL}/payments?month=${selectedMonth}`)
            ]);

            const activeCustomers = customersRes.data;
            const currentPayments = paymentsRes.data;

            let mergedData = [];

            if (currentPayments.length > 0) {
                mergedData = currentPayments.map(paymentRecord => {
                    const customer = paymentRecord.customerId;
                    if (!customer) return null; 
                    
                    return {
                        ...customer,
                        _id: customer._id, 
                        paymentId: paymentRecord._id,
                        status: paymentRecord.status,
                        paidDate: paymentRecord.paidDate,
                        dailyStatus: paymentRecord.dailyStatus || [],
                        missedDays: paymentRecord.missedDays || 0,
                        amount: paymentRecord.amount
                    };
                }).filter(Boolean); 
            } else {
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
        setMonthSearchTerm('');
        setExpandedMonth(null);
        try {
            const res = await axios.get(API_URL.replace('/customers', '/customers/global/history'));
            setGlobalHistoryData(res.data);
            setInitializedMonths(res.data.map(d => d.month));
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
                    fetchInitializedMonths(); 
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
            .map(d => new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }))
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
    // RENDER: GLOBAL HISTORY PAGE VIEW (FULLY RESPONSIVE)
    // ==========================================
    if (currentView === 'history') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-sans flex flex-col w-full">
                {/* Header */}
                <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between sticky top-0 z-40 shadow-sm gap-3">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setCurrentView('dashboard')} 
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-all duration-200 active:scale-95"
                        >
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                                <Database className="text-indigo-600" size={22} /> 
                                <span className="truncate">Global Ledger</span>
                            </h1>
                            <p className="text-[11px] sm:text-xs text-slate-500 font-medium hidden sm:block">Database history across all months</p>
                        </div>
                    </div>
                    <div className="text-xs sm:text-sm bg-indigo-50 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-indigo-700 font-bold flex items-center gap-1 self-start sm:self-auto">
                        <Database size={14} /> {globalHistoryData.length} Months
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-3 sm:p-5 lg:p-8 w-full max-w-full overflow-y-auto">
                    {isHistoryLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 sm:py-24">
                            <Clock className="mx-auto mb-4 text-indigo-400 animate-spin" size={40} />
                            <p className="text-slate-500 font-bold">Loading ledger history...</p>
                        </div>
                    ) : globalHistoryData.length === 0 ? (
                        <div className="text-center py-16 sm:py-24 bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm max-w-md mx-auto">
                            <FileText className="mx-auto mb-3 text-slate-300" size={48} />
                            <p className="text-slate-500 font-bold text-base sm:text-lg">No billing history found.</p>
                            <button 
                                onClick={() => setCurrentView('dashboard')}
                                className="mt-4 text-indigo-600 text-sm font-semibold underline"
                            >
                                ← Back to Dashboard
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 sm:gap-6 w-full max-w-6xl mx-auto">
                            {globalHistoryData.map((data, idx) => {
                                const isExpanded = expandedMonth === data.month;
                                
                                let displayedPayments = data.payments;
                                if (isExpanded && monthSearchTerm) {
                                    displayedPayments = data.payments.filter(p => 
                                        p.customerId?.name?.toLowerCase().includes(monthSearchTerm.toLowerCase()) ||
                                        p.customerId?.phone?.includes(monthSearchTerm)
                                    );
                                }

                                return (
                                    <div key={idx} className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200">
                                        {/* Month Header - Accordion Button */}
                                        <button 
                                            onClick={() => {
                                                setExpandedMonth(isExpanded ? null : data.month);
                                                setMonthSearchTerm(''); 
                                            }}
                                            className="w-full text-left bg-gradient-to-r from-indigo-50/30 to-white hover:bg-indigo-50/50 p-4 sm:p-5 flex flex-col gap-3 transition-all"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 sm:gap-4">
                                                    <div className="bg-white p-2 sm:p-3 rounded-xl shadow-sm border border-indigo-100 text-indigo-600">
                                                        <CalendarDays size={18} className="sm:w-6 sm:h-6" />
                                                    </div>
                                                    <div className="text-left">
                                                        <h2 className="text-lg sm:text-2xl font-black text-indigo-900">{data.month}</h2>
                                                        <p className="text-[10px] sm:text-xs font-bold text-indigo-600">{data.payments.length} Customers Billed</p>
                                                    </div>
                                                </div>
                                                <div className={`p-1.5 sm:p-2 rounded-xl transition-all ${isExpanded ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-400'}`}>
                                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </div>
                                            </div>
                                            
                                            {/* Stats Row - visible even when collapsed */}
                                            <div className="flex gap-3 sm:gap-4 ml-12 sm:ml-16">
                                                <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg">
                                                    <CheckCircle2 size={14} className="text-emerald-600" />
                                                    <span className="text-xs font-bold text-emerald-700">₹{data.collected}</span>
                                                </div>
                                                <div className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-lg">
                                                    <Clock size={14} className="text-rose-600" />
                                                    <span className="text-xs font-bold text-rose-700">₹{data.pending}</span>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="border-t border-slate-100 animate-in slide-in-from-top-2 duration-200">
                                                {/* Search Bar */}
                                                <div className="p-3 sm:p-4 bg-slate-50/80 border-b border-slate-100">
                                                    <div className="relative w-full">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                        <input 
                                                            type="text" 
                                                            placeholder={`Search in ${data.month}...`}
                                                            value={monthSearchTerm} 
                                                            onChange={(e) => setMonthSearchTerm(e.target.value)} 
                                                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all bg-white" 
                                                        />
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-2 ml-1">Showing {displayedPayments.length} of {data.payments.length} records</p>
                                                </div>

                                                {/* Mobile Card View (xs to md) */}
                                                <div className="md:hidden p-3 space-y-3">
                                                    {displayedPayments.length === 0 ? (
                                                        <div className="text-center py-8 text-slate-500 text-sm">
                                                            No customers match your search in {data.month}.
                                                        </div>
                                                    ) : (
                                                        displayedPayments.map((p, i) => (
                                                            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                                                <div className="flex justify-between items-start mb-3">
                                                                    <div className="flex-1">
                                                                        <h3 className="font-bold text-slate-800 text-base">{p.customerId?.name || 'Unknown'}</h3>
                                                                        <p className="text-slate-500 text-xs mt-0.5">📞 +91 {p.customerId?.phone || ''}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="font-black text-indigo-700 text-lg">₹{p.amount}</p>
                                                                        <div className="mt-1">
                                                                            {p.status === 'Paid' ? (
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Paid</span>
                                                                            ) : p.status === 'Pending' ? (
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Pending</span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">No Record</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-slate-500 text-xs">Missed:</span>
                                                                        {p.missedDays > 0 ? (
                                                                            <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[11px] font-bold">{p.missedDays} days</span>
                                                                        ) : (
                                                                            <span className="text-slate-300 text-xs">—</span>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        {p.paidDate ? (
                                                                            <span className="text-emerald-600 text-xs font-semibold">✅ {p.paidDate}</span>
                                                                        ) : (
                                                                            <span className="text-rose-500 text-xs font-semibold">⏳ Unpaid</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                {/* Desktop Table View (md and up) */}
                                                <div className="hidden md:block overflow-x-auto">
                                                    <table className="w-full text-left border-collapse min-w-[700px]">
                                                        <thead className="bg-slate-50">
                                                            <tr className="border-b border-slate-200">
                                                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer Name</th>
                                                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Phone</th>
                                                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Missed Days</th>
                                                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Final Amount</th>
                                                                <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Paid Date</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {displayedPayments.length === 0 ? (
                                                                <tr>
                                                                    <td colSpan="6" className="px-5 py-10 text-center text-slate-500 font-medium">
                                                                        No customers match your search in {data.month}.
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                displayedPayments.map((p, i) => (
                                                                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                                                                        <td className="px-5 py-3.5 font-bold text-slate-800 text-sm">{p.customerId?.name || 'Unknown'}</td>
                                                                        <td className="px-5 py-3.5 text-slate-600 text-xs font-mono">+91 {p.customerId?.phone || ''}</td>
                                                                        <td className="px-5 py-3.5">
                                                                            {p.status === 'Paid' ? (
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Paid</span>
                                                                            ) : p.status === 'Pending' ? (
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Pending</span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">No Record</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-5 py-3.5 text-center">
                                                                            {p.missedDays > 0 ? (
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                                                                    {p.missedDays} Days
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-slate-300 text-sm">-</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-5 py-3.5 text-right font-black text-slate-900">₹{p.amount}</td>
                                                                        <td className="px-5 py-3.5 text-right text-xs font-semibold">
                                                                            {p.paidDate ? (
                                                                                <span className="text-slate-600">{p.paidDate}</span>
                                                                            ) : (
                                                                                <span className="text-rose-500">Unpaid</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }


    // ==========================================
    // RENDER: MAIN DASHBOARD VIEW
    // ==========================================
    return (
        <div className="min-h-screen bg-slate-50 p-3 sm:p-5 lg:p-8 font-sans relative w-full flex flex-col">
            
            {/* Toast Notification */}
            <div className={`fixed top-4 right-4 z-[70] transition-all duration-500 ease-out transform ${toast.show ? 'translate-x-0 opacity-100' : 'translate-x-32 opacity-0 pointer-events-none'}`}>
                <div className={`flex items-center gap-2 sm:gap-3 px-3 py-2.5 sm:px-5 sm:py-4 rounded-xl sm:rounded-2xl shadow-xl border ${toast.type === 'error' ? 'bg-white border-rose-200' : 'bg-white border-emerald-200'}`}>
                    {toast.type === 'error' ? (
                        <div className="bg-rose-100 p-1.5 sm:p-2 rounded-full text-rose-600"><XCircle size={16} className="sm:w-5 sm:h-5" /></div>
                    ) : (
                        <div className="bg-emerald-100 p-1.5 sm:p-2 rounded-full text-emerald-600"><CheckCircle2 size={16} className="sm:w-5 sm:h-5" /></div>
                    )}
                    <p className={`text-xs sm:text-sm font-bold ${toast.type === 'error' ? 'text-rose-900' : 'text-emerald-900'}`}>{toast.message}</p>
                </div>
            </div>

            {/* Confirmation Modal */}
            {confirmDialog.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-[90%] sm:max-w-sm overflow-hidden">
                        <div className="p-5 sm:p-6">
                            <div className={`mx-auto flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full mb-3 sm:mb-4 ${confirmDialog.type === 'danger' ? 'bg-rose-100' : 'bg-blue-100'}`}>
                                {confirmDialog.type === 'danger' ? <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-rose-600" /> : <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />}
                            </div>
                            <div className="text-center">
                                <h3 className="text-base sm:text-lg font-bold text-slate-900">{confirmDialog.title}</h3>
                                <p className="text-xs sm:text-sm text-slate-500 mt-2">{confirmDialog.message}</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <button
                                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                                className="px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDialog.onConfirm}
                                className={`px-4 py-2 text-sm font-bold text-white rounded-xl transition-all ${confirmDialog.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-5 lg:mb-8 gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <span className="text-blue-600 text-2xl sm:text-3xl">🚗</span> AutoFlow
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Monthly Subscription & Payment Tracker</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                    {/* Month Selector */}
                    <div className="relative w-full sm:w-auto" ref={dropdownRef}>
                        <button
                            onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                            className="w-full sm:w-56 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 px-3 py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <CalendarDays size={16} className="text-blue-600" />
                                <div className="flex flex-col items-start leading-tight">
                                    <span className="text-[9px] uppercase text-slate-500 font-semibold">Viewing</span>
                                    <span className="text-sm">{selectedMonth}</span>
                                </div>
                            </div>
                            <ChevronDown size={14} className={`text-slate-400 transition-transform ${isMonthDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isMonthDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-full sm:w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
                                {initializedMonths.includes(selectedMonth) ? (
                                    <div className="p-3 bg-gradient-to-r from-emerald-50 to-emerald-100/30 text-center">
                                        <div className="bg-emerald-500 text-white p-2 rounded-full inline-flex mb-1">
                                            <CheckCircle2 size={16} />
                                        </div>
                                        <p className="text-xs font-black text-emerald-800">✅ Billing Activated</p>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-gradient-to-r from-amber-50 to-amber-100/30">
                                        <button onClick={confirmStartMonth} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                                            <Plus size={14} /> Initialize {selectedMonth}
                                        </button>
                                    </div>
                                )}
                                <div className="max-h-56 overflow-y-auto py-1">
                                    {availableMonths.map((month) => {
                                        const isActivated = initializedMonths.includes(month);
                                        return (
                                            <button
                                                key={month}
                                                onClick={() => { setSelectedMonth(month); setIsMonthDropdownOpen(false); }}
                                                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-all ${selectedMonth === month ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                                            >
                                                <span>{month}</span>
                                                {isActivated ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Active</span>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Inactive</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={navigateToGlobalHistory} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2 text-sm">
                        <Database size={16} /> Global History
                    </button>

                    <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 text-sm">
                        <Users size={16} /> Add Customer
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-5 lg:mb-8">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600"><Users size={14} /></div>
                        <h2 className="text-[10px] font-bold text-slate-500 uppercase">Customers</h2>
                    </div>
                    <p className="text-xl sm:text-2xl font-extrabold text-slate-900">{totalCustomers}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="bg-slate-50 p-1.5 rounded-lg text-slate-600"><IndianRupee size={14} /></div>
                        <h2 className="text-[10px] font-bold text-slate-500 uppercase">Expected</h2>
                    </div>
                    <p className="text-xl sm:text-2xl font-extrabold text-slate-900">₹{expectedRevenue}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-5"><CheckCircle2 size={40} /></div>
                    <div className="flex items-center gap-2 mb-1 relative">
                        <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600"><CheckCircle2 size={14} /></div>
                        <h2 className="text-[10px] font-bold text-emerald-700 uppercase">Collected</h2>
                    </div>
                    <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 relative">₹{collectedRevenue}</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-rose-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-5"><AlertCircle size={40} /></div>
                    <div className="flex items-center gap-2 mb-1 relative">
                        <div className="bg-rose-50 p-1.5 rounded-lg text-rose-600"><Clock size={14} /></div>
                        <h2 className="text-[10px] font-bold text-rose-700 uppercase">Pending</h2>
                    </div>
                    <p className="text-xl sm:text-2xl font-extrabold text-rose-600 relative">₹{pendingDues}</p>
                </div>
            </div>

            {/* Main Table/Card Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full overflow-hidden flex flex-col flex-1">
                <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-50/50 gap-3">
                    <h2 className="text-base font-bold text-slate-900">Active Subscriptions</h2>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                    </div>
                </div>

                {filteredCustomers.length === 0 ? (
                    <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center">
                        <div className="bg-slate-100 p-4 rounded-full mb-3 text-slate-400"><Users size={28} /></div>
                        <h3 className="text-slate-900 font-bold text-base mb-1">No customers found</h3>
                        <p className="text-slate-500 text-sm">Add a customer to start tracking</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:hidden gap-3 p-4 bg-slate-50/50">
                            {filteredCustomers.map((c) => {
                                const todayStatus = getTodayStatus(c.dailyStatus);
                                const hasActionToday = todayStatus === 'Cleaned' || todayStatus === 'Missed';
                                return (
                                    <div key={c._id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-slate-900 text-base truncate">{c.name}</h3>
                                                <p className="text-slate-500 text-xs mt-0.5">+91 {c.phone}</p>
                                            </div>
                                            <div className="text-right shrink-0 ml-2">
                                                <p className="font-black text-slate-900">₹{c.amount || c.monthlyAmount}</p>
                                                <StatusBadge status={c.status} />
                                            </div>
                                        </div>
                                        {c.paymentId && (
                                            <div className="mb-3 bg-slate-50 p-2 rounded-lg">
                                                <div className="flex justify-between text-xs mb-2">
                                                    <span className="font-bold text-slate-500">Today</span>
                                                    {c.missedDays > 0 && <span className="text-rose-500 font-bold">Missed: {c.missedDays}</span>}
                                                </div>
                                                {hasActionToday ? (
                                                    <div className="flex justify-between items-center">
                                                        <span className={`text-xs font-bold ${todayStatus === 'Cleaned' ? 'text-emerald-600' : 'text-rose-600'}`}>{todayStatus}</span>
                                                        <button onClick={() => updateDailyStatus(c.paymentId, "None")} className="text-slate-400 text-xs">Undo</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => updateDailyStatus(c.paymentId, "Cleaned")} className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">Clean</button>
                                                        <button onClick={() => updateDailyStatus(c.paymentId, "Missed")} className="flex-1 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold">Miss</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                                            {c.paymentId && (
                                                <button onClick={() => togglePaymentStatus(c.paymentId)} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${c.status === 'Pending' ? 'bg-slate-100 hover:bg-emerald-100' : 'bg-slate-100 hover:bg-rose-100'}`}>
                                                    {c.status === 'Pending' ? 'Mark Paid' : 'Mark Pending'}
                                                </button>
                                            )}
                                            <button onClick={() => handleSendWhatsApp(c, 'request')} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold">Bill</button>
                                            <button onClick={() => handleSendWhatsApp(c, 'reminder')} className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg text-[10px] font-bold">Nudge</button>
                                            <div className="flex gap-1 ml-auto">
                                                <button onClick={() => openHistory(c)} className="p-1.5 text-slate-400"><History size={14} /></button>
                                                <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400"><Edit size={14} /></button>
                                                <button onClick={() => confirmDelete(c._id)} className="p-1.5 text-slate-400"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden xl:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 sticky top-0">
                                    <tr className="border-b border-slate-200">
                                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase">Customer</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Phone</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Amount</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Status</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase text-center">Daily</th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredCustomers.map((c) => {
                                        const todayStatus = getTodayStatus(c.dailyStatus);
                                        const hasActionToday = todayStatus === 'Cleaned' || todayStatus === 'Missed';
                                        return (
                                            <tr key={c._id} className="hover:bg-slate-50/50">
                                                <td className="px-5 py-3">
                                                    <div className="font-bold text-slate-800 text-sm">{c.name}</div>
                                                    <div className="text-[9px] text-slate-400">{c.gender?.charAt(0).toUpperCase() || 'M'}</div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 text-sm">+91 {c.phone}</td>
                                                <td className="px-4 py-3 font-black text-slate-900">₹{c.amount || c.monthlyAmount}</td>
                                                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                                                <td className="px-4 py-3">
                                                    {c.paymentId ? (
                                                        hasActionToday ? (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${todayStatus === 'Cleaned' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{todayStatus}</span>
                                                                <button onClick={() => updateDailyStatus(c.paymentId, "None")} className="p-1 text-slate-400"><Trash2 size={12} /></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex gap-1 justify-center">
                                                                <button onClick={() => updateDailyStatus(c.paymentId, "Cleaned")} className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold">Clean</button>
                                                                <button onClick={() => updateDailyStatus(c.paymentId, "Missed")} className="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold">Miss</button>
                                                            </div>
                                                        )
                                                    ) : <span className="text-slate-400 text-[10px]">No record</span>}
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {c.paymentId && <button onClick={() => togglePaymentStatus(c.paymentId)} className="px-2 py-1 text-[10px] font-bold bg-slate-100 rounded">Mark</button>}
                                                        <button onClick={() => handleSendWhatsApp(c, 'request')} className="p-1 text-emerald-600"><MessageCircle size={14} /></button>
                                                        <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                                        <button onClick={() => openHistory(c)} className="p-1 text-slate-400"><History size={14} /></button>
                                                        <button onClick={() => handleEdit(c)} className="p-1 text-slate-400"><Edit size={14} /></button>
                                                        <button onClick={() => confirmDelete(c._id)} className="p-1 text-slate-400"><Trash2 size={14} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                             </table>
                        </div>
                    </>
                )}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-[90%] sm:max-w-md overflow-hidden max-h-[90vh]">
                        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900">{editingId ? "Edit Customer" : "Add Customer"}</h3>
                            <button onClick={resetForm} className="p-1 hover:bg-slate-100 rounded-full"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" required />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Gender</label>
                                <select name="gender" value={formData.gender} onChange={handleInputChange} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm">
                                    <option value="male">Male (Sir)</option>
                                    <option value="female">Female (Ma'am)</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Phone</label>
                                <div className="flex border border-slate-300 rounded-xl overflow-hidden">
                                    <span className="px-3 py-2.5 bg-slate-50 text-slate-500 text-sm border-r">+91</span>
                                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="flex-1 px-3 py-2.5 text-sm outline-none" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Monthly Amount (₹)</label>
                                <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm" required />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={resetForm} className="flex-1 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-xl font-bold text-sm">Cancel</button>
                                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Save size={16} /> {editingId ? 'Update' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {historyModalOpen && selectedCustomer && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-[90%] sm:max-w-md overflow-hidden max-h-[80vh]">
                        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-900">Payment History</h3>
                                <p className="text-sm text-slate-500">{selectedCustomer.name}</p>
                            </div>
                            <button onClick={() => setHistoryModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-full"><X size={18} /></button>
                        </div>
                        <div className="p-4 bg-indigo-50 flex justify-between">
                            <span className="font-bold text-indigo-800">Total Collected:</span>
                            <span className="font-black text-indigo-600">₹{totalPaidBySelected}</span>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[50vh]">
                            {customerHistory.length === 0 ? (
                                <p className="text-center text-slate-500 py-6">No payment history.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {customerHistory.map((record) => (
                                        <li key={record._id} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    {record.status === 'Paid' ? <CheckCircle2 size={14} className="text-emerald-600" /> : <AlertCircle size={14} className="text-rose-600" />}
                                                    <span className="font-bold text-slate-800">{record.month}</span>
                                                </div>
                                                <span className={`font-black ${record.status === 'Paid' ? 'text-emerald-600' : 'text-rose-600'}`}>₹{record.amount}</span>
                                            </div>
                                            {record.paidDate && <p className="text-xs text-slate-400 ml-6 mt-1">Paid: {record.paidDate}</p>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100">
                            <button onClick={() => setHistoryModalOpen(false)} className="w-full py-2.5 text-slate-700 bg-white border border-slate-300 rounded-xl font-bold">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;