import React, { useState, useEffect } from 'react';
import {
  Activity,
  Battery,
  BatteryCharging,
  Globe,
  MapPin,
  Monitor,
  RefreshCw,
  Send,
  CheckCircle2,
  XCircle,
  Terminal,
  Layers,
  Clock
} from 'lucide-react';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [useMockBackend, setUseMockBackend] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);

  // Deployment configuration markers — Version bumped to verify pipeline deployment
  const BUILD_VERSION = "v1.0.18-live";
  const BUILD_TIMESTAMP = new Date().toLocaleTimeString();

  const addLog = (msg, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, msg, type }]);
  };

  // Collect Hardware & Browser Metrics
  const collectMetrics = async () => {
    addLog("Gathering browser & hardware telemetry...", "info");
    const battery = navigator.getBattery ? await navigator.getBattery() : null;

    const data = {
      batteryLevel: battery ? Math.round(battery.level * 100) : "N/A",
      isCharging: battery ? battery.charging : false,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timestamp: new Date().toISOString(),
    };

    setMetrics(data);
    addLog("Hardware metrics captured successfully.", "success");
    return data;
  };

  // Request GPS Coordinates
  const collectLocation = () => {
    return new Promise((resolve) => {
      addLog("Requesting GPS location permissions...", "info");
      if (!navigator.geolocation) {
        addLog("Geolocation API not supported on this browser.", "warn");
        resolve({ error: "Geolocation unavailable" });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: `${Math.round(pos.coords.accuracy)}m`,
          };
          setLocation(loc);
          addLog(`GPS Position Acquired: ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`, "success");
          resolve(loc);
        },
        (err) => {
          addLog(`GPS Access Denied/Failed: ${err.message}`, "warn");
          const fallbackLoc = { latitude: 28.6139, longitude: 77.2090, accuracy: "Simulated" };
          setLocation(fallbackLoc);
          resolve(fallbackLoc);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  // Main Tracking Dispatch Function
  const handleExecuteTracking = async () => {
    setLoading(true);
    setStatus(null);
    setLogs([]);
    addLog(`Initiating Verification Check [Version ${BUILD_VERSION}]`, "info");

    try {
      const clientMetrics = await collectMetrics();
      const clientLocation = await collectLocation();

      const payload = {
        metrics: clientMetrics,
        location: clientLocation,
        _meta: {
          version: BUILD_VERSION,
          environment: "CI/CD Deployment Test",
        },
      };

      addLog("Preparing payload dispatch...", "info");

      if (useMockBackend) {
        // Simulated Backend Response
        await new Promise((res) => setTimeout(res, 800));
        addLog("POST /api/v1/track-location 200 OK (Mocked Backend Response)", "success");
        setStatus({ success: true, message: "Payload processed cleanly by simulated endpoint." });
      } else {
        // Real Backend Call
        addLog("POST /api/v1/track-location -> Sending request...", "info");
        const res = await fetch("/api/v1/track-location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: Endpoint not reachable.`);

        const data = await res.json();
        addLog("Payload delivered to live server!", "success");
        setStatus({ success: true, message: data.message || "Live API call successful!" });
      }
    } catch (err) {
      addLog(`Tracking Dispatch Error: ${err.message}`, "error");
      setStatus({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    collectMetrics();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header Bar */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Activity className="w-7 h-7 text-emerald-400 animate-pulse" />
              <h1 className="text-2xl font-bold tracking-wide">CI/CD Live Deployment Tracker</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">Real-time system telemetry & pipeline push verification</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              {BUILD_VERSION}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded-full border border-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Build Time: {BUILD_TIMESTAMP}
            </span>
          </div>
        </header>

        {/* Control Toolbar & Backend Switch */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useMockBackend}
                onChange={(e) => setUseMockBackend(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
            <span className="text-sm font-medium text-slate-300">
              {useMockBackend ? "Mock Mode (CI/CD Pipeline Safe)" : "Live Backend Server Mode"}
            </span>
          </div>

          <button
            onClick={handleExecuteTracking}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-medium text-sm rounded-lg transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? "Running Verification..." : "Run Live Verification Push"}
          </button>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Device Metrics Card */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-slate-400 font-semibold text-sm flex items-center gap-2">
                <Monitor className="w-4 h-4 text-indigo-400" /> Device Telemetry
              </span>
              <span className="text-xs text-slate-500">Hardware</span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Battery Level</span>
                <span className="font-mono text-slate-200 flex items-center gap-1">
                  {metrics?.isCharging ? <BatteryCharging className="w-4 h-4 text-emerald-400" /> : <Battery className="w-4 h-4 text-slate-400" />}
                  {metrics ? `${metrics.batteryLevel}%` : "Reading..."}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Platform</span>
                <span className="font-mono text-slate-200">{metrics?.platform || "Detecting..."}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Resolution</span>
                <span className="font-mono text-slate-200">{metrics?.screenResolution || "Detecting..."}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Language</span>
                <span className="font-mono text-slate-200">{metrics?.language || "Detecting..."}</span>
              </div>
            </div>
          </div>

          {/* Location Details Card */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-slate-400 font-semibold text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" /> GPS Location
              </span>
              <span className="text-xs text-slate-500">Geolocation</span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Latitude</span>
                <span className="font-mono text-slate-200">
                  {location ? location.latitude : "Not captured"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Longitude</span>
                <span className="font-mono text-slate-200">
                  {location ? location.longitude : "Not captured"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Accuracy</span>
                <span className="font-mono text-slate-200">{location?.accuracy || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Verification Status Card */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-slate-400 font-semibold text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" /> Push Status
              </span>
              <span className="text-xs text-slate-500">Verification</span>
            </div>

            {status ? (
              <div className={`p-4 rounded-lg border ${status.success ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {status.success ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  {status.success ? "Verification Passed" : "Verification Failed"}
                </div>
                <p className="text-xs mt-2 opacity-80">{status.message}</p>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-800 text-slate-400 text-xs text-center">
                Click "Run Live Verification Push" to test payload transmission.
              </div>
            )}
          </div>

        </div>

        {/* Live Terminal Output Console */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-400 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" /> Pipeline Verification Console Logs
            </span>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-slate-500 hover:text-slate-300 transition cursor-pointer"
            >
              Clear Logs
            </button>
          </div>

          <div className="p-4 font-mono text-xs h-48 overflow-y-auto space-y-2 bg-slate-950/50">
            {logs.length === 0 ? (
              <span className="text-slate-600 italic">No logs recorded yet. Run a verification check.</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                  <span className={
                    log.type === 'success' ? 'text-emerald-400' :
                      log.type === 'error' ? 'text-rose-400' :
                        log.type === 'warn' ? 'text-amber-400' : 'text-slate-300'
                  }>
                    {log.msg}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}