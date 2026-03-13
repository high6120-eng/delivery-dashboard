"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import Script from "next/script"; // 추가: Next.js 스크립트 로더

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 정산일(금요일) 기준 월/주차 계산 로직
const getWeekInfo = (dateStr) => {
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
  const [logs, setLogs] = useState([]);
  const [activeLog, setActiveLog] = useState(null);
  const [weeklyDeposits, setWeeklyDeposits] = useState({});

  // 텔레그램 웹앱 초기화 및 전체화면 확장
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();    // 텔레그램에게 준비 완료 알림
      tg.expand();   // 전체 화면으로 확장
      
      // 텔레그램 테마에 맞게 상단 바 색상 조절 (선택 사항)
      // tg.setHeaderColor('secondary_bg_color'); 
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
  const [editLogId, setEditLogId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const fetchData = async () => {
    const { data: workingData } = await supabase.from("delivery_logs").select("*").eq("status", "working").maybeSingle(); 
    setActiveLog(workingData);
    if (workingData) setEndDate(workingData.work_date || getTodayDate());

    const { data: historyData } = await supabase.from("delivery_logs").select("*").order("work_date", { ascending: false });
    if (historyData) setLogs(historyData);

    const { data: depositData } = await supabase.from("weekly_deposits").select("*");
    if (depositData) {
      const depObj = {};
      depositData.forEach(d => depObj[d.week_id] = d.actual_deposit);
      setWeeklyDeposits(depObj);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDepositChange = async (weekId, value) => {
    const numVal = Number(value) || 0;
    setWeeklyDeposits(prev => ({ ...prev, [weekId]: numVal }));
    await supabase.from("weekly_deposits").upsert({ week_id: weekId, actual_deposit: numVal });
  };

  // 📊 통계 데이터 자동 계산 로직
  const statsData = useMemo(() => {
    const wStats = {};
    logs.forEach(log => {
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
    
    const weeklyList = Object.values(wStats).sort((a, b) => b.weekId.localeCompare(a.weekId));
    weeklyList.forEach(w => {
      w.actualDeposit = weeklyDeposits[w.weekId] || 0;
      w.insuranceTax = w.income - w.actualDeposit;
      w.netProfit = w.actualDeposit - w.expense;
    });
    
    const mStats = {};
    weeklyList.forEach(w => {
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
    
    const monthlyList = Object.values(mStats).sort((a, b) => b.monthId.localeCompare(a.monthId));
    monthlyList.forEach(m => {
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
      end_time: finalEndTime, end_mileage: endMileage ? Number(endMileage) : null, work_hours: calculatedWorkHours,
      kakao_picker: Number(kakaoPicker) || 0, coupang_eats: Number(coupangEats) || 0, baemin: Number(baemin) || 0,
      etc_income_memo: etcIncomeMemo || null, etc_income: Number(etcIncome) || 0, expense_memo: expense_memo || null, expense: Number(expense) || 0,
      status: "completed"
    }).eq("id", activeLog.id);
    alert(`정산 완료!`); fetchData();
  };

  const handleDelete = async (id) => {
    if (confirm("정말 이 일지를 삭제하시겠습니까?")) { await supabase.from("delivery_logs").delete().eq("id", id); fetchData(); }
  };

  const startEdit = (log) => {
    setEditLogId(log.id);
    setEditForm({
      work_date: log.work_date || "", start_time: log.start_time?.slice(0, 5) || "", end_time: log.end_time?.slice(0, 5) || "",
      start_mileage: log.start_mileage || "", end_mileage: log.end_mileage || "", work_hours: log.work_hours || "",
      kakao_picker: log.kakao_picker || "", coupang_eats: log.coupang_eats || "", baemin: log.baemin || "",
      etc_income_memo: log.etc_income_memo || "", etc_income: log.etc_income || "", expense_memo: log.expense_memo || "", expense: log.expense || "",
    });
  };

  const handleEditChange = (e) => {
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
      {/* 텔레그램 SDK 로드 */}
      <Script 
        src="https://telegram.org/js/telegram-web-app.js" 
        strategy="beforeInteractive" 
      />

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
                  <th style={{ padding: "12px 10px" }}>월</th>
                  <th style={{ padding: "12px 10px" }}>수입</th>
                  <th style={{ padding: "12px 10px", color: "#2e7d32" }}>실제 입금액</th>
                  <th style={{ padding: "12px 10px" }}>지출</th>
                  <th style={{ padding: "12px 10px", color: "#f57f17" }}>순수익</th>
                  <th style={{ padding: "12px 10px" }}>순수익률</th>
                  <th style={{ padding: "12px 10px", color: "#d32f2f" }}>보험료/세금</th>
                  <th style={{ padding: "12px 10px", fontWeight: "bold" }}>시급 (순수익 기준)</th>
                </tr>
              </thead>
              <tbody>
                {statsData.monthlyList.map((m) => (
                  <tr key={m.monthId} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "12px 10px", textAlign: "center", fontWeight: "bold" }}>{m.month}월</td>
                    <td style={{ padding: "12px 10px" }}>{m.income.toLocaleString()}원</td>
                    <td style={{ padding: "12px 10px", color: "#2e7d32", fontWeight: "bold" }}>{m.actualDeposit.toLocaleString()}원</td>
                    <td style={{ padding: "12px 10px" }}>{m.expense.toLocaleString()}원</td>
                    <td style={{ padding: "12px 10px", color: "#f57f17", fontWeight: "bold" }}>{m.netProfit.toLocaleString()}원</td>
                    <td style={{ padding: "12px 10px" }}>{m.margin}%</td>
                    <td style={{ padding: "12px 10px", color: "#d32f2f" }}>{m.insuranceTax.toLocaleString()}원</td>
                    <td style={{ padding: "12px 10px", fontWeight: "bold", color: "#0070f3" }}>{m.hourlyWage.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ color: "#d90429", borderLeft: "4px solid #d90429", paddingLeft: "10px" }}>주간 통계 (수~화 기준)</h2>
          <div style={{ overflowX: "auto", backgroundColor: "#fff", borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <table style={{ width: "100%", minWidth: "700px", borderCollapse: "collapse", textAlign: "right", fontSize: "14px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa", borderBottom: "2px solid #ddd", textAlign: "center" }}>
                  <th style={{ padding: "12px 10px" }}>주차 (정산일 기준)</th>
                  <th style={{ padding: "12px 10px" }}>수입</th>
                  <th style={{ padding: "12px 10px", color: "#2e7d32" }}>실제 입금액 (입력)</th>
                  <th style={{ padding: "12px 10px" }}>지출</th>
                  <th style={{ padding: "12px 10px", color: "#d32f2f" }}>보험료/세금</th>
                </tr>
              </thead>
              <tbody>
                {statsData.weeklyList.map((w) => (
                  <tr key={w.weekId} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "12px 10px", textAlign: "center", fontWeight: "bold" }}>{w.month}월 {w.weekNum}주차</td>
                    <td style={{ padding: "12px 10px" }}>{w.income.toLocaleString()}원</td>
                    <td style={{ padding: "12px 10px", textAlign: "center" }}>
                      <input type="number" defaultValue={w.actualDeposit || ""} onBlur={(e) => handleDepositChange(w.weekId, e.target.value)} style={{ width: "100px", padding: "6px", borderRadius: "4px", border: "2px solid #4caf50", textAlign: "right", fontWeight: "bold" }} />
                    </td>
                    <td style={{ padding: "12px 10px" }}>{w.expense.toLocaleString()}원</td>
                    <td style={{ padding: "12px 10px", color: "#d32f2f" }}>{w.insuranceTax.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // 메인 화면
        <div>
          <div style={{ backgroundColor: "#f0f7ff", padding: "20px", borderRadius: "10px", marginBottom: "30px" }}>
            {!activeLog ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <h3>새로운 배달 시작</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ flex: "1 1 120px" }}><label style={{ fontSize: "12px", color: "#666" }}>출근 일자</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: "10px", width: "100%" }} /></div>
                  <div style={{ flex: "1 1 120px" }}><label style={{ fontSize: "12px", color: "#666" }}>출근 시간</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ padding: "10px", width: "100%" }} /></div>
                  <div style={{ flex: "1 1 150px" }}><label style={{ fontSize: "12px", color: "#666" }}>주행거리</label><input type="number" value={startMileage} onChange={(e) => setStartMileage(e.target.value)} style={{ padding: "10px", width: "100%" }} /></div>
                </div>
                <button onClick={handleClockIn} style={{ padding: "15px", backgroundColor: "#0070f3", color: "white", borderRadius: "8px", fontWeight: "bold" }}>🚀 출근하기</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <h3 style={{ margin: "0", color: "#d90429" }}>🟢 근무 중 ({activeLog.work_date})</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ flex: "1 1 120px" }}><label style={{ fontSize: "12px", color: "#666" }}>퇴근 일자</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: "10px", width: "100%" }} /></div>
                  <div style={{ flex: "1 1 120px" }}><label style={{ fontSize: "12px", color: "#666" }}>퇴근 시간</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ padding: "10px", width: "100%" }} /></div>
                  <div style={{ flex: "1 1 150px" }}><label style={{ fontSize: "12px", color: "#666" }}>주행거리</label><input type="number" value={endMileage} onChange={(e) => setEndMileage(e.target.value)} style={{ padding: "10px", width: "100%" }} /></div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  <input type="number" placeholder="카카오" value={kakaoPicker} onChange={(e) => setKakaoPicker(e.target.value)} style={{ padding: "10px", flex: 1 }} />
                  <input type="number" placeholder="쿠팡" value={coupangEats} onChange={(e) => setCoupangEats(e.target.value)} style={{ padding: "10px", flex: 1 }} />
                  <input type="number" placeholder="배민" value={baemin} onChange={(e) => setBaemin(e.target.value)} style={{ padding: "10px", flex: 1 }} />
                </div>
                <button onClick={handleClockOut} style={{ padding: "15px", backgroundColor: "#d90429", color: "white", borderRadius: "8px", fontWeight: "bold" }}>🏁 퇴근하고 정산하기</button>
              </div>
            )}
          </div>

          <h3>과거 일지 목록 ({logs.length}일)</h3>
          <div style={{ overflowX: "auto", backgroundColor: "#fff", borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <table style={{ width: "100%", minWidth: "600px", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "12px 10px" }}>날짜</th>
                  <th style={{ padding: "12px 10px" }}>상태/시간</th>
                  <th style={{ padding: "12px 10px" }}>수입 합계</th>
                  <th style={{ padding: "12px 10px" }}>지출</th>
                  <th style={{ padding: "12px 10px", textAlign: "center" }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const totalIncome = (log.coupang_eats || 0) + (log.baemin || 0) + (log.kakao_picker || 0) + (log.etc_income || 0);
                  if (editLogId === log.id) {
                    return (
                      <tr key={log.id} style={{ backgroundColor: "#fffde7", borderBottom: "2px solid #ccc" }}>
                        <td colSpan={5} style={{ padding: "15px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                              <label style={{ flex: "1 1 120px", fontSize: "12px" }}>날짜 <input type="date" name="work_date" value={editForm.work_date} onChange={handleEditChange} style={{ width: "100%", padding: "8px" }} /></label>
                              <label style={{ flex: "1 1 100px", fontSize: "12px" }}>출근 <input type="time" name="start_time" value={editForm.start_time} onChange={handleEditChange} style={{ width: "100%", padding: "8px" }} /></label>
                              <label style={{ flex: "1 1 100px", fontSize: "12px" }}>퇴근 <input type="time" name="end_time" value={editForm.end_time} onChange={handleEditChange} style={{ width: "100%", padding: "8px" }} /></label>
                              <label style={{ flex: "1 1 80px", fontSize: "12px" }}>시간 <input type="number" name="work_hours" value={editForm.work_hours} onChange={handleEditChange} style={{ width: "100%", padding: "8px" }} /></label>
                            </div>
                            <div style={{ display: "flex", gap: "10px" }}>
                              <button onClick={saveEdit} style={{ flex: 1, background: "#f57f17", color: "white", border: "none", padding: "12px", borderRadius: "5px" }}>💾 저장</button>
                              <button onClick={() => setEditLogId(null)} style={{ flex: 1, background: "#9e9e9e", color: "white", border: "none", padding: "12px", borderRadius: "5px" }}>❌ 취소</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "12px 10px" }}>{log.work_date}</td>
                      <td style={{ padding: "12px 10px" }}>{log.status === 'completed' ? `✅ ${log.work_hours}h` : '🏃'}</td>
                      <td style={{ padding: "12px 10px", fontWeight: "bold", color: "#0070f3" }}>{totalIncome.toLocaleString()}원</td>
                      <td style={{ padding: "12px 10px", color: "red" }}>{log.expense > 0 ? `${log.expense.toLocaleString()}원` : '-'}</td>
                      <td style={{ padding: "12px 10px", textAlign: "center" }}>
                        <button onClick={() => startEdit(log)} style={{ marginRight: "8px", padding: "5px 10px", borderRadius: "4px" }}>수정</button>
                        <button onClick={() => handleDelete(log.id)} style={{ padding: "5px 10px", color: "red", borderRadius: "4px" }}>삭제</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}