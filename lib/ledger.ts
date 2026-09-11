import { z } from "zod";

export const channels = ["Amazon", "Flipkart", "Meesho", "Direct", "General"] as const;
export const expenseCategories = ["Filament & resin", "Packaging", "Electricity", "Shipping", "Marketplace fees", "Advertising", "Repairs & maintenance", "Equipment", "Rent & utilities", "Salaries", "Refunds & returns", "Other"] as const;
export const methods = ["Bank transfer", "UPI", "Cash", "Card", "Other"] as const;
export type Entry = {
  id: string; kind: "payment" | "expense"; title: string; amount: number;
  channel: typeof channels[number]; category: string; status: "settled" | "pending";
  date: string; method: typeof methods[number]; reference: string; notes: string;
  version: number; createdAt: string; updatedAt: string;
};
export type EntryInput = Omit<Entry, "version" | "createdAt" | "updatedAt">;

export function todayIST(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", {timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const part = (t:string) => p.find(x=>x.type===t)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s < "2000-01-01" || s > "2100-12-31") return false;
  const d = new Date(s+"T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === s;
}
export const entrySchema = z.object({
  id:z.string().uuid(), kind:z.enum(["payment","expense"]), title:z.string().trim().min(1,"Add a description.").max(140),
  amount:z.number().int().min(1,"Amount must be greater than zero.").max(100_000_000_000,"Maximum amount is ₹100 crore."),
  channel:z.enum(channels),category:z.string().max(60),status:z.enum(["settled","pending"]),
  date:z.string().refine(validDate,"Choose a valid date between 2000 and 2100."),method:z.enum(methods),
  reference:z.string().trim().max(100),notes:z.string().trim().max(1000),
}).superRefine((v,c)=>{
  if(v.kind === "expense" && !expenseCategories.includes(v.category as typeof expenseCategories[number])) c.addIssue({code:"custom",path:["category"],message:"Choose an expense category."});
  if(v.kind === "payment" && (v.channel === "General" || v.category !== "Settlement")) c.addIssue({code:"custom",path:["channel"],message:"Choose a payment marketplace or Direct."});
  if(v.status === "settled" && v.date > todayIST()) c.addIssue({code:"custom",path:["date"],message:"Received or paid entries cannot have a future date. Use Pending."});
});

// Integer paise are authoritative; no floating-point currency arithmetic.
export function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if(!/^\d{1,10}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, fraction = ""] = s.split(".");
  const n = Number(whole)*100 + Number(fraction.padEnd(2,"0"));
  return Number.isSafeInteger(n) && n>0 && n<=100_000_000_000 ? n : null;
}
export function amountText(paise: number) { return (paise/100).toFixed(2); }
export function money(paise: number, decimals = false) {
  return new Intl.NumberFormat("en-IN", {style:"currency",currency:"INR",minimumFractionDigits:decimals || paise%100!==0 ? 2:0,maximumFractionDigits:2}).format(paise/100);
}
export function shortMoney(paise: number) {
  const n=paise/100;
  return Math.abs(n)>=10000000 ? `₹${(n/10000000).toFixed(1)}Cr` : Math.abs(n)>=100000 ? `₹${(n/100000).toFixed(1)}L` : Math.abs(n)>=1000 ? `₹${(n/1000).toFixed(0)}k` : `₹${n.toFixed(0)}`;
}
export function dateLabel(date:string) { return new Date(date+"T12:00:00Z").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}); }
export function summarize(rows: Entry[]) {
  let received=0, expenses=0, pendingIn=0, pendingOut=0;
  for (const r of rows) {
    if(r.kind==="payment") { if(r.status==="settled") received+=r.amount; else pendingIn+=r.amount; }
    else { if(r.status==="settled") expenses+=r.amount; else pendingOut+=r.amount; }
  }
  return {received,expenses,pendingIn,pendingOut,profit:received-expenses,margin:received ? (received-expenses)/received*100 : null};
}
export type Period = "month" | "last-month" | "year" | "all" | "custom";
export function rangeFor(period: Period, today:string, start="", end="") {
  const [y,m]=today.split("-").map(Number);
  if(period==="all") return {start:"",end:""};
  if(period==="custom") return {start,end};
  if(period==="year") return {start:`${y}-01-01`,end:`${y}-12-31`};
  const month = period==="last-month" ? new Date(Date.UTC(y,m-2,1)) : new Date(Date.UTC(y,m-1,1));
  return {start:month.toISOString().slice(0,10),end:new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,0)).toISOString().slice(0,10)};
}
export function filterRange(rows:Entry[],start:string,end:string) { return rows.filter(r=>(!start||r.date>=start)&&(!end||r.date<=end)); }
export function csv(rows:Entry[]) {
  const safe = (v:unknown) => {const s=String(v);return '"'+(/^[\s]*[=+@\-]/.test(s)?"'":"")+s.replaceAll('"','""')+'"';};
  return "\uFEFF"+[["Date (IST)","Type","Description","Channel","Category","Status","Amount (INR)","Method","Reference","Notes"],...rows.map(r=>[r.date,r.kind,r.title,r.channel,r.category,r.status==="pending"?"Pending":r.kind==="payment"?"Received":"Paid",amountText(r.amount),r.method,r.reference,r.notes])].map(r=>r.map(safe).join(",")).join("\r\n");
}
