"use client";
import { useState, useEffect } from "react";

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ dager: 85, timer: 2, minutter: 11, sekunder: 0 });
  const [activeTab, setActiveTab] = useState("kunde");
  const [notifVisible, setNotifVisible] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date("2026-09-01T00:00:00");
    const tick = () => {
      const now = new Date();
      const diff = target.getTime() - now.getTime();
      if (diff <= 0) return;
      setTimeLeft({
        dager: Math.floor(diff / 86400000),
        timer: Math.floor((diff % 86400000) / 3600000),
        minutter: Math.floor((diff % 3600000) / 60000),
        sekunder: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (activeTab !== "eier") { setNotifVisible(true); return; }
    const id = setInterval(() => setNotifVisible(v => !v), 2800);
    return () => clearInterval(id);
  }, [activeTab]);

  const slots = ["09:00", "10:00", "11:30", "13:00", "14:30", "16:00"];
  const bookedSlots = [1, 3];

  return (
    <main style={{
      minHeight: "100vh", background: "#04342C",
      fontFamily: "'Work Sans', system-ui, sans-serif",
      color: "#fff", position: "relative", overflowX: "hidden",
    }}>
      <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:`linear-gradient(rgba(93,202,165,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(93,202,165,0.04) 1px,transparent 1px)`,backgroundSize:"56px 56px" }} />
      <div style={{ position:"fixed",top:"-15%",right:"-8%",width:"520px",height:"520px",pointerEvents:"none",zIndex:0,background:"radial-gradient(circle,rgba(15,110,86,0.38) 0%,transparent 68%)" }} />
      <div style={{ position:"fixed",bottom:"-15%",left:"-8%",width:"400px",height:"400px",pointerEvents:"none",zIndex:0,background:"radial-gradient(circle,rgba(93,202,165,0.1) 0%,transparent 70%)" }} />

      <nav style={{ position:"relative",zIndex:10,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 40px",borderBottom:"1px solid rgba(93,202,165,0.1)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:36,height:36,borderRadius:8,background:"#0F6E56",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800 }}>
            <span style={{ color:"#fff" }}>B</span><span style={{ color:"#5DCAA5" }}>ti</span>
          </div>
          <span style={{ fontSize:17,fontWeight:700,letterSpacing:"-0.3px" }}>Bookti</span>
        </div>
        <div style={{ fontSize:11,fontWeight:700,letterSpacing:"2.5px",color:"#5DCAA5",background:"rgba(93,202,165,0.08)",padding:"6px 14px",borderRadius:20,border:"1px solid rgba(93,202,165,0.2)" }}>
          KOMMER SNART
        </div>
      </nav>

      <div style={{ position:"relative",zIndex:5,display:"flex",flexDirection:"column",alignItems:"center",padding:"56px 24px 0",textAlign:"center" }}>
        <div style={{ display:"flex",alignItems:"center",gap:8,fontSize:11,fontWeight:700,letterSpacing:"3px",color:"#5DCAA5",marginBottom:18,textTransform:"uppercase" as const }}>
          <span style={{ width:28,height:1,background:"rgba(93,202,165,0.45)",display:"inline-block" }} />
          Smart booking for norske servicebedrifter
          <span style={{ width:28,height:1,background:"rgba(93,202,165,0.45)",display:"inline-block" }} />
        </div>

        <h1 style={{ fontSize:"clamp(42px,6.5vw,78px)",fontWeight:900,lineHeight:1.05,letterSpacing:"-2.5px",margin:"0 0 20px" }}>
          Booking som<br />
          <span style={{ WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundImage:"linear-gradient(135deg,#5DCAA5 0%,#0F6E56 100%)" }}>faktisk fungerer</span>
        </h1>

        <p style={{ fontSize:17,color:"rgba(255,255,255,0.48)",maxWidth:460,lineHeight:1.68,marginBottom:38,fontWeight:400 }}>
          La kundene booke selv — du får beskjed med én gang. Ingen dobbeltbookinger, ingen tapte avtaler.
        </p>

        {!submitted ? (
          <form onSubmit={e => { e.preventDefault(); if (email) setSubmitted(true); }} style={{ display:"flex",gap:8,marginBottom:52,width:"100%",maxWidth:420,flexWrap:"wrap" as const }}>
            <input type="email" placeholder="din@epost.no" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ flex:1,minWidth:170,padding:"13px 18px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(93,202,165,0.2)",borderRadius:10,color:"#fff",fontSize:15,outline:"none" }} />
            <button type="submit" style={{ padding:"13px 22px",background:"#0F6E56",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer" }}>
              Varsle meg →
            </button>
          </form>
        ) : (
          <div style={{ marginBottom:52,padding:"13px 28px",background:"rgba(93,202,165,0.1)",border:"1px solid rgba(93,202,165,0.28)",borderRadius:10,color:"#5DCAA5",fontSize:15,fontWeight:600 }}>
            ✓ Takk! Vi varsler deg ved lansering.
          </div>
        )}

        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:72 }}>
          {[{val:timeLeft.dager,label:"DAGER"},{val:timeLeft.timer,label:"TIMER"},{val:timeLeft.minutter,label:"MINUTTER"},{val:timeLeft.sekunder,label:"SEKUNDER"}].map(({val,label},i) => (
            <div key={label} style={{ display:"flex",alignItems:"center",gap:6 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"clamp(28px,4vw,50px)",fontWeight:900,letterSpacing:"-1px",minWidth:62,padding:"10px 14px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10 }}>
                  {String(val).padStart(2,"0")}
                </div>
                <div style={{ fontSize:9,color:"rgba(255,255,255,0.28)",letterSpacing:"2px",marginTop:6 }}>{label}</div>
              </div>
              {i < 3 && <span style={{ fontSize:26,color:"rgba(255,255,255,0.13)",fontWeight:900,paddingBottom:22 }}>:</span>}
            </div>
          ))}
        </div>

        <div style={{ width:"100%",maxWidth:700,borderTop:"1px solid rgba(93,202,165,0.1)",marginBottom:40 }} />

        <div style={{ display:"flex",gap:6,marginBottom:32 }}>
          {[{id:"kunde",label:"👤  Kundeside"},{id:"eier",label:"🏪  Salongpanel"}].map(({id,label}) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{ padding:"10px 24px",borderRadius:10,fontSize:13,fontWeight:700,cursor:"pointer",border:activeTab===id?"1px solid rgba(93,202,165,0.35)":"1px solid rgba(255,255,255,0.08)",background:activeTab===id?"rgba(93,202,165,0.12)":"rgba(255,255,255,0.03)",color:activeTab===id?"#5DCAA5":"rgba(255,255,255,0.32)",letterSpacing:"0.3px",transition:"all 0.18s" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position:"relative",zIndex:5,maxWidth:820,margin:"0 auto",padding:"0 20px 20px" }}>
        {activeTab === "kunde" && (
          <div style={{ display:"flex",gap:24,flexWrap:"wrap" as const }}>
            <div style={{ flex:"1 1 200px" }}>
              <div style={{ fontSize:10,color:"rgba(255,255,255,0.28)",letterSpacing:"2.5px",marginBottom:12 }}>VELG TJENESTE</div>
              {[{name:"Klipp og stell",price:"kr 350",min:"45 min"},{name:"Farging",price:"kr 750",min:"90 min"},{name:"Manikyr",price:"kr 280",min:"40 min"},{name:"Massasje",price:"kr 580",min:"60 min"}].map((s,i) => (
                <div key={s.name} style={{ padding:"11px 14px",borderRadius:10,marginBottom:7,background:i===0?"rgba(93,202,165,0.1)":"rgba(255,255,255,0.03)",border:i===0?"1px solid rgba(93,202,165,0.28)":"1px solid rgba(255,255,255,0.07)",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer" }}>
                  <div>
                    <div style={{ fontSize:14,fontWeight:600,color:i===0?"#5DCAA5":"rgba(255,255,255,0.65)" }}>{s.name}</div>
                    <div style={{ fontSize:11,color:"rgba(255,255,255,0.28)",marginTop:2 }}>{s.min}</div>
                  </div>
                  <div style={{ fontSize:13,fontWeight:700,color:i===0?"#5DCAA5":"rgba(255,255,255,0.35)" }}>{s.price}</div>
                </div>
              ))}
            </div>
            <div style={{ flex:"1 1 260px" }}>
              <div style={{ fontSize:10,color:"rgba(255,255,255,0.28)",letterSpacing:"2.5px",marginBottom:12 }}>VELG DATO OG TID — JUNI 2026</div>
              <div style={{ display:"flex",gap:6,marginBottom:16 }}>
                {[{d:"Man",n:8},{d:"Tir",n:9},{d:"Ons",n:10},{d:"Tor",n:11},{d:"Fre",n:12}].map(({d,n},i) => (
                  <div key={n} style={{ flex:1,textAlign:"center",padding:"8px 4px",borderRadius:9,cursor:"pointer",background:i===1?"#0F6E56":"rgba(255,255,255,0.04)",border:i===1?"1px solid rgba(93,202,165,0.5)":"1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize:10,color:i===1?"#5DCAA5":"rgba(255,255,255,0.3)",marginBottom:3 }}>{d}</div>
                    <div style={{ fontSize:16,fontWeight:800,color:i===1?"#fff":"rgba(255,255,255,0.45)" }}>{n}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7 }}>
                {slots.map((s,i) => {
                  const booked = bookedSlots.includes(i);
                  const sel = selectedSlot === i;
                  return (
                    <div key={s} onClick={() => !booked && setSelectedSlot(i)} style={{ padding:"10px 0",borderRadius:9,textAlign:"center",fontSize:14,fontWeight:700,cursor:booked?"not-allowed":"pointer",background:booked?"transparent":sel?"#0F6E56":"rgba(255,255,255,0.05)",border:booked?"1px solid rgba(255,255,255,0.05)":sel?"1px solid rgba(93,202,165,0.6)":"1px solid rgba(255,255,255,0.1)",color:booked?"rgba(255,255,255,0.18)":sel?"#fff":"rgba(255,255,255,0.72)",textDecoration:booked?"line-through":"none",transition:"all 0.15s" }}>
                      {s}
                    </div>
                  );
                })}
              </div>
              {selectedSlot !== null && (
                <button style={{ marginTop:14,width:"100%",padding:"13px",background:"linear-gradient(135deg,#0F6E56 0%,#5DCAA5 100%)",border:"none",borderRadius:10,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer" }}>
                  Bekreft kl. {slots[selectedSlot]} →
                </button>
              )}
              <div style={{ marginTop:12,padding:"10px 14px",background:"rgba(93,202,165,0.05)",border:"1px solid rgba(93,202,165,0.12)",borderRadius:9,fontSize:12,color:"rgba(255,255,255,0.35)",display:"flex",gap:8,alignItems:"center" }}>
                <span>📲</span> Du får SMS-bekreftelse øyeblikkelig
              </div>
            </div>
          </div>
        )}

        {activeTab === "eier" && (
          <div>
            <div style={{ transition:"opacity 0.5s ease,transform 0.5s ease",opacity:notifVisible?1:0,transform:notifVisible?"translateY(0)":"translateY(-6px)",marginBottom:24,padding:"12px 18px",background:"rgba(93,202,165,0.09)",border:"1px solid rgba(93,202,165,0.24)",borderRadius:11,fontSize:13,display:"flex",alignItems:"center",gap:12,color:"#5DCAA5" }}>
              <span style={{ fontSize:20 }}>🔔</span>
              <div>
                <div style={{ fontWeight:700 }}>Ny bestilling!</div>
                <div style={{ opacity:0.62,fontSize:12,marginTop:1 }}>Sara Andersen — Mandag 9. juni kl. 15:30</div>
              </div>
              <div style={{ marginLeft:"auto",fontSize:11,opacity:0.38,whiteSpace:"nowrap" as const }}>akkurat nå</div>
            </div>
            <div style={{ display:"flex",gap:20,flexWrap:"wrap" as const }}>
              <div style={{ display:"flex",flexDirection:"column" as const,gap:9,flex:"0 0 auto" }}>
                {[{label:"Avtaler i dag",val:"8",accent:true},{label:"Inntekt denne uken",val:"kr 6.800",accent:false},{label:"Belagte timer",val:"87%",accent:true},{label:"Aktive kunder",val:"124",accent:false}].map(({label,val,accent}) => (
                  <div key={label} style={{ padding:"12px 18px",borderRadius:11,minWidth:162,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:5 }}>{label}</div>
                    <div style={{ fontSize:24,fontWeight:800,color:accent?"#5DCAA5":"#fff" }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ flex:1,minWidth:200 }}>
                <div style={{ fontSize:10,color:"rgba(255,255,255,0.28)",letterSpacing:"2.5px",marginBottom:12 }}>DAGENS AVTALER — MANDAG 9. JUNI</div>
                {[{time:"09:00",name:"Anna Kowalczyk",service:"Klipp og stell",done:true},{time:"10:30",name:"Maria Lindstad",service:"Farging",done:true},{time:"13:00",name:"Ingrid Haugen",service:"Manikyr",done:false},{time:"14:30",name:"Sara Andersen",service:"Massasje",done:false},{time:"15:30",name:"Kari Olsen",service:"Klipp",done:false}].map(({time,name,service,done}) => (
                  <div key={time} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 13px",borderRadius:9,marginBottom:6,background:done?"rgba(255,255,255,0.02)":"rgba(93,202,165,0.06)",border:done?"1px solid rgba(255,255,255,0.05)":"1px solid rgba(93,202,165,0.15)",opacity:done?0.4:1,transition:"opacity 0.2s" }}>
                    <div style={{ fontSize:12,fontWeight:800,color:"#5DCAA5",minWidth:44,fontFamily:"monospace" }}>{time}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13,fontWeight:600 }}>{name}</div>
                      <div style={{ fontSize:11,color:"rgba(255,255,255,0.35)" }}>{service}</div>
                    </div>
                    <div style={{ fontSize:10,padding:"3px 10px",borderRadius:20,fontWeight:700,background:done?"rgba(255,255,255,0.05)":"rgba(93,202,165,0.14)",color:done?"rgba(255,255,255,0.25)":"#5DCAA5" }}>
                      {done?"Ferdig":"Kommende"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ borderTop:"1px solid rgba(93,202,165,0.1)",margin:"44px 0 28px" }} />

        <div style={{ display:"flex",flexWrap:"wrap" as const,justifyContent:"center",gap:8 }}>
          {["📅 Online booking 24/7","📲 SMS-påminnelser","💳 Stripe-betaling","📊 Sanntidsoversikt","🔗 Din egen bookingside","🇳🇴 Bygget for Norge"].map(f => (
            <div key={f} style={{ padding:"7px 16px",borderRadius:20,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",fontSize:12,color:"rgba(255,255,255,0.45)" }}>{f}</div>
          ))}
        </div>

        <div style={{ textAlign:"center",marginTop:44,fontSize:12,color:"rgba(255,255,255,0.18)",borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:22 }}>
          © 2026 Bookti · Bergen, Norge · kontakt@bookti.no
        </div>
      </div>
    </main>
  );
}
