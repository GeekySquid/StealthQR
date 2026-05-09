import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Copy, DownloadCloud, Lock, AlertCircle, Loader } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ShareRecord } from "../types";
import { supabase } from "../lib/supabase";

export default function Download() {
  const { id } = useParams();
  const [share, setShare] = useState<ShareRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Realtime Status State
  const [uploadProgress, setUploadProgress] = useState(100);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(true);
  const [uploadSpeed, setUploadSpeed] = useState("");

  useEffect(() => {
    const fetchShareDetails = async () => {
      try {
        const response = await fetch(`/api/share/${id}`);
        if (!response.ok) {
           setError("Share link expired or invalid.");
           setLoading(false);
           return;
        }

        const data = await response.json();
        if (data) {
          setShare(data);
          // Subscribe to live status
          const channel = supabase.channel(`share-${id}`);
          channel.on('broadcast', { event: 'upload-status' }, (payload) => {
             const { progress, speed, isUploading, isCompleted } = payload.payload;
             setUploadProgress(progress);
             setUploadSpeed(speed);
             setIsUploading(isUploading);
             setIsCompleted(isCompleted);
          }).subscribe();

        } else {
          setError("Share link not found.");
        }
      } catch (err) {
        console.error(err);
        setError("Error fetching share details.");
      }
      setLoading(false);
    };

    if (id) fetchShareDetails();
    return () => {
       supabase.removeAllChannels();
    };
  }, [id]);

  const handleDownload = async () => {
     if (!share || isUploading) return;
     try {
       // Authenticate using the new backend endpoint
       const res = await fetch(`/api/share/${id}/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password })
       });

       const data = await res.json();
       if (!res.ok) {
          setPasswordError(data.error || "Authentication failed.");
          return;
       }

       const downloadUrl = `/api/download/${id}?token=${data.token}`;
       
       // Creating a temporary anchor link to initiate download
       const a = document.createElement('a');
       a.href = downloadUrl;
       a.download = share.file_name;
       document.body.appendChild(a);
       a.click();
       document.body.removeChild(a);
     } catch (e: any) {
       setPasswordError("Network error: " + e.message);
     }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center flex flex-col items-center">
           <div className="w-16 h-1 bg-zinc-900 overflow-hidden mb-6">
              <div className="h-full bg-emerald-500 animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite]"></div>
           </div>
           <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] text-emerald-500">
             Establishing Secure Tunnel
           </div>
         </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black text-white flex flex-col font-sans overflow-hidden selection:bg-emerald-500/30">
      <header className="flex justify-between items-center px-4 md:px-8 lg:px-12 py-6 border-b border-zinc-800 shrink-0">
        <div className="text-2xl font-black tracking-tighter uppercase">StealthQR<span className="text-zinc-500 ml-1">/v1.0</span></div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden sm:flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-emerald-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Proxy: Connected
          </div>
        </div>
      </header>
      
      <main className="flex-grow flex flex-col justify-center items-center p-6 md:p-12 relative overflow-y-auto min-h-0">
        <div className="absolute -left-20 top-40 text-[180px] xl:text-[240px] leading-none font-black opacity-[0.02] -rotate-90 select-none pointer-events-none tracking-tighter mix-blend-overlay hidden lg:block">
           DOWNLOAD
        </div>

        <div className="w-full max-w-4xl z-10 flex flex-col flex-1 justify-center py-8">
            {error ? (
              <div className="flex flex-col items-center text-center">
                 <AlertCircle className="w-16 h-16 text-red-500 mb-8 opacity-80" />
                 <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase text-white mb-4">Connection Failed</h1>
                 <p className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-xs md:text-sm">{error}</p>
                 <div className="mt-12 h-1 w-24 bg-red-900/50"></div>
              </div>
            ) : share ? (
              <div className="w-full">
                <div className="flex flex-col gap-2">
                  <div className={`text-[10px] md:text-xs font-black px-2 py-0.5 w-fit uppercase ${isUploading ? 'bg-white text-black animate-pulse' : 'bg-emerald-500 text-black'}`}>
                    {isUploading ? 'Uplink In Progress' : 'Stream Ready'}
                  </div>
                  <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tighter leading-[0.85] truncate max-w-full pb-2" title={share.file_name}>
                    {share.file_name}
                  </h1>
                  
                  <div className="flex flex-col mt-4 md:mt-8">
                     <span className="text-2xl sm:text-3xl md:text-4xl font-light font-mono text-zinc-300">{formatBytes(share.size)}</span>
                     <span className="text-[10px] uppercase text-zinc-600 font-bold tracking-widest mt-1">Total Payload</span>
                  </div>
                  
                  {isUploading && (
                    <div className="w-full mt-8 max-w-2xl bg-zinc-900 border border-zinc-800 p-6 rounded-sm">
                       <div className="w-full h-1 md:h-2 bg-black overflow-hidden mb-4">
                         <div className="h-full bg-white transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }}></div>
                       </div>
                       <div className="flex justify-between text-[9px] md:text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                         <div>Speed: <span className="text-white">{uploadSpeed || "..."}</span></div>
                         <div>Progress: <span className="text-white">{uploadProgress}%</span></div>
                       </div>
                    </div>
                  )}
                </div>

                <div className="mt-12 md:mt-16 max-w-2xl space-y-8">
                   {share.password_hash && (
                     <div className="bg-zinc-900/50 border border-zinc-800 p-6 md:p-8 rounded-sm space-y-4">
                        <div className="flex items-center gap-3 text-white">
                           <Lock className="w-5 h-5 text-emerald-500" />
                           <div>
                             <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em]">Vault Locked</div>
                             <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">Authentication required for decryption stream</div>
                           </div>
                        </div>
                        <div className="relative group">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="ENTER PASSPHRASE"
                            value={password}
                            onChange={(e) => {
                               setPassword(e.target.value);
                               setPasswordError("");
                            }}
                            className={`bg-black border ${passwordError ? 'border-red-500 focus-visible:ring-red-500' : 'border-zinc-800 focus-visible:ring-emerald-500'} text-white font-mono rounded-none h-12 md:h-14 uppercase tracking-widest text-[10px] md:text-xs pr-12 transition-all duration-300`}
                          />
                          <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-emerald-500 transition-colors"
                          >
                            {showPassword ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-in fade-in zoom-in duration-300"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-in fade-in zoom-in duration-300"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                            )}
                          </button>
                        </div>
                        {passwordError && <p className="text-red-500 font-bold tracking-widest uppercase text-[9px] md:text-[10px]">{passwordError}</p>}
                     </div>
                   )}

                   <button
                     onClick={handleDownload}
                     disabled={isUploading}
                     className={`w-full transition-colors py-5 md:py-6 rounded-sm font-black uppercase tracking-[0.2em] text-xs md:text-sm flex justify-center items-center gap-3 ${isUploading ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-white text-black hover:bg-zinc-200'}`}
                   >
                     {isUploading ? 'Waiting for sender...' : 'Initiate Secure Download'} <DownloadCloud className="w-5 h-5" />
                   </button>
                   
                   <div className="pt-8 border-t border-zinc-900 mt-8 grid grid-cols-2 md:grid-cols-3 gap-6">
                      <div>
                         <div className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Content Type</div>
                         <div className="text-xs font-mono text-zinc-300 truncate" title={share.content_type}>{share.content_type}</div>
                      </div>
                      <div>
                         <div className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1">Network</div>
                         <div className="text-xs font-mono text-emerald-500">Tunneled</div>
                      </div>
                   </div>
                </div>
              </div>
            ) : null}
        </div>
      </main>

      <footer className="h-10 md:h-12 border-t border-zinc-800 bg-zinc-950 flex items-center px-6 md:px-12 justify-between text-[8px] md:text-[10px] font-bold uppercase tracking-widest md:tracking-[0.3em] text-zinc-600 shrink-0">
        <div className="hidden md:block">Network: Secure Tunneled</div>
        <div className="hidden md:block">Web Streams API: Streaming</div>
        <div>Next.js 14 • Edge Ready</div>
      </footer>
    </div>
  );
}
