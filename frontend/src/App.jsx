import { BrowserRouter, Routes, Route } from "react-router-dom";

// Make sure these paths match where you saved the files
import Auth from "./components/Auth";
import ServiceSelection from "./components/ServiceSelection";
import Dashboard from "./components/Dashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Step 1: Login & Registration */}
        <Route path="/" element={<Auth />} />

        {/* Step 2: Workspace Selection */}
        <Route path="/services" element={<ServiceSelection />} />

        {/* Step 3: Main Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;