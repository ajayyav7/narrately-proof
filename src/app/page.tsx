"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Activity, ArrowDownToLine, ArrowRight, Bell, BookOpenCheck, Check, CircleHelp, Clock3, FileCheck2, FileText, FolderClosed, Gauge, LayoutDashboard, LockKeyhole, LogOut, MoreHorizontal, Plus, Search, Settings2, ShieldCheck, UploadCloud, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Report = { name: string; date: string; claims: number; score: string; status: "Complete" | "Processing" };
type Ledger = { summary: { total_claims:number; supported:number; partially_supported:number; unsupported:number; contradicted:number; support_rate:number }; findings: { claim:string; report_location:string; status:string; explanation:string; evidence:{source:string;location:string;text:string;match_score:number}[] }[]; notice:string; report?:{filename:string}; sources?:{filename:string}[] };
const initialReports: Report[] = [];

export default function Dashboard() {
  const router = useRouter();
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [proofPlan, setProofPlan] = useState<string | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [activating, setActivating] = useState(false);
  const [reports, setReports] = useState(initialReports);
  const [modal, setModal] = useState(false);
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [toast, setToast] = useState("");
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [busy, setBusy] = useState(false);
  const reportInput = useRef<HTMLInputElement>(null);
  const sourceInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const supabase = createClient();
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setSupabaseUser(user);
      if (user) {
        const { data, error } = await supabase.from("product_entitlements").select("plan_key").eq("product_key", "proof").in("status", ["active", "trialing"]).maybeSingle();
        if (error) setAccessError("Proof access setup is not complete yet. Please try again after the product access database setup is finished.");
        else setProofPlan(data?.plan_key ?? null);
      }
      setAccessLoading(false);
    };
    void loadUser();
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,session) => {
      setSupabaseUser(session?.user ?? null);
      if (!session?.user) { setProofPlan(null); setAccessLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);
  const displayName = String(supabaseUser?.user_metadata?.full_name || supabaseUser?.email?.split("@")[0] || "Narrately user");
  const userInitials = displayName.split(/[\s._-]+/).filter(Boolean).slice(0,2).map((part)=>part[0]?.toUpperCase()).join("") || "N";
  const signOut = async () => { await createClient().auth.signOut(); router.replace("/login"); router.refresh(); };
  const startFreePlan = async () => {
    setActivating(true); setAccessError("");
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) { router.replace("/login"); return; }
    const { error } = await createClient().from("product_entitlements").insert({ user_id: user.id, product_key: "proof", plan_key: "free", status: "active", granted_by: "self_service" });
    if (error && error.code !== "23505") setAccessError("Could not activate Proof access. Check that the product access migration has been applied, then try again.");
    else setProofPlan("free");
    setActivating(false);
  };
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };
  const addFiles = (files: FileList | null, setter: (files: File[]) => void, existing: File[]) => {
    if (!files) return;
    const allowed = Array.from(files).filter((file) => /\.(pdf|docx|xlsx)$/i.test(file.name));
    setter([...existing, ...allowed]);
    if (allowed.length !== files.length) notify("Some files were skipped. Use PDF, DOCX, or XLSX files.");
  };
  const startAnalysis = async () => {
    if (!reportFiles.length || !sourceFiles.length) { notify("Add one report and at least one source document to continue."); return; }
    const data = new FormData(); data.append("report", reportFiles[0]); sourceFiles.forEach((file) => data.append("sources", file));
    setBusy(true);
    try {
      const {data:{session}} = await createClient().auth.getSession();
      if (!session?.access_token) throw new Error("Your Narrately session expired. Please sign in again.");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("The Proof verification service is not connected yet. Your account and password reset pages are available while we finish setting it up.");
      const response = await fetch(`${apiUrl}/api/v1/analyses`, { method:"POST", headers:{Authorization:`Bearer ${session.access_token}`}, body:data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Analysis could not be completed.");
      setLedger(result);
      setReports([{ name: reportFiles[0].name, date: "Just now", claims: result.summary.total_claims, score: `${result.summary.support_rate}%`, status: "Complete" }, ...reports]);
      setModal(false); setReportFiles([]); setSourceFiles([]);
    } catch (error) { notify(error instanceof Error ? error.message : "Could not reach the Narrately Proof API. Start the backend and try again."); }
    finally { setBusy(false); }
  };
  const downloadLedger = () => { if (!ledger) return; const blob = new Blob([JSON.stringify(ledger,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const anchor=document.createElement("a"); anchor.href=url; anchor.download=`${ledger.report?.filename?.replace(/\.[^.]+$/,"" ) || "narrately-proof"}-evidence-ledger.json`; anchor.click(); URL.revokeObjectURL(url); };

  if (accessLoading) return <main className="auth-screen"><div className="auth-card"><p>Checking your Narrately Proof access…</p></div></main>;
  if (!proofPlan) return <main className="auth-screen"><div className="auth-card">
    <div className="auth-brand"><span className="brand-mark"><ShieldCheck size={18}/></span>narrately<span>proof</span></div>
    <h1>Choose your Proof plan</h1>
    <p>Start the free Proof plan to continue.</p>
    <button className="button auth-submit" onClick={startFreePlan} disabled={activating}>{activating ? "Setting up…" : "Start Proof free plan"}</button>
    {accessError && <p className="auth-error" role="alert">{accessError}</p>}
    <button className="auth-switch" onClick={signOut}>Sign out</button>
  </div></main>;

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><ShieldCheck size={18}/></span>narrately<span style={{fontWeight:450,color:"#64748b"}}>proof</span></div>
      <div className="nav-label">Workspace</div>
      <a className="nav-item active"><LayoutDashboard/>Overview</a>
      <a className="nav-item" onClick={() => notify("Your saved projects will appear here.")}><FolderClosed/>Projects</a>
      <a className="nav-item" onClick={() => notify("Report history is available on the Basic plan.")}><Clock3/>History<LockKeyhole size={12} style={{marginLeft:"auto",opacity:.55}}/></a>
      <div className="nav-label" style={{marginTop:27}}>Manage</div>
      <a className="nav-item" onClick={() => notify("Billing setup is coming later in the MVP.")}><Gauge/>Usage &amp; plan</a>
      <a className="nav-item" onClick={() => notify("Settings are coming soon.")}><Settings2/>Settings</a>
      <div className="sidebar-bottom">
        <div className="plan-card"><strong>Free plan</strong><p>0 of 3 reports used this month</p><div className="meter"><i style={{width:"0%"}}/></div></div>
        <div className="user-card"><div className="avatar">{userInitials}</div><div className="user-details"><strong>{displayName}</strong><span>{supabaseUser?.email || "Narrately account"}</span></div><button className="sign-out" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={15}/></button></div>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Workspace <span style={{padding:"0 8px",color:"#cbd5e1"}}>/</span> <b>Overview</b></div><div className="top-right"><Search/><CircleHelp/><Bell/></div></header>
      <div className="workspace">
        <div className="welcome"><div><h1>Good morning, Jordan</h1><p>Here’s what’s happening with your reports.</p></div><button className="button" onClick={() => setModal(true)}><Plus/>New analysis</button></div>
        <div className="stats">
          <Stat icon={<FileCheck2/>} label="Reports this month" value="0 / 3" note="3 reports remaining"/>
          <Stat icon={<BookOpenCheck/>} label="Claims verified" value="0" note="Across completed reports"/>
          <Stat icon={<Activity/>} label="Average support" value="—" note="Across completed reports"/>
          <Stat icon={<Clock3/>} label="Time saved" value="—" note="Estimated review time"/>
        </div>
        <div className="section-head"><h2>Recent reports</h2><a className="text-link" href="#reports">View all reports <ArrowRight size={12} style={{verticalAlign:"middle",marginLeft:4}}/></a></div>
        <div className="panel" id="reports">
          {reports.length ? reports.map((report, i) => <div className="report" key={`${report.name}-${i}`}>
            <div className="report-title"><div className="file-icon"><FileText/></div><div><strong>{report.name}</strong><span>{report.date}</span></div></div>
            <div className="report-meta">{report.claims ? `${report.claims} claims` : "Preparing analysis"}</div>
            <span className={`status ${report.status === "Processing" ? "processing" : ""}`}>{report.status === "Complete" && <Check size={11} style={{verticalAlign:"-2px",marginRight:3}}/>}{report.status}</span>
            <div className="score">{report.score}</div><MoreHorizontal size={17} className="kebab"/>
          </div>) : <div className="empty">No reports yet. Start a new analysis to review your first report.</div>}
        </div>
        <div className="section-head"><h2>How verification works</h2></div>
        <div className="panel" style={{padding:"17px 19px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
          <Step n="01" title="Upload your report" desc="Add a PDF or DOCX report to review."/>
          <Step n="02" title="Add source documents" desc="Provide the evidence pack in PDF, DOCX, or XLSX."/>
          <Step n="03" title="Review the evidence ledger" desc="Trace every finding back to its source and page."/>
        </div>
        <p style={{fontSize:10,color:"#94a3b8",marginTop:23}}>Narrately Proof checks claims against the source documents you provide.</p>
      </div>
    </main>
    {modal && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-analysis-title">
      <div className="modal-head"><h2 id="new-analysis-title">Start a new analysis</h2><button className="close" onClick={() => setModal(false)} aria-label="Close"><X size={18}/></button></div>
      <p className="modal-desc">Upload a report and its source documents. Narrately Proof will check claims against your evidence.</p>
      <label className="modal-label">Report to verify <span style={{color:"#94a3b8",fontWeight:400}}>· PDF or DOCX</span></label>
      <input ref={reportInput} hidden type="file" accept=".pdf,.docx" onChange={(e) => addFiles(e.target.files,setReportFiles,reportFiles)}/>
      <Dropzone title="Choose your report" hint="PDF or DOCX · One report per analysis" onClick={() => reportInput.current?.click()}/>
      {reportFiles.map((f,i)=><PickedFile key={`${f.name}-${i}`} file={f} onRemove={() => setReportFiles(reportFiles.filter((_,n)=>n!==i))}/>)}
      <label className="modal-label">Source pack <span style={{color:"#94a3b8",fontWeight:400}}>· PDF, DOCX, or XLSX</span></label>
      <input ref={sourceInput} hidden multiple type="file" accept=".pdf,.docx,.xlsx" onChange={(e) => addFiles(e.target.files,setSourceFiles,sourceFiles)}/>
      <Dropzone title="Choose source documents" hint="Add the documents that support the report’s claims" onClick={() => sourceInput.current?.click()}/>
      {sourceFiles.map((f,i)=><PickedFile key={`${f.name}-${i}`} file={f} onRemove={() => setSourceFiles(sourceFiles.filter((_,n)=>n!==i))}/>)}
      <div className="modal-actions"><button className="button secondary" onClick={() => setModal(false)}>Cancel</button><button className="button" onClick={startAnalysis} disabled={busy}>{busy ? "Verifying…" : "Start verification"} <ArrowRight size={14}/></button></div>
    </section></div>}
    {ledger && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setLedger(null); }}><section className="modal result-modal" role="dialog" aria-modal="true" aria-labelledby="ledger-title">
      <div className="modal-head"><div><h2 id="ledger-title">Evidence ledger</h2><p className="modal-desc" style={{margin:"5px 0 0"}}>{ledger.report?.filename} · {ledger.sources?.length || 0} source documents</p></div><button className="close" onClick={() => setLedger(null)} aria-label="Close"><X size={18}/></button></div>
      <div className="ledger-summary"><LedgerCount label="Total claims" value={ledger.summary.total_claims}/><LedgerCount label="Supported" value={ledger.summary.supported} tone="good"/><LedgerCount label="Partial" value={ledger.summary.partially_supported} tone="warn"/><LedgerCount label="Unsupported" value={ledger.summary.unsupported} tone="bad"/><LedgerCount label="Contradicted" value={ledger.summary.contradicted} tone="bad"/></div>
      <div className="ledger-actions"><span>{ledger.summary.support_rate}% of claims fully supported in first pass</span><button className="button secondary" onClick={downloadLedger}><ArrowDownToLine size={14}/> Download ledger</button></div>
      <div className="findings-list">{ledger.findings.map((finding,i)=><article className="finding" key={`${i}-${finding.claim}`}>
        <div className="finding-top"><span className={`finding-status ${finding.status}`}>{finding.status.replace("_"," ")}</span><span>{finding.report_location}</span></div><strong>{finding.claim}</strong><p>{finding.explanation}</p>
        {finding.evidence.map((item,n)=><div className="evidence" key={`${item.source}-${n}`}><div><FileText size={13}/><b>{item.source}</b><span>{item.location} · match {Math.round(item.match_score*100)}%</span></div><blockquote>{item.text}</blockquote></div>)}
      </article>)}</div>
      <p className="ledger-notice">{ledger.notice}</p>
    </section></div>}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function Stat({icon,label,value,note}:{icon:React.ReactNode;label:string;value:string;note:string}) { return <div className="stat"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>; }
function Step({n,title,desc}:{n:string;title:string;desc:string}) { return <div style={{display:"flex",gap:11}}><span style={{fontSize:10,color:"#94a3b8",fontWeight:650,marginTop:1}}>{n}</span><div><strong style={{fontSize:11}}>{title}</strong><p style={{fontSize:10,color:"#64748b",lineHeight:1.55,margin:"5px 0 0"}}>{desc}</p></div></div>; }
function Dropzone({title,hint,onClick}:{title:string;hint:string;onClick:()=>void}) { return <div className="dropzone" onClick={onClick}><UploadCloud/><strong>{title}</strong><span>{hint}</span></div>; }
function PickedFile({file,onRemove}:{file:File;onRemove:()=>void}) { return <div className="picked-file"><FileText size={14}/><strong>{file.name}</strong><span>{(file.size/1024/1024).toFixed(1)} MB</span><X size={14} className="remove" onClick={onRemove}/></div>; }
function LedgerCount({label,value,tone=""}:{label:string;value:number;tone?:string}) { return <div className={`ledger-count ${tone}`}><span>{label}</span><strong>{value}</strong></div>; }
