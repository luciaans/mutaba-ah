import { ImageResponse } from "next/og";

export const alt = "MUTABA'AH — Monitoring Ibadah Santri";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#f5f7f4", fontFamily: "Arial, sans-serif" }}>
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 465, background: "#0d5c45" }} />
        <div style={{ position: "absolute", top: -180, right: -125, width: 560, height: 560, borderRadius: 280, background: "#14694f" }} />
        <div style={{ position: "absolute", bottom: -310, right: 195, width: 530, height: 530, borderRadius: 265, background: "#0a503d" }} />

        <div style={{ position: "absolute", top: 64, left: 72, display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="62" height="62" viewBox="0 0 64 64" fill="none">
            <rect width="64" height="64" rx="18" fill="#0D5C45" />
            <path d="M13 47h38M18 47V32h28v15M22 32c0-7 4-12 10-15 6 3 10 8 10 15M29 23h6M29 39v8m6-8v8" stroke="#F8FAF7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M32 14v-3" stroke="#D5B66D" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ color: "#193b2b", fontSize: 23, fontWeight: 700, letterSpacing: 1.1 }}>MUTABA'AH</div>
            <div style={{ color: "#718078", fontSize: 12, fontWeight: 700, letterSpacing: 2.2 }}>MONITORING IBADAH SANTRI</div>
          </div>
        </div>

        <div style={{ position: "absolute", top: 205, left: 76, width: 555, display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#18392a", fontSize: 49, lineHeight: 1.14, fontWeight: 700, letterSpacing: -1.7 }}>Menjaga kebiasaan baik.</div>
          <div style={{ marginTop: 20, width: 500, color: "#68776e", fontSize: 21, lineHeight: 1.5 }}>Pencatatan ibadah santri yang rapi dan mudah dipantau.</div>
          <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 10, color: "#0d5c45", fontSize: 14, fontWeight: 700 }}>
            <div style={{ width: 26, height: 2, background: "#c6a65e" }} />
            UNTUK PONDOK PESANTREN
          </div>
        </div>

        <div style={{ position: "absolute", right: 62, top: 118, width: 390, height: 394, borderRadius: 22, background: "#ffffff", padding: 27, display: "flex", flexDirection: "column", boxShadow: "0 20px 50px rgba(0,0,0,0.14)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ color: "#21352a", fontSize: 18, fontWeight: 700 }}>Pemantauan ibadah</div>
              <div style={{ color: "#829087", fontSize: 12 }}>Rekap kehadiran harian</div>
            </div>
            <div style={{ width: 35, height: 35, borderRadius: 12, background: "#eaf4ef", color: "#0d5c45", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>OK</div>
          </div>
          <div style={{ height: 1, background: "#e9eee9", marginTop: 20, marginBottom: 8 }} />
          {[
            ["Subuh", "#0d5c45", "82%"],
            ["Zuhur", "#3e8764", "68%"],
            ["Asar", "#c6a65e", "74%"],
            ["Magrib", "#3e8764", "91%"],
            ["Isya", "#0d5c45", "77%"],
          ].map(([prayer, color, width]) => (
            <div key={prayer} style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 11, paddingBottom: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#506057", fontSize: 13, fontWeight: 600 }}>
                <span>{prayer}</span><span style={{ color: "#98a39b", fontSize: 11 }}>Tercatat</span>
              </div>
              <div style={{ width: "100%", height: 6, borderRadius: 5, background: "#edf1ed", display: "flex" }}>
                <div style={{ width, height: 6, borderRadius: 5, background: color }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", bottom: 44, left: 76, color: "#87938b", fontSize: 14 }}>www.mutaba-ah.web.id</div>
      </div>
    ),
    { ...size },
  );
}
