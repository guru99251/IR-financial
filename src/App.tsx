import "./App.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Save, Trash2, Download, Rocket, Calculator, Settings,
  BarChart3, Table2, LayoutGrid, Building2, Database
} from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import Chart from "chart.js/auto";
import type { Chart as ChartType } from "chart.js";

/*************************
 * 통화/퍼센트 유틸
 *************************/
const KRW = {
  fmt(n: number){
    if(n===null||n===undefined||isNaN(n as any)) return '-';
    const sign = n<0?'-':''; n=Math.abs(n);
    if(n>=100_000_000){ return sign + (n/100_000_000).toFixed(2).replace(/\.00$/,'') + ' 억'; }
    if(n>=1_000_000){ return sign + (n/1_000_000).toFixed(1).replace(/\.0$/,'') + ' 백만'; }
    if(n>=100_000){ return sign + Math.round(n).toLocaleString('ko-KR'); }
    return sign + Math.round(n).toLocaleString('ko-KR');
  },
  parse(str: string|number){
    if(typeof str==='number') return str;
    if(!str) return 0;
    let s = (''+str).trim().replace(/,/g,'');
    const unit = s.match(/[가-힣]+$/);
    let base = parseFloat(s);
    if(isNaN(base)) return 0;
    if(unit){
      if(unit[0]==='억') base*=100_000_000;
      else if(unit[0]==='백만') base*=1_000_000;
    }
    return base;
  },
  pctParse(v: string|number){
    if(v===''||v===null||v===undefined) return 0;
    if(typeof v==='number') return v>1? v/100 : v;
    let s=(''+v).trim();
    if(s.endsWith('%')) s=s.slice(0,-1);
    const x=parseFloat(s);
    if(isNaN(x)) return 0;
    return x>1? x/100 : x;
  },
  pctFmt(p: number){ return (p*100).toFixed(1).replace(/\.0$/,'')+'%'; }
}

/*************************
 * 초기 상태
 *************************/
function uid(){ return Math.random().toString(36).slice(2,9); }
const STORE_KEY = 'lm_fin_cases_v7';

const defaultState = {
  name: "Case A (default)",

  // 요금/단가
  pricing: { standard: 7_900, pro: 0 },          // pro 안 쓰면 0 유지
  print: {
    price: 40_000,                               // 인쇄 객단가
    outsUnit: 15_000, outsRate: 1,               // 외주 원가(건), 배수
    leaseUnit: 7_000,  leaseRate: 1              // 리스 원가(건), 배수
  },

  // 고정비
  fixed: {
    office: 1_200_000,                           // 사무실 비용(월)
    mkt:    2_000_000,                           // 마케팅 비용(월)
    legal:    500_000,                           // 법률/회계 비용(월)
    leaseMonthly: 3_000_000                      // 리스 월 금액(장비 1대)
  },

  // 시나리오 가중치
  weights: { con: 0.7, neu: 1.0, agg: 1.3 },

  // 활성 사용자 시나리오 (기간별)
  // 퍼센트는 "소수(0~1)"로 입력해야 합니다.
  periods: [
    { id: uid(), start: 1,  end: 3,  mau: 300,   subCR: 0.00, prtCR: 0.10, server: 300_000, hasWage: false, avgWage: 0,        heads: 4, hasOffice: false, hasLease: false, leaseCnt: 0 },
    { id: uid(), start: 4,  end: 6,  mau: 500,   subCR: 0.00, prtCR: 0.15, server: 400_000, hasWage: false, avgWage: 0,        heads: 4, hasOffice: false, hasLease: false, leaseCnt: 0 },
    { id: uid(), start: 7,  end: 9,  mau: 600,   subCR: 0.03, prtCR: 0.15, server: 500_000, hasWage: true,  avgWage: 2_200_000, heads: 4, hasOffice: true,  hasLease: false, leaseCnt: 0 },
    { id: uid(), start: 10, end: 12, mau: 800,   subCR: 0.03, prtCR: 0.15, server: 800_000, hasWage: true,  avgWage: 2_200_000, heads: 4, hasOffice: true,  hasLease: false, leaseCnt: 0 },
    { id: uid(), start: 13, end: 18, mau: 2_500, subCR: 0.03, prtCR: 0.12, server: 1_700_000, hasWage: true, avgWage: 2_500_000, heads: 5, hasOffice: true, hasLease: true,  leaseCnt: 1 },
    { id: uid(), start: 19, end: 21, mau: 7_500, subCR: 0.04, prtCR: 0.08, server: 3_000_000, hasWage: true, avgWage: 3_000_000, heads: 5, hasOffice: true, hasLease: true,  leaseCnt: 1 },
    { id: uid(), start: 22, end: 24, mau: 12_000, subCR: 0.05, prtCR: 0.07, server: 4_400_000, hasWage: true, avgWage: 3_500_000, heads: 6, hasOffice: true, hasLease: true,  leaseCnt: 2 },
    { id: uid(), start: 25, end: 30, mau: 30_000, subCR: 0.05, prtCR: 0.07, server: 7_500_000, hasWage: true, avgWage: 3_500_000, heads: 6, hasOffice: true, hasLease: true,  leaseCnt: 2 },
    { id: uid(), start: 31, end: 36, mau: 50_000, subCR: 0.05, prtCR: 0.08, server: 13_000_000, hasWage: true, avgWage: 4_000_000, heads: 7, hasOffice: true, hasLease: true, leaseCnt: 3 },
  ],
};


/*************************
 * 메인 컴포넌트
 *************************/
export default function FinancialCalculatorApp(){
  const [state,setState] = useState(defaultState);
  const [caseList,setCaseList] = useState<any[]>(()=>JSON.parse(localStorage.getItem(STORE_KEY)||'[]'));
  const [periodDraft,setPeriodDraft] = useState({start:1,end:3,mau:300});
  const [tab,setTab] = useState("sum");
  const [simTick,setSimTick] = useState(0); // "시뮬레이션하기" 동작 트리거

  // 계산 결과
  const { months, minCum, minCumMonth, bepMonth } = useMemo(()=>calcMonthlySeries(state),[state, simTick]);
  const needed = useMemo(()=>calcNeededFund(months),[months]);
  const totalInvestNeed = Math.max(0, needed.maxDeficit * 1.10);

  // 차트 참조
  const cumRef = useRef<HTMLCanvasElement | null>(null);
  const monthlyRef = useRef<HTMLCanvasElement | null>(null);
  const scRef = useRef<HTMLCanvasElement | null>(null);
  const cumChart = useRef<ChartType | null>(null);
  const monthlyChart = useRef<ChartType | null>(null);
  const scChart = useRef<ChartType | null>(null);

  // 시뮬레이션 버튼
  const runSimulation = ()=>{ setSimTick(t=>t+1); setTab('chart'); };

  // 차트 렌더
  useEffect(()=>{
    const labels = months.map(r=>`${r.month}M`);
    const yFmt = (v:number)=>KRW.fmt(v);

    // 누적 손익
    if (cumChart.current) cumChart.current.destroy();
    if (cumRef.current) {
      cumChart.current = new Chart(cumRef.current, {
        type: "line",
        data: { labels, datasets: [{ label: "누적손익", data: months.map(r => r.cum) }] },
        options: { responsive: true, maintainAspectRatio:false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: yFmt } } } }
      });
    }

    // 월 매출/비용
    if (monthlyChart.current) monthlyChart.current.destroy();
    if (monthlyRef.current) {
      monthlyChart.current = new Chart(monthlyRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            { label: "매출", data: months.map(r => r.rev) },
            { label: "변동비", data: months.map(r => r.varCost) },
            { label: "고정비", data: months.map(r => r.fixed) },
            { label: "순이익", data: months.map(r => r.net) }
          ]
        },
        options: { responsive: true, maintainAspectRatio:false, scales: { y: { ticks: { callback: yFmt } } } }
      });
    }

    // 연도별 시나리오
    if (scChart.current) scChart.current.destroy();
    if (scRef.current) {
      const sc = calcScenarioYears(state);
      const yLabels = sc.neutral.map(r => `Y${r.year}`);
      scChart.current = new Chart(scRef.current, {
        type: "bar",
        data: {
          labels: yLabels,
          datasets: [
            { label: "보수적 순이익", data: sc.conservative.map(r => r.net) },
            { label: "중립 순이익", data: sc.neutral.map(r => r.net) },
            { label: "공격적 순이익", data: sc.aggressive.map(r => r.net) }
          ]
        },
        options: { responsive: true, maintainAspectRatio:false, scales: { y: { ticks: { callback: yFmt } } } }
      });
    }

    return ()=>{ cumChart.current?.destroy(); monthlyChart.current?.destroy(); scChart.current?.destroy(); };
  }, [months, state, simTick]);

  // 저장/불러오기
  const saveCase = ()=>{
    let next = [...caseList];
    const idx = next.findIndex((c:any)=>c.name===state.name);
    const payload = JSON.parse(JSON.stringify(state));
    if(idx>=0) next[idx]=payload; else next.push(payload);
    setCaseList(next);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  }
  const loadCase = (name:string)=>{
    const c = caseList.find((x:any)=>x.name===name);
    if(c) setState(c);
  }
  const deleteCase = ()=>{
    const next = caseList.filter((c:any)=>c.name!==state.name);
    setCaseList(next);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  }

  // 헬퍼
  const officeOffRanges = mergeRanges(state.periods.filter(p=>!p.hasOffice).map(p=>[p.start,p.end]));

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-600" aria-hidden/>
            <span className="font-semibold tracking-tight">재무 계산기 · Life Magazine</span>
            <span className="sr-only">비용, BEP, 누적손익, ROI, 투자금 계산</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <Input aria-label="Case 이름" value={state.name}
                     onChange={e=>setState(s=>({...s,name:e.target.value}))}
                     className="w-56" placeholder="Case 이름"/>
              <motion.div whileTap={{scale:0.98}}>
                <Button onClick={saveCase} className="gap-2" variant="default">
                  <Save className="w-4 h-4"/> 저장
                </Button>
              </motion.div>
              <motion.div whileTap={{scale:0.98}}>
                <Button onClick={deleteCase} className="gap-2" variant="secondary">
                  <Trash2 className="w-4 h-4"/> 삭제
                </Button>
              </motion.div>
            </div>
            <motion.div whileHover={{scale:1.03}} whileTap={{scale:0.98}}>
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 rounded-2xl px-4 py-2">
                <Rocket className="w-4 h-4"/>
                투자 제안서 받기
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* (1) 기본설정 */}
        <SectionTitle icon={<Settings className="w-4 h-4"/>} title="① 기본설정" subtitle="케이스 저장 · 불러오기 및 기초 변수"/>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <HoverCard>
            <CardHeader>
              <CardTitle className="text-sm text-slate-600">Case 관리</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="caseName" className="text-slate-700">Case 이름</Label>
              <Input id="caseName" value={state.name} onChange={e=>setState(s=>({...s,name:e.target.value}))} placeholder="예: Case A (MVP)"/>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={saveCase} className="gap-2"><Save className="w-4 h-4"/> 저장</Button>
                <Button variant="secondary" onClick={()=>setState(defaultState)} className="gap-2"><LayoutGrid className="w-4 h-4"/> 예시 불러오기</Button>
                <Button variant="destructive" onClick={deleteCase} className="gap-2"><Trash2 className="w-4 h-4"/> 삭제</Button>
              </div>
              <div>
                <Label className="text-slate-700">저장된 Case</Label>
                <div className="mt-2 flex items-center gap-2">
                  <select className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200"
                          onChange={(e)=>loadCase(e.target.value)}
                          defaultValue="">
                    <option value="" disabled>선택…</option>
                    {caseList.map(c=> (<option key={c.name} value={c.name}>{c.name}</option>))}
                  </select>
                </div>
              </div>
            </CardContent>
          </HoverCard>

          <HoverCard>
            <CardHeader><CardTitle className="text-sm text-slate-600">요금/단가</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <MoneyInput label="구독 (Standard) 월 요금" value={state.pricing.standard}
                          onChange={(v)=>setState(s=>({...s,pricing:{...s.pricing,standard:v}}))}/>
              <MoneyInput label="인쇄 객단가 (1건 매출)" value={state.print.price}
                          onChange={(v)=>setState(s=>({...s,print:{...s.print,price:v}}))}/>
            </CardContent>
          </HoverCard>

          <HoverCard>
            <CardHeader><CardTitle className="text-sm text-slate-600">인쇄 원가</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <MoneyInput label="외주 원가 (1건)" value={state.print.outsUnit}
                          onChange={(v)=>setState(s=>({...s,print:{...s.print,outsUnit:v}}))}/>
              <NumberInput label="외주 원가율 (배수)" value={state.print.outsRate}
                           onChange={(v)=>setState(s=>({...s,print:{...s.print,outsRate:v}}))}/>
              <MoneyInput label="리스 원가 (1건)" value={state.print.leaseUnit}
                          onChange={(v)=>setState(s=>({...s,print:{...s.print,leaseUnit:v}}))}/>
              <NumberInput label="리스 원가율 (배수)" value={state.print.leaseRate}
                           onChange={(v)=>setState(s=>({...s,print:{...s.print,leaseRate:v}}))}/>
            </CardContent>
          </HoverCard>

          <HoverCard>
            <CardHeader><CardTitle className="text-sm text-slate-600">고정비</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <MoneyInput label="사무실 비용 (월)" value={state.fixed.office}
                          onChange={(v)=>setState(s=>({...s,fixed:{...s.fixed,office:v}}))}/>
              <MoneyInput label="마케팅 비용 (월)" value={state.fixed.mkt}
                          onChange={(v)=>setState(s=>({...s,fixed:{...s.fixed,mkt:v}}))}/>
              <MoneyInput label="법률/회계 비용 (월)" value={state.fixed.legal}
                          onChange={(v)=>setState(s=>({...s,fixed:{...s.fixed,legal:v}}))}/>
              <MoneyInput label="리스 월 금액 (장비 1대)" value={state.fixed.leaseMonthly}
                          onChange={(v)=>setState(s=>({...s,fixed:{...s.fixed,leaseMonthly:v}}))}/>
            </CardContent>
          </HoverCard>

          <HoverCard>
            <CardHeader><CardTitle className="text-sm text-slate-600">시나리오 가중치</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <NumberInput label="보수적" value={state.weights.con}
                           onChange={(v)=>setState(s=>({...s,weights:{...s.weights,con:v}}))}/>
              <NumberInput label="중립" value={state.weights.neu}
                           onChange={(v)=>setState(s=>({...s,weights:{...s.weights,neu:v}}))}/>
              <NumberInput label="공격적" value={state.weights.agg}
                           onChange={(v)=>setState(s=>({...s,weights:{...s.weights,agg:v}}))}/>
            </CardContent>
          </HoverCard>

          <HoverCard>
            <CardHeader><CardTitle className="text-sm text-slate-600">기간(개월) · MAU 구간</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-3">
              <NumberInput label="시작 (개월차)" value={periodDraft.start}
                           onChange={v=>setPeriodDraft(d=>({...d,start:Math.max(1,Math.round(v||1))}))}/>
              <NumberInput label="종료 (개월차)" value={periodDraft.end}
                           onChange={v=>setPeriodDraft(d=>({...d,end:Math.max(d.start,Math.round(v||d.start))}))}/>
              <NumberInput label="MAU" value={periodDraft.mau}
                           onChange={v=>setPeriodDraft(d=>({...d,mau:Math.max(0,Math.round(v||0))}))}/>
              <div className="col-span-3 flex gap-2">
                <Button variant="secondary" className="gap-2" onClick={()=>setState(s=>({...s,periods:[...s.periods,{id:uid(),start:periodDraft.start,end:periodDraft.end,mau:periodDraft.mau,subCR:0.03,prtCR:0.05,server:500_000,hasWage:false,avgWage:3_000_000,heads:0,hasOffice:false,hasLease:false,leaseCnt:0}]}))}><Plus className="w-4 h-4"/> 구간 추가</Button>
                <Button variant="outline" onClick={()=>setState(s=>({...s,periods:[]}))}>초기화</Button>
              </div>
              <p className="text-xs text-slate-500">구간은 아래 ② 활성 사용자 시나리오 표의 첫 두 열(기간·MAU)와 자동 연동됩니다.</p>
            </CardContent>
          </HoverCard>
        </div>

        {/* (2) 활성 사용자 시나리오 */}
        <SectionTitle icon={<Database className="w-4 h-4"/>} title="② 활성 사용자 시나리오" subtitle="엑셀처럼 각 셀 직접 입력"/>
        <Card className="rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr className="[&>th]:px-3 [&>th]:py-2 border-b border-slate-200">
                    {/* 기간 열 너비 40% 축소 */}
                    <th className="w-[72px] min-w-[72px]">기간 (개월)</th>
                    <th className="min-w-[100px]">MAU</th>
                    <th>구독 전환율</th>
                    <th>인쇄 전환율</th>
                    <th>서버 비용(월)</th>
                    <th>인건비 포함?</th>
                    <th>평균 인건비</th>
                    <th>인원수</th>
                    <th>사무실 포함?</th>
                    <th>리스?</th>
                    <th>리스 개수</th>
                    <th>삭제</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.periods.sort((a,b)=>a.start-b.start).map((p,idx)=> (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      {/* 인라인 입력: value는 포맷 없이 순수값만 */}
                      <td className="px-3 py-2">
                        <input aria-label="기간" className="w-full bg-transparent border border-transparent focus:border-indigo-300 focus:bg-indigo-50/40 rounded px-2 py-1 h-8"
                          value={`${p.start}-${p.end}`}
                          onChange={(e)=>{
                            const [s,e2]=e.target.value.split('-').map(x=>parseInt(x.trim()));
                            setState(st=>{ const arr=[...st.periods]; arr[idx] = {...arr[idx], start:Number.isFinite(s)?Math.max(1,s!):p.start, end:Number.isFinite(e2)?Math.max(arr[idx].start,e2!):p.end}; return {...st, periods:arr}; })
                          }}/>
                      </td>
                      <td className="px-3 py-2"><input type="number" className="w-full bg-transparent border border-transparent focus:border-indigo-300 focus:bg-indigo-50/40 rounded px-2 py-1 h-8 text-right"
                          value={p.mau}
                          onChange={(e)=>updatePeriod(idx,{mau:parseInt(e.target.value||'0')||0},setState)}/></td>
                      <td className="px-3 py-2"><input type="number" step="0.1" className="w-full bg-transparent border border-transparent focus:border-indigo-300 focus:bg-indigo-50/40 rounded px-2 py-1 h-8 text-right"
                          value={+(p.subCR*100).toFixed(2)}
                          onChange={(e)=>updatePeriod(idx,{subCR:(parseFloat(e.target.value||'0')||0)/100},setState)}/></td>
                      <td className="px-3 py-2"><input type="number" step="0.1" className="w-full bg-transparent border border-transparent focus:border-indigo-300 focus:bg-indigo-50/40 rounded px-2 py-1 h-8 text-right"
                          value={+(p.prtCR*100).toFixed(2)}
                          onChange={(e)=>updatePeriod(idx,{prtCR:(parseFloat(e.target.value||'0')||0)/100},setState)}/></td>
                      <td className="px-3 py-2"><input type="number" className="w-full bg-transparent border border-transparent focus:border-indigo-300 focus:bg-indigo-50/40 rounded px-2 py-1 h-8 text-right"
                          value={p.server}
                          onChange={(e)=>updatePeriod(idx,{server:parseInt(e.target.value||'0')||0},setState)}/></td>
                      <td className="px-3 py-2"><Switch checked={p.hasWage} onCheckedChange={(v)=>updatePeriod(idx,{hasWage:v},setState)} aria-label="인건비 포함"/></td>
                      <td className="px-3 py-2"><input type="number" className="w-full bg-transparent border border-transparent focus:border-indigo-300 focus:bg-indigo-50/40 rounded px-2 py-1 h-8 text-right"
                          value={p.avgWage}
                          onChange={(e)=>updatePeriod(idx,{avgWage:parseInt(e.target.value||'0')||0},setState)}/></td>
                      <td className="px-3 py-2"><input type="number" className="w-full bg-transparent border border-transparent focus:border-indigo-300 focus:bg-indigo-50/40 rounded px-2 py-1 h-8 text-right"
                          value={p.heads}
                          onChange={(e)=>updatePeriod(idx,{heads:parseInt(e.target.value||'0')||0},setState)}/></td>
                      <td className="px-3 py-2"><Switch checked={p.hasOffice} onCheckedChange={(v)=>updatePeriod(idx,{hasOffice:v},setState)} aria-label="사무실 포함"/></td>
                      <td className="px-3 py-2"><Switch checked={p.hasLease} onCheckedChange={(v)=>updatePeriod(idx,{hasLease:v},setState)} aria-label="리스"/></td>
                      <td className="px-3 py-2"><input type="number" className="w-full bg-transparent border border-transparent focus:border-indigo-300 focus:bg-indigo-50/40 rounded px-2 py-1 h-8 text-right"
                          value={p.leaseCnt}
                          onChange={(e)=>updatePeriod(idx,{leaseCnt:parseInt(e.target.value||'0')||0},setState)}/></td>
                      <td className="px-3 py-2">
                        <Button size="icon" variant="destructive" onClick={()=>setState(s=>({...s,periods:s.periods.filter(x=>x.id!==p.id)}))} aria-label="행 삭제">
                          <Trash2 className="w-4 h-4"/>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button className="gap-2" onClick={runSimulation}><Rocket className="w-4 h-4"/> 시뮬레이션하기</Button>
          </CardFooter>
        </Card>

        {/* (3) 결과 */}
        <SectionTitle icon={<BarChart3 className="w-4 h-4"/>} title="③ 시뮬레이션 (결과)" subtitle="요약 · 차트 · 표"/>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full md:w-auto">
            <TabsTrigger value="sum">요약보기</TabsTrigger>
            <TabsTrigger value="chart">차트보기</TabsTrigger>
            <TabsTrigger value="table">표보기</TabsTrigger>
          </TabsList>

          <TabsContent value="sum" className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <KPI label="BEP 시기" value={bepMonth? `${bepMonth}개월차`:'미달성'}/>
              <KPI label="누적적자 최대 (시점/금액)" value={minCumMonth? `${minCumMonth}개월차 / ${KRW.fmt(-minCum)}`:'-'}/>
              <KPI label="흑자전환 시점" value={bepMonth? `${bepMonth}개월차`:'미달성'}/>
              <KPI label="최종 ROI" value={`${(((months.reduce((a,b)=>a+b.net,0)) / (totalInvestNeed||1))*100).toFixed(1)}%`}/>
              <KPI label="필요 투자금 (6/12/24M)" value={`6M ${KRW.fmt(needed.need6*1.10)}, 12M ${KRW.fmt(needed.need12*1.10)}, 24M ${KRW.fmt(needed.need24*1.10)}`}/>
              <KPI label="총 필요 투자금 (예비비 포함)" value={KRW.fmt(totalInvestNeed)}/>
            </div>
            {officeOffRanges.length>0 && (
              <p className="mt-3 text-sm text-amber-700 flex items-center gap-2"><Building2 className="w-4 h-4"/> 사무실 비용 제외 구간 {officeOffRanges.map(r=>`${r[0]}~${r[1]}개월차`).join(', ')} 은(는) 공간 지원 필요.</p>
            )}
          </TabsContent>

          <TabsContent value="chart" className="pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ChartCard title="누적 손익"><canvas ref={cumRef} className="w-full h-full" role="img" aria-label="누적 손익 라인 차트"/></ChartCard>
              <ChartCard title="월 매출 · 비용"><canvas ref={monthlyRef} className="w-full h-full" role="img" aria-label="월 매출·비용 라인 차트"/></ChartCard>
              <ChartCard title="연도별 시나리오 (보수/중립/공격)"><canvas ref={scRef} className="w-full h-full" role="img" aria-label="시나리오 바 차트"/></ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="table" className="pt-4 space-y-4">
            <HoverCard>
              <CardHeader><CardTitle className="text-sm text-slate-600">구간별 월 발생비용</CardTitle></CardHeader>
              <CardContent>
                <CostByPeriodTable state={state}/>
                <p className="text-xs text-slate-500 mt-2">요약: 각 구간 월 고정비 합계를 표시합니다.</p>
              </CardContent>
            </HoverCard>
            <HoverCard>
              <CardHeader><CardTitle className="text-sm text-slate-600">MAU별 BEP (200명 단위)</CardTitle></CardHeader>
              <CardContent>
                <BEPTable state={state}/>
                <p className="text-xs text-slate-500 mt-2">요약: 공헌이익 ≥ 고정비 지점이 BEP 입니다.</p>
              </CardContent>
            </HoverCard>
            <HoverCard>
              <CardHeader><CardTitle className="text-sm text-slate-600">누적손익 (월별)</CardTitle></CardHeader>
              <CardContent>
                <MonthlyTable months={months}/>
              </CardContent>
            </HoverCard>
            <HoverCard>
              <CardHeader><CardTitle className="text-sm text-slate-600">1~3년차 시나리오별 매출/이익</CardTitle></CardHeader>
              <CardContent>
                <YearlyTable state={state}/>
              </CardContent>
            </HoverCard>
            <HoverCard>
              <CardHeader><CardTitle className="text-sm text-slate-600">투자금 재무 운용 (최대 적자 시점까지)</CardTitle></CardHeader>
              <CardContent>
                <FundingTable state={state} months={months} minCumMonth={minCumMonth}/>
              </CardContent>
            </HoverCard>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={()=>exportCSV(months)}>
                <Download className="w-4 h-4"/> CSV 내보내기
              </Button>
              <p className="text-xs text-slate-500">숫자 입력: 1억, 3.5백만 처럼 단위 입력 가능 · %는 3 또는 3% 모두 가능</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="py-8 text-center text-xs text-slate-500">
        © Life Magazine · Financial Simulator
      </footer>
    </div>
  );
}

/*************************
 * 소형 컴포넌트
 *************************/
function SectionTitle({icon,title,subtitle}:{icon:React.ReactNode,title:string,subtitle?:string}){
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 w-8 h-8" aria-hidden>{icon}</span>
      <div>
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  )
}

function HoverCard({children}:{children:React.ReactNode}){
  return (
    <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:.25}}>
      <Card className="rounded-2xl shadow-sm border-slate-200 hover:shadow-md transition-shadow">{children}</Card>
    </motion.div>
  )
}

function KPI({label,value}:{label:string,value:string}){
  return (
    <motion.div whileHover={{scale:1.01}}>
      <Card className="rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-600">{label}</CardTitle></CardHeader>
        <CardContent><div className="text-lg font-semibold">{value}</div></CardContent>
      </Card>
    </motion.div>
  )
}

function ChartCard({title,children}:{title:string,children:React.ReactNode}){
  return (
    <HoverCard>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-600">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="relative h-72">{children}</div>
      </CardContent>
    </HoverCard>
  )
}

function MoneyInput({label,value,onChange}:{label:string,value:number,onChange:(v:number)=>void}){
  const [raw,setRaw] = useState(String(value));
  useEffect(()=>{ setRaw(String(value)); },[value]);
  return (
    <div className="space-y-1">
      <Label className="text-slate-700">{label}</Label>
      {/* 포맷 문자열을 value로 쓰지 않고, 숫자 그 자체로 입력 */}
      <Input inputMode="numeric" value={raw} onChange={(e)=>setRaw(e.target.value)} onBlur={()=>onChange(KRW.parse(raw))}/>
    </div>
  )
}
function NumberInput({label,value,onChange}:{label:string,value:number,onChange:(v:number)=>void}){
  return (
    <div className="space-y-1">
      <Label className="text-slate-700">{label}</Label>
      <Input type="number" value={value} onChange={(e)=>onChange(parseFloat(e.target.value||'0'))}/>
    </div>
  )
}

/*************************
 * 표들
 *************************/
function CostByPeriodTable({state}:{state:any}){
  const outsCost = state.print.outsUnit * state.print.outsRate;
  const leaseCost = state.print.leaseUnit * state.print.leaseRate;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr className="[&>th]:px-3 [&>th]:py-2 border-b border-slate-200">
            <th>기간</th><th className="text-right">서버</th><th className="text-right">사무실</th><th className="text-right">인건비</th><th className="text-right">리스(고정)</th><th className="text-right">마케팅</th><th className="text-right">법률/회계</th><th className="text-right">변동(인쇄/건)</th><th className="text-right">월 합계(고정)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {state.periods.sort((a:any,b:any)=>a.start-b.start).map((p:any)=>{
            const wage = p.hasWage ? (p.avgWage*p.heads):0;
            const office = p.hasOffice ? state.fixed.office : 0;
            const leaseFix = p.hasLease ? state.fixed.leaseMonthly*p.leaseCnt : 0;
            const fixed = p.server + wage + office + state.fixed.mkt + state.fixed.legal + leaseFix;
            return (
              <tr key={p.id} className="[&>td]:px-3 [&>td]:py-2">
                <td>{p.start}~{p.end}</td>
                <td className="text-right">{KRW.fmt(p.server)}</td>
                <td className="text-right">{KRW.fmt(office)}</td>
                <td className="text-right">{KRW.fmt(wage)}</td>
                <td className="text-right">{KRW.fmt(leaseFix)}</td>
                <td className="text-right">{KRW.fmt(state.fixed.mkt)}</td>
                <td className="text-right">{KRW.fmt(state.fixed.legal)}</td>
                <td className="text-right">{KRW.fmt(outsCost)} / {KRW.fmt(leaseCost)}</td>
                <td className="text-right">{KRW.fmt(fixed)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function BEPTable({state}:{state:any}){
  const std = state.pricing.standard;
  const pp = state.print.price;
  const outsCost = state.print.outsUnit * state.print.outsRate;
  const leaseCost = state.print.leaseUnit * state.print.leaseRate;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr className="[&>th]:px-3 [&>th]:py-2 border-b border-slate-200">
            <th>기간</th><th className="text-right">MAU</th><th className="text-right">구독매출(비율)</th><th className="text-right">인쇄매출(비율)</th><th className="text-right">총 매출</th><th className="text-right">변동비</th><th className="text-right">공헌이익</th><th className="text-right">고정비</th><th>BEP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {state.periods.sort((a:any,b:any)=>a.start-b.start).map((p:any, idx:number)=>{
            const rows:any[] = [];
            const step = 200;
            const sorted = state.periods.sort((a:any,b:any)=>a.start-b.start);
            const prev = sorted.filter((x:any)=>x.start < p.start).slice(-1)[0];
            const startRaw = prev? prev.mau : 0;
            const mauStart = Math.max(0, Math.ceil(startRaw/step)*step);
            const maxMAU = Math.max(step, Math.ceil(p.mau*1.6/step)*step);
            for(let mau=mauStart; mau<=maxMAU; mau+=step){
              const subUsers=mau*p.subCR, prtOrders=mau*p.prtCR;
              const subRev=subUsers*std, prtRev=prtOrders*pp;
              const varc=prtOrders*(p.hasLease? leaseCost: outsCost);
              const wage=p.hasWage? (p.avgWage*p.heads):0;
              const office=p.hasOffice? state.fixed.office:0;
              const leaseFix=p.hasLease? state.fixed.leaseMonthly*p.leaseCnt:0;
              const fixed=p.server + wage + office + state.fixed.mkt + state.fixed.legal + leaseFix;
              const contrib=subRev + prtRev - varc;
              const ok = contrib >= fixed;
              rows.push(
                <tr key={`${p.id}-${mau}`} className="[&>td]:px-3 [&>td]:py-2">
                  <td>{p.start}~{p.end}</td>
                  <td className="text-right">{mau.toLocaleString()}</td>
                  <td className="text-right">{KRW.fmt(subRev)} <span className="text-slate-400">({KRW.pctFmt(p.subCR)})</span></td>
                  <td className="text-right">{KRW.fmt(prtRev)} <span className="text-slate-400">({KRW.pctFmt(p.prtCR)})</span></td>
                  <td className="text-right">{KRW.fmt(subRev+prtRev)}</td>
                  <td className="text-right">{KRW.fmt(varc)}</td>
                  <td className="text-right">{KRW.fmt(contrib)}</td>
                  <td className="text-right">{KRW.fmt(fixed)}</td>
                  <td className={ok?"text-emerald-600":"text-rose-600"}>{ok? '달성':'미달성'}</td>
                </tr>
              );
            }
            return rows;
          })}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyTable({months}:{months:any[]}){
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr className="[&>th]:px-3 [&>th]:py-2 border-b border-slate-200">
            <th>월</th><th className="text-right">활성 사용자</th><th className="text-right">구독 매출</th><th className="text-right">인쇄매출</th><th className="text-right">총 매출</th><th className="text-right">변동비</th><th className="text-right">고정비</th><th className="text-right">순이익</th><th className="text-right">누적손익</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {months.map(r=> (
            <tr key={r.month} className="[&>td]:px-3 [&>td]:py-2">
              <td>{r.month}</td>
              <td className="text-right">{r.mau.toLocaleString()}</td>
              <td className="text-right">{KRW.fmt(r.subRev)}</td>
              <td className="text-right">{KRW.fmt(r.prtRev)}</td>
              <td className="text-right">{KRW.fmt(r.rev)}</td>
              <td className="text-right">{KRW.fmt(r.varCost)}</td>
              <td className="text-right">{KRW.fmt(r.fixed)}</td>
              <td className="text-right">{KRW.fmt(r.net)}</td>
              <td className="text-right">{KRW.fmt(r.cum)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function YearlyTable({state}:{state:any}){
  const sc = calcScenarioYears(state);
  const rows = sc.neutral.map((r:any,i:number)=>({
    year:r.year,
    con: sc.conservative[i].net,
    neu: r.net,
    agg: sc.aggressive[i].net
  }));
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr className="[&>th]:px-3 [&>th]:py-2 border-b border-slate-200"><th>연도</th><th className="text-right">보수적</th><th className="text-right">중립</th><th className="text-right">공격적</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(r=> (
            <tr key={r.year} className="[&>td]:px-3 [&>td]:py-2">
              <td>Y{r.year}</td>
              <td className="text-right">{KRW.fmt(r.con)}</td>
              <td className="text-right">{KRW.fmt(r.neu)}</td>
              <td className="text-right">{KRW.fmt(r.agg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FundingTable({state, months, minCumMonth}:{state:any, months:any[], minCumMonth:number}){
  const until = months.filter(m=>m.month<=minCumMonth);
  const need = until.reduce((min, r)=> Math.min(min, r.cum), 0);
  const total = Math.max(0, -need*1.10);
  const angelVC = total*0.7, gov=total*0.2, founder=total*0.1;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100"><tr className="[&>th]:px-3 [&>th]:py-2 border-b border-slate-200"><th>구분</th><th className="text-right">금액</th><th className="text-right">비율</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          <tr className="[&>td]:px-3 [&>td]:py-2"><td>Angel/VC</td><td className="text-right">{KRW.fmt(angelVC)}</td><td className="text-right">70%</td></tr>
          <tr className="[&>td]:px-3 [&>td]:py-2"><td>Government</td><td className="text-right">{KRW.fmt(gov)}</td><td className="text-right">20%</td></tr>
          <tr className="[&>td]:px-3 [&>td]:py-2"><td>Founder</td><td className="text-right">{KRW.fmt(founder)}</td><td className="text-right">10%</td></tr>
          <tr className="[&>td]:px-3 [&>td]:py-2 font-semibold"><td>합계</td><td className="text-right">{KRW.fmt(total)}</td><td className="text-right">100%</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/*************************
 * 계산 로직
 *************************/
function updatePeriod(idx:number, patch:any, setState:React.Dispatch<any>){
  setState((st:any)=>{ const arr=[...st.periods]; arr[idx] = {...arr[idx], ...patch}; return {...st, periods:arr}; });
}

function mergeRanges(ranges:number[][]){
  if(!ranges.length) return [] as number[][];
  const sorted = ranges.sort((a,b)=>a[0]-b[0]);
  const res:number[][] = [sorted[0].slice() as number[]];
  for(let i=1;i<sorted.length;i++){
    const cur = sorted[i];
    const last = res[res.length-1];
    if(cur[0] <= last[1]+1) last[1] = Math.max(last[1], cur[1]);
    else res.push(cur.slice() as number[]);
  }
  return res;
}

function calcMonthlySeries(state:any){
  const periods = [...state.periods].sort((a,b)=>a.start-b.start);
  const maxEnd = periods.reduce((m:number,p:any)=>Math.max(m,p.end),0);
  const months:any[] = [];
  const stdPrice = state.pricing.standard;
  const printPrice = state.print.price;
  const outsCost = state.print.outsUnit * state.print.outsRate;
  const leaseCost = state.print.leaseUnit * state.print.leaseRate;

  let lastMAU = 0; // 직전 월 MAU

  for(let m=1; m<=maxEnd; m++){
    const pIdx = periods.findIndex((pp:any)=>m>=pp.start && m<=pp.end);
    if(pIdx<0){ months.push({month:m, rev:0, subRev:0, prtRev:0, varCost:0, fixed:0, op:0, net:0, mau:0, ratios:{sub:0,prt:0}}); continue; }
    const p = periods[pIdx];
    const prevTarget = (pIdx>0)? periods[pIdx-1].mau : p.mau; // 첫 구간은 자기 목표
    const periodLen = (p.end - p.start + 1);
    const step = (p.mau - prevTarget) / periodLen;

    // 월별 MAU: 첫 구간은 고정, 이후 구간은 선형 증가
    const mau = (pIdx===0)? p.mau : Math.max(0, Math.round(lastMAU + step));
    lastMAU = mau;

    const subUsers = mau * p.subCR;
    const prtOrders = mau * p.prtCR; // 1인 1주문 가정
    const subRev = subUsers * stdPrice;
    const prtRev = prtOrders * printPrice;
    const varCost = prtOrders * (p.hasLease? leaseCost : outsCost);
    const contribution = subRev + prtRev - varCost;
    const wage = p.hasWage ? (p.avgWage * p.heads) : 0;
    const office = p.hasOffice ? state.fixed.office : 0;
    const leaseFix = p.hasLease ? state.fixed.leaseMonthly * p.leaseCnt : 0;
    const fixed = p.server + wage + office + state.fixed.mkt + state.fixed.legal + leaseFix;
    const net = contribution - fixed;

    months.push({month:m,mau,subRev,prtRev,rev:subRev+prtRev,varCost,fixed,net,ratios:{sub:p.subCR,prt:p.prtCR}});
  }

  // 누적 및 BEP
  let cum=0, minCum=0, minCumMonth=0, bepMonth:number|undefined=undefined;
  months.forEach(r=>{ cum+=r.net; r.cum=cum; if(cum<minCum){ minCum=cum; minCumMonth=r.month; } if(bepMonth===undefined && r.cum>=0) bepMonth=r.month; });
  return {months, minCum, minCumMonth, bepMonth};
}

function calcScenarioYears(state:any){
  const { months } = calcMonthlySeries(state);
  const agg = (arr:number[])=>arr.reduce((a,b)=>a+b,0);
  const y1 = months.filter(m=>m.month<=12);
  const y2 = months.filter(m=>m.month>12 && m.month<=24);
  const y3 = months.filter(m=>m.month>24 && m.month<=36);
  const neu = [y1,y2,y3].map((ys,i)=>({year:i+1, net: agg(ys.map(r=>r.net))}));
  const w = state.weights;
  const conservative = neu.map((r:any)=>({year:r.year, net: r.net*w.con}));
  const aggressive = neu.map((r:any)=>({year:r.year, net: r.net*w.agg}));
  return { neutral: neu, conservative, aggressive };
}

function calcNeededFund(months:any[]){
  let minCum = 0; let minAt = 0; let cum=0;
  const needAt = (at:number)=> Math.max(0, -Math.min(...months.filter(m=>m.month<=at).map(m=>m.cum)));
  months.forEach(m=>{ cum+=m.net; if(cum<minCum){ minCum=cum; minAt=m.month; } });
  return {
    maxDeficit: -minCum,
    minAt,
    need6: needAt(6), need12: needAt(12), need24: needAt(24)
  };
}

function exportCSV(months:any[]){
  const headers = ['month','mau','subRev','prtRev','rev','varCost','fixed','net','cum'];
  const rows = months.map(r=>[r.month,r.mau,r.subRev,r.prtRev,r.rev,r.varCost,r.fixed,r.net,r.cum]);
  const csv = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='months.csv'; a.click(); URL.revokeObjectURL(url);
}
