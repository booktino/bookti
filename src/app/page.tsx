"use client";
import { useState, useEffect } from "react";
import { Logo } from "@/components/Logo";

const C = {
  bg: "#EFF8F4",
  text: "#0D3B2E",
  muted: "#4A6B5E",
  faint: "#7A9A8E",
  surface: "#FFFFFF",
  border: "#C8E6D8",
  primary: "#0F6E56",
  accent: "#0F6E56",
  accentLight: "#5DCAA5",
};

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ dager: 85, timer: 2, minutter: 11, sekunder: 0 });

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

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .bookti-nav { padding: 14px 16px !important; }
          .bookti-hero { padding: 36px 16px 0 !important; }
          .bookti-tagline-line { display: none !important; }
          .bookti-tagline { font-size: 10px !important; letter-spacing: 1.5px !important; padding: 0 8px !important; }
          .bookti-actions { flex-direction: column !important; width: 100% !important; max-width: 300px !important; }
          .bookti-actions a { width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
          .bookti-free-banner { font-size: 13px !important; padding: 10px 14px !important; max-width: 100% !important; }
          .bookti-form { flex-direction: column !important; max-width: 100% !important; }
          .bookti-form input, .bookti-form button { width: 100% !important; box-sizing: border-box !important; }
          .bookti-countdown { gap: 4px !important; }
          .bookti-countdown-num { min-width: 48px !important; padding: 8px 6px !important; font-size: 22px !important; }
          .bookti-countdown-sep { font-size: 18px !important; padding-bottom: 16px !important; }
          .bookti-features { padding: 0 12px !important; gap: 6px !important; }
          .bookti-feature { font-size: 11px !important; padding: 6px 12px !important; }
          .bookti-footer { flex-direction: column !important; gap: 6px !important; padding: 10px 16px !important; }
          .bookti-footer-sep { display: none !important; }
        }
      `}</style>

      <main style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Work Sans',system-ui,sans-serif", color:C.text, position:"relative", overflowX:"hidden" }}>
        <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:`linear-gradient(rgba(15,110,86,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(15,110,86,0.06) 1px,transparent 1px)`,backgroundSize:"56px 56px" }} />
        <div style={{ position:"fixed",top:"-15%",right:"-8%",width:"520px",height:"520px",pointerEvents:"none",zIndex:0,background:"radial-gradient(circle,rgba(93,202,165,0.25) 0%,transparent 68%)" }} />
        <div style={{ position:"fixed",bottom:"-15%",left:"-8%",width:"400px",height:"400px",pointerEvents:"none",zIndex:0,background:"radial-gradient(circle,rgba(15,110,86,0.08) 0%,transparent 70%)" }} />

        <nav className="bookti-nav" style={{ position:"relative",zIndex:10,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 40px",borderBottom:`1px solid ${C.border}`,background:C.surface,flexWrap:"wrap",gap:12 }}>
          <Logo />
          <div style={{ fontSize:11,fontWeight:700,letterSpacing:"2.5px",color:C.primary,background:"rgba(15,110,86,0.08)",padding:"6px 14px",borderRadius:20,border:`1px solid ${C.border}` }}>
            KOMMER SNART
          </div>
        </nav>

        <div className="bookti-hero" style={{ position:"relative",zIndex:5,display:"flex",flexDirection:"column",alignItems:"center",padding:"56px 24px 0",textAlign:"center" }}>
          <div className="bookti-tagline" style={{ display:"flex",alignItems:"center",gap:8,fontSize:11,fontWeight:700,letterSpacing:"3px",color:C.primary,marginBottom:18,textTransform:"uppercase" }}>
            <span className="bookti-tagline-line" style={{ width:28,height:1,background:C.border,display:"inline-block" }} />
            Smart booking for norske servicebedrifter
            <span className="bookti-tagline-line" style={{ width:28,height:1,background:C.border,display:"inline-block" }} />
          </div>

          <h1 style={{ fontSize:"clamp(32px,8vw,78px)",fontWeight:900,lineHeight:1.05,letterSpacing:"-2.5px",margin:"0 0 20px",color:C.text }}>
            Booking som<br />
            <span style={{ WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundImage:"linear-gradient(135deg,#5DCAA5 0%,#0F6E56 100%)" }}>faktisk fungerer</span>
          </h1>

          <p style={{ fontSize:"clamp(15px,4vw,17px)",color:C.muted,maxWidth:460,lineHeight:1.68,marginBottom:28,fontWeight:400,padding:"0 8px" }}>
            La kundene booke selv — du får beskjed med én gang. Ingen dobbeltbookinger, ingen tapte avtaler.
          </p>

          <p style={{ fontSize:12,fontWeight:700,letterSpacing:"2.5px",color:C.faint,marginBottom:14,textTransform:"uppercase" }}>
            Se hvordan det fungerer
          </p>
          <div className="bookti-actions" style={{ display:"flex",justifyContent:"center",gap:10,marginBottom:32,flexWrap:"wrap",width:"100%" }}>
            <a href="/din-bedrift" style={{ padding:"11px 22px",background:C.primary,border:`1px solid ${C.primary}`,borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,textDecoration:"none" }}>
              Prøv bookingside →
            </a>
            <a href="/admin" style={{ padding:"11px 22px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,color:C.muted,fontSize:13,fontWeight:700,textDecoration:"none" }}>
              Bookti Dashboard →
            </a>
          </div>

          <div className="bookti-free-banner" style={{ marginBottom:32,padding:"10px 20px",background:C.surface,border:`2px solid ${C.primary}`,borderRadius:12,color:C.primary,fontSize:15,fontWeight:800,boxShadow:"0 2px 8px rgba(15,110,86,0.12)",maxWidth:"100%" }}>
            🎁 6 måneder gratis — ingen kredittkort nødvendig
          </div>

          {!submitted ? (
            <form className="bookti-form" onSubmit={(e) => { e.preventDefault(); if (email) setSubmitted(true); }} style={{ display:"flex",gap:8,marginBottom:52,width:"100%",maxWidth:420,flexWrap:"wrap" }}>
              <input type="email" placeholder="din@epost.no" value={email} onChange={(e) => setEmail(e.target.value)} required
                style={{ flex:1,minWidth:0,padding:"13px 18px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:15,outline:"none" }} />
              <button type="submit" style={{ padding:"13px 22px",background:"#0F6E56",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer" }}>
                Varsle meg →
              </button>
            </form>
          ) : (
            <div style={{ marginBottom:52,padding:"13px 28px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,color:C.primary,fontSize:15,fontWeight:600,boxShadow:"0 1px 3px rgba(15,110,86,0.08)" }}>
              ✓ Takk! Vi varsler deg ved lansering.
            </div>
          )}

          <div className="bookti-countdown" style={{ display:"flex",alignItems:"center",gap:6,marginBottom:72 }}>
            {[{val:timeLeft.dager,label:"DAGER"},{val:timeLeft.timer,label:"TIMER"},{val:timeLeft.minutter,label:"MINUTTER"},{val:timeLeft.sekunder,label:"SEKUNDER"}].map(({val,label},i) => (
              <div key={label} style={{ display:"flex",alignItems:"center",gap:6 }}>
                <div style={{ textAlign:"center" }}>
                  <div className="bookti-countdown-num" style={{ fontSize:"clamp(22px,5vw,50px)",fontWeight:900,letterSpacing:"-1px",minWidth:62,padding:"10px 14px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,boxShadow:"0 1px 3px rgba(15,110,86,0.06)" }}>
                    {String(val).padStart(2,"0")}
                  </div>
                  <div style={{ fontSize:9,color:C.faint,letterSpacing:"2px",marginTop:6 }}>{label}</div>
                </div>
                {i < 3 && <span className="bookti-countdown-sep" style={{ fontSize:26,color:C.border,fontWeight:900,paddingBottom:22 }}>:</span>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position:"relative",zIndex:5,maxWidth:820,margin:"0 auto",padding:"0 20px 20px" }}>
          <div className="bookti-features" style={{ display:"flex",flexWrap:"wrap",justifyContent:"center",gap:8 }}>
            {["🎁 6 måneder gratis","📅 Online booking 24/7","📲 SMS-påminnelser","💚 Vipps-betaling","🧾 MVA + Altinn","💰 299–399 kr/mnd","🇳🇴 Bygget for Norge"].map((f) => (
              <div key={f} className="bookti-feature" style={{ padding:"7px 16px",borderRadius:20,background:C.surface,border:`1px solid ${C.border}`,fontSize:12,color:C.muted,boxShadow:"0 1px 2px rgba(15,110,86,0.04)" }}>{f}</div>
            ))}
          </div>

          <div style={{ textAlign:"center",marginTop:44,fontSize:12,color:C.faint,borderTop:`1px solid ${C.border}`,paddingTop:22,paddingBottom:80 }}>
            © 2026 Bookti · Bergen, Norge · kontakt@bookti.no
          </div>
        </div>

        <footer className="bookti-footer" style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:20,display:"flex",alignItems:"center",justifyContent:"center",gap:16,padding:"14px 24px",background:C.surface,borderTop:`1px solid ${C.border}`,boxShadow:"0 -4px 20px rgba(15,110,86,0.06)" }}>
          <a
            href="https://www.instagram.com/bookti.no/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display:"inline-flex",alignItems:"center",gap:8,color:C.primary,fontSize:14,fontWeight:700,textDecoration:"none" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" stroke="#0F6E56" strokeWidth="2"/>
              <circle cx="12" cy="12" r="4.5" stroke="#0F6E56" strokeWidth="2"/>
              <circle cx="17.5" cy="6.5" r="1.2" fill="#0F6E56"/>
            </svg>
            @bookti.no
          </a>
          <span className="bookti-footer-sep" style={{ color:C.border }}>|</span>
          <span style={{ fontSize:12,color:C.faint }}>© 2026 Bookti</span>
        </footer>
      </main>
    </>
  );
}
