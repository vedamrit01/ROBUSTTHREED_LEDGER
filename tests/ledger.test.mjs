import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { csv, entrySchema, filterRange, parseAmount, rangeFor, summarize, todayIST, validDate } from "../lib/ledger.ts";

const base = (extra={}) => ({id:randomUUID(),kind:"payment",title:"Weekly settlement",amount:100025,channel:"Amazon",category:"Settlement",status:"settled",date:todayIST(),method:"Bank transfer",reference:"",notes:"",...extra});
test("Currency parsing preserves paise and rejects invalid monetary input",()=>{
 assert.equal(parseAmount("1000.25"),100025);
 assert.equal(parseAmount("0.10")+parseAmount("0.20"),30);
 assert.equal(parseAmount("999999999.99"),99999999999);
 for(const x of ["0","-100","1.234","1e5","NaN","1,000","1000000000.01",""]) assert.equal(parseAmount(x),null,x);
});
test("Cash P&L excludes pending entries and handles losses",()=>{
 const rows=[base({amount:100025}),base({kind:"expense",amount:30010,category:"Packaging"}),base({amount:900000,status:"pending"}),base({kind:"expense",amount:80000,category:"Electricity",status:"pending"})];
 const s=summarize(rows);
 assert.equal(s.received,100025);assert.equal(s.expenses,30010);assert.equal(s.profit,70015);
 assert.equal(s.pendingIn,900000);assert.equal(s.pendingOut,80000);
 assert.equal(summarize([rows[1]]).profit,-30010);assert.equal(summarize([]).margin,null);
});
test("Calendar boundaries, leap dates, IST dates and inclusive filtering",()=>{
 assert.deepEqual(rangeFor("last-month","2026-01-12"),{start:"2025-12-01",end:"2025-12-31"});
 assert.deepEqual(rangeFor("month","2024-02-20"),{start:"2024-02-01",end:"2024-02-29"});
 assert.equal(validDate("2026-02-30"),false);assert.equal(validDate("2024-02-29"),true);
 assert.equal(todayIST(new Date("2026-09-06T19:00:00Z")),"2026-09-07");
 assert.equal(filterRange([base({date:"2026-08-31"}),base({date:"2026-09-01"}),base({date:"2026-09-30"}),base({date:"2026-10-01"})],"2026-09-01","2026-09-30").length,2);
});
test("Server schema validates category, channel, status and actual payment date",()=>{
 assert.equal(entrySchema.safeParse(base()).success,true);
 for(const bad of [{amount:0},{amount:1.2},{date:"2026-02-30"},{date:"2100-01-01"},{channel:"General"},{status:"arbitrary"},{kind:"expense",category:"Made up"}])assert.equal(entrySchema.safeParse(base(bad)).success,false);
 assert.equal(entrySchema.safeParse(base({status:"pending",date:"2100-01-01"})).success,true);
});
test("CSV export escapes quotes and neutralizes spreadsheet formulas",()=>{
 const data=csv([base({title:'=SUM(1,2)',notes:'Two "spools"\nblue',amount:12345})]);
 assert.ok(data.startsWith("\uFEFF"));assert.ok(data.includes("\"'=SUM(1,2)\""));assert.ok(data.includes('"123.45"'));assert.ok(data.includes('Two ""spools""'));
});
