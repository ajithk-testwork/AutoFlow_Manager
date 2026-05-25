import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';
import { 
    Mail, Lock, Briefcase, User, Phone, LayoutDashboard, 
    CheckCircle2, XCircle, IndianRupee, Eye, EyeOff 
} from 'lucide-react';

// Custom Impressive Circular Loader
const CircularLoader = () => (
    <div className="relative flex items-center justify-center w-6 h-6">
        {/* Semi-transparent background ring */}
        <svg className="absolute inset-0 w-full h-full text-white/20" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4.5" stroke="currentColor" />
        </svg>
        {/* Spinning gradient/dash ring */}
        <svg className="absolute inset-0 w-full h-full text-white animate-[spin_1s_linear_infinite]" viewBox="0 0 50 50">
            <circle
                cx="25" cy="25" r="20" fill="none" strokeWidth="4.5" stroke="currentColor"
                strokeLinecap="round"
                strokeDasharray="80 150"
                strokeDashoffset="0"
            />
        </svg>
        {/* Center glowing pulse */}
        <div className="absolute w-1.5 h-1.5 bg-white rounded-full animate-pulse shadow-[0_0_10px_3px_rgba(255,255,255,0.8)]"></div>
    </div>
);

const Auth = () => {
    const navigate = useNavigate();
    const [authView, setAuthView] = useState('login');
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [showPassword, setShowPassword] = useState(false); 
    const [isLoading, setIsLoading] = useState(false);

    const [authForm, setAuthForm] = useState({
        businessName: '', ownerName: '', email: '', whatsapp: '', password: '', upiId: '',
    });

    useEffect(() => {
        if (localStorage.getItem('token')) {
            navigate('/services');
        }
    }, [navigate]);

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    const handleAuthInputChange = (e) => {
        setAuthForm({ ...authForm, [e.target.name]: e.target.value });
    };

    const toggleView = (view) => {
        setAuthView(view);
        setShowPassword(false);
        setIsLoading(false);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true); 
        
        try {
            const res = await API.post("/login", { email: authForm.email, password: authForm.password });

            localStorage.setItem("token", res.data.token);
            localStorage.setItem("autoflow_owner", res.data.tenant?.ownerName || "Client");
            localStorage.setItem("autoflow_business", res.data.tenant?.businessName || "Your Business");
            localStorage.setItem("autoflow_upiId", res.data.tenant?.upiId || "");
            localStorage.setItem("autoflow_qrCode", res.data.tenant?.qrCode || "");

            showToast("Login successful!", "success");
            setTimeout(() => { navigate("/services"); }, 1000);
        } catch (error) {
            showToast(error.response?.data?.message || "Login failed", "error");
            setIsLoading(false); 
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setIsLoading(true); 
        
        try {
            await API.post("/register", authForm);
            showToast("Registration successful!", "success");
            toggleView("login");
        } catch (error) {
            showToast(error.response?.data?.message || "Registration failed", "error");
            setIsLoading(false); 
        } 
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-8 sm:p-8 font-sans relative overflow-x-hidden">
            
            {/* Toast Notification */}
            <div className={`fixed top-4 right-4 z-[70] transition-all duration-500 ease-out transform ${toast.show ? 'translate-x-0 opacity-100' : 'translate-x-32 opacity-0 pointer-events-none'}`}>
                <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border ${toast.type === 'error' ? 'bg-white border-rose-200' : 'bg-white border-emerald-200'}`}>
                    {toast.type === 'error' ? <div className="bg-rose-100 p-2 rounded-full text-rose-600"><XCircle size={20} /></div> : <div className="bg-emerald-100 p-2 rounded-full text-emerald-600"><CheckCircle2 size={20} /></div>}
                    <p className={`text-sm font-bold ${toast.type === 'error' ? 'text-rose-900' : 'text-emerald-900'}`}>{toast.message}</p>
                </div>
            </div>

            {/* Background Blobs */}
            <div className="fixed -top-40 -right-40 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob pointer-events-none"></div>
            <div className="fixed -bottom-40 -left-40 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="bg-white/80 backdrop-blur-xl border border-white/20 p-6 sm:p-8 rounded-3xl shadow-2xl w-full max-w-md relative z-10 flex flex-col justify-center overflow-hidden">
                
                <div className="text-center mb-6 mt-2">
                    <div className="bg-blue-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/30">
                        <LayoutDashboard size={28} />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">AutoFlow</h1>
                </div>

                {authView === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className={`space-y-4 transition-all duration-500 ${isLoading ? 'opacity-40 blur-[2px] pointer-events-none' : 'opacity-100 blur-none'}`}>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input type="email" name="email" value={authForm.email} onChange={handleAuthInputChange} required className="w-full pl-9 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="Enter your email" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        name="password" 
                                        value={authForm.password} 
                                        onChange={handleAuthInputChange} 
                                        required 
                                        className="w-full pl-9 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:bg-white transition-colors" 
                                        placeholder="••••••••" 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {/* Morphing Login Button Wrapper */}
                        <div className="flex justify-center w-full mt-6 h-12">
                            <button 
                                type="submit" 
                                disabled={isLoading}
                                className={`h-full flex items-center justify-center relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                                    isLoading
                                        ? "w-12 bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.6)] cursor-wait"
                                        : "w-full bg-slate-900 hover:bg-black text-white rounded-xl hover:shadow-lg hover:-translate-y-0.5"
                                }`}
                            >
                                {/* Text State */}
                                <span className={`absolute whitespace-nowrap text-sm font-bold transition-all duration-200 ${isLoading ? 'opacity-0 scale-75' : 'opacity-100 scale-100 delay-200'}`}>
                                    Sign In to Dashboard
                                </span>
                                
                                {/* Circular Loader State */}
                                <div className={`absolute flex items-center justify-center transition-all duration-300 ${isLoading ? 'opacity-100 scale-100 delay-200' : 'opacity-0 scale-0'}`}>
                                    <CircularLoader />
                                </div>
                            </button>
                        </div>
                        
                        <div className={`transition-all duration-500 ${isLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                            <p className="text-center text-xs text-slate-500 mt-4 font-medium">Don't have a workspace? <button type="button" onClick={() => toggleView('register')} className="text-blue-600 font-bold hover:underline">Create one</button></p>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className={`space-y-4 transition-all duration-500 ${isLoading ? 'opacity-40 blur-[2px] pointer-events-none' : 'opacity-100 blur-none'}`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Business Name</label>
                                    <div className="relative"><Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="text" name="businessName" value={authForm.businessName} onChange={handleAuthInputChange} required className="w-full pl-8 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white transition-colors" /></div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Owner Name</label>
                                    <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="text" name="ownerName" value={authForm.ownerName} onChange={handleAuthInputChange} required className="w-full pl-8 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white transition-colors" /></div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">UPI ID (Optional)</label>
                                <div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="text" name="upiId" value={authForm.upiId} onChange={handleAuthInputChange} className="w-full pl-8 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="example@upi" /></div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Email</label>
                                    <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="email" name="email" value={authForm.email} onChange={handleAuthInputChange} required className="w-full pl-8 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white transition-colors" /></div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">WhatsApp</label>
                                    <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="tel" name="whatsapp" value={authForm.whatsapp} onChange={handleAuthInputChange} className="w-full pl-8 pr-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white transition-colors" /></div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        name="password" 
                                        value={authForm.password} 
                                        onChange={handleAuthInputChange} 
                                        required 
                                        className="w-full pl-8 pr-10 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white transition-colors" 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Morphing Register Button Wrapper */}
                        <div className="flex justify-center w-full mt-4 h-11">
                            <button 
                                type="submit" 
                                disabled={isLoading}
                                className={`h-full flex items-center justify-center relative overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                                    isLoading
                                        ? "w-11 bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.6)] cursor-wait text-white"
                                        : "w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl hover:shadow-lg hover:-translate-y-0.5"
                                }`}
                            >
                                {/* Text State */}
                                <span className={`absolute whitespace-nowrap text-sm font-bold transition-all duration-200 ${isLoading ? 'opacity-0 scale-75' : 'opacity-100 scale-100 delay-200'}`}>
                                    Create Workspace
                                </span>
                                
                                {/* Circular Loader State */}
                                <div className={`absolute flex items-center justify-center transition-all duration-300 ${isLoading ? 'opacity-100 scale-100 delay-200' : 'opacity-0 scale-0'}`}>
                                    <CircularLoader />
                                </div>
                            </button>
                        </div>
                        
                        <div className={`transition-all duration-500 ${isLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                            <p className="text-center text-xs text-slate-500 mt-4 font-medium">Already registered? <button type="button" onClick={() => toggleView('login')} className="text-blue-600 font-bold hover:underline">Sign In</button></p>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Auth;