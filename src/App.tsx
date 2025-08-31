import './App.css'
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

// Chart.js (no styles required, accessible colors come from default palette)
import Chart from "chart.js/auto";
import type { Chart as ChartType } from "chart.js";


import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://irqvbemferrqxzbzhjwh.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlycXZiZW1mZXJycXh6YnpoandoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2MzQzNjksImV4cCI6MjA3MjIxMDM2OX0.nZX_EGJ_6dFbmX7sO5Yp98_d4-HSfjLBUcd7H9b4xzo"
);

async function saveCaseToServer(caseData: any) {
  const { data, error } = await supabase.from("cases").insert([caseData]);
  if (error) console.error(error);
}

async function loadCasesFromServer() {
  const { data, error } = await supabase.from("cases").select("*");
  return data || [];
}


/*************************
 * 통화/퍼센트 유틸
 *************************/
const KRW = {
  fmt(n){
    if(n===null||n===undefined||isNaN(n)) return '-';
    const sign = n<0?'-':''; n=Math.abs(n);
    if(n>=100_000_000){ return sign + (n/100_000_000).toFixed(2).replace(/\.00$/,'') + ' 억'; }
    if(n>=1_000_000){ return sign + (n/1_000_000).toFixed(1).replace(/\.0$/,'') + ' 백만'; }
    if(n>=100_000){ return sign + n.toLocaleString('ko-KR'); }
    return sign + Math.round(n).toLocaleString('ko-KR');
  },
  parse(str){
    if(typeof str==='number') return str;
    if(!str) return 0;
    str = (''+str).trim().replace(/,/g,'');
    const unit = str.match(/[가-힣]+$/);
    let base = parseFloat(str);
    if(isNaN(base)) return 0;
    if(unit){
      if(unit[0]==='억') base*=100_000_000;
      else if(unit[0]==='백만') base*=1_000_000;
    }
    return base;
  },
  pctParse(v){
    if(v===''||v===null||v===undefined) return 0;
    if(typeof v==='number') return v>1? v/100 : v;
    v=(''+v).trim();
    if(v.endsWith('%')) v=v.slice(0,-1);
    const x=parseFloat(v);
    if(isNaN(x)) return 0;
    return x>1? x/100 : x;
  },
  pctFmt(p){ return (p*100).toFixed(1).replace(/\.0$/,'')+'%'; }
}

/*************************
 * 초기 상태
 *************************/
const defaultState = {
  name: "Case A (MVP 예시)",
  pricing:{ standard:9_900, pro:14_900 },
  print:{ price:20_000, outsUnit:12_000, outsRate:1.0, leaseUnit:8_000, leaseRate:1.0 },
  fixed:{ office:1_500_000, mkt:1_000_000, legal:300_000, leaseMonthly:2_000_000 },
  weights:{ con:0.7, neu:1.0, agg:1.3 },
  periods:[
    {id:uid(),start:1,end:6,mau:300,subCR:0.03,prtCR:0.05,server:500_000,hasWage:false,avgWage:3_000_000,heads:0,hasOffice:false,hasLease:false,leaseCnt:0},
    {id:uid(),start:7,end:12,mau:1000,subCR:0.035,prtCR:0.06,server:800_000,hasWage:true,avgWage:3_200_000,heads:3,hasOffice:true,hasLease:true,leaseCnt:1},
    {id:uid(),start:13,end:24,mau:5000,subCR:0.04,prtCR:0.07,server:1_500_000,hasWage:true,avgWage:3_500_000,heads:5,hasOffice:true,hasLease:true,leaseCnt:2},
  ]
}

function uid(){ return Math.random().toString(36).slice(2,9); }
const STORE_KEY = 'lm_fin_cases_v6';

/*************************
 * 메인 컴포넌트
 *************************/
export default function FinancialCalculatorApp(){
  const [state,setState] = useState(defaultState);
  const [caseList,setCaseList] = useState(()=>JSON.parse(localStorage.getItem(STORE_KEY)||'[]'));
  const [periodDraft,setPeriodDraft] = useState({start:1,end:6,mau:300});
  const [tab,setTab] = useState("sum");

  const { months, minCum, minCumMonth, bepMonth } = useMemo(()=>calcMonthlySeries(state),[state]);
  const needed = useMemo(()=>calcNeededFund(months),[months]);
  const totalInvestNeed = Math.max(0, needed.maxDeficit * 1.10);

  // Charts
  const cumRef = useRef<HTMLCanvasElement | null>(null);
  const monthlyRef = useRef<HTMLCanvasElement | null>(null);
  const scRef = useRef<HTMLCanvasElement | null>(null);

  const cumChart = useRef<ChartType | null>(null);
  const monthlyChart = useRef<ChartType | null>(null);
  const scChart = useRef<ChartType | null>(null);


useEffect(() => {
  const labels = months.map(r => `${r.month}M`);
  const yFmt = (v: number) => KRW.fmt(v);

  // 누적 손익
  if (cumChart.current) cumChart.current.destroy();
  if (cumRef.current) {
    cumChart.current = new Chart(cumRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [{ label: "누적손익", data: months.map(r => r.cum) }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: yFmt } } }
      }
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
      options: { responsive: true, scales: { y: { ticks: { callback: yFmt } } } }
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
      options: { responsive: true, scales: { y: { ticks: { callback: yFmt } } } }
    });
  }

  // (선택) 언마운트/재렌더 시 Chart 메모리 정리
  return () => {
    cumChart.current?.destroy();
    monthlyChart.current?.destroy();
    scChart.current?.destroy();
  };
}, [months, state]);


  // 저장/불러오기
  const saveCase = ()=>{
    let next = [...caseList];
    const idx = next.findIndex(c=>c.name===state.name);
    const payload = JSON.parse(JSON.stringify(state));
    if(idx>=0) next[idx]=payload; else next.push(payload);
    setCaseList(next);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  }
  const loadCase = (name)=>{
    const c = caseList.find(x=>x.name===name);
    if(c) setState(c);
  }
  const deleteCase = ()=>{
    const next = caseList.filter(c=>c.name!==state.name);
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
            {/* 마케팅용 CTA */}
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
                    <th className="min-w-[120px]">기간 (개월)</th>
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
                      <td className="px-3 py-2"><Input aria-label="기간"
                          value={`${p.start}-${p.end}`}
                          onChange={(e)=>{
                            const [s,e2]=e.target.value.split('-').map(x=>parseInt(x.trim()));
                            setState(st=>{ const arr=[...st.periods]; arr[idx] = {...arr[idx], start:isNaN(s)?p.start:s, end:isNaN(e2)?p.end:e2}; return {...st, periods:arr}; })
                          }}/></td>
                      <td className="px-3 py-2"><Input type="number" value={p.mau}
                          onChange={(e)=>updatePeriod(idx,{mau:parseInt(e.target.value||'0')},setState)}/></td>
                      <td className="px-3 py-2"><Input value={KRW.pctFmt(p.subCR)}
                          onChange={(e)=>updatePeriod(idx,{subCR:KRW.pctParse(e.target.value)},setState)}/></td>
                      <td className="px-3 py-2"><Input value={KRW.pctFmt(p.prtCR)}
                          onChange={(e)=>updatePeriod(idx,{prtCR:KRW.pctParse(e.target.value)},setState)}/></td>
                      <td className="px-3 py-2"><Input value={KRW.fmt(p.server)}
                          onChange={(e)=>updatePeriod(idx,{server:KRW.parse(e.target.value)},setState)}/></td>
                      <td className="px-3 py-2">
                        <Switch checked={p.hasWage}
                          onCheckedChange={(v)=>updatePeriod(idx,{hasWage:v},setState)} aria-label="인건비 포함"/>
                      </td>
                      <td className="px-3 py-2"><Input value={KRW.fmt(p.avgWage)}
                          onChange={(e)=>updatePeriod(idx,{avgWage:KRW.parse(e.target.value)},setState)}/></td>
                      <td className="px-3 py-2"><Input type="number" value={p.heads}
                          onChange={(e)=>updatePeriod(idx,{heads:parseInt(e.target.value||'0')},setState)}/></td>
                      <td className="px-3 py-2"><Switch checked={p.hasOffice}
                          onCheckedChange={(v)=>updatePeriod(idx,{hasOffice:v},setState)} aria-label="사무실 포함"/></td>
                      <td className="px-3 py-2"><Switch checked={p.hasLease}
                          onCheckedChange={(v)=>updatePeriod(idx,{hasLease:v},setState)} aria-label="리스"/></td>
                      <td className="px-3 py-2"><Input type="number" value={p.leaseCnt}
                          onChange={(e)=>updatePeriod(idx,{leaseCnt:parseInt(e.target.value||'0')},setState)}/></td>
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
            <p className="mt-4 text-sm text-slate-600">투자 구조: 엔젤/VC {KRW.fmt(totalInvestNeed*0.7)} (70%), 정부 {KRW.fmt(totalInvestNeed*0.2)} (20%), 대표 자본금 {KRW.fmt(totalInvestNeed*0.1)} (10%).</p>
            {officeOffRanges.length>0 && (
              <p className="mt-1 text-sm text-amber-700 flex items-center gap-2"><Building2 className="w-4 h-4"/> 사무실 비용 제외 구간 {officeOffRanges.map(r=>`${r[0]}~${r[1]}개월차`).join(', ')} 은(는) 공간 지원 필요.</p>
            )}
          </TabsContent>

          <TabsContent value="chart" className="pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ChartCard title="누적 손익"><canvas ref={cumRef} role="img" aria-label="누적 손익 라인 차트"/></ChartCard>
              <ChartCard title="월 매출 · 비용"><canvas ref={monthlyRef} role="img" aria-label="월 매출·비용 라인 차트"/></ChartCard>
              <ChartCard title="연도별 시나리오 (보수/중립/공격)"><canvas ref={scRef} role="img" aria-label="시나리오 바 차트"/></ChartCard>
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
        <div className="relative aspect-[16/9]">{children}</div>
      </CardContent>
    </HoverCard>
  )
}

function MoneyInput({label,value,onChange}:{label:string,value:number,onChange:(v:number)=>void}){
  const [raw,setRaw] = useState(KRW.fmt(value));
  useEffect(()=>{ setRaw(KRW.fmt(value)); },[value]);
  return (
    <div className="space-y-1">
      <Label className="text-slate-700">{label}</Label>
      <Input value={raw} onChange={(e)=>setRaw(e.target.value)} onBlur={()=>onChange(KRW.parse(raw))}/>
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

function CostByPeriodTable({state}:{state:any}){
  const outsCost = state.print.outsUnit * state.print.outsRate;
  const leaseCost = state.print.leaseUnit * state.print.leaseRate;
  let totalFix=0;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr className="[&>th]:px-3 [&>th]:py-2 border-b border-slate-200">
            <th>기간</th><th className="text-right">서버</th><th className="text-right">사무실</th><th className="text-right">인건비</th><th className="text-right">리스(고정)</th><th className="text-right">마케팅</th><th className="text-right">법률/회계</th><th className="text-right">변동(인쇄/건)</th><th className="text-right">월 합계(고정)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {state.periods.map((p:any)=>{
            const wage = p.hasWage ? (p.avgWage*p.heads):0;
            const office = p.hasOffice ? state.fixed.office:0;
            const leaseFix = p.hasLease ? state.fixed.leaseMonthly * p.leaseCnt : 0;
            const fix = p.server + office + wage + leaseFix + state.fixed.mkt + state.fixed.legal;
            totalFix += fix;
            const varUnit = p.hasLease? leaseCost : outsCost;
            return (
              <tr key={p.id} className="[&>td]:px-3 [&>td]:py-2">
                <td>{p.start}~{p.end}</td>
                <td className="text-right">{KRW.fmt(p.server)}</td>
                <td className="text-right">{KRW.fmt(office)}</td>
                <td className="text-right">{KRW.fmt(wage)}</td>
                <td className="text-right">{KRW.fmt(leaseFix)}</td>
                <td className="text-right">{KRW.fmt(state.fixed.mkt)}</td>
                <td className="text-right">{KRW.fmt(state.fixed.legal)}</td>
                <td className="text-right">{KRW.fmt(varUnit)} <span className="text-slate-400">/주문</span></td>
                <td className="text-right">{KRW.fmt(fix)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-2">요약: 월 고정비 단순합 {KRW.fmt(totalFix)}</p>
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
          {state.periods.map((p:any)=>{
            const rows=[] as any[];
            const step=200; const maxMAU=Math.max(200, Math.ceil(p.mau*1.6/step)*step);
            for(let mau=0;mau<=maxMAU;mau+=step){
              const subUsers=mau*p.subCR, prtOrders=mau*p.prtCR;
              const subRev=subUsers*std, prtRev=prtOrders*pp;
              const varc=prtOrders*(p.hasLease? leaseCost:outsCost);
              const contrib=subRev+prtRev-varc;
              const wage=p.hasWage? (p.avgWage*p.heads):0;
              const office=p.hasOffice? state.fixed.office:0;
              const leaseFix = p.hasLease? state.fixed.leaseMonthly*p.leaseCnt:0;
              const fixed=p.server+wage+office+state.fixed.mkt+state.fixed.legal+leaseFix;
              const ok = contrib>=fixed;
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
                  <td className={ok?"text-emerald-600":"text-rose-600"}>{ok?'달성':'미달성'}</td>
                </tr>
              )
            }
            return rows;
          })}
        </tbody>
      </table>
    </div>
  )
}

function MonthlyTable({months}:{months:any[]}){
  const firstNonNeg = months.find(m=>m.net>=0);
  const bepTxt = firstNonNeg? `${firstNonNeg.month}개월차` : '미달성';
  const min = months.reduce((a,b)=> a.cum<b.cum? a:b, months[0]||{cum:0});
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr className="[&>th]:px-3 [&>th]:py-2 border-b border-slate-200">
            <th>월</th><th className="text-right">활성 사용자</th><th className="text-right">구독 매출(비율)</th><th className="text-right">인쇄 매출(비율)</th><th className="text-right">총 매출</th><th className="text-right">변동비</th><th className="text-right">고정비</th><th className="text-right">영업이익</th><th className="text-right">순이익</th><th className="text-right">누적손익</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {months.map(r=> (
            <tr key={r.month} className="[&>td]:px-3 [&>td]:py-2">
              <td>{r.month}</td><td className="text-right">{r.mau.toLocaleString()}</td>
              <td className="text-right">{KRW.fmt(r.subRev)} <span className="text-slate-400">({KRW.pctFmt(r.ratios.sub)})</span></td>
              <td className="text-right">{KRW.fmt(r.prtRev)} <span className="text-slate-400">({KRW.pctFmt(r.ratios.prt)})</span></td>
              <td className="text-right">{KRW.fmt(r.rev)}</td>
              <td className="text-right">{KRW.fmt(r.varCost)}</td>
              <td className="text-right">{KRW.fmt(r.fixed)}</td>
              <td className={r.op>=0?"text-emerald-600 text-right":"text-rose-600 text-right"}>{KRW.fmt(r.op)}</td>
              <td className={r.net>=0?"text-emerald-600 text-right":"text-rose-600 text-right"}>{KRW.fmt(r.net)}</td>
              <td className={r.cum>=0?"text-emerald-600 text-right":"text-rose-600 text-right"}>{KRW.fmt(r.cum)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-2">요약: BEP 시기 {bepTxt}, 최대 누적적자는 {min?.month}개월차에 {KRW.fmt(-(min?.cum||0))}.</p>
    </div>
  )
}

function YearlyTable({state}:{state:any}){
  const sc = calcScenarioYears(state);
  const Row = ({label,rows}:{label:string,rows:any[]})=> (
    <>
      {rows.map((r)=>{
        const contrib=r.rev-r.varCost; const op=contrib-r.fixed;
        return (
          <tr key={`${label}-${r.year}`} className="[&>td]:px-3 [&>td]:py-2">
            <td>{label}</td>
            <td>Y{r.year}</td>
            <td className="text-right">{r.mau.toLocaleString()}</td>
            <td className="text-right">{KRW.fmt(r.rev)}</td>
            <td className="text-right">{KRW.fmt(r.varCost)}</td>
            <td className="text-right">{KRW.fmt(contrib)}</td>
            <td className="text-right">{KRW.fmt(r.fixed)}</td>
            <td className={op>=0?"text-emerald-600 text-right":"text-rose-600 text-right"}>{KRW.fmt(op)}</td>
            <td className={op>=0?"text-emerald-600 text-right":"text-rose-600 text-right"}>{KRW.fmt(op)}</td>
          </tr>
        )
      })}
    </>
  );
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr className="[&>th]:px-3 [&>th]:py-2 border-b border-slate-200">
            <th>시나리오</th><th>연도</th><th className="text-right">평균 MAU</th><th className="text-right">총 매출</th><th className="text-right">변동비</th><th className="text-right">공헌이익</th><th className="text-right">고정비</th><th className="text-right">영업이익</th><th className="text-right">순이익</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          <Row label="보수적" rows={sc.conservative}/>
          <Row label="중립" rows={sc.neutral}/>
          <Row label="공격적" rows={sc.aggressive}/>
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-2">요약: 가중치로 MAU 및 매출을 스케일링한 1~3년차 추정입니다. (고정비 동일 가정)</p>
    </div>
  )
}

function FundingTable({state, months, minCumMonth}:{state:any, months:any[], minCumMonth:number}){
  const outsCost = state.print.outsUnit * state.print.outsRate;
  const leaseCost = state.print.leaseUnit * state.print.leaseRate;
  const slice = months.filter(r=>r.month<=minCumMonth);
  const sums = { server:0, office:0, wage:0, leaseFix:0, mkt:0, legal:0, varPrint:0 } as Record<string,number>;

  for(const r of slice){
    const p = state.periods.find((pp:any)=>r.month>=pp.start && r.month<=pp.end);
    if(!p) continue;
    sums.server += p.server;
    if(p.hasOffice) sums.office += state.fixed.office;
    if(p.hasWage) sums.wage += p.avgWage * p.heads;
    if(p.hasLease) sums.leaseFix += state.fixed.leaseMonthly * p.leaseCnt;
    sums.mkt += state.fixed.mkt;
    sums.legal += state.fixed.legal;
    const prtOrders = r.mau * p.prtCR;
    sums.varPrint += prtOrders * (p.hasLease? leaseCost : outsCost);
  }
  const total = Object.values(sums).reduce((a,b)=>a+b,0);
  const Row = ({type,item,amount}:{type:string,item:string,amount:number})=> (
    <tr className="[&>td]:px-3 [&>td]:py-2">
      <td>~ {minCumMonth}개월차</td>
      <td>{type}</td>
      <td>{item}</td>
      <td className="text-right">{KRW.fmt(amount)}</td>
      <td className="text-right">{total? ((amount/total*100).toFixed(1)+"%"):'-'}</td>
    </tr>
  );

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr className="[&>th]:px-3 [&>th]:py-2 border-b border-slate-200">
            <th>기간</th><th>집행 유형</th><th>집행 항목</th><th className="text-right">금액</th><th className="text-right">비중</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          <Row type="고정" item="서버" amount={sums.server}/>
          <Row type="고정" item="사무실" amount={sums.office}/>
          <Row type="고정" item="인건비" amount={sums.wage}/>
          <Row type="고정" item="리스(월)" amount={sums.leaseFix}/>
          <Row type="고정" item="마케팅" amount={sums.mkt}/>
          <Row type="고정" item="법률/회계" amount={sums.legal}/>
          <Row type="변동" item="인쇄 원가" amount={sums.varPrint}/>
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-2">요약: 최대 적자 시점({minCumMonth}개월차)까지 누적 집행 총액 {KRW.fmt(total)} (예비비 10% 별도).</p>
    </div>
  )
}

/*************************
 * 계산 로직
 *************************/
function calcMonthlySeries(state:any){
  const maxEnd = state.periods.reduce((m:number,p:any)=>Math.max(m,p.end),0);
  const months:any[] = [];
  const stdPrice = state.pricing.standard;
  const printPrice = state.print.price;
  const outsCost = state.print.outsUnit * state.print.outsRate;
  const leaseCost = state.print.leaseUnit * state.print.leaseRate;

  for(let m=1;m<=maxEnd;m++){
    const p = state.periods.find((pp:any)=>m>=pp.start && m<=pp.end);
    if(!p){ months.push({month:m, rev:0, subRev:0, prtRev:0, varCost:0, fixed:0, op:0, net:0, mau:0, ratios:{sub:0,prt:0}}); continue; }
    const mau = p.mau;
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
    const op = contribution - fixed;
    const net = op;
    months.push({month:m,mau,subRev,prtRev,rev:subRev+prtRev,varCost,fixed,op,net,ratios:{sub:p.subCR,prt:p.prtCR}});
  }

  let cum=0, minCum=0, minCumMonth=0, bepMonth:null|number=null;
  months.forEach(r=>{ cum+=r.net; r.cum=cum; if(cum<minCum){ minCum=cum; minCumMonth=r.month; } if(bepMonth===null && r.net>=0) bepMonth=r.month; });
  return {months, minCum, minCumMonth, bepMonth};
}

function calcYearly(state:any){
  const {months} = calcMonthlySeries(state);
  const years:any[] = [];
  const maxMonth = months.length;
  const yearCount = Math.ceil(maxMonth/12);
  for(let y=1;y<=Math.max(3,yearCount);y++){
    const s=(y-1)*12+1, e=y*12;
    const slice = months.filter(r=>r.month>=s && r.month<=e);
    if(slice.length===0){ years.push({year:y, mau:0, rev:0, varCost:0, fixed:0, op:0, net:0}); continue; }
    const totalMAU = slice.reduce((a,b)=>a+b.mau,0);
    years.push({year:y,
      mau: Math.round(totalMAU/ slice.length),
      rev: slice.reduce((a,b)=>a+b.rev,0),
      varCost: slice.reduce((a,b)=>a+b.varCost,0),
      fixed: slice.reduce((a,b)=>a+b.fixed,0),
      op: slice.reduce((a,b)=>a+b.op,0),
      net: slice.reduce((a,b)=>a+b.net,0)
    });
  }
  return years; // baseline (중립)
}

function calcScenarioYears(state:any){
  const base = calcYearly(state);
  const w = state.weights;
  function scaleRow(row:any, k:number){
    return {
      scenarioK:k,
      year:row.year,
      mau: Math.round(row.mau * k),
      rev: row.rev * k,
      varCost: row.varCost * k,
      fixed: row.fixed,
      op: row.rev * k - row.varCost * k - row.fixed,
      net: row.rev * k - row.varCost * k - row.fixed
    }
  }
  return {
    conservative: base.map(r=>scaleRow(r,w.con)),
    neutral: base.map(r=>scaleRow(r,w.neu)),
    aggressive: base.map(r=>scaleRow(r,w.agg)),
  }
}

function calcNeededFund(months:any[]){
  let cum=0, minCum=0;
  const arr:number[]=[]; // cum at months {6,12,24}
  const targets=[6,12,24];
  let tIdx=0;
  for(let i=0;i<months.length;i++){
    cum+=months[i].net;
    if(cum<minCum) minCum=cum;
    const m=i+1;
    if(tIdx<targets.length && m===targets[tIdx]){ arr.push(minCum); tIdx++; }
  }
  while(arr.length<targets.length) arr.push(minCum);
  return {maxDeficit: -minCum, need6: -arr[0], need12: -arr[1], need24: -arr[2]};
}

function mergeRanges(ranges:number[][]){
  if(!ranges.length) return [] as number[][];
  ranges.sort((a,b)=>a[0]-b[0]);
  const res:[number,number][]= [ranges[0] as [number,number]];
  for(let i=1;i<ranges.length;i++){
    const last=res[res.length-1];
    const cur=ranges[i];
    if(cur[0]<=last[1]+1) last[1]=Math.max(last[1],cur[1]); else res.push(cur as [number,number]);
  }
  return res;
}

function updatePeriod(idx:number, patch:any, setState:Function){
  setState((st:any)=>{
    const arr=[...st.periods];
    arr[idx] = { ...arr[idx], ...patch };
    return { ...st, periods: arr };
  })
}

function exportCSV(months:any[]){
  const rows=[['월','MAU','구독 매출','인쇄 매출','총 매출','변동비','고정비','순이익','누적손익']];
  months.forEach(r=>rows.push([r.month,r.mau,r.subRev,r.prtRev,r.rev,r.varCost,r.fixed,r.net,r.cum]));
  const csv = rows.map(r=>r.map(v=>`"${(''+v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'monthly_pnl.csv';
  a.click();
}

