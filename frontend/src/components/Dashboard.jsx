import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, IndianRupee, AlertCircle, Plus, X, Save, MessageCircle, CheckCircle2, Clock, Edit, Trash2, Search, History, CalendarDays } from 'lucide-react';

const API_URL = 'https://autoflow-manager.onrender.com/api/customers';

const Dashboard = () => {
    const [dashboardData, setDashboardData] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerHistory, setCustomerHistory] = useState([]);

    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        name: '', phone: '', amount: '', gender: 'male'
    });

    const getCurrentMonthStr = () => {
        return new Date().toLocaleString("default", { month: "long", year: "numeric" });
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const currentMonth = getCurrentMonthStr();
            const [customersRes, paymentsRes] = await Promise.all([
                axios.get(API_URL),
                axios.get(`${API_URL}/payments?month=${currentMonth}`)
            ]);

            const customers = customersRes.data;
            const currentPayments = paymentsRes.data;

            const mergedData = customers.map(customer => {
                const paymentRecord = currentPayments.find(p =>
                    (p.customerId?._id || p.customerId) === customer._id
                );

                return {
                    ...customer,
                    paymentId: paymentRecord?._id || null,
                    status: paymentRecord?.status || 'No Record',
                    paidDate: paymentRecord?.paidDate || null
                };
            });

            setDashboardData(mergedData);
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        }
    };

    const totalCustomers = dashboardData.length;
    const expectedRevenue = dashboardData.reduce((sum, c) => sum + (c.monthlyAmount || 0), 0);
    const collectedRevenue = dashboardData.reduce((sum, c) => c.status === 'Paid' ? sum + (c.monthlyAmount || 0) : sum, 0);
    const pendingDues = dashboardData.reduce((sum, c) => (c.status === 'Pending' || c.status === 'No Record') ? sum + (c.monthlyAmount || 0) : sum, 0);

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
        };

        try {
            if (editingId) {
                await axios.put(`${API_URL}/${editingId}`, payload);
            } else {
                await axios.post(API_URL, payload);
            }
            resetForm();
            fetchDashboardData();
        } catch (error) {
            console.error("Failed to save customer:", error);
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

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this customer?")) {
            try {
                await axios.delete(`${API_URL}/${id}`);
                fetchDashboardData();
            } catch (error) {
                console.error("Failed to delete customer:", error);
            }
        }
    };

    const startNewMonth = async () => {
        if (window.confirm(`Start billing cycle for ${getCurrentMonthStr()}?`)) {
            try {
                await axios.post(`${API_URL}/start-month`);
                fetchDashboardData();
            } catch (error) {
                console.error("Failed to start new month:", error);
            }
        }
    };

    const togglePaymentStatus = async (paymentId) => {
        if (!paymentId) return alert("No payment record found for this month.");
        try {
            await axios.patch(`${API_URL}/payment/${paymentId}/toggle`);
            fetchDashboardData();
        } catch (error) {
            console.error("Failed to toggle payment:", error);
        }
    };

    const openHistory = async (customer) => {
        setSelectedCustomer(customer);
        setHistoryModalOpen(true);
        try {
            const res = await axios.get(`${API_URL}/${customer._id}/history`);
            setCustomerHistory(res.data);
        } catch (error) {
            console.error("Failed to fetch history:", error);
        }
    };

    const totalPaidBySelected = customerHistory
        .filter(record => record.status === 'Paid')
        .reduce((sum, record) => sum + record.amount, 0);


    // 🔥 UPDATED: Now points to your backend to handle the deep link routing perfectly
   const generatePaymentData = (customer) => {
  return {
    payLink: `https://autoflow-manager.onrender.com/api/customers/pay?amount=${customer.monthlyAmount}`,
    confirmLink: `https://autoflow-manager.onrender.com/api/customers/confirm?customerId=${customer._id}`
  };
};

   const handleSendWhatsApp = (customer, type) => {
    const { name, phone, monthlyAmount, gender } = customer;

    const month = new Date().toLocaleString("default", {
        month: "long",
        year: "numeric"
    });

    const honorific =
        gender === "female" ? " Ma'am" :
        gender === "male" ? " Sir" : "";

    // ✅ NEW LINKS
    const { payLink, confirmLink } = generatePaymentData(customer);

    let message = "";

    if (type === "request") {
        message = `Hello ${name}${honorific},

This is a reminder for your ${month} car cleaning fee of ₹${monthlyAmount}.

👉 Click & Pay:
${payLink}

✅ After payment, confirm here:
${confirmLink}

UPI ID: quicklyajithda3@okicici

Thank you! 🚗✨`;
    } 
    else if (type === "reminder") {
        message = `Hi ${name}${honorific},

Your payment of ₹${monthlyAmount} for ${month} is still pending.

⚡ Pay Now:
${payLink}

✅ After payment, confirm here:
${confirmLink}

Please clear dues soon.

Thanks!`;
    } 
    else if (type === "thankyou") {
        message = `Hi ${name}${honorific},

Payment of ₹${monthlyAmount} received!

Thank you for choosing us! 🚗💧`;
    }

    let cleanPhone = phone.toString().replace(/\D/g, "");
    if (cleanPhone.length === 10) {
        cleanPhone = "91" + cleanPhone;
    }

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
};

    const filteredCustomers = dashboardData.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans relative">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <span className="text-blue-600">🚗</span> AutoFlow Manager
                    </h1>
                    <p className="text-slate-500 mt-1">Track monthly subscriptions and automate payment reminders.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button onClick={startNewMonth} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 flex-1 md:flex-none">
                        <CalendarDays size={20} className="text-indigo-600" /> Start New Month
                    </button>
                    <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 flex-1 md:flex-none">
                        <Plus size={20} strokeWidth={2.5} /> Add Customer
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Users size={20} /></div>
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Customers</h2>
                    </div>
                    <p className="text-3xl font-extrabold text-slate-900">{totalCustomers}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-slate-50 p-2 rounded-lg text-slate-600"><IndianRupee size={20} /></div>
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Expected</h2>
                    </div>
                    <p className="text-3xl font-extrabold text-slate-900">₹{expectedRevenue}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><CheckCircle2 size={64} className="text-emerald-500" /></div>
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                        <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><CheckCircle2 size={20} /></div>
                        <h2 className="text-sm font-semibold text-emerald-700 uppercase tracking-wider">Collected</h2>
                    </div>
                    <p className="text-3xl font-extrabold text-emerald-700 relative z-10">₹{collectedRevenue}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-rose-100 flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><AlertCircle size={64} className="text-rose-500" /></div>
                    <div className="flex items-center gap-3 mb-2 relative z-10">
                        <div className="bg-rose-50 p-2 rounded-lg text-rose-600"><Clock size={20} /></div>
                        <h2 className="text-sm font-semibold text-rose-700 uppercase tracking-wider">Pending</h2>
                    </div>
                    <p className="text-3xl font-extrabold text-rose-600 relative z-10">₹{pendingDues}</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:justify-between md:items-center bg-slate-50/50 gap-4">
                    <h2 className="text-lg font-bold text-slate-900">Active Subscriptions</h2>
                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input type="text" placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                    </div>
                </div>

                {filteredCustomers.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center">
                        <div className="bg-slate-100 p-5 rounded-full mb-4 text-slate-400"><Users size={36} strokeWidth={1.5} /></div>
                        <h3 className="text-slate-900 font-bold text-xl mb-2">No customers found</h3>
                        <p className="text-slate-500 max-w-sm mb-6 leading-relaxed">
                            {searchTerm ? "No customers match your search criteria." : "Add your first car cleaning customer to start tracking monthly payments."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredCustomers.map((c) => (
                                    <tr key={c._id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                                            {c.name} <span className="text-xs font-normal text-slate-400 ml-1">({c.gender?.charAt(0).toUpperCase() || 'M'})</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">+91 {c.phone}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">₹{c.monthlyAmount}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {c.status === 'Paid' ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Paid</span>
                                            ) : c.status === 'Pending' ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">Pending</span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">No Record</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap flex items-center justify-end gap-3">
                                            {c.paymentId && (
                                                <button
                                                    onClick={() => togglePaymentStatus(c.paymentId)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all mr-2 ${c.status === 'Pending'
                                                        ? 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700'
                                                        }`}
                                                >
                                                    {c.status === 'Pending' ? 'Mark Paid' : 'Mark Pending'}
                                                </button>
                                            )}

                                            {c.status === 'Pending' || c.status === 'No Record' ? (
                                                <>
                                                    <button onClick={() => handleSendWhatsApp(c, 'request')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 rounded-lg text-sm font-semibold transition-all" title="Send Request">
                                                        <MessageCircle size={16} /> Msg
                                                    </button>
                                                    <button onClick={() => handleSendWhatsApp(c, 'reminder')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 rounded-lg text-sm font-semibold transition-all" title="Send Reminder">
                                                        <AlertCircle size={16} /> Remind
                                                    </button>
                                                </>
                                            ) : (
                                                <button onClick={() => handleSendWhatsApp(c, 'thankyou')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 rounded-lg text-sm font-semibold transition-all" title="Send Thank You">
                                                    <MessageCircle size={16} /> Thanks
                                                </button>
                                            )}

                                            <div className="flex items-center gap-1 ml-2 pl-3 border-l border-slate-200">
                                                <button onClick={() => openHistory(c)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View Payment History">
                                                    <History size={18} />
                                                </button>
                                                <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Customer">
                                                    <Edit size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(c._id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Customer">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-bold text-slate-900">{editingId ? "Edit Customer" : "Add New Customer"}</h3>
                            <button onClick={resetForm} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-full transition-all"><X size={20} strokeWidth={2.5} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
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
                                    <span className="flex items-center justify-center px-4 bg-slate-50 text-slate-500 font-medium border-r border-slate-300">+91</span>
                                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="98765 43210" className="w-full px-4 py-3 text-slate-900 outline-none bg-transparent" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Monthly Amount (₹)</label>
                                <input type="number" name="amount" value={formData.amount} onChange={handleInputChange} placeholder="e.g. 500" className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 outline-none transition-all" required />
                            </div>
                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                                <button type="button" onClick={resetForm} className="px-5 py-2.5 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl font-semibold transition-all">Cancel</button>
                                <button type="submit" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md active:scale-95 transition-all flex items-center gap-2"><Save size={18} strokeWidth={2.5} /> {editingId ? 'Update' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {historyModalOpen && selectedCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Payment History</h3>
                                <p className="text-sm text-slate-500">{selectedCustomer.name}</p>
                            </div>
                            <button onClick={() => setHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-2 rounded-full transition-all"><X size={20} strokeWidth={2.5} /></button>
                        </div>
                        <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                            <span className="font-semibold text-indigo-800">Total Collected:</span>
                            <span className="text-xl font-bold text-indigo-600">₹{totalPaidBySelected}</span>
                        </div>
                        <div className="p-6 overflow-y-auto bg-white">
                            {customerHistory.length === 0 ? (
                                <div className="text-center py-6 text-slate-500">
                                    <Clock className="mx-auto mb-2 opacity-20" size={32} />
                                    <p>No payment history recorded yet.</p>
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
                                                    <span className="font-bold text-slate-800">{record.month}</span>
                                                </div>
                                                <span className={`font-bold ${record.status === 'Paid' ? 'text-emerald-600' : 'text-rose-600'}`}>₹{record.amount}</span>
                                            </div>
                                            {record.paidDate && <span className="text-xs text-slate-400 ml-7">Paid on: {record.paidDate}</span>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button onClick={() => setHistoryModalOpen(false)} className="px-5 py-2 w-full text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl font-semibold transition-all">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;