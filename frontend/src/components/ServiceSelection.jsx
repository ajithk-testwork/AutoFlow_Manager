import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';
import {
    LogOut, Briefcase, Plus, ChevronRight,
    Tag, Save, X, CheckCircle2, XCircle
} from 'lucide-react';

const ServiceSelection = () => {
    const navigate = useNavigate();
    
    // --- STATES ---
    const [services, setServices] = useState([]);
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [serviceForm, setServiceForm] = useState({ serviceName: '', description: '' });
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // --- LOCAL STORAGE DATA ---
    const token = localStorage.getItem('token');
    const ownerName = localStorage.getItem('autoflow_owner') || "Client";
    const businessName = localStorage.getItem('autoflow_business') || "Your Business";

    // --- EFFECTS ---
    useEffect(() => {
        if (!token) {
            navigate('/');
            return;
        }
        fetchServices();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    // --- HELPER: Auth Headers ---
    const getAuthHeaders = () => ({
        headers: { Authorization: `Bearer ${token}` }
    });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    // --- API CALLS ---
    const fetchServices = async () => {
        try {
            const res = await API.get("/services", getAuthHeaders());
            setServices(res.data);
        } catch (error) {
            showToast("Failed to load services.", "error");
            if (error.response?.status === 401) {
                handleLogout();
            }
        }
    };

    const handleServiceSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await API.post("/services", {
                serviceName: serviceForm.serviceName,
                description: serviceForm.description || "Workspace Core Service",
                monthlyPrice: 0 // Required by backend schema
            }, getAuthHeaders());

            showToast("Service created successfully!", "success");
            setServices([...services, res.data]); 
            setIsServiceModalOpen(false); 
            setServiceForm({ serviceName: '', description: '' }); 
        } catch (error) {
            showToast(error.response?.data?.message || "Failed to create service.", "error");
        }
    };

    // --- ACTIONS ---
    const openDashboard = (service) => {
        localStorage.setItem("selectedService", JSON.stringify(service));
        navigate("/dashboard");
    };

    const handleLogout = async () => {
        try {
            await API.post("/logout", {}, getAuthHeaders());
        } catch (error) {
            console.error("Logout failed:", error);
        }
        localStorage.clear();
        navigate("/");
    };

    // ==========================================
    // RENDER UI
    // ==========================================
    return (
        <div className="min-h-screen bg-[#f8fafc] font-sans relative overflow-x-hidden flex flex-col items-center py-8 px-4 sm:py-12 sm:px-8">
            
            {/* TOAST NOTIFICATION */}
            <div className={`fixed top-4 right-4 z-[100] transition-all duration-500 ease-out transform ${toast.show ? 'translate-x-0 opacity-100' : 'translate-x-32 opacity-0 pointer-events-none'}`}>
                <div className={`flex items-center gap-2 sm:gap-3 px-4 py-3 sm:px-5 sm:py-4 rounded-xl sm:rounded-2xl shadow-xl border ${toast.type === 'error' ? 'bg-white border-rose-200' : 'bg-white border-emerald-200'}`}>
                    {toast.type === 'error' ? (
                        <div className="bg-rose-100 p-1.5 sm:p-2 rounded-full text-rose-600"><XCircle size={18} className="sm:w-5 sm:h-5" /></div>
                    ) : (
                        <div className="bg-emerald-100 p-1.5 sm:p-2 rounded-full text-emerald-600"><CheckCircle2 size={18} className="sm:w-5 sm:h-5" /></div>
                    )}
                    <p className={`text-xs sm:text-sm font-bold ${toast.type === 'error' ? 'text-rose-900' : 'text-emerald-900'}`}>{toast.message}</p>
                </div>
            </div>

            {/* BACKGROUND GRADIENTS (Premium Feel) */}
            <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-72 h-72 sm:w-96 sm:h-96 bg-blue-300/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-80 h-80 sm:w-[500px] sm:h-[500px] bg-indigo-300/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-6xl relative z-10">
                
                {/* HEADER SECTION - Mobile Optimized */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 sm:mb-10 border-b border-slate-200 pb-5 sm:pb-6 gap-4">
                    <div className="w-full md:w-auto">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            Welcome, <span className="text-blue-600">{ownerName}</span> 👋
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-2.5">
                            <span className="bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-md uppercase tracking-wide shadow-sm truncate max-w-[200px] sm:max-w-md">
                                {businessName}
                            </span>
                            <p className="text-slate-500 font-medium text-[11px] sm:text-sm">
                                Select a workspace
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleLogout} 
                        className="w-full md:w-auto flex items-center justify-center gap-2 text-sm font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors bg-white px-5 py-2.5 sm:py-3 rounded-xl border border-slate-200 shadow-sm shrink-0 active:scale-95"
                    >
                        <LogOut size={16} /> <span>Logout</span>
                    </button>
                </div>

                {/* SERVICES GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    
                    {/* Render Existing Services */}
                    {services.map((svc) => (
                        <div 
                            key={svc._id} 
                            onClick={() => openDashboard(svc)}
                            className="group bg-white rounded-[1.5rem] p-5 sm:p-6 border border-slate-200 hover:border-blue-400 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[14rem] relative overflow-hidden"
                        >
                            {/* Card Background Decoration - Z-index fixed */}
                            <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-bl-full z-0 group-hover:scale-125 transition-transform duration-700 ease-out"></div>
                            
                            {/* Content wrapped in z-10 */}
                            <div className="relative z-10">
                                <div className="bg-blue-600 text-white w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md shadow-blue-500/20 mb-4 sm:mb-5">
                                    <Briefcase size={22} className="sm:w-6 sm:h-6" />
                                </div>
                                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight group-hover:text-blue-700 transition-colors pr-4">{svc.serviceName}</h3>
                                {svc.description && (
                                    <p className="text-xs sm:text-sm text-slate-500 mt-2 line-clamp-2 font-medium leading-relaxed pr-2">
                                        {svc.description}
                                    </p>
                                )}
                            </div>
                            
                            {/* ACTION FOOTER - Fixed Hover UI Issue */}
                            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center relative z-10">
                                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Open Dashboard</span>
                                
                                {/* New Stable Hover Icon */}
                                <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-50 border border-slate-100 group-hover:bg-blue-600 group-hover:border-blue-600 text-slate-400 group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:shadow-blue-500/30">
                                    <ChevronRight size={18} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Add New Service Card */}
                    <div 
                        onClick={() => setIsServiceModalOpen(true)}
                        className="rounded-[1.5rem] p-5 sm:p-6 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center min-h-[14rem] group bg-white/40 hover:shadow-md"
                    >
                        <div className="bg-slate-100 group-hover:bg-blue-600 text-slate-500 group-hover:text-white w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-300 mb-3 sm:mb-4 shadow-sm group-hover:shadow-blue-500/30">
                            <Plus size={28} strokeWidth={2.5} className="sm:w-8 sm:h-8" />
                        </div>
                        <h3 className="text-base sm:text-lg font-extrabold text-slate-700 group-hover:text-blue-700 transition-colors">Add New Service</h3>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">Create a new workspace</p>
                    </div>

                </div>
            </div>

            {/* ========================================== */}
            {/* ADD SERVICE MODAL - Mobile Optimized */}
            {/* ========================================== */}
            {isServiceModalOpen && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-[95%] sm:max-w-md overflow-hidden shadow-2xl border border-slate-100 transform transition-all">
                        
                        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
                                <Tag size={18} className="text-blue-600 sm:w-5 sm:h-5"/> Create Service
                            </h3>
                            <button onClick={() => setIsServiceModalOpen(false)} className="p-1.5 sm:p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                                <X size={18} className="sm:w-5 sm:h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleServiceSubmit} className="p-5 sm:p-8 space-y-4 sm:space-y-5">
                            <div>
                                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2 ml-1">Service Name</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Premium Exterior Wash" 
                                    value={serviceForm.serviceName} 
                                    onChange={(e) => setServiceForm({ ...serviceForm, serviceName: e.target.value })} 
                                    className="w-full border-2 border-slate-100 bg-slate-50 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all placeholder:font-medium placeholder:text-slate-400" 
                                    required 
                                />
                            </div>
                            
                            <div>
                                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2 ml-1">Description (Optional)</label>
                                <textarea 
                                    rows="2" 
                                    placeholder="Brief details about this service..." 
                                    value={serviceForm.description} 
                                    onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} 
                                    className="w-full border-2 border-slate-100 bg-slate-50 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-3 sm:py-3.5 text-sm focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all resize-none placeholder:font-medium placeholder:text-slate-400"
                                ></textarea>
                            </div>
                            
                            <div className="pt-2 sm:pt-4">
                                <button type="submit" className="w-full py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl sm:rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all">
                                    <Save size={18} /> Publish Service
                                </button>
                            </div>
                        </form>

                    </div>
                </div>
            )}
        </div>
    );
};

export default ServiceSelection;