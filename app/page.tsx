"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import Script from "next/script";

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 모바일 겹침 방지 완벽 스타일
const inputStyle: any = { 
  width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: "10px", 
  border: "1px solid #ddd", fontSize: "15px", WebkitAppearance: "none", margin: 0, backgroundColor: "#fff" 
};
const editInputStyle: any = { 
  width: "100%", boxSizing: "border-box", padding: "8px", borderRadius: "6px", 
  border: "1px solid #ddd", fontSize: "13px", WebkitAppearance: "none", margin: 0, backgroundColor: "#fff" 
};
const labelStyle: any = { fontSize: "12px", color: "#666", fontWeight: "600", display: "block", marginBottom: "4px" };
const gridItemStyle: any = { minWidth: 0 }; 

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
  return { weekId: `${year}-${String(month).padStart(2, '0')}-W${weekNum}`, monthId: `${year}-${String(month).padStart(2, '0')}`, year, month, weekNum };
};

export default function Home() {
  const [view, setView] = useState("main"); 
  const [logs, setLogs] = useState<any[]>([]);
  const [activeLog, setActiveLog] = useState<any>(null);
  const [weeklyDeposits, setWeeklyDeposits] = useState<any>({});
  
  const [user, setUser] = useState<any>(null);
  const [allowedUsers, setAllowedUsers] = useState<any[]>([]);
  const MASTER_ID = "1062746453"; // 👑 마스터 텔레그램 ID

  const [newViewerId, setNewViewerId] = useState("");
  const [newViewerMemo, setNewViewerMemo] = useState("");

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.requestFullscreen) tg.requestFullscreen();
      tg.setHeaderColor('#f4f5f7'); 
      if (tg.initDataUnsafe?.user) setUser(tg.initDataUnsafe.user);
    }
  }, []);

  const isMaster = user?.id?.toString() === MASTER_ID;
  const isViewer = allowedUsers.some(u => u.telegram_id === user?.id?.toString());

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
  const [etcIncome, setEtcIncome] = useState("");
  const [etcIncomeMemo, setEtcIncomeMemo] = useState(""); 
  const [expense, setExpense] = useState("");
  const [expenseMemo, setExpenseMemo] = useState("");
  
  // ✨ 근무 시간, 주행 거리 수동 입력 확인용 상태
  const [inputWorkHours, setInputWorkHours] = useState("");
  const [inputDistance, setInputDistance] = useState("");

  const [editLogId, setEditLogId] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  const fetchData = async () => {
    const { data: workingData } = await supabase.from("delivery_logs").select("*").eq("status", "working").maybeSingle(); 
    setActiveLog(workingData);
    if (workingData) setEndDate(workingData.end_date || getTodayDate());

    const { data: historyData } = await supabase.from("delivery_logs").select("*").order("work_date", { ascending: false });
    if (historyData) setLogs(historyData);

    const { data: depositData } = await supabase.from("weekly_deposits").select("*");
    if (depositData) {
      const depObj: any = {};
      depositData.forEach((d: any) => depObj[d.week_id] = d.actual_deposit);
      setWeeklyDeposits(depObj);
    }

    const { data: authUsers } = await supabase.from("allowed_users").select("*");
    if (authUsers) setAllowedUsers(authUsers);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddViewer = async () => {
    if (!newViewerId) return alert("텔레그램 ID를 입력해주세요.");
    await supabase.from("allowed_users").insert([{ telegram_id: newViewerId, memo: newViewerMemo }]);
    setNewViewerId(""); setNewViewerMemo(""); fetchData(); alert("열람자가 추가되었습니다.");
  };

  const handleDeleteViewer = async (id: any) => {
    if (confirm("이 사용자의 열람 권한을 삭제하시겠습니까?")) {
      await supabase.from("allowed_users").delete().eq("id", id); fetchData();
    }
  };

  const handleDepositChange = async (weekId: any, value: any) => {
    if (!isMaster) return;
    const numVal = Number(value) || 0;
    setWeeklyDeposits((prev: any) => ({ ...prev, [weekId]: numVal }));
    await supabase.from("weekly_deposits").upsert({ week_id: weekId, actual_deposit: numVal });
  };

  const handleClockIn = async () => {
    const finalStartTime = startTime || getCurrentTime();
    const { error } = await supabase.from("delivery_logs").insert([{ 
      work_date: startDate, start_time: finalStartTime, start_mileage: startMileage ? Number(startMileage) : null, status: "working" 
    }]);
    if (!error) { alert(`🚀 출근 완료! 안전운전하세요.`); fetchData(); }
  };

  const handleClockOut = async () => {
    if (!activeLog) return;
    const finalEndTime = endTime || getCurrentTime();
    
    // ✨ 근무시간 자동 계산 (빈값이면 null)
    let calcHours = null;
    if (activeLog.start_time && finalEndTime) {
      const sDate = new Date(`${activeLog.work_date}T${activeLog.start_time}:00`);
      const eDate = new Date(`${endDate}T${finalEndTime}:00`);
      let diffMins = (eDate.getTime() - sDate.getTime()) / (1000 * 60);
      if (diffMins < 0) diffMins += 24 * 60;
      calcHours = Number((diffMins / 60).toFixed(2));
    }

    // ✨ 주행거리 자동 계산 (빈값이면 null)
    let calcDist = null;
    if (activeLog.start_mileage !== null && activeLog.start_mileage !== "" && endMileage !== "") {
      calcDist = Number(endMileage) - Number(activeLog.start_mileage);
    }

    // 🚨 수동 입력 값 검증
    if (inputWorkHours !== "" && calcHours !== null && Number(inputWorkHours) !== calcHours) {
      return alert(`⚠️ 업무 시간 오류: 수동 입력 시간(${inputWorkHours}h)과 실제 계산된 시간(${calcHours}h)이 다릅니다.`);
    }
    if (inputDistance !== "" && calcDist !== null && Number(inputDistance) !== calcDist) {
      return alert(`⚠️ 주행 거리 오류: 수동 입력 거리(${inputDistance}km)와 실제 계산된 거리(${calcDist}km)가 다릅니다.`);
    }

    const finalWorkHours = inputWorkHours !== "" ? Number(inputWorkHours) : (calcHours || 0);
    const finalDistance = inputDistance !== "" ? Number(inputDistance) : (calcDist || 0);

    await supabase.from("delivery_logs").update({
      end_date: endDate, end_time: finalEndTime, end_mileage: endMileage ? Number(endMileage) : null, 
      work_hours: finalWorkHours, distance: finalDistance,
      kakao_picker: Number(kakaoPicker) || 0, coupang_eats: Number(coupangEats) || 0, baemin: Number(baemin) || 0,
      etc_income: Number(etcIncome) || 0, etc_income_memo: etcIncomeMemo || null, 
      expense: Number(expense) || 0, expense_memo: expenseMemo || null,
      status: "completed"
    }).eq("id", activeLog.id);
    
    alert(`🏁 정산 완료! 고생하셨습니다.`); 
    setCoupangEats(""); setBaemin(""); setKakaoPicker(""); setEtcIncome(""); setEtcIncomeMemo(""); 
    setExpense(""); setExpenseMemo(""); setEndTime(""); setEndMileage(""); 
    setInputWorkHours(""); setInputDistance("");
    fetchData();
  };

  const handleDelete = async (id: any) => {
    if (confirm("⚠️ 정말 이 일지를 삭제하시겠습니까? 복구할 수 없습니다.")) { 
      await supabase.from("delivery_logs").delete().eq("id", id); fetchData(); 
    }
  };

  const startEdit = (log: any) => { 
    setEditLogId(log.id); 
    setEditForm({ ...log, end_date: log.end_date || log.work_date }); 
  };
  
  const handleEditChange = (e: any) => { setEditForm({ ...editForm, [e.target.name]: e.target.value }); };

  const saveEdit = async () => {
    // ✨ 수정 시 근무시간 자동 계산
    let calcHours = null;
    if (editForm.start_time && editForm.end_time) {
      const sDate = new Date(`${editForm.work_date}T${editForm.start_time}:00`);
      const eDate = new Date(`${editForm.end_date || editForm.work_date}T${editForm.end_time}:00`);
      let diffMins = (eDate.getTime() - sDate.getTime()) / (1000 * 60);
      if (diffMins < 0) diffMins += 24 * 60;
      calcHours = Number((diffMins / 60).toFixed(2));
    }

    // ✨ 수정 시 주행거리 자동 계산
    let calcDist = null;
    if (editForm.start_mileage !== null && editForm.start_mileage !== "" && editForm.end_mileage !== null && editForm.end_mileage !== "") {
      calcDist = Number(editForm.end_mileage) - Number(editForm.start_mileage);
    }

    // 🚨 수정 시 수동 입력 값 검증
    if (editForm.work_hours !== "" && editForm.work_hours != null && calcHours !== null && Number(editForm.work_hours) !== calcHours) {
      return alert(`⚠️ 업무 시간 오류: 수동 입력 시간(${editForm.work_hours}h)과 실제 계산된 시간(${calcHours}h)이 다릅니다.`);
    }
    if (editForm.distance !== "" && editForm.distance != null && calcDist !== null && Number(editForm.distance) !== calcDist) {
      return alert(`⚠️ 주행 거리 오류: 수동 입력 거리(${editForm.distance}km)와 실제 계산된 거리(${calcDist}km)가 다릅니다.`);
    }

    const finalWorkHours = (editForm.work_hours !== "" && editForm.work_hours != null) ? Number(editForm.work_hours) : (calcHours || 0);
    const finalDistance = (editForm.distance !== "" && editForm.distance != null) ? Number(editForm.distance) : (calcDist || 0);

    await supabase.from("delivery_logs").update({
      work_date: editForm.work_date, start_time: editForm.start_time, 
      end_date: editForm.end_date, end_time: editForm.end_time,
      start_mileage: editForm.start_mileage ? Number(editForm.start_mileage) : null, 
      end_mileage: editForm.end_mileage ? Number(editForm.end_mileage) : null,
      kakao_picker: Number(editForm.kakao_picker), coupang_eats: Number(editForm.coupang_eats), baemin: Number(editForm.baemin),
      etc_income: Number(editForm.etc_income), etc_income_memo: editForm.etc_income_memo, 
      expense: Number(editForm.expense), expense_memo: editForm.expense_memo, 
      work_hours: finalWorkHours, distance: finalDistance
    }).eq("id", editLogId);
    
    setEditLogId(null); fetchData(); alert("✅ 일지가 성공적으로 수정 및 계산되었습니다.");
  };

  const statsData = useMemo(() => {
    const wStats: any = {};
    logs.forEach((log: any) => {
      if (log.status !== 'completed') return;
      const info = getWeekInfo(log.work_date);
      if (!info) return;
      if (!wStats[info.weekId]) wStats[info.weekId] = { weekId: info.weekId, monthId: info.monthId, month: info.month, weekNum: info.weekNum, income: 0, expense: 0, workHours: 0 };
      wStats[info.weekId].income += (log.coupang_eats||0) + (log.baemin||0) + (log.kakao_picker||0) + (log.etc_income||0);
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
      if (!mStats[w.monthId]) mStats[w.monthId] = { monthId: w.monthId, month: w.month, income: 0, actualDeposit: 0, expense: 0, insuranceTax: 0, netProfit: 0, workHours: 0 };
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

  if (user && !isMaster && !isViewer) {
    return (
      <div style={{ padding: "100px 20px", textAlign: "center", fontFamily: "sans-serif" }}>
        <h2>🚫 접근 권한이 없습니다</h2>
        <p>마스터 계정에 등록된 사용자만 열람 가능합니다.</p>
        <p style={{ color: "#999", fontSize: "12px", marginTop: "10px" }}>내 ID: {user.id}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "110px 16px 40px 16px", boxSizing: "border-box", width: "100%", overflowX: "hidden", fontFamily: "-apple-system, sans-serif", backgroundColor: "#f4f5f7", minHeight: "100vh" }}>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      
      {/* 🚀 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "800", margin: 0 }}>🛵 배달 일지</h1>
          {user && <p style={{ fontSize: "13px", color: isMaster ? "#d90429" : "#0070f3", margin: "4px 0 0 0", fontWeight: "600" }}>
            {isMaster ? "👑 마스터 계정" : `👀 반가워요, ${user.first_name}님!`}
          </p>}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {isMaster && (
            <button onClick={() => setView(view === 'admin' ? 'main' : 'admin')} style={{ background: view === 'admin' ? "#333" : "#fff", color: view === 'admin' ? "#fff" : "#333", border: "1px solid #ddd", padding: "10px", borderRadius: "20px", fontWeight: "bold", fontSize: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              ⚙️
            </button>
          )}
          <button onClick={() => setView(view === 'main' ? 'stats' : 'main')} style={{ background: view === 'main' ? "#333" : "#0070f3", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "20px", fontWeight: "bold", fontSize: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
            {view === 'main' ? "📊 통계" : "🏠 홈"}
          </button>
        </div>
      </div>

      {view === 'admin' && isMaster ? (
        /* 👥 열람자 관리 화면 */
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "17px", fontWeight: "700" }}>새 열람자 등록</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input type="text" placeholder="텔레그램 ID 숫자 (예: 123456789)" value={newViewerId} onChange={(e)=>setNewViewerId(e.target.value)} style={inputStyle} />
              <input type="text" placeholder="메모 (이름 등)" value={newViewerMemo} onChange={(e)=>setNewViewerMemo(e.target.value)} style={inputStyle} />
              <button onClick={handleAddViewer} style={{ width: "100%", padding: "14px", backgroundColor: "#333", color: "white", borderRadius: "10px", fontWeight: "bold", border: "none" }}>➕ 권한 부여</button>
            </div>
          </div>
          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "17px", fontWeight: "700" }}>등록된 열람자 목록</h3>
            {allowedUsers.length === 0 ? <p style={{fontSize:"13px", color:"#999"}}>등록된 사용자가 없습니다.</p> : null}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {allowedUsers.map(u => (
                <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid #eee", borderRadius: "8px" }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>ID: {u.telegram_id}</div>
                    <div style={{ fontSize: "12px", color: "#666" }}>{u.memo || "메모 없음"}</div>
                  </div>
                  <button onClick={() => handleDeleteViewer(u.id)} style={{ padding: "8px 12px", backgroundColor: "#ffeeee", color: "#d90429", border: "none", borderRadius: "6px", fontWeight: "bold", fontSize: "12px" }}>삭제</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : view === 'stats' ? (
        /* 📊 통계 화면 */
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <h2 style={{ fontSize: "18px", color: "#0070f3", marginBottom: "12px", paddingLeft: "8px", borderLeft: "4px solid #0070f3" }}>월간 마감 통계</h2>
            <div style={{ overflowX: "auto", width: "100%", backgroundColor: "#fff", borderRadius: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <table style={{ width: "100%", minWidth: "800px", borderCollapse: "collapse", textAlign: "right", fontSize: "14px" }}>
                <thead><tr style={{ backgroundColor: "#fafafa", borderBottom: "2px solid #eee", textAlign: "center" }}><th style={{ padding: "12px" }}>월</th><th style={{ padding: "12px" }}>총 수입</th><th style={{ padding: "12px", color:"#2e7d32" }}>실제 입금</th><th style={{ padding: "12px" }}>지출</th><th style={{ padding: "12px", color:"#f57f17" }}>순수익</th><th style={{ padding: "12px" }}>마진율</th><th style={{ padding: "12px", color:"#d32f2f" }}>세금/보험</th><th style={{ padding: "12px" }}>시급</th></tr></thead>
                <tbody>
                  {statsData.monthlyList.map((m: any) => (
                    <tr key={m.monthId} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "12px", textAlign: "center", fontWeight: "bold" }}>{m.month}월</td><td style={{ padding: "12px" }}>{m.income.toLocaleString()}원</td><td style={{ padding: "12px", color: "#2e7d32", fontWeight: "bold" }}>{m.actualDeposit.toLocaleString()}원</td><td style={{ padding: "12px" }}>{m.expense.toLocaleString()}원</td><td style={{ padding: "12px", color: "#f57f17", fontWeight: "bold" }}>{m.netProfit.toLocaleString()}원</td><td style={{ padding: "12px" }}>{m.margin}%</td><td style={{ padding: "12px", color: "#d32f2f" }}>{m.insuranceTax.toLocaleString()}원</td><td style={{ padding: "12px", fontWeight: "bold", color: "#0070f3" }}>{m.hourlyWage.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: "18px", color: "#d90429", marginBottom: "12px", paddingLeft: "8px", borderLeft: "4px solid #d90429" }}>주간 입금 관리</h2>
            <div style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              {statsData.weeklyList.map((w: any) => (
                <div key={w.weekId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 10px", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: "bold", fontSize: "15px" }}>{w.month}월 {w.weekNum}주차</span>
                    <span style={{ fontSize: "12px", color: "#666" }}>예상: {w.income.toLocaleString()}원</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ fontSize: "12px", color: "#999" }}>실입금</span>
                    <input type="number" placeholder="입력" defaultValue={w.actualDeposit || ""} onBlur={(e) => handleDepositChange(w.weekId, e.target.value)} disabled={!isMaster} style={{ width: "90px", padding: "8px", border: "1px solid #ccc", borderRadius: "8px", textAlign: "right", fontWeight: "bold", backgroundColor: isMaster ? "#fff" : "#f5f5f5" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* 🏠 메인 화면 */
        <div>
          {isMaster && (
            <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", marginBottom: "24px" }}>
              {!activeLog ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700" }}>새로운 배달 시작</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                     <div style={gridItemStyle}><label style={labelStyle}>출근 날짜</label><input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} style={inputStyle}/></div>
                     <div style={gridItemStyle}><label style={labelStyle}>출근 시간</label><input type="time" value={startTime} onChange={(e)=>setStartTime(e.target.value)} style={inputStyle}/></div>
                  </div>
                  <div style={gridItemStyle}>
                    <label style={labelStyle}>현재 주행거리(km)</label>
                    <input type="number" placeholder="예: 15400" value={startMileage} onChange={(e)=>setStartMileage(e.target.value)} style={inputStyle}/>
                  </div>
                  <button onClick={handleClockIn} style={{ width: "100%", padding: "16px", backgroundColor: "#0070f3", color: "white", borderRadius: "12px", fontWeight: "800", fontSize:"16px", border: "none", marginTop:"8px", boxShadow: "0 4px 12px rgba(0, 112, 243, 0.3)" }}>🚀 출근하기</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#d90429" }}>🟢 근무 중 ({activeLog.start_time} ~ )</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                     <div style={gridItemStyle}><label style={labelStyle}>퇴근 날짜</label><input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} style={inputStyle}/></div>
                     <div style={gridItemStyle}><label style={labelStyle}>퇴근 시간</label><input type="time" value={endTime} onChange={(e)=>setEndTime(e.target.value)} style={inputStyle}/></div>
                  </div>
                  <div style={gridItemStyle}>
                     <label style={labelStyle}>종료 주행거리(km)</label>
                     <input type="number" placeholder="예: 15500" value={endMileage} onChange={(e)=>setEndMileage(e.target.value)} style={inputStyle}/>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "4px", padding: "10px", backgroundColor: "#f9f9f9", borderRadius: "10px", border: "1px dashed #ccc" }}>
                    <div style={gridItemStyle}><label style={labelStyle}>근무 시간(h) <span style={{color:"#999",fontWeight:"normal"}}>(비워두면 자동)</span></label><input type="number" placeholder="자동 계산" value={inputWorkHours} onChange={(e)=>setInputWorkHours(e.target.value)} style={inputStyle}/></div>
                    <div style={gridItemStyle}><label style={labelStyle}>주행 거리(km) <span style={{color:"#999",fontWeight:"normal"}}>(비워두면 자동)</span></label><input type="number" placeholder="자동 계산" value={inputDistance} onChange={(e)=>setInputDistance(e.target.value)} style={inputStyle}/></div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "4px" }}>
                    <div style={gridItemStyle}><label style={labelStyle}>쿠팡 수입 (원)</label><input type="number" placeholder="입력" value={coupangEats} onChange={(e)=>setCoupangEats(e.target.value)} style={inputStyle}/></div>
                    <div style={gridItemStyle}><label style={labelStyle}>배민 수입 (원)</label><input type="number" placeholder="입력" value={baemin} onChange={(e)=>setBaemin(e.target.value)} style={inputStyle}/></div>
                    <div style={gridItemStyle}><label style={labelStyle}>카카오 수입 (원)</label><input type="number" placeholder="입력" value={kakaoPicker} onChange={(e)=>setKakaoPicker(e.target.value)} style={inputStyle}/></div>
                    <div style={gridItemStyle}></div> 
                    
                    <div style={gridItemStyle}><label style={labelStyle}>기타 수입 (원)</label><input type="number" placeholder="금액" value={etcIncome} onChange={(e)=>setEtcIncome(e.target.value)} style={inputStyle}/></div>
                    <div style={gridItemStyle}><label style={labelStyle}>기타 수입 내역</label><input type="text" placeholder="예: 프로모션" value={etcIncomeMemo} onChange={(e)=>setEtcIncomeMemo(e.target.value)} style={inputStyle}/></div>
                    
                    <div style={gridItemStyle}><label style={labelStyle}>지출 (원)</label><input type="number" placeholder="금액" value={expense} onChange={(e)=>setExpense(e.target.value)} style={inputStyle}/></div>
                    <div style={gridItemStyle}><label style={labelStyle}>지출 내역</label><input type="text" placeholder="예: 주유, 식사" value={expenseMemo} onChange={(e)=>setExpenseMemo(e.target.value)} style={inputStyle}/></div>
                  </div>

                  <button onClick={handleClockOut} style={{ width: "100%", padding: "16px", backgroundColor: "#d90429", color: "white", borderRadius: "12px", fontWeight: "800", fontSize:"16px", border: "none", marginTop:"8px", boxShadow: "0 4px 12px rgba(217, 4, 41, 0.3)" }}>🏁 퇴근하고 정산하기</button>
                </div>
              )}
            </div>
          )}

          {!isMaster && <div style={{ padding: "10px", marginBottom: "15px", backgroundColor: "#e3f2fd", color: "#0070f3", borderRadius: "10px", textAlign: "center", fontSize: "14px", fontWeight: "bold" }}>👀 열람 전용 모드로 접속 중입니다.</div>}

          <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "12px", paddingLeft: "4px" }}>최근 일지 목록</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {logs.map((log: any) => {
              const isEditing = editLogId === log.id;
              const total = (log.coupang_eats||0) + (log.baemin||0) + (log.kakao_picker||0) + (log.etc_income||0);
              
              return (
                <div key={log.id} style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: isEditing ? "2px solid #0070f3" : "none" }}>
                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{fontWeight:"bold", borderBottom:"1px solid #eee", paddingBottom:"8px", marginBottom:"4px"}}>✏️ 전체 항목 수정</div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>출근 날짜</span><input type="date" name="work_date" value={editForm.work_date || ""} onChange={handleEditChange} style={editInputStyle}/></div>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>출근 시간</span><input type="time" name="start_time" value={editForm.start_time || ""} onChange={handleEditChange} style={editInputStyle}/></div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>퇴근 날짜</span><input type="date" name="end_date" value={editForm.end_date || ""} onChange={handleEditChange} style={editInputStyle}/></div>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>퇴근 시간</span><input type="time" name="end_time" value={editForm.end_time || ""} onChange={handleEditChange} style={editInputStyle}/></div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>시작 주행(km)</span><input type="number" name="start_mileage" value={editForm.start_mileage || ""} onChange={handleEditChange} style={editInputStyle}/></div>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>종료 주행(km)</span><input type="number" name="end_mileage" value={editForm.end_mileage || ""} onChange={handleEditChange} style={editInputStyle}/></div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", padding: "8px", backgroundColor: "#f9f9f9", borderRadius: "8px", border: "1px dashed #ccc" }}>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>근무 시간(h) <span style={{fontSize:"10px"}}>(자동 계산)</span></span><input type="number" name="work_hours" value={editForm.work_hours || ""} onChange={handleEditChange} placeholder="자동" style={editInputStyle}/></div>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>주행 거리(km) <span style={{fontSize:"10px"}}>(자동 계산)</span></span><input type="number" name="distance" value={editForm.distance || ""} onChange={handleEditChange} placeholder="자동" style={editInputStyle}/></div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>쿠팡</span><input type="number" name="coupang_eats" value={editForm.coupang_eats || ""} onChange={handleEditChange} style={editInputStyle}/></div>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>배민</span><input type="number" name="baemin" value={editForm.baemin || ""} onChange={handleEditChange} style={editInputStyle}/></div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>카카오</span><input type="number" name="kakao_picker" value={editForm.kakao_picker || ""} onChange={handleEditChange} style={editInputStyle}/></div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>기타 수입 (원)</span><input type="number" name="etc_income" value={editForm.etc_income || ""} onChange={handleEditChange} style={editInputStyle}/></div>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>기타 내역</span><input type="text" name="etc_income_memo" value={editForm.etc_income_memo || ""} onChange={handleEditChange} style={editInputStyle}/></div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>지출 (원)</span><input type="number" name="expense" value={editForm.expense || ""} onChange={handleEditChange} style={editInputStyle}/></div>
                        <div style={gridItemStyle}><span style={{fontSize:"11px", color:"#999"}}>지출 내역</span><input type="text" name="expense_memo" value={editForm.expense_memo || ""} onChange={handleEditChange} style={editInputStyle}/></div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <button onClick={saveEdit} style={{ flex: 1, padding: "12px", background: "#0070f3", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "bold" }}>💾 전체 저장</button>
                        <button onClick={() => setEditLogId(null)} style={{ flex: 1, padding: "12px", background: "#f0f0f0", color:"#333", border:"none", borderRadius: "10px", fontWeight:"bold" }}>❌ 취소</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "15px", color:"#222" }}>
                          {log.work_date} <span style={{fontSize:"12px", color:"#888", fontWeight:"normal", marginLeft:"4px"}}>{log.start_time} ~ {log.end_time}</span>
                        </div>
                        <div style={{ fontSize: "13px", color: "#555", marginTop: "6px" }}>
                          {log.status === 'completed' ? (
                             <span>✅ <b style={{color:"#0070f3"}}>{total.toLocaleString()}</b>원 <span style={{color:"#999"}}>({log.work_hours}h {log.distance ? `/ ${log.distance}km` : ""})</span></span>
                          ) : '🏃 근무 중...'}
                        </div>
                        {log.expense > 0 && <div style={{ fontSize: "11px", color: "#d90429", marginTop:"4px" }}>지출: {log.expense.toLocaleString()}원 {log.expense_memo ? `(${log.expense_memo})` : ''}</div>}
                        {log.etc_income > 0 && <div style={{ fontSize: "11px", color: "#0070f3", marginTop:"2px" }}>기타수입: {log.etc_income.toLocaleString()}원 {log.etc_income_memo ? `(${log.etc_income_memo})` : ''}</div>}
                      </div>
                      {isMaster && (
                        <div style={{ display: "flex", gap: "6px", flexDirection:"column" }}>
                          <button onClick={() => startEdit(log)} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "12px", fontWeight:"bold", backgroundColor: "#fff", color:"#333" }}>수정</button>
                          <button onClick={() => handleDelete(log.id)} style={{ padding: "8px 14px", borderRadius: "8px", border: "none", fontSize: "12px", fontWeight:"bold", backgroundColor: "#ffeeee", color: "#d90429" }}>삭제</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}