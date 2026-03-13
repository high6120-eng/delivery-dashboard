"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import Script from "next/script";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const getWeekInfo = (dateStr: any) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const day = d.getDay(); 
  const daysUntilTue = (2 - day + 7) % 7;
  const endTue = new Date(d);
  endTue.setDate(d.getDate() + daysUntilTue);
  const year = endTue.getFullYear();
  const month = endTue.getMonth() + 1;
  const weekNum = Math.floor((endTue.getDate() - 1) / 7) + 1;
  return { weekId: `${year}-${String(month).padStart(2, '0')}-W${weekNum}`, monthId: `${year}-${String(month).padStart(2, '0')}`, month, weekNum };
};

export default function Home() {
  const [view, setView] = useState("main"); 
  const [logs, setLogs] = useState<any[]>([]);
  const [activeLog, setActiveLog] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [editLogId, setEditLogId] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.requestFullscreen) tg.requestFullscreen();
      tg.setHeaderColor('#f9f9f9');
      if (tg.initDataUnsafe?.user) setUser(tg.initDataUnsafe.user);
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

  const fetchData = async () => {
    const { data: workingData } = await supabase.from("delivery_logs").select("*").eq("status", "working").maybeSingle(); 
    setActiveLog(workingData);
    const { data: historyData } = await supabase.from("delivery_logs").select("*").order("work_date", { ascending: false });
    if (historyData) setLogs(historyData);
  };

  useEffect(() => { fetchData(); }, []);

  const handleClockIn = async () => {
    const finalStartTime = startTime || getCurrentTime();
    const { error } = await supabase.from("delivery_logs").insert([{ 
      work_date: startDate, start_time: finalStartTime, start_mileage: startMileage ? Number(startMileage) : null, status: "working" 
    }]);
    if (!error) { alert(`🚀 출근 완료!`); fetchData(); }
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
      status: "completed"
    }).eq("id", activeLog.id);
    alert(`🏁 정산 완료!`); fetchData();
  };

  const startEdit = (log: any) => {
    setEditLogId(log.id);
    setEditForm({ ...log });
  };

  const handleEditChange = (e: any) => {
    const { name, value } = e.target;
    setEditForm({ ...editForm, [name]: value });
  };

  const saveEdit = async () => {
    // 수정 시에도 근무 시간 자동 재계산
    let updatedWorkHours = editForm.work_hours;
    if (editForm.start_time && editForm.end_time) {
      const s = editForm.start_time.split(':').map(Number);
      const e = editForm.end_time.split(':').map(Number);
      let diff = (e[0] * 60 + e[1]) - (s[0] * 60 + s[1]);
      if (diff < 0) diff += 24 * 60;
      updatedWorkHours = Number((diff / 60).toFixed(2));
    }

    await supabase.from("delivery_logs").update({
      work_date: editForm.work_date,
      start_time: editForm.start_time,
      end_time: editForm.end_time,
      start_mileage: Number(editForm.start_mileage),
      end_mileage: Number(editForm.end_mileage),
      kakao_picker: Number(editForm.kakao_picker),
      coupang_eats: Number(editForm.coupang_eats),
      baemin: Number(editForm.baemin),
      work_hours: updatedWorkHours
    }).eq("id", editLogId);
    setEditLogId(null); fetchData(); alert("✅ 모든 항목이 수정되었습니다.");
  };

  const statsData = useMemo(() => {
    const wStats: any = {};
    logs.forEach((log: any) => {
      if (log.status !== 'completed') return;
      const info = getWeekInfo(log.work_date);
      if (!info) return;
      if (!wStats[info.weekId]) wStats[info.weekId] = { ...info, income: 0 };
      wStats[info.weekId].income += (log.coupang_eats||0) + (log.baemin||0) + (log.kakao_picker||0);
    });
    return Object.values(wStats).sort((a: any, b: any) => b.weekId.localeCompare(a.weekId));
  }, [logs]);

  return (
    <div style={{ padding: "60px 16px 40px 16px", fontFamily: "-apple-system, sans-serif", backgroundColor: "#f9f9f9", minHeight: "100vh" }}>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "800", margin: 0 }}>🛵 배달 일지</h1>
          {user && <p style={{ fontSize: "12px", color: "#0088cc", margin: "4px 0 0 0" }}>반가워요, {user.first_name}님!</p>}
        </div>
        <button onClick={() => setView(view === 'main' ? 'stats' : 'main')} style={{ background: "#4caf50", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "20px", fontWeight: "bold", fontSize: "13px" }}>
          {view === 'main' ? "📊 통계" : "🏠 홈"}
        </button>
      </div>

      {view === 'stats' ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {statsData.map((w: any) => (
            <div key={w.weekId} style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "12px", display: "flex", justifyContent: "space-between", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <span>{w.month}월 {w.weekNum}주차</span>
              <span style={{ fontWeight: "bold", color: "#0070f3" }}>{w.income.toLocaleString()}원</span>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {/* 입력 카드 */}
          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", marginBottom: "24px" }}>
            {!activeLog ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <h3 style={{ margin: 0, fontSize: "16px" }}>새로운 배달 시작</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                   <div><label style={{fontSize: "11px", color: "#999"}}>출근 날짜</label><input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} style={{width:"100%", padding:"10px", borderRadius:"8px", border:"1px solid #eee"}}/></div>
                   <div><label style={{fontSize: "11px", color: "#999"}}>출근 시간</label><input type="time" value={startTime} onChange={(e)=>setStartTime(e.target.value)} style={{width:"100%", padding:"10px", borderRadius:"8px", border:"1px solid #eee"}}/></div>
                </div>
                <input type="number" placeholder="현재 주행거리(km) 입력" value={startMileage} onChange={(e)=>setStartMileage(e.target.value)} style={{padding:"12px", borderRadius:"8px", border:"1px solid #eee"}}/>
                <button onClick={handleClockIn} style={{ padding: "14px", backgroundColor: "#0070f3", color: "white", borderRadius: "10px", fontWeight: "bold", border: "none" }}>🚀 출근하기</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#d90429" }}>🟢 근무 중 ({activeLog.start_time}~)</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                   <div><label style={{fontSize: "11px", color: "#999"}}>퇴근 시간</label><input type="time" value={endTime} onChange={(e)=>setEndTime(e.target.value)} style={{width:"100%", padding:"10px", borderRadius:"8px", border:"1px solid #eee"}}/></div>
                   <div><label style={{fontSize: "11px", color: "#999"}}>퇴근 주행거리</label><input type="number" value={endMileage} onChange={(e)=>setEndMileage(e.target.value)} style={{width:"100%", padding:"10px", borderRadius:"8px", border:"1px solid #eee"}}/></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  <input type="number" placeholder="쿠팡" value={coupangEats} onChange={(e)=>setCoupangEats(e.target.value)} style={{padding:"10px", borderRadius:"8px", border:"1px solid #eee", textAlign:"center"}}/>
                  <input type="number" placeholder="배민" value={baemin} onChange={(e)=>setBaemin(e.target.value)} style={{padding:"10px", borderRadius:"8px", border:"1px solid #eee", textAlign:"center"}}/>
                  <input type="number" placeholder="카카오" value={kakaoPicker} onChange={(e)=>setKakaoPicker(e.target.value)} style={{padding:"10px", borderRadius:"8px", border:"1px solid #eee", textAlign:"center"}}/>
                </div>
                <button onClick={handleClockOut} style={{ padding: "14px", backgroundColor: "#d90429", color: "white", borderRadius: "10px", fontWeight: "bold", border: "none" }}>🏁 퇴근하고 정산하기</button>
              </div>
            )}
          </div>

          <h3 style={{ fontSize: "15px", marginBottom: "12px" }}>최근 일지 목록</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {logs.map((log: any) => {
              const isEditing = editLogId === log.id;
              const total = (log.coupang_eats||0) + (log.baemin||0) + (log.kakao_picker||0);
              return (
                <div key={log.id} style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <label style={{fontSize:"11px"}}>날짜/시간 수정</label>
                      <div style={{display:"flex", gap:"5px"}}>
                        <input type="date" name="work_date" value={editForm.work_date} onChange={handleEditChange} style={{flex:2, padding:"8px", fontSize:"13px"}}/>
                        <input type="time" name="start_time" value={editForm.start_time} onChange={handleEditChange} style={{flex:1, padding:"8px", fontSize:"13px"}}/>
                        <input type="time" name="end_time" value={editForm.end_time} onChange={handleEditChange} style={{flex:1, padding:"8px", fontSize:"13px"}}/>
                      </div>
                      <label style={{fontSize:"11px"}}>주행거리 수정 (시작/종료)</label>
                      <div style={{display:"flex", gap:"5px"}}>
                        <input type="number" name="start_mileage" value={editForm.start_mileage} onChange={handleEditChange} style={{flex:1, padding:"8px"}}/>
                        <input type="number" name="end_mileage" value={editForm.end_mileage} onChange={handleEditChange} style={{flex:1, padding:"8px"}}/>
                      </div>
                      <label style={{fontSize:"11px"}}>플랫폼 수익 수정 (쿠팡/배민/카카오)</label>
                      <div style={{display:"flex", gap:"5px"}}>
                        <input type="number" name="coupang_eats" value={editForm.coupang_eats} onChange={handleEditChange} style={{flex:1, padding:"8px"}}/>
                        <input type="number" name="baemin" value={editForm.baemin} onChange={handleEditChange} style={{flex:1, padding:"8px"}}/>
                        <input type="number" name="kakao_picker" value={editForm.kakao_picker} onChange={handleEditChange} style={{flex:1, padding:"8px"}}/>
                      </div>
                      <div style={{ display: "flex", gap: "8px", marginTop: "5px" }}>
                        <button onClick={saveEdit} style={{ flex: 1, padding: "10px", background: "#0070f3", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold" }}>💾 저장</button>
                        <button onClick={() => setEditLogId(null)} style={{ flex: 1, padding: "10px", background: "#eee", borderRadius: "8px" }}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: "14px" }}>{log.work_date} <span style={{fontSize:"11px", color:"#999", fontWeight:"normal"}}>{log.start_time}~{log.end_time}</span></div>
                        <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                          {log.status === 'completed' ? `✅ ${total.toLocaleString()}원 (${log.work_hours}h)` : '🏃 근무 중'}
                        </div>
                      </div>
                      <button onClick={() => startEdit(log)} style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid #eee", fontSize: "12px", backgroundColor: "#fff" }}>수정</button>
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