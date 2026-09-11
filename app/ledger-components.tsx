"use client";
import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, ArrowLeftRight, BarChart3, Check, Clock3, HelpCircle, LayoutDashboard, Layers3, LockKeyhole, MoreHorizontal, Pencil, Plus, ReceiptText, Trash2, TrendingUp, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { channels, dateLabel, expenseCategories, money, shortMoney, summarize } from "@/lib/ledger";
import type { Entry } from "@/lib/ledger";
export type View = "overview" | "ledger" | "payments" | "expenses" | "report";
export const nav = [
  {id:"overview" as const,label:"Overview",icon:LayoutDashboard},
  {id:"ledger" as const,label:"All transactions",icon:ArrowLeftRight},
  {id:"payments" as const,label:"Payments",icon:Wallet},
  {id:"expenses" as const,label:"Expenses",icon:ReceiptText},
  {id:"report" as const,label:"Profit & loss",icon:BarChart3},
];
const channelInitial: Record<string,string> = {Amazon:"a",Flipkart:"F",Meesho:"m",Direct:"D",General:"G"};
export function Choice({value,onChange,options,label,id,className="",disabled=false}:{value:string;onChange:(v:string)=>void;options:(readonly string[] | string)[];label:string;id?:string;className?:string;disabled?:boolean}) {
  return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger id={id} aria-label={label} className={"select-control "+className}><SelectValue/></SelectTrigger><SelectContent>{options.map(o=>{const [v,t]=typeof o==="string"?[o,o]:o;return <SelectItem value={v} key={v}>{t}</SelectItem>})}</SelectContent></Select>;
}
export function AppNav({view,go,demo,setDemo,onHelp}:{view:View;go:(v:View)=>void;demo:boolean;setDemo:(v:boolean)=>void;onHelp:()=>void}) {
  const {setOpenMobile}=useSidebar();
  return <Sidebar className="app-sidebar">
    <SidebarHeader><div className="brand"><div className="brand-symbol"><Layers3 size={24}/></div><div><div className="brand-name">Robustthreed<span style={{color:"#a0f0d2"}}>.</span></div><span className="brand-sub">BUSINESS LEDGER</span></div></div></SidebarHeader>
    <SidebarContent><div className="nav-label">WORKSPACE</div><SidebarMenu className="px-3">{nav.map(n=><SidebarMenuItem key={n.id}><SidebarMenuButton isActive={view===n.id} className="nav-item" onClick={()=>{go(n.id);setOpenMobile(false)}}><n.icon/><span>{n.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>
      <div className="sidebar-tip"><Layers3 size={21} className="mb-3 text-[#9fecd0]"/><strong>Make more. Manage less.</strong>A quick entry today keeps your numbers in order.</div>
    </SidebarContent>
    <SidebarFooter className="px-3"><SidebarMenu><SidebarMenuItem><SidebarMenuButton className="nav-item" onClick={()=>{setDemo(!demo);setOpenMobile(false)}}><BarChart3/><span>{demo?"Back to my ledger":"Explore sample ledger"}</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton className="nav-item" onClick={onHelp}><HelpCircle/><span>How calculations work</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu><div className="sidebar-person"><div className="avatar">R3</div><div><strong className="block font-medium text-white">Robustthreed</strong><span className="text-xs text-[#9eb5bb]">Owner workspace · INR</span></div><LockKeyhole size={15} className="ml-auto"/></div></SidebarFooter>
  </Sidebar>;
}
export function sampleEntries(today:string):Entry[] {
  const day=Number(today.slice(8)), prefix=today.slice(0,8);
  const date=(offset:number)=>prefix+String(Math.max(1,day-offset)).padStart(2,"0");
  const data:Partial<Entry>[]=[
    {kind:"payment",title:"Amazon weekly settlement",amount:1845000,channel:"Amazon",date:date(0)},
    {kind:"expense",title:"PLA filament · 5 kg",amount:425000,category:"Filament & resin",date:date(0)},
    {kind:"payment",title:"Flipkart settlement",amount:1268000,channel:"Flipkart",date:date(1)},
    {kind:"expense",title:"Shipping boxes & bubble wrap",amount:165000,category:"Packaging",date:date(2)},
    {kind:"payment",title:"Meesho settlement",amount:874000,channel:"Meesho",date:date(3)},
    {kind:"expense",title:"Workshop electricity",amount:210000,category:"Electricity",date:date(4)},
    {kind:"payment",title:"Custom desk organiser order",amount:350000,channel:"Direct",date:date(4),method:"UPI"},
    {kind:"expense",title:"Nozzle & build plate maintenance",amount:98000,category:"Repairs & maintenance",date:date(5)},
    {kind:"payment",title:"Amazon payout expected",amount:640000,channel:"Amazon",status:"pending",date:date(1)},
    {kind:"payment",title:"Meesho payout expected",amount:225000,channel:"Meesho",status:"pending",date:today},
    {kind:"expense",title:"Next filament delivery",amount:240000,category:"Filament & resin",status:"pending",date:today},
  ];
  return data.map((d,i)=>({id:"sample-"+i,kind:"payment",title:"",amount:0,channel:d.kind==="expense"?"General":"Direct",category:d.kind==="expense"?"Other":"Settlement",status:"settled",date:today,method:"Bank transfer",reference:"",notes:"Illustrative entry — not your business data.",version:1,createdAt:today+"T10:00:00Z",updatedAt:today+"T10:00:00Z",...d} as Entry));
}
export function CashChart({rows,range,today}:{rows:Entry[];range:{start:string;end:string};today:string}) {
  const {data,monthly}=useMemo(()=>{
    const settled=rows.filter(r=>r.status==="settled");
    const start=range.start||settled.map(r=>r.date).sort()[0]||today.slice(0,8)+"01";
    const end=range.end||today;
    const startMs=Date.parse(start+"T12:00:00Z"),endMs=Date.parse(end+"T12:00:00Z");
    const days=Math.max(1,Math.round((endMs-startMs)/86400000)+1),monthly=days>62;
    const buckets: {key:string;label:string;received:number;expenses:number}[]=[];
    if(monthly) {
      const d=new Date(startMs);d.setUTCDate(1);
      for(let i=0;i<1212&&d.getTime()<=endMs;i++,d.setUTCMonth(d.getUTCMonth()+1)) {
        const key=d.toISOString().slice(0,7);
        buckets.push({key,label:d.toLocaleDateString("en-IN",{month:"short",year:days>366?"2-digit":undefined,timeZone:"UTC"}),received:0,expenses:0});
      }
    } else {
      for(let i=0;i<days;i++) {const d=new Date(startMs+i*86400000);buckets.push({key:d.toISOString().slice(0,10),label:d.toLocaleDateString("en-IN",{day:"numeric",month:"short",timeZone:"UTC"}),received:0,expenses:0})}
    }
    const map=new Map(buckets.map(b=>[b.key,b]));
    for(const r of settled){const b=map.get(monthly?r.date.slice(0,7):r.date);if(b)b[r.kind==="payment"?"received":"expenses"]+=r.amount;}
    return {data:buckets,monthly};
  },[rows,range.start,range.end,today]);
  const hasData=rows.some(r=>r.status==="settled");
  return <div className="panel"><div className="panel-head"><div><h2 className="panel-title">Money in, money out</h2><p className="panel-sub">{monthly?"Monthly":"Daily"} received payments and paid expenses</p></div><div className="legend"><span><i/>Payments</span><span><i className="orange"/>Expenses</span></div></div>
    <div className="chart-wrap" aria-label="Cash flow chart for the selected period">
      <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{top:15,right:12,left:0,bottom:0}}>
        <defs><linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#44b596" stopOpacity={.2}/><stop offset="100%" stopColor="#44b596" stopOpacity={.01}/></linearGradient></defs>
        <CartesianGrid stroke="#eaf0f2" strokeDasharray="3 4" vertical={false}/><XAxis dataKey="label" tick={{fill:"#6c8089",fontSize:12}} axisLine={false} tickLine={false} minTickGap={38} tickMargin={12}/><YAxis width={57} tickFormatter={shortMoney} tick={{fill:"#6c8089",fontSize:12}} axisLine={false} tickLine={false} tickCount={4} domain={[0,hasData?"auto":100000]}/>
        <ChartTooltip content={({active,payload,label})=>active&&payload?.length?<div className="chart-tooltip"><strong>{label}</strong>{payload.map(p=><p key={String(p.dataKey)} style={{color:p.color}}>{p.dataKey==="received"?"Payments":"Expenses"}: {money(Number(p.value))}</p>)}</div>:null}/>
        <Area type="linear" dataKey="received" stroke="#008574" strokeWidth={2.5} fill="url(#income-fill)" isAnimationActive={false}/>
        <Area type="linear" dataKey="expenses" stroke="#dfa06e" strokeWidth={2} fill="transparent" isAnimationActive={false}/>
      </AreaChart></ResponsiveContainer>
      {!hasData&&<div className="chart-empty"><strong>Your cash flow starts with your first entry</strong><span>Received payments and paid expenses appear here.</span></div>}
    </div>
  </div>;
}
export function Stats({rows}:{rows:Entry[]}) {
  const s=summarize(rows);
  const cards=[
    {label:s.profit<0?"Net loss":"Net profit",value:s.profit,icon:TrendingUp,foot:"Received payments − paid expenses",featured:true},
    {label:"Payments received",value:s.received,icon:ArrowDownLeft,foot:rows.filter(r=>r.kind==="payment"&&r.status==="settled").length+" received entries"},
    {label:"Expenses paid",value:s.expenses,icon:ArrowUpRight,foot:rows.filter(r=>r.kind==="expense"&&r.status==="settled").length+" paid entries"},
    {label:"Payments pending",value:s.pendingIn,icon:Clock3,foot:money(s.pendingOut)+" in unpaid expenses"},
  ];
  return <div className="stats-grid">{cards.map(c=><section key={c.label} className={"stat "+(c.featured?"stat-featured ":"")+(c.featured&&s.profit<0?"loss":"")}><div className="stat-top"><span>{c.label}</span><div className="stat-icon"><c.icon size={17}/></div></div><div className="stat-number">{money(c.value)}</div><p className="stat-foot">{c.foot}</p></section>)}</div>;
}
export function Markets({rows}:{rows:Entry[]}) {
  const total=summarize(rows).received;
  return <div className="panel"><div className="panel-head"><div><h2 className="panel-title">Payments by channel</h2><p className="panel-sub">Where your money comes from</p></div><Wallet size={18} className="text-muted-foreground"/></div><div className="market-list">{channels.filter(c=>c!=="General").map(c=>{
    const sum=rows.filter(r=>r.channel===c&&r.kind==="payment"&&r.status==="settled").reduce((a,b)=>a+b.amount,0);
    return <div className="market-row" key={c}><div className="market-line"><span className={"market-mark market-"+c}>{channelInitial[c]}</span><span>{c==="Direct"?"Direct sales":c}</span><strong>{money(sum)}</strong></div><div className="market-track"><div className="market-fill" style={{width:(total?sum/total*100:0)+"%"}}/></div></div>
  })}</div><div className="market-foot">Net payouts received · selected period</div></div>;
}
export function EntryTable({rows,demo,today,edit,remove,emptyAction}:{rows:Entry[];demo:boolean;today:string;edit:(e:Entry,settle?:boolean)=>void;remove:(e:Entry)=>void;emptyAction:()=>void}) {
  if(!rows.length)return <Empty className="empty-ledger"><EmptyHeader><EmptyMedia variant="icon"><ReceiptText/></EmptyMedia><EmptyTitle>No transactions here yet</EmptyTitle><EmptyDescription>Add a payment or expense, or try a different period and filter.</EmptyDescription></EmptyHeader><Button className="btn" variant="outline" onClick={emptyAction} disabled={demo}><Plus size={15}/>Add an entry</Button></Empty>;
  return <Table className="entry-table"><TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Channel</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{rows.map(r=><TableRow key={r.id}><TableCell><div className="entry-description"><span className={"entry-icon "+(r.kind==="expense"?"out":"")}>{r.kind==="payment"?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</span><div><strong>{r.title}</strong><small>{r.kind==="payment"?"Payment":r.category}{r.reference?" · "+r.reference:""}</small></div></div></TableCell><TableCell><span className="flex items-center gap-2"><span className={"market-mark market-"+r.channel} style={{height:24,width:24,fontSize:12}}>{channelInitial[r.channel]}</span>{r.channel}</span></TableCell><TableCell>{dateLabel(r.date)}{r.status==="pending"&&<span className="block text-xs text-muted-foreground">Expected / due</span>}</TableCell><TableCell><span className={"status "+(r.status==="pending"?(r.date<today?"overdue":"pending"):"")}>{r.status==="settled"?<Check size={12}/>:<Clock3 size={12}/>}{r.status==="pending"?(r.date<today?"Overdue":"Pending"):(r.kind==="payment"?"Received":"Paid")}</span></TableCell><TableCell className={"text-right "+(r.kind==="payment"?"money-in":"money-out")}>{r.kind==="payment"?"+":"−"}{money(r.amount)}</TableCell><TableCell>{!demo&&<DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={"Actions for "+r.title}><MoreHorizontal size={18}/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={()=>edit(r)}><Pencil size={15}/>Edit entry</DropdownMenuItem>{r.status==="pending"&&<DropdownMenuItem onSelect={()=>edit(r,true)}><Check size={15}/>{r.kind==="payment"?"Mark as received":"Mark as paid"}</DropdownMenuItem>}<DropdownMenuSeparator/><DropdownMenuItem className="text-destructive" onSelect={()=>remove(r)}><Trash2 size={15}/>Delete entry</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</TableCell></TableRow>)}</TableBody></Table>;
}
export function Report({rows,rangeLabel}:{rows:Entry[];rangeLabel:string}) {
  const s=summarize(rows),groups=expenseCategories.map(category=>({category,amount:rows.filter(r=>r.kind==="expense"&&r.status==="settled"&&r.category===category).reduce((a,b)=>a+b.amount,0)})).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
  return <><Stats rows={rows}/><div className="report-grid"><div className="panel"><div className="panel-head"><div><h2 className="panel-title">Profit & loss statement</h2><p className="panel-sub">{rangeLabel} · cash basis</p></div><ReceiptText size={20} className="text-muted-foreground"/></div><div className="report-lines"><div className="report-line section">Payments received</div>{channels.filter(c=>c!=="General").map(c=><div className="report-line" key={c}><span>{c==="Direct"?"Direct sales":c+" settlements"}</span><span>{money(rows.filter(r=>r.kind==="payment"&&r.status==="settled"&&r.channel===c).reduce((a,b)=>a+b.amount,0))}</span></div>)}<div className="report-line"><strong>Total received</strong><span>{money(s.received)}</span></div><div className="report-line section">Expenses paid</div>{groups.length?groups.map(g=><div className="report-line" key={g.category}><span>{g.category}</span><span>{money(g.amount)}</span></div>):<p className="text-sm text-muted-foreground py-3">No paid expenses in this period.</p>}<div className="report-line"><strong>Total expenses</strong><span>{money(s.expenses)}</span></div><div className="report-line total"><span>Net {s.profit<0?"loss":"profit"} · cash basis</span><span>{money(s.profit)}</span></div></div></div><div className="flex flex-col gap-5"><div className="panel"><div className="panel-head"><h2 className="panel-title">Expense breakdown</h2></div><div className="category-breakdown">{groups.length?groups.map(g=><div className="category-item" key={g.category}><div><span>{g.category}</span><span>{(g.amount/s.expenses*100).toFixed(1)}%</span></div><div className="expense-bar"><div style={{width:g.amount/s.expenses*100+"%"}}/></div></div>):<p className="text-sm text-muted-foreground">Your expense mix will appear after your first paid expense.</p>}</div></div><div className="panel report-help"><h2 className="panel-title mb-3">A clear view of your cash</h2><p><strong>Profit = payments received − expenses paid.</strong> Pending entries are excluded until you mark them received or paid.</p><p>Use the amount credited to your bank for marketplace settlements. Don’t add marketplace fees again if they were already deducted.</p><p className="mb-0!">This is a cash P&L. Inventory value, depreciation and tax adjustments are not calculated. Equipment purchases count as cash expenses. Keep owner transfers and loans out of payments and expenses.</p></div></div></div></>;
}
