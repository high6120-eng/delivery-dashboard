"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import Script from "next/script";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 정산일(금요일) 기준 월/주차 계산 로직
const getWeekInfo = (dateStr: any) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const day = d.getDay(); 

  const daysUntilTue = (2 - day + 7) % 7;
  const endTue = new Date(d);
  endTue.setDate(d.getDate() + daysUntilTue);
  
  const paymentFri = new Date(endTue);
  paymentFri.setDate(endTue.getDate() + 3);

  const year = paymentFri.getFullYear();
  const month = paymentFri.getMonth() + 1;
  const weekNum = Math.floor((endTue.getDate() - 1) / 7) + 1;
  
  const weekId = `${year}-${String(month).padStart(2, '0')}-W${weekNum}`;
  const monthId = `${year}-${String(month).padStart(2, '0')}`;
  
  return { weekId, monthId, year, month, weekNum };
};

export default function Home() {
  const [view, setView] = useState("main"); 
  const [logs, setLogs] = useState<any[]>([]);
  const [activeLog, setActiveLog] = useState<any>(null); // any 추가
  const [weeklyDeposits, setWeeklyDeposits] = useState<any>({});

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  const getTodayDate = () => new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const [startDate, setStartDate] = useState(getTodayDate());
  const [startTime, setStartTime] = useState("");
  const [startMileage, setStartMileage] = useState("");
  const [endDate, setEndDate] = useState(getTodayDate());
  const [endTime, setEndTime] = useState("");
  const [endMileage, setEndMileage] = useState("");
  const [kakaoPicker, setKakaoPicker] = useState("");
  const [coupangEats, setCoupangEats] = useState("");
  const [baemin, setBaemin] = useState("");
  const [etcIncomeMemo, setEtcIncomeMemo] = useState("");
  const [etcIncome, setEtcIncome] = useState("");
  const [expenseMemo, setExpenseMemo] = useState("");
  const [expense, setExpense] = useState("");
  const [editLogId, setEditLogId] = useState<any>(null); // any 추가
  const [editForm, setEditForm] = useState<any>({}); // any 추가

  const fetchData = async () => {
    const { data: workingData } = await supabase.from("delivery_logs").select("*").eq("status", "working").maybeSingle(); 
    setActiveLog(workingData);
    if (workingData) setEndDate(workingData.work_date || getTodayDate());

    const { data: historyData } = await supabase.from("delivery_logs").select("*").order("work_date", { ascending: false });
    if (historyData) setLogs(historyData);

    const { data: depositData } = await supabase.from("weekly_deposits").select("*");
    if (depositData) {
      const depObj: any = {};
      depositData.forEach((d: any) => depObj[d.week_id] = d.actual_deposit);
      setWeeklyDeposits(depObj);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDepositChange = async (weekId: any, value: any) => {
    const numVal = Number(value) || 0;
    setWeeklyDeposits((prev: any) => ({ ...prev, [weekId]: numVal }));
    await supabase.from("weekly_deposits").upsert({ week_id: weekId, actual_deposit: numVal });
  };

  const statsData = useMemo(() => {
    const wStats: any = {}; // any 추가
    logs.forEach((log: any) => {
      if (log.status !== 'completed') return;
      const info = getWeekInfo(log.work_date);
      if (!info) return;

      if (!wStats[info.weekId]) {
        wStats[info.weekId] = { weekId: info.weekId, monthId: info.monthId, month: info.month, weekNum: info.weekNum, income: 0, expense: 0, workHours: 0 };
      }
      
      const income = (log.coupang_eats||0) + (log.baemin||0) + (log.kakao_picker||0) + (log.etc_income||0);
      wStats[info.weekId].income += income;
      wStats[info.weekId].expense += (log.expense||0);
      wStats[info.weekId].workHours += Number(log.work_hours||0);
    });
    
    const weeklyList = Object.values(wStats).sort((a: any, b: any) => b.weekId.localeCompare(a.weekId));
    weeklyList.forEach((w: any) => {
      w.actualDeposit = weeklyDeposits[w.weekId] || 0;
      w.insuranceTax = w.income - w.actualDeposit;
      w.netProfit = w.actualDeposit - w.expense;
    });
    
    const mStats: any = {}; // any 추가
    weeklyList.forEach((w: any) => {
      if (!mStats[w.monthId]) {
        mStats[w.monthId] = { monthId: w.monthId, month: w.month, income: 0, actualDeposit: 0, expense: 0, insuranceTax: 0, netProfit: 0, workHours: 0 };
      }
      mStats[w.monthId].income += w.income;
      mStats[w.monthId].actualDeposit += w.actualDeposit;
      mStats[w.monthId].expense += w.expense;
      mStats[w.monthId].insuranceTax += w.insuranceTax;
      mStats[w.monthId].netProfit += w.netProfit;
      mStats[w.monthId].workHours += w.workHours;
    });
    
    const monthlyList = Object.values(mStats).sort((a: any, b: any) => b.monthId.localeCompare(a.monthId));
    monthlyList.forEach((m: any) => {
      m.margin = m.income > 0 ? ((m.netProfit / m.income) * 100).toFixed(1) : 0;
      m.hourlyWage = m.workHours > 0 ? Math.round(m.netProfit / m.workHours) : 0;
    });
    
    return { weeklyList, monthlyList };
  }, [logs, weeklyDeposits]);

  const handleClockIn = async () => {
    const finalStartTime = startTime || getCurrentTime();
    const { error } = await supabase.from("delivery_logs").insert([{ 
      work_date: startDate, start_time: finalStartTime, start_mileage: startMileage ? Number(startMileage) : null, status: "working" 
    }]);
    if (!error) { alert(`출근 완료!`); setStartTime(""); setStartMileage(""); fetchData(); }
  };

  const handleClockOut = async () => {
    if (!activeLog) return;
    const finalEndTime = endTime || getCurrentTime();
    let calculatedWorkHours = 0;
    if (activeLog.start_time) {
      const sDate = new Date(`${activeLog.work_date}T${activeLog.start_time}:00`);
      const eDate = new Date(`${endDate}T${finalEndTime}:00`);
      let diffMins = (eDate.getTime() - sDate.getTime()) / (1000 * 60);
      if (diffMins < 0) diffMins += 24 * 60;
      calculatedWorkHours = Number((diffMins / 60).toFixed(2));
    }
    await supabase.from("delivery_logs").update({
      end_time: finalEndTime, 
      end_mileage: endMileage ? Number(endMileage) : null, 
      work_hours: calculatedWorkHours,
      kakao_picker: Number(kakaoPicker) || 0, 
      coupang_eats: Number(coupangEats) || 0, 
      baemin: Number(baemin) || 0,
      etc_income_memo: etcIncomeMemo || null, 
      etc_income: Number(etcIncome) || 0, 
      expense_memo: expenseMemo || null, 
      expense: Number(expense) || 0,
      status: "completed"
    }).eq("id", activeLog.id);
    alert(`정산 완료!`); fetchData();
  };

  const handleDelete = async (id: any) => {
    if (confirm("정말 이 일지를 삭제하시겠습니까?")) { await supabase.from("delivery_logs").delete().eq("id", id); fetchData(); }
  };

  const startEdit = (log: any) => {
    setEditLogId(log.id);
    setEditForm({
      work_date: log.work_date || "", start_time: log.start_time?.slice(0, 5) || "", end_time: log.end_time?.slice(0, 5) || "",
      start_mileage: log.start_mileage || "", end_mileage: log.end_mileage || "", work_hours: log.work_hours || "",
      kakao_picker: log.kakao_picker || "", coupang_eats: log.coupang_eats || "", baemin: log.baemin || "",
      etc_income_memo: log.etc_income_memo || "", etc_income: log.etc_income || "", expense_memo: log.expense_memo || "", expense: log.expense || "",
    });
  };

  const handleEditChange = (e: any) => {
    const { name, value } = e.target;
    let updatedForm = { ...editForm, [name]: value };
    if ((name === "start_time" || name === "end_time") && updatedForm.start_time && updatedForm.end_time) {
      const [sH, sM] = updatedForm.start_time.split(':').map(Number);
      const [eH, eM] = updatedForm.end_time.split(':').map(Number);
      let diffMins = (eH * 60 + eM) - (sH * 60 + sM);
      if (diffMins < 0) diffMins += 24 * 60;
      updatedForm.work_hours = Number((diffMins / 60).toFixed(2));
    }
    setEditForm(updatedForm);
  };

  const saveEdit = async () => {
    await supabase.from("delivery_logs").update({
      work_date: editForm.work_date, start_time: editForm.start_time || null, end_time: editForm.end_time || null,
      start_mileage: editForm.start_mileage ? Number(editForm.start_mileage) : null, end_mileage: editForm.end_mileage ? Number(editForm.end_mileage) : null,
      work_hours: Number(editForm.work_hours) || 0, kakao_picker: Number(editForm.kakao_picker) || 0, coupang_eats: Number(editForm.coupang_eats) || 0, baemin: Number(editForm.baemin) || 0,
      etc_income_memo: editForm.etc_income_memo || null, etc_income: Number(editForm.etc_income) || 0, expense_memo: editForm.expense_memo || null, expense: Number(editForm.expense) || 0,
    }).eq("id", editLogId);
    setEditLogId(null); fetchData(); alert("수정되었습니다.");
  };

  return (
    <div style={{ padding: "15px", fontFamily: "sans-serif", maxWidth: "1000px", margin: "0 auto", boxSizing: "border-box" }}>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #eee", paddingBottom: "10px", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "24px", margin: 0 }}>🛵 나의 배달 일지</h1>
        <button onClick={() => setView(view === 'main' ? 'stats' : 'main')} style={{ background: view === 'main' ? "#4caf50" : "#9e9e9e", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
          {view === 'main' ? "📊 통계 보기" : "⬅️ 메인으로"}
        </button>
      </div>

      {view === 'stats' ? (
        <div>
          <h2 style={{ color: "#0070f3", borderLeft: "4px solid #0070f3", paddingLeft: "10px" }}>월간 통계 (정산월 기준)</h2>
          <div style={{ overflowX: "auto", backgroundColor: "#fff", borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "30px" }}>
            <table style={{ width: "100%", minWidth: "850px", borderCollapse: "collapse", textAlign: "right", fontSize: "14px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa", borderBottom: "2px solid #ddd", textAlign: "center" }}>
                  <th>월</th><th>수입</th><th>실제 입금액</th><th>지출</th><th>순수익</th><th>순수익률</th><th>보험료/세금</th><th>시급</th>
                </tr>
              </thead>
              <tbody>
                {statsData.monthlyList.map((m: any) => (
                  <tr key={m.monthId} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ textAlign: "center", fontWeight: "bold" }}>{m.month}월</td>
                    <td>{m.income.toLocaleString()}원</td>
                    <td style={{ color: "#2e7d32", fontWeight: "bold" }}>{m.actualDeposit.toLocaleString()}원</td>
                    <td>{m.expense.toLocaleString()}원</td>
                    <td style={{ color: "#f57f17", fontWeight: "bold" }}>{m.netProfit.toLocaleString()}원</td>
                    <td>{m.margin}%</td>
                    <td style={{ color: "#d32f2f" }}>{m.insuranceTax.toLocaleString()}원</td>
                    <td style={{ fontWeight: "bold", color: "#0070f3" }}>{m.hourlyWage.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* 주간 통계 부분도 동일하게 map((w: any) 적용 */}
          <h2 style={{ color: "#d90429", borderLeft: "4px solid #d90429", paddingLeft: "10px" }}>주간 통계 (수~화 기준)</h2>
          <div style={{ overflowX: "auto", backgroundColor: "#fff", borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <table style={{ width: "100%", minWidth: "700px", borderCollapse: "collapse", textAlign: "right", fontSize: "14px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa", borderBottom: "2px solid #ddd", textAlign: "center" }}>
                  <th>주차</th><th>수입</th><th>실제 입금액</th><th>지출</th><th>보험료/세금</th>
                </tr>
              </thead>
              <tbody>
                {statsData.weeklyList.map((w: any) => (
                  <tr key={w.weekId} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ textAlign: "center", fontWeight: "bold" }}>{w.month}월 {w.weekNum}주차</td>
                    <td>{w.income.toLocaleString()}원</td>
                    <td><input type="number" defaultValue={w.actualDeposit || ""} onBlur={(e) => handleDepositChange(w.weekId, e.target.value)} style={{ width: "80px" }} /></td>
                    <td>{w.expense.toLocaleString()}원</td>
                    <td>{w.insuranceTax.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ backgroundColor: "#f0f7ff", padding: "20px", borderRadius: "10px", marginBottom: "30px" }}>
            {!activeLog ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3>새로운 배달 시작</h3>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                <input type="number" placeholder="주행거리" value={startMileage} onChange={(e) => setStartMileage(e.target.value)} />
                <button onClick={handleClockIn} style={{ padding: "10px", background: "#0070f3", color: "#fff" }}>🚀 출근하기</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3>🟢 근무 중</h3>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                <input type="number" placeholder="퇴근 주행거리" value={endMileage} onChange={(e) => setEndMileage(e.target.value)} />
                <button onClick={handleClockOut} style={{ padding: "10px", background: "#d90429", color: "#fff" }}>🏁 퇴근/정산</button>
              </div>
            )}
          </div>
          <h3>과거 일지 ({logs.length}일)</h3>
          {logs.map((log: any) => (
             <div key={log.id} style={{ padding: "10px", borderBottom: "1px solid #eee" }}>
                {log.work_date} - {log.status} 
                <button onClick={() => startEdit(log)}>수정</button>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}