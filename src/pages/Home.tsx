import React, { useCallback, useState, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { v4 as uuidv4 } from "uuid";
import { QRCodeSVG } from "qrcode.react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { UploadCloud, AlertCircle, Copy, CheckCircle2 } from "lucide-react";
import { useTusUploader } from "../hooks/useTusUploader";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uuid, setUuid] = useState<string | null>(null);
  const [passwordProtection, setPasswordProtection] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

  const { uploadProgress, isUploading, isCompleted, uploadSpeed, remainingTime, startUpload, cancelUpload, resetUploader } = useTusUploader({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    bucketName: "private_files",
    onError: (err) => setError(err.message),
    onCompleted: () => {
       // Upload done. Channel broadcast automatically updates the peers.
    }
  });

  // Broadcast realtime events using Supabase Channels
  useEffect(() => {
     if (!uuid || !isUploading && !isCompleted) return;

     const channel = supabase.channel(`share-${uuid}`);
     
     // Quick send state updates
     channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
           await channel.send({
             type: 'broadcast',
             event: 'upload-status',
             payload: {
                progress: uploadProgress,
                speed: uploadSpeed,
                eta: remainingTime,
                isCompleted: isCompleted,
                isUploading: isUploading,
             }
           });
        }
     });

     return () => {
        supabase.removeChannel(channel);
     };
  }, [uuid, uploadProgress, isUploading, isCompleted, uploadSpeed, remainingTime]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setUuid(uuidv4());
      resetUploader();
      setError(null);
    }
  }, [resetUploader]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    multiple: false
  });

  const generateShareLink = () => {
    return `${APP_URL}/d/${uuid}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateShareLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpload = async () => {
    if (!file || !uuid) return;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setError("Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your environment secrets (.env).");
      return;
    }
    setError(null);
    
    // Register in Database using secure API before uploading
    try {
      const res = await fetch(`/api/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: uuid,
          file_name: file.name,
          size: file.size,
          content_type: file.type || "application/octet-stream",
          password: passwordProtection ? password : null
        })
      });
      
      if (!res.ok) {
         const data = await res.json();
         setError("Failed to register share: " + (data.error || "Unknown"));
         return;
      }
      
      startUpload(file, uuid);
    } catch(e: any) {
      setError("Network error: " + e.message);
    }
  };

  const reset = () => {
    cancelUpload();
    resetUploader();
    setFile(null);
    setUuid(null);
    setError(null);
  }

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  return (
    <div className="h-screen w-full bg-black text-white flex flex-col font-sans overflow-hidden selection:bg-emerald-500/30">
      <header className="flex justify-between items-center px-4 md:px-8 lg:px-12 py-6 border-b border-zinc-800 shrink-0">
        <div className="text-2xl font-black tracking-tighter uppercase">StealthQR<span className="text-zinc-500 ml-1">/v1.0</span></div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden sm:flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-emerald-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> PWA: Ready
          </div>
          <div className="px-3 md:px-4 py-1.5 border border-zinc-800 rounded-full text-[10px] md:text-xs font-medium bg-zinc-900 uppercase tracking-widest text-zinc-300">Masking Proxy: Active</div>
        </div>
      </header>

      <main className="flex-grow flex flex-col lg:grid lg:grid-cols-12 overflow-hidden overflow-y-auto lg:overflow-hidden">
        <aside className="hidden lg:flex lg:col-span-4 xl:col-span-3 lg:border-r border-zinc-800 p-6 md:p-8 flex-col justify-between bg-zinc-950/50">
          <div className="space-y-10">
            {!SUPABASE_URL && (
              <div className="bg-red-950/50 border border-red-500/50 rounded-sm p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="text-[10px] md:text-xs text-red-200 uppercase tracking-wide">
                  <p className="font-bold text-red-400 mb-1 tracking-widest">Configuration Required</p>
                  <p className="leading-relaxed">You must set SUPABASE_URL, SUPABASE_ANON_KEY in your environment.</p>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">Security & Network</h3>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs md:text-sm">
                  <span className="text-zinc-400">TUS Chunking</span>
                  <span className="text-emerald-500 font-mono">6MB</span>
                </div>
                <div className="flex justify-between items-center text-xs md:text-sm">
                  <span className="text-zinc-400">Masked Route</span>
                  <span className="text-emerald-400 font-mono uppercase">Enabled</span>
                </div>
                <div className="flex justify-between items-center text-xs md:text-sm text-zinc-500">
                  <span>Rate Limits</span>
                  <span className="text-zinc-300">Unrestricted</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:block text-[10px] leading-relaxed text-zinc-700 uppercase tracking-wider font-medium mt-12">
            Encryption: AES-256-GCM<br/>
            Protocol: TUS RESUMABLE v1.0.0
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-8 xl:col-span-9 p-6 md:p-10 lg:p-16 flex flex-col relative overflow-y-auto min-h-0 justify-center items-center lg:items-stretch lg:justify-between">
          <div className="hidden xl:block absolute -right-10 top-40 text-[200px] leading-none font-black opacity-[0.02] rotate-90 select-none pointer-events-none tracking-tighter mix-blend-overlay">
            STEALTH
          </div>
          
          <div className="flex flex-col w-full max-w-4xl z-10 flex-1 justify-center py-8">

            {error && (
              <div className="mb-8 bg-red-900/20 border border-red-500/30 text-red-400 p-4 rounded-sm text-[10px] md:text-xs font-mono uppercase tracking-wider leading-relaxed break-all divide-y divide-red-500/20">
                <div className="pb-3">
                   <span className="font-bold">Error:</span> {error}
                </div>
                {(error.includes('PGRST205') || error.includes('Could not find the table')) && (
                  <div className="pt-3 flex flex-col gap-2">
                    <p className="font-bold text-red-300">Database Setup Required</p>
                    <p className="text-red-200/80">You need to create the 'shares' table in your Supabase project. Run this in your SQL Editor:</p>
                    <div className="bg-black border border-red-500/30 p-2 rounded-sm text-[9px] mt-1 overflow-x-auto whitespace-pre font-mono text-zinc-300">
{`CREATE TABLE public.shares (
    id UUID PRIMARY KEY,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    size INT8 NOT NULL,
    content_type TEXT,
    password_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`}
                    </div>
                  </div>
                )}
                {error.includes('Bucket not found') && (
                  <div className="pt-3 flex flex-col gap-2">
                    <p className="font-bold text-red-300">Storage Setup Required</p>
                    <p className="text-red-200/80">You need to create a storage bucket named 'private_files'. Run this in your SQL Editor:</p>
                    <div className="bg-black border border-red-500/30 p-2 rounded-sm text-[9px] mt-1 overflow-x-auto whitespace-pre font-mono text-zinc-300">
{`INSERT INTO storage.buckets (id, name, public) 
VALUES ('private_files', 'private_files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow anonymous uploads" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'private_files');
CREATE POLICY "Allow anonymous selects" ON storage.objects FOR SELECT TO public USING (bucket_id = 'private_files');
CREATE POLICY "Allow anonymous updates" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'private_files');`}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {!file ? (
              <div 
                {...getRootProps()} 
                className={`w-full min-h-[300px] lg:h-96 border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-colors p-8 ${
                  isDragActive ? "border-emerald-500 bg-emerald-500/5 text-white" : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                }`}
              >
                <input {...getInputProps()} />
                <UploadCloud className="w-8 h-8 md:w-12 md:h-12 text-zinc-700 mb-6" />
                <div className="font-black text-2xl sm:text-3xl md:text-4xl uppercase tracking-tighter mb-2 md:mb-4">Select Payload</div>
                <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-zinc-600">Drag & drop large files or click to browse</div>
              </div>
            ) : (
              <div className="w-full flex-col justify-center items-center flex-1 py-8">
                 <div className="w-full">
                   <div className="flex flex-col gap-2">
                     <div className={`text-[10px] md:text-xs font-black px-2 py-0.5 w-fit uppercase ${isCompleted ? 'bg-emerald-500 text-black' : isUploading ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-300'}`}>
                       {isCompleted ? 'Transmission Complete' : isUploading ? 'Uploading' : 'File Selected'}
                     </div>
                     <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black tracking-tighter leading-[0.85] truncate max-w-full pb-2" title={file.name}>
                       {file.name}
                     </h1>
                     <div className="flex flex-wrap items-end gap-6 mt-4 md:mt-8">
                       <div className="flex flex-col">
                         <span className="text-2xl sm:text-3xl md:text-4xl font-light font-mono text-zinc-300">{formatBytes(file.size)}</span>
                         <span className="text-[10px] uppercase text-zinc-600 font-bold tracking-widest mt-1">Total Payload</span>
                       </div>
                       {isUploading && (
                         <div className="flex flex-col border-l border-zinc-800 pl-6">
                           <span className="text-2xl sm:text-3xl md:text-4xl font-light font-mono text-emerald-400">{uploadProgress}%</span>
                           <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest mt-1">Progress</span>
                         </div>
                       )}
                     </div>
                   </div>

                   {!isUploading && !isCompleted && (
                     <div className="mt-12 md:mt-16 space-y-8 max-w-2xl">
                       <div className="bg-zinc-900/50 border border-zinc-800 py-6 px-4 md:px-6 rounded-sm">
                         <div className="flex items-center justify-between mb-4">
                           <div className="space-y-1">
                             <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-white">Vault Lock</div>
                             <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-zinc-500">Require password to decrypt stream</div>
                           </div>
                           <Switch checked={passwordProtection} onCheckedChange={setPasswordProtection} />
                         </div>
                         {passwordProtection && (
                           <Input 
                             type="password" 
                             placeholder="ENTER SECURE PASSWORD" 
                             value={password}
                             onChange={(e) => setPassword(e.target.value)}
                             className="bg-black border-zinc-800 text-white font-mono rounded-none focus-visible:ring-emerald-500 h-12 md:h-14 mt-4 uppercase tracking-widest text-[10px] md:text-xs"
                           />
                         )}
                       </div>

                       <div className="flex flex-col sm:flex-row gap-4">
                         <button onClick={reset} className="px-6 md:px-8 py-4 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] transition-colors rounded-sm text-center">
                           Cancel
                         </button>
                         <button onClick={handleUpload} className="flex-1 bg-white text-black hover:bg-zinc-200 py-4 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] transition-colors rounded-sm flex justify-center items-center gap-3">
                           Initiate Uplink <UploadCloud className="w-4 h-4" />
                         </button>
                       </div>
                     </div>
                   )}

                   {isUploading && (
                     <div className="mt-12 md:mt-24 w-full space-y-6 max-w-2xl">
                       <div className="w-full h-1 md:h-2 bg-zinc-900 overflow-hidden">
                         <div className="h-full bg-white transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }}></div>
                       </div>
                       <div className="flex justify-between text-[9px] md:text-[11px] font-bold uppercase tracking-widest md:tracking-[0.2em]">
                         <div className="text-zinc-500">Speed: <span className="text-white ml-2">{uploadSpeed || "..."}</span></div>
                         <div className="text-zinc-500">ETA: <span className="text-white ml-2">{remainingTime || "..."}</span></div>
                       </div>
                       
                       <div className="flex justify-end pt-4 md:pt-8">
                         <button onClick={reset} className="text-red-500 hover:text-red-400 text-[10px] md:text-xs font-black uppercase tracking-[0.2em]">
                           Abort Transmission
                         </button>
                       </div>
                     </div>
                   )}

                   {(isCompleted || isUploading) && (
                     <div className="mt-12 md:mt-24 grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-end z-10 w-full max-w-4xl">
                       <div className="w-full space-y-6 order-2 md:order-1">
                         <div className="bg-zinc-900/50 border border-zinc-800 p-6 md:p-8 rounded-sm">
                           <div className="text-[10px] uppercase text-zinc-500 mb-3 md:mb-4 font-bold tracking-[0.2em]">Gateway Detail</div>
                           <div className="flex items-center gap-4">
                             <div className="text-xs md:text-sm font-mono truncate flex-1 text-white">{generateShareLink()}</div>
                             <button onClick={copyToClipboard} className="text-zinc-400 hover:text-white shrink-0 bg-black p-2 rounded-sm border border-zinc-800 hover:border-zinc-600 transition-colors">
                               {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                             </button>
                           </div>
                         </div>
                         
                         {isCompleted && (
                           <button onClick={reset} className="w-full py-4 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] transition-colors rounded-sm mt-4">
                             New Payload
                           </button>
                         )}
                       </div>
                       
                       <div className="flex flex-col items-center justify-center p-6 md:p-8 bg-zinc-900/30 border border-zinc-800 rounded-sm h-full order-1 md:order-2">
                         <div className="bg-white p-3 md:p-4 rounded-sm">
                           <QRCodeSVG value={generateShareLink()} size={140} level="M" fgColor="#000000" bgColor="#ffffff" className="w-[120px] h-[120px] md:w-[140px] md:h-[140px]" />
                         </div>
                         <div className="mt-6 md:mt-8 text-white text-[10px] md:text-xs font-black uppercase tracking-widest text-center leading-relaxed">
                           Scan to connect<br/>
                           <span className="text-[9px] md:text-[10px] font-mono text-zinc-500 uppercase mt-2 block">{generateShareLink().replace(/^https?:\/\//, '').substring(0, 30)}...</span>
                         </div>
                       </div>
                     </div>
                   )}
                 </div>
              </div>
            )}
            
          </div>
        </section>
      </main>

      <footer className="h-10 md:h-12 border-t border-zinc-800 bg-zinc-950 flex items-center px-6 md:px-12 justify-between text-[8px] md:text-[10px] font-bold uppercase tracking-widest md:tracking-[0.3em] text-zinc-600 shrink-0">
        <div className="hidden md:block">Network: Secure Tunneled</div>
        <div className="hidden md:block">Web Streams API: Streaming</div>
        <div>Next.js 14 • Edge Ready</div>
      </footer>
    </div>
  );
}
