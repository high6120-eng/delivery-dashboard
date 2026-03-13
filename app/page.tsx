"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import Script from "next/script";

// Supabase 설정 (환경 변수 끝에 !를 붙여 타입 에러 방지)
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
  const [activeLog, setActiveLog] = useState<any>(null);
  const [weeklyDeposits, setWeeklyDeposits] = useState<any>({});
  
  // 텔레그램 사용자 정보 저장용
  const [user, setUser] = useState<any>(null);

  // 텔레그램 SDK 초기화
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      
      // 1. 화면 확장 (기존)
      tg.expand();
      
      // 2. 봇파더처럼 '진짜 전체 화면' 요청 (새로 추가)
      // 이 옵션은 유저가 페이지를 위로 슬라이드했을 때 상단 바를 숨겨줍니다.
      if (tg.requestFullscreen) {
        tg.requestFullscreen();
      }

      // 3. 상단 바 색상을 배경색과 맞추기 (디자인 일관성)
      tg.setHeaderColor('#f9f9f9'); // 배경색과 동일한 값으로 설정
      
      if (tg.initDataUnsafe?.user) {
        setUser(tg.initDataUnsafe.user);
      }
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
  const [editLogId, setEditLogId] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

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

  // 통계 계산 로직
  const statsData = useMemo(() => {
    const wStats: any = {};
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
    
    const mStats: any = {};
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
    <div style={{ padding: "15px", fontFamily: "sans-serif", maxWidth: "1000px", margin: "0 auto", boxSizing: "border-box", backgroundColor: "#f9f9f9", minHeight: "100vh" }}>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      
      {/* 상단 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #eee", paddingBottom: "10px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "20px", margin: 0 }}>🛵 나의 배달 일지</h1>
          {user && <p style={{ fontSize: "12px", color: "#0088cc", margin: "5px 0 0 0" }}>반가워요, {user.first_name}님!</p>}
        </div>
        <button onClick={() => setView(view === 'main' ? 'stats' : 'main')} style={{ background: view === 'main' ? "#4caf50" : "#9e9e9e", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "8px", fontWeight: "bold", fontSize: "14px" }}>
          {view === 'main' ? "📊 통계" : "🏠 홈"}
        </button>
      </div>

      {view === 'stats' ? (
        /* 통계 뷰 */
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <h2 style={{ fontSize: "18px", color: "#0070f3", borderLeft: "4px solid #0070f3", paddingLeft: "10px" }}>월간 요약</h2>
          <div style={{ overflowX: "auto", backgroundColor: "#fff", borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "right" }}>
              <thead style={{ backgroundColor: "#f8f9fa" }}>
                <tr>
                  <th style={{ padding: "10px", textAlign: "center" }}>월</th>
                  <th style={{ padding: "10px" }}>순수익</th>
                  <th style={{ padding: "10px" }}>시급</th>
                </tr>
              </thead>
              <tbody>
                {statsData.monthlyList.map((m: any) => (
                  <tr key={m.monthId} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "10px", textAlign: "center", fontWeight: "bold" }}>{m.month}월</td>
                    <td style={{ padding: "10px", color: "#f57f17", fontWeight: "bold" }}>{m.netProfit.toLocaleString()}원</td>
                    <td style={{ padding: "10px", color: "#0070f3" }}>{m.hourlyWage.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontSize: "18px", color: "#d90429", borderLeft: "4px solid #d90429", paddingLeft: "10px" }}>주간 입금 관리</h2>
          <div style={{ backgroundColor: "#fff", borderRadius: "10px", padding: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            {statsData.weeklyList.map((w: any) => (
              <div key={w.weekId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
                <span style={{ fontSize: "14px" }}>{w.month}월 {w.weekNum}주차</span>
                <input 
                  type="number" 
                  placeholder="실제 입금액"
                  defaultValue={w.actualDeposit || ""} 
                  onBlur={(e) => handleDepositChange(w.weekId, e.target.value)} 
                  style={{ width: "100px", padding: "5px", border: "1px solid #4caf50", borderRadius: "5px", textAlign: "right" }} 
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* 메인 뷰 */
        <div>
          {/* 출퇴근 카드 */}
          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "15px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", marginBottom: "25px" }}>
            {!activeLog ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ margin: "0 0 5px 0", fontSize: "16px" }}>새로운 배달 시작</h3>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
                </div>
                <input type="number" placeholder="현재 주행거리(km)" value={startMileage} onChange={(e) => setStartMileage(e.target.value)} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
                <button onClick={handleClockIn} style={{ padding: "14px", backgroundColor: "#0070f3", color: "white", borderRadius: "10px", fontWeight: "bold", border: "none", fontSize: "16px" }}>🚀 출근하기</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <h3 style={{ margin: "0 0 5px 0", fontSize: "16px", color: "#d90429" }}>🟢 근무 중 ({activeLog.start_time})</h3>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
                  <input type="number" placeholder="종료 주행거리" value={endMileage} onChange={(e) => setEndMileage(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input type="number" placeholder="쿠팡" value={coupangEats} onChange={(e) => setCoupangEats(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
                  <input type="number" placeholder="배민" value={baemin} onChange={(e) => setBaemin(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
                  <input type="number" placeholder="카카오" value={kakaoPicker} onChange={(e) => setKakaoPicker(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }} />
                </div>
                <button onClick={handleClockOut} style={{ padding: "14px", backgroundColor: "#d90429", color: "white", borderRadius: "10px", fontWeight: "bold", border: "none", fontSize: "16px" }}>🏁 퇴근하고 정산하기</button>
              </div>
            )}
          </div>

          {/* 목록 리스트 */}
          <h3 style={{ fontSize: "16px", marginBottom: "10px" }}>최근 일지 ({logs.length}일)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {logs.map((log: any) => {
              const totalIncome = (log.coupang_eats || 0) + (log.baemin || 0) + (log.kakao_picker || 0) + (log.etc_income || 0);
              return (
                <div key={log.id} style={{ backgroundColor: "#fff", padding: "15px", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>{log.work_date}</div>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      {log.status === 'completed' ? `✅ ${totalIncome.toLocaleString()}원 (${log.work_hours}h)` : '🏃 근무 중...'}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <button onClick={() => startEdit(log)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #ddd", fontSize: "12px", backgroundColor: "#fff" }}>수정</button>
                    <button onClick={() => handleDelete(log.id)} style={{ padding: "6px 10px", borderRadius: "6px", border: "none", fontSize: "12px", backgroundColor: "#fff0f0", color: "#ff4d4f" }}>삭제</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* 하단 여백 (모바일 하단 바 대비) */}
      <div style={{ height: "50px" }}></div>
    </div>
  );
}