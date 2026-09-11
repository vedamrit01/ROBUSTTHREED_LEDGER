"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, CalendarDays, Check, ChevronRight, Download, HelpCircle, Loader2, LockKeyhole, Plus, RefreshCw, Search, Trash2, Wallet, X } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { amountText, channels, csv, dateLabel, entrySchema, expenseCategories, filterRange, methods, money, parseAmount, rangeFor, summarize, todayIST } from "@/lib/ledger";
import type { Entry, EntryInput, Period } from "@/lib/ledger";
import { AppNav, CashChart, Choice, EntryTable, Markets, Report, Stats, nav, sampleEntries } from "./ledger-components";
import type { View } from "./ledger-components";
const periodOptions=[["month","This month"],["last-month","Last month"],["year","This year"],["all","All time"],["custom","Custom dates"]];
import { api } from "@/lib/api";
export default function LedgerApp({onLogout}:{onLogout:()=>Promise<void>}) {
  const [signingOut,setSigningOut]=useState(false);
  const signOut=async()=>{setSigningOut(true);try{await onLogout()}catch(e){toast.error(e instanceof Error?e.message:"Could not sign out. Please try again.")}finally{setSigningOut(false)}};
  const [view,setView]=useState<View>("overview"),[entries,setEntries]=useState<Entry[]>([]),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(""),[loaded,setLoaded]=useState(false);
  const [demo,setDemo]=useState(false),[today,setToday]=useState(todayIST),[period,setPeriod]=useState<Period>("month"),[customStart,setCustomStart]=useState(today.slice(0,8)+"01"),[customEnd,setCustomEnd]=useState(today);
  const [channel,setChannel]=useState("all"),[status,setStatus]=useState("all"),[query,setQuery]=useState(""),[page,setPage]=useState(0),[help,setHelp]=useState(false);
  const [draft,setDraft]=useState<EntryInput|null>(null),[editing,setEditing]=useState<Entry|null>(null),[amount,setAmount]=useState(""),[saving,setSaving]=useState(false),[formError,setFormError]=useState("");
  const [deleteTarget,setDeleteTarget]=useState<Entry|null>(null),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState("");
  const loadingRef=useRef(false),reloadQueued=useRef(false);
  const reload=useCallback(async():Promise<void>=>{
    if(loadingRef.current){reloadQueued.current=true;return;}
    loadingRef.current=true;setLoading(true);setLoadError("");
    try {
      const rows:Entry[]=[];let page=0,hasMore=true;
      while(hasMore){const body=await api<{entries:Entry[];hasMore:boolean}>("/api/entries?page="+page);rows.push(...body.entries);hasMore=body.hasMore;page++;}
      setEntries(Array.from(new Map(rows.map(r=>[r.id,r])).values()));setLoaded(true);
    }catch(e){setLoadError(e instanceof Error?e.message:"Your ledger could not be loaded. Please retry.");}
    finally{loadingRef.current=false;setLoading(false);if(reloadQueued.current){reloadQueued.current=false;void reload();}}
  },[]);
  useEffect(()=>{void reload();const onFocus=()=>{setToday(todayIST());void reload()};window.addEventListener("focus",onFocus);return()=>window.removeEventListener("focus",onFocus)},[reload]);
  useEffect(()=>{setPage(0)},[view,period,customStart,customEnd,channel,status,query,demo]);
  const range=rangeFor(period,today,customStart,customEnd),invalidRange=period==="custom"&&(!customStart||!customEnd||customStart>customEnd);
  const source=useMemo(()=>demo?sampleEntries(today):entries,[demo,today,entries]);
  const rows=useMemo(()=>invalidRange?[]:filterRange(source,range.start,range.end).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)),[source,range.start,range.end,invalidRange]);
  const typedRows=rows.filter(r=>(view!=="payments"||r.kind==="payment")&&(view!=="expenses"||r.kind==="expense"));
  const matching=typedRows.filter(r=>(channel==="all"||r.channel===channel)&&(status==="all"||r.status===status)&&[r.title,r.reference,r.category,r.notes].join(" ").toLowerCase().includes(query.toLowerCase().trim()));
  const maxPage=Math.max(0,Math.ceil(matching.length/12)-1),safePage=Math.min(page,maxPage);
  const totals=summarize(matching);
  const rangeLabel=period==="all"?"All time":range.start&&range.end?dateLabel(range.start)+" – "+dateLabel(range.end):"Choose a date range";
  const activeNav=nav.find(n=>n.id===view)!;
  const go=(v:View)=>{setView(v);setPage(0);setQuery("");setChannel("all");setStatus("all")};
  const toggleDemo=(v:boolean)=>{setDemo(v);setPeriod("month");go("overview");};
  const newEntry=(kind:"payment"|"expense")=>{
    if(demo){toast.info("Return to your ledger to add a real entry.");return}
    setEditing(null);setFormError("");setAmount("");
    setDraft({id:crypto.randomUUID(),kind,title:"",amount:0,channel:kind==="payment"?"Amazon":"General",category:kind==="payment"?"Settlement":"Filament & resin",status:"settled",date:today,method:"Bank transfer",reference:"",notes:""});
  };
  const editEntry=(e:Entry,settle=false)=>{setEditing(e);setFormError("");setAmount(amountText(e.amount));setDraft({...e,...(settle?{status:"settled" as const,date:today}:{})})};
  const updateDraft=(patch:Partial<EntryInput>)=>setDraft(d=>d?{...d,...patch}:null);
  const saveEntry=async(e:FormEvent)=>{
    e.preventDefault();if(!draft||saving)return;setFormError("");
    const paise=parseAmount(amount);if(paise===null){setFormError("Enter an amount greater than zero, with up to two decimal places (for example, 1250.50).");return}
    const parsed=entrySchema.safeParse({...draft,amount:paise});if(!parsed.success){setFormError(parsed.error.issues[0].message);return}
    setSaving(true);
    try{
      const body=await api<{entry:Entry}>("/api/entries",{method:editing?"PUT":"POST",body:JSON.stringify({...parsed.data,...(editing?{version:editing.version}:{})})});
      setEntries(old=>[body.entry,...old.filter(r=>r.id!==body.entry.id)]);setDraft(null);setEditing(null);toast.success(editing?"Entry updated":"Entry saved");
      void reload();
    }catch(e){setFormError(e instanceof Error?e.message:"Your entry could not be saved. Please try again.")}
    finally{setSaving(false)}
  };
  const deleteEntry=async()=>{
    if(!deleteTarget||deleting)return;setDeleting(true);setDeleteError("");
    try {await api("/api/entries",{method:"DELETE",body:JSON.stringify({id:deleteTarget.id,version:deleteTarget.version})});setEntries(old=>old.filter(r=>r.id!==deleteTarget.id));setDeleteTarget(null);toast.success("Entry deleted");void reload();}
    catch(e){setDeleteError(e instanceof Error?e.message:"Could not delete. Please retry.")}
    finally{setDeleting(false)}
  };
  const exportEntries=()=>{
    const exportRows=(view==="ledger"||view==="payments"||view==="expenses")?matching:rows;
    if(!exportRows.length){toast.info("There are no transactions to export in this view.");return}
    const blob=new Blob([csv(exportRows)],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=(demo?"SAMPLE-":"")+"Robustthreed-"+view+"-"+today+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast.success("Ledger exported");
  };
  const pendingCount=rows.filter(r=>r.kind==="payment"&&r.status==="pending").length;
  const ready=demo||loaded;
  return <SidebarProvider style={{"--sidebar-width":"15.5rem"} as CSSProperties}><AppNav view={view} go={go} demo={demo} setDemo={toggleDemo} onHelp={()=>setHelp(true)}/><SidebarInset className="shell">
    <header className="topbar"><div className="breadcrumb"><SidebarTrigger className="md:hidden"/><span className="breadcrumb-brand">Workspace</span><ChevronRight size={13} className="breadcrumb-brand"/><strong>{activeNav.label}</strong></div><div className="action-row"><span className="private-badge"><LockKeyhole size={14}/>Private workspace</span><Button size="sm" variant="ghost" disabled={signingOut} onClick={()=>void signOut()}>{signingOut?"Signing out…":"Sign out"}</Button><span className="avatar hidden sm:grid">R3</span></div></header>
    <div className="workspace"><div className="page-heading"><div><h1>{view==="overview"?"Business overview":activeNav.label}</h1><p className="subtitle">{view==="overview"?"Your business, by the numbers.":view==="payments"?"Every marketplace payout, in one place.":view==="expenses"?"Stay on top of what it costs to create.":view==="report"?"Know what came in, what went out, and what remains.":"Your day-to-day money trail."}</p></div><div className="action-row"><Button variant="outline" className="btn bg-white" onClick={()=>newEntry("expense")} disabled={demo}><Plus size={16}/>Add expense</Button><Button className="btn" onClick={()=>newEntry("payment")} disabled={demo}><Plus size={16}/>Add payment</Button></div></div>
    {demo&&<div className="demo-banner"><span><strong>Sample ledger</strong> · Illustrative numbers only. Your real records are separate.</span><Button variant="outline" className="btn bg-white" onClick={()=>toggleDemo(false)}>Use my ledger<ArrowRight size={15}/></Button></div>}
    {!demo&&loadError&&<div className="error-banner" role="alert"><span>{loaded?"Showing the last loaded records. ":""}{loadError}</span><Button size="sm" variant="outline" onClick={()=>void reload()} disabled={loading}><RefreshCw size={14}/>Retry</Button></div>}
    <div className="filterbar"><div className="period-control"><CalendarDays size={17} className="text-muted-foreground"/><Choice value={period} onChange={v=>setPeriod(v as Period)} options={periodOptions} label="Reporting period"/>{period==="custom"&&<><Input aria-label="Start date" type="date" className="w-auto bg-white" value={customStart} onChange={e=>setCustomStart(e.target.value)} min="2000-01-01" max="2100-12-31"/><span className="text-sm text-muted-foreground">to</span><Input aria-label="End date" type="date" className="w-auto bg-white" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} min={customStart} max="2100-12-31"/></>}<span className="filter-note hidden xl:flex">{period==="all"?"All recorded transactions":rangeLabel}</span></div><div className="action-row"><span className="filter-note hidden sm:flex">{loading&&!demo?<><Loader2 size={13} className="animate-spin"/>Updating</>:demo?"Sample data":loaded&&!loadError?<><Check size={13}/>Records saved</>:null}</span><Button variant="ghost" size="icon" aria-label="Refresh ledger" onClick={()=>void reload()} disabled={loading||demo}><RefreshCw size={15}/></Button><Button variant="outline" className="btn bg-white" onClick={exportEntries} disabled={!ready||invalidRange}><Download size={15}/>Export CSV</Button></div></div>
    {invalidRange?<div className="error-banner" role="alert">Choose a start and end date, with the start on or before the end.</div>:!ready?<div className="space-y-5" aria-busy={loading}>{loading?<><div className="stats-grid">{[1,2,3,4].map(i=><Skeleton key={i} className="h-40 rounded-xl"/>)}</div><Skeleton className="h-72 w-full rounded-xl"/><Skeleton className="h-52 w-full rounded-xl"/></>:<Empty className="panel"><EmptyHeader><EmptyMedia variant="icon"><Wallet/></EmptyMedia><EmptyTitle>Reconnect to your ledger</EmptyTitle><EmptyDescription>Retry loading to see your saved payments, expenses and totals.</EmptyDescription></EmptyHeader><Button onClick={()=>void reload()}>Retry loading</Button></Empty>}</div>:<>
    {!demo&&entries.length===0&&view==="overview"&&<div className="start-strip"><div><strong>A fresh start for your business books</strong><p>Add your first payment or expense. Your totals update automatically.</p></div><button className="text-link whitespace-nowrap" onClick={()=>toggleDemo(true)}>See a sample ledger<ArrowRight size={15}/></button></div>}
    {view==="overview"?<><Stats rows={rows}/><div className="dashboard-grid"><CashChart rows={rows} range={range} today={today}/><Markets rows={rows}/></div><section className="panel"><div className="panel-head"><div><h2 className="panel-title">Recent transactions</h2><p className="panel-sub">The latest activity in your selected period</p></div><button className="text-link whitespace-nowrap" onClick={()=>go("ledger")}>View all<ArrowRight size={14}/></button></div><EntryTable rows={rows.slice(0,5)} demo={demo} today={today} edit={editEntry} remove={e=>{setDeleteError("");setDeleteTarget(e)}} emptyAction={()=>newEntry("payment")}/><div className="table-footer"><span>{rows.length} transaction{rows.length===1?"":"s"} in this period</span>{pendingCount>0&&<button className="text-link" onClick={()=>{go("payments");setStatus("pending")}}>{pendingCount} pending payment{pendingCount===1?"":"s"}<ChevronRight size={14}/></button>}</div></section></>:view==="report"?<Report rows={rows} rangeLabel={rangeLabel}/>:<>
      <div className="mini-stats">{(view==="payments"?[{label:"Received",amount:totals.received},{label:"Pending",amount:totals.pendingIn},{label:"Total expected & received",amount:totals.received+totals.pendingIn}]:view==="expenses"?[{label:"Paid",amount:totals.expenses},{label:"Unpaid",amount:totals.pendingOut},{label:"Total expenses logged",amount:totals.expenses+totals.pendingOut}]:[{label:"Payments received",amount:totals.received},{label:"Expenses paid",amount:totals.expenses},{label:"Net profit · cash basis",amount:totals.profit}]).map(c=><section key={c.label} className="panel mini-stat"><p>{c.label}</p><strong>{money(c.amount)}</strong></section>)}</div>
      <div className="ledger-toolbar"><div className="searchbox"><Search/><Input aria-label="Search transactions" placeholder="Search description, category or reference..." value={query} onChange={e=>setQuery(e.target.value)}/></div><Choice value={channel} onChange={setChannel} options={[["all","All channels"],...channels]} label="Filter channel"/><Choice value={status} onChange={setStatus} options={[["all","All statuses"],["settled",view==="payments"?"Received":view==="expenses"?"Paid":"Received / paid"],["pending","Pending / unpaid"]]} label="Filter status"/>{(query||channel!=="all"||status!=="all")&&<Button variant="ghost" onClick={()=>{setQuery("");setChannel("all");setStatus("all")}}><X size={14}/>Clear filters</Button>}</div>
      <section className="panel"><EntryTable rows={matching.slice(safePage*12,(safePage+1)*12)} demo={demo} today={today} edit={editEntry} remove={e=>{setDeleteError("");setDeleteTarget(e)}} emptyAction={()=>newEntry(view==="expenses"?"expense":"payment")}/><div className="table-footer"><span>{matching.length?(safePage*12+1)+"–"+Math.min((safePage+1)*12,matching.length)+" of "+matching.length:"0"} transactions</span><Pagination className="m-0 w-auto"><PaginationContent><PaginationItem><Button variant="outline" size="sm" disabled={safePage===0} onClick={()=>setPage(safePage-1)}>Previous</Button></PaginationItem><PaginationItem><span className="px-2 text-xs">{safePage+1} / {maxPage+1}</span></PaginationItem><PaginationItem><Button variant="outline" size="sm" disabled={safePage>=maxPage} onClick={()=>setPage(safePage+1)}>Next</Button></PaginationItem></PaginationContent></Pagination></div></section>
    </>}
    </>}
    <footer className="footer-note"><button onClick={()=>setHelp(true)}><HelpCircle size={13}/>Cash basis · pending entries don’t count towards profit</button><span>₹ INR · India time (IST) · Manual entry</span></footer>
    </div>
    <Dialog open={!!draft} onOpenChange={open=>{if(!open&&!saving){setDraft(null);setEditing(null)}}}><DialogContent className="entry-dialog sm:max-w-[560px]" onInteractOutside={e=>e.preventDefault()} onEscapeKeyDown={e=>{if(saving)e.preventDefault()}}><DialogHeader><DialogTitle>{editing?"Update transaction":"Add a transaction"}</DialogTitle><DialogDescription>{editing?"Review the details and save your changes.":"A few details now. Clearer numbers all month."}</DialogDescription></DialogHeader>{draft&&<form onSubmit={saveEntry} className="space-y-4"><Tabs value={draft.kind} onValueChange={kind=>updateDraft({kind:kind as Entry["kind"],category:kind==="payment"?"Settlement":"Filament & resin",channel:kind==="payment"?"Amazon":"General"})}><TabsList className="w-full h-11!"><TabsTrigger value="payment" disabled={saving}><ArrowDownLeft size={16}/>Payment</TabsTrigger><TabsTrigger value="expense" disabled={saving}><ArrowUpRight size={16}/>Expense</TabsTrigger></TabsList><TabsContent value={draft.kind}><div className="form-grid mt-3"><div className="form-full"><label className="form-label" htmlFor="entry-amount">{draft.kind==="payment"?"Payment amount (net payout)":"Expense amount"}</label><div className="amount-field"><span>₹</span><Input id="entry-amount" className="form-input" autoFocus inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} required disabled={saving} maxLength={14}/></div></div>
      <div className="form-full"><label className="form-label" htmlFor="entry-title">Description</label><Input id="entry-title" className="form-input" placeholder={draft.kind==="payment"?"e.g. Amazon weekly settlement":"e.g. White PLA filament · 2 kg"} value={draft.title} onChange={e=>updateDraft({title:e.target.value})} required maxLength={140} disabled={saving}/></div>
      <div><label className="form-label" htmlFor="entry-channel">{draft.kind==="payment"?"Payment channel":"Related channel"}</label><Choice id="entry-channel" value={draft.channel} onChange={v=>updateDraft({channel:v as Entry["channel"]})} options={draft.kind==="payment"?channels.filter(c=>c!=="General"):[...channels]} label="Payment channel" className="w-full form-input" disabled={saving}/></div>
      <div><label className="form-label" htmlFor="entry-status">Status</label><Choice id="entry-status" value={draft.status} onChange={v=>updateDraft({status:v as Entry["status"]})} options={[["settled",draft.kind==="payment"?"Received":"Paid"],["pending",draft.kind==="payment"?"Pending":"Unpaid"]]} label="Payment status" className="w-full form-input" disabled={saving}/></div>
      {draft.kind==="expense"&&<div className="form-full"><label className="form-label" htmlFor="entry-category">Expense category</label><Choice id="entry-category" value={draft.category} onChange={v=>updateDraft({category:v})} options={[...expenseCategories]} label="Expense category" className="w-full form-input" disabled={saving}/></div>}
      <div><label className="form-label" htmlFor="entry-date">{draft.status==="pending"?(draft.kind==="payment"?"Expected payment date":"Due date"):(draft.kind==="payment"?"Date received":"Date paid")}</label><Input id="entry-date" type="date" className="form-input" value={draft.date} onChange={e=>updateDraft({date:e.target.value})} required min="2000-01-01" max={draft.status==="settled"?today:"2100-12-31"} disabled={saving}/></div>
      <div><label className="form-label" htmlFor="entry-method">Payment method</label><Choice id="entry-method" value={draft.method} onChange={v=>updateDraft({method:v as Entry["method"]})} options={[...methods]} label="Payment method" className="w-full form-input" disabled={saving}/></div>
      <div className="form-full"><label className="form-label" htmlFor="entry-ref">Order / settlement reference <span className="font-normal text-muted-foreground">(optional)</span></label><Input id="entry-ref" className="form-input" placeholder="Reference ID, invoice number or supplier" value={draft.reference} onChange={e=>updateDraft({reference:e.target.value})} maxLength={100} disabled={saving}/></div>
      <div className="form-full"><label className="form-label" htmlFor="entry-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></label><Textarea id="entry-notes" className="form-input resize-y" rows={2} placeholder="Anything you’d like to remember..." value={draft.notes} onChange={e=>updateDraft({notes:e.target.value})} maxLength={1000} disabled={saving}/></div>
    </div></TabsContent></Tabs>
    {draft.kind==="payment"?<p className="form-note">Enter the net amount credited or expected after marketplace deductions. Don’t also log fees that were already deducted from this payout.</p>:draft.category==="Marketplace fees"?<p className="form-note">Only log fees paid separately. Fees already deducted from a net marketplace payout are already reflected in your profit.</p>:null}
    <div className="settle-preview"><span>{draft.status==="pending"?"Excluded from profit until settled":editing?"Updated entry’s P&L contribution":"P&L contribution"}</span><strong>{draft.status==="pending"?"₹0":(draft.kind==="expense"?"−":"+")+money(parseAmount(amount)||0)}</strong></div>
    {formError&&<p className="text-sm text-destructive leading-relaxed" role="alert">{formError}</p>}
    <div className="flex justify-end gap-2 border-t pt-4"><Button variant="outline" type="button" className="btn" disabled={saving} onClick={()=>{setDraft(null);setEditing(null)}}>Cancel</Button><Button type="submit" className="btn" disabled={saving}>{saving?<Loader2 size={16} className="animate-spin"/>:<Check size={16}/>} {saving?"Saving…":editing?"Save changes":"Save entry"}</Button></div>
    </form>}</DialogContent></Dialog>
    <AlertDialog open={!!deleteTarget} onOpenChange={open=>{if(!open&&!deleting)setDeleteTarget(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this transaction?</AlertDialogTitle><AlertDialogDescription>“{deleteTarget?.title}” will be removed and your totals recalculated. This can’t be undone.</AlertDialogDescription></AlertDialogHeader>{deleteError&&<p className="text-sm text-destructive" role="alert">{deleteError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={deleting}>Keep entry</AlertDialogCancel><Button variant="destructive" disabled={deleting} onClick={()=>void deleteEntry()}>{deleting?<Loader2 size={16} className="animate-spin"/>:<Trash2 size={16}/>}Delete entry</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="entry-dialog"><DialogHeader><DialogTitle>How your ledger works</DialogTitle><DialogDescription>Simple daily bookkeeping for Robustthreed.</DialogDescription></DialogHeader><div className="report-help p-0!"><p><strong>1. Record payments.</strong> For Amazon, Flipkart and Meesho, enter each net bank settlement once. For direct sales, enter the amount received. Entries are manual; marketplace accounts are not connected.</p><p><strong>2. Record expenses.</strong> Choose a category such as filament, packaging, electricity or shipping. Don’t repeat fees already deducted from a marketplace payout.</p><p><strong>3. Track what’s due.</strong> Pending payments and unpaid expenses use the expected or due date. When money moves, edit the entry to received or paid and use the actual payment date. For partial payments, create separate received and pending entries.</p><p><strong>Profit = received payments − paid expenses.</strong> All amounts use INR. Dates follow India time. Date filters apply to actual payment dates for settled entries and due dates for pending entries.</p><p><strong>Cash basis.</strong> This does not calculate GST, inventory value, depreciation or tax adjustments. Equipment purchases count as cash expenses. Keep loans and owner transfers outside this ledger.</p><p className="mb-0!"><strong>Your records stay saved.</strong> Export CSV downloads the transactions in the selected view. Choose All transactions → All time and clear filters for a full export.</p></div></DialogContent></Dialog>
    <Toaster theme="light" richColors position="bottom-right"/>
  </SidebarInset></SidebarProvider>;
}
