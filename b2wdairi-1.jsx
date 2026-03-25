import { useState, useEffect, useRef } from "react";

const WEATHER_OPTIONS = ["☀️ Sunny", "⛅ Cloudy", "🌧️ Rainy", "⛈️ Stormy", "❄️ Snowy", "🌤️ Partly Cloudy", "🌈 Rainbow", "🌬️ Windy"];

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
};

const today = () => new Date().toISOString().split("T")[0];

const EMPTY_FORM = { date: today(), event: "", weather: "☀️ Sunny", notes: "" };

const AIPanel = ({ entry, onClose }) => {
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("reflect");

  const prompts = {
    reflect: "Reflect on this diary entry with warmth and insight. Offer a brief, thoughtful perspective in 2-3 sentences.",
    quote: "Based on this diary entry, suggest a meaningful, uplifting quote that matches the mood and events described.",
    summary: "Summarize this diary entry in one poetic sentence that captures its essence.",
    advice: "Offer one gentle, actionable piece of advice based on the events in this diary entry.",
  };

  const askAI = async (type) => {
    setPrompt(type);
    setLoading(true);
    setResponse("");
    try {
      const userContent = `Date: ${entry.date}\nEvent: ${entry.event}\nWeather: ${entry.weather}\nNotes: ${entry.notes}`;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: prompts[type],
          messages: [{ role: "user", content: userContent }],
        }),
      });
      const data = await res.json();
      setResponse(data.content?.[0]?.text || "No response.");
    } catch {
      setResponse("Couldn't connect to AI. Please try again.");
    }
    setLoading(false);
  };

  useEffect(() => { askAI("reflect"); }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(30,20,10,0.6)", zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      backdropFilter: "blur(4px)"
    }}>
      <div style={{
        background: "linear-gradient(135deg, #fdf6e3 0%, #fef9ee 100%)",
        borderRadius: "1.5rem", maxWidth: "520px", width: "100%", padding: "2rem",
        boxShadow: "0 24px 80px rgba(120,80,20,0.25), 0 0 0 1px rgba(180,140,60,0.2)",
        fontFamily: "'Lora', Georgia, serif",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
          <h3 style={{ margin: 0, color: "#6b3f1a", fontSize: "1.1rem", letterSpacing: "0.02em" }}>✨ AI Companion</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.4rem", color: "#b8885a" }}>×</button>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
          {[["reflect","Reflect"],["quote","Quote"],["summary","Summarize"],["advice","Advise"]].map(([k,label]) => (
            <button key={k} onClick={() => askAI(k)} style={{
              padding: "0.35rem 0.85rem", borderRadius: "999px", border: "1.5px solid",
              borderColor: prompt === k ? "#c17f3a" : "#ddc9a3",
              background: prompt === k ? "#c17f3a" : "transparent",
              color: prompt === k ? "#fff" : "#9a6b3a",
              fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s"
            }}>{label}</button>
          ))}
        </div>
        <div style={{
          background: "rgba(180,130,60,0.08)", borderRadius: "1rem", padding: "1.2rem",
          minHeight: "100px", color: "#5a3010", lineHeight: "1.75", fontSize: "0.95rem",
          border: "1px dashed rgba(180,130,60,0.3)"
        }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#c17f3a" }}>
              <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>✦</span> Thinking...
            </div>
          ) : response}
        </div>
      </div>
    </div>
  );
};

export default function b2wdairi() {
  const [entries, setEntries] = useState([]);
  const [view, setView] = useState("list"); // list | form | detail
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [aiEntry, setAiEntry] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef();

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("b2wdairi_entries");
        if (res?.value) setEntries(JSON.parse(res.value));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const save = async (updated) => {
    setEntries(updated);
    try { await window.storage.set("b2wdairi_entries", JSON.stringify(updated)); } catch {}
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleSubmit = async () => {
    if (!form.date || !form.event || !form.notes) { showToast("Please fill in Date, Event, and Notes.", "error"); return; }
    let updated;
    if (editId) {
      updated = entries.map(e => e.id === editId ? { ...form, id: editId } : e);
      showToast("Entry updated!");
    } else {
      const newEntry = { ...form, id: Date.now() };
      updated = [newEntry, ...entries];
      showToast("Entry saved!");
    }
    await save(updated);
    setForm(EMPTY_FORM); setEditId(null); setView("list");
  };

  const handleDelete = async (id) => {
    const updated = entries.filter(e => e.id !== id);
    await save(updated);
    showToast("Entry deleted.", "error");
    if (selected?.id === id) { setSelected(null); setView("list"); }
  };

  const handleEdit = (entry) => {
    setForm({ date: entry.date, event: entry.event, weather: entry.weather, notes: entry.notes });
    setEditId(entry.id); setView("form");
  };

  const handlePrint = () => {
    const printContent = filtered.map(e =>
      `<div style="margin-bottom:2rem;page-break-inside:avoid;">
        <h3 style="font-family:Georgia;color:#6b3f1a;border-bottom:1px solid #ddc;padding-bottom:6px">${formatDate(e.date)}</h3>
        <p><b>Event:</b> ${e.event}</p>
        <p><b>Weather:</b> ${e.weather}</p>
        <p style="white-space:pre-wrap"><b>Notes:</b><br/>${e.notes}</p>
      </div>`
    ).join("");
    const w = window.open("","_blank");
    w.document.write(`<html><head><title>b2wdairi — My Diary</title><style>body{font-family:Georgia,serif;max-width:700px;margin:auto;padding:2rem;color:#333}</style></head><body><h1 style="font-family:Georgia;color:#6b3f1a;text-align:center">📖 b2wdairi</h1><hr/>${printContent}</body></html>`);
    w.document.close(); w.print();
  };

  const filtered = entries.filter(e =>
    e.event.toLowerCase().includes(search.toLowerCase()) ||
    e.notes.toLowerCase().includes(search.toLowerCase()) ||
    e.date.includes(search)
  );

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Playfair+Display:wght@700;800&family=Source+Serif+4:wght@300;400&display=swap');
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
    @keyframes slideDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:none; } }
    * { box-sizing: border-box; }
    ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #fdf6e3; } ::-webkit-scrollbar-thumb { background: #ddc9a3; border-radius: 3px; }
    textarea { resize: vertical; }
  `;

  const colors = {
    bg: "#faf5e8", paper: "#fdf9ef", accent: "#c17f3a", accentLight: "#f0dbb8",
    text: "#3d2008", muted: "#9a7050", border: "#e8d8b8", header: "#6b2f0a"
  };

  const cardStyle = {
    background: colors.paper, borderRadius: "1rem", padding: "1.2rem 1.5rem",
    border: `1px solid ${colors.border}`, boxShadow: "0 2px 16px rgba(120,70,10,0.07)",
    cursor: "pointer", transition: "all 0.2s", animation: "fadeIn 0.4s ease both",
    position: "relative", overflow: "hidden"
  };

  const btnPrimary = {
    background: `linear-gradient(135deg, ${colors.accent}, #a86028)`, color: "#fff",
    border: "none", borderRadius: "0.6rem", padding: "0.6rem 1.4rem",
    fontFamily: "'Lora', serif", fontSize: "0.9rem", cursor: "pointer",
    fontWeight: 600, letterSpacing: "0.02em", transition: "opacity 0.2s"
  };

  const btnGhost = {
    background: "transparent", color: colors.muted,
    border: `1.5px solid ${colors.border}`, borderRadius: "0.6rem", padding: "0.6rem 1.1rem",
    fontFamily: "'Lora', serif", fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s"
  };

  const inputStyle = {
    width: "100%", padding: "0.7rem 1rem", borderRadius: "0.6rem",
    border: `1.5px solid ${colors.border}`, background: "rgba(255,250,235,0.8)",
    fontFamily: "'Lora', serif", fontSize: "0.95rem", color: colors.text,
    outline: "none", transition: "border 0.2s"
  };

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, fontFamily: "'Lora', Georgia, serif", color: colors.text }}>
      <style>{css}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "1.5rem", right: "1.5rem", zIndex: 300,
          background: toast.type === "error" ? "#c0392b" : "#27a065",
          color: "#fff", padding: "0.7rem 1.4rem", borderRadius: "0.7rem",
          fontFamily: "'Lora', serif", fontSize: "0.88rem", boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          animation: "slideDown 0.3s ease"
        }}>{toast.msg}</div>
      )}

      {/* AI Panel */}
      {aiEntry && <AIPanel entry={aiEntry} onClose={() => setAiEntry(null)} />}

      {/* Header */}
      <header style={{
        background: `linear-gradient(135deg, #3d1505 0%, #6b2f0a 50%, #5a2508 100%)`,
        color: "#fdf6e3", padding: "2rem 2rem 1.5rem", textAlign: "center",
        position: "relative", overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.06,
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px"
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: "0.8rem", letterSpacing: "0.3em", color: "#ddc9a3", marginBottom: "0.3rem", textTransform: "uppercase" }}>Personal Journal</div>
          <h1 style={{
            margin: "0 0 0.2rem", fontSize: "clamp(2.2rem,5vw,3.2rem)",
            fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 800,
            letterSpacing: "-0.01em", color: "#fdf6e3",
            textShadow: "0 2px 20px rgba(0,0,0,0.3)"
          }}>b2wdairi</h1>
          <p style={{ margin: 0, color: "#ddc9a3", fontSize: "0.9rem", fontStyle: "italic" }}>Where every day tells a story</p>
          <div style={{ marginTop: "1.2rem", display: "flex", gap: "0.6rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setView("form"); }} style={{
              ...btnPrimary, background: "rgba(255,220,160,0.15)", border: "1.5px solid rgba(255,220,160,0.4)",
              color: "#fdf6e3", backdropFilter: "blur(4px)"
            }}>+ New Entry</button>
            {entries.length > 0 && <button onClick={handlePrint} style={{
              ...btnGhost, background: "rgba(255,220,160,0.08)", border: "1.5px solid rgba(255,220,160,0.3)",
              color: "#ddc9a3"
            }}>🖨 Print All</button>}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "780px", margin: "0 auto", padding: "1.5rem 1rem 4rem" }}>

        {/* Form View */}
        {view === "form" && (
          <div style={{ ...cardStyle, cursor: "default", animation: "fadeIn 0.35s ease" }}>
            <h2 style={{ margin: "0 0 1.4rem", fontFamily: "'Playfair Display', serif", color: colors.header, fontSize: "1.4rem" }}>
              {editId ? "✏️ Edit Entry" : "📝 New Entry"}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.8rem", color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.8rem", color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Weather</label>
                <select value={form.weather} onChange={e => setForm({...form, weather: e.target.value})} style={inputStyle}>
                  {WEATHER_OPTIONS.map(w => <option key={w}>{w}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.8rem", color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Event / Title</label>
              <input type="text" value={form.event} onChange={e => setForm({...form, event: e.target.value})} placeholder="What happened today?" style={inputStyle} />
            </div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.3rem", fontSize: "0.8rem", color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Daily Notes</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Write about your day..." rows={7} style={{ ...inputStyle, lineHeight: "1.75" }} />
            </div>
            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
              <button onClick={() => { setView("list"); setForm(EMPTY_FORM); setEditId(null); }} style={btnGhost}>Cancel</button>
              <button onClick={handleSubmit} style={btnPrimary}>{editId ? "Update Entry" : "Save Entry"}</button>
            </div>
          </div>
        )}

        {/* Detail View */}
        {view === "detail" && selected && (
          <div style={{ animation: "fadeIn 0.35s ease" }}>
            <button onClick={() => setView("list")} style={{ ...btnGhost, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>← Back</button>
            <div style={{ ...cardStyle, cursor: "default" }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "4px",
                background: `linear-gradient(90deg, ${colors.accent}, #e8a060)`
              }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.2rem" }}>
                <div>
                  <div style={{ fontSize: "0.78rem", color: colors.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                    {selected.weather}
                  </div>
                  <h2 style={{ margin: 0, fontFamily: "'Playfair Display', serif", color: colors.header, fontSize: "1.4rem" }}>{selected.event}</h2>
                  <div style={{ color: colors.muted, fontSize: "0.85rem", fontStyle: "italic", marginTop: "0.2rem" }}>{formatDate(selected.date)}</div>
                </div>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button onClick={() => setAiEntry(selected)} style={{ ...btnGhost, fontSize: "0.8rem", padding: "0.4rem 0.9rem" }}>✨ AI</button>
                  <button onClick={() => handleEdit(selected)} style={{ ...btnGhost, fontSize: "0.8rem", padding: "0.4rem 0.9rem" }}>✏️ Edit</button>
                  <button onClick={() => handleDelete(selected.id)} style={{ ...btnGhost, borderColor: "#e8a0a0", color: "#c05050", fontSize: "0.8rem", padding: "0.4rem 0.9rem" }}>🗑 Delete</button>
                </div>
              </div>
              <div style={{
                background: "rgba(180,130,60,0.05)", borderRadius: "0.8rem", padding: "1.2rem",
                lineHeight: "1.9", whiteSpace: "pre-wrap", fontSize: "0.97rem", color: colors.text,
                borderLeft: `3px solid ${colors.accentLight}`
              }}>{selected.notes}</div>
            </div>
          </div>
        )}

        {/* List View */}
        {view === "list" && (
          <>
            {/* Search */}
            <div style={{ marginBottom: "1.2rem", position: "relative" }}>
              <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: colors.muted, pointerEvents: "none" }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries..."
                style={{ ...inputStyle, paddingLeft: "2.5rem" }} />
            </div>

            {/* Stats */}
            {entries.length > 0 && !search && (
              <div style={{ display: "flex", gap: "0.7rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
                {[
                  ["📖", entries.length, "Entries"],
                  ["📅", new Set(entries.map(e => e.date.slice(0,7))).size, "Months"],
                ].map(([icon, num, label]) => (
                  <div key={label} style={{
                    background: colors.paper, border: `1px solid ${colors.border}`,
                    borderRadius: "0.7rem", padding: "0.6rem 1rem",
                    display: "flex", alignItems: "center", gap: "0.5rem"
                  }}>
                    <span style={{ fontSize: "1.1rem" }}>{icon}</span>
                    <span style={{ fontWeight: 700, color: colors.accent, fontSize: "1.1rem" }}>{num}</span>
                    <span style={{ color: colors.muted, fontSize: "0.82rem" }}>{label}</span>
                  </div>
                ))}
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: "center", padding: "3rem", color: colors.muted }}>Loading entries...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
                <div style={{ fontSize: "3rem", marginBottom: "0.8rem" }}>📒</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", color: colors.header, margin: "0 0 0.5rem" }}>
                  {search ? "No entries found" : "Your diary is empty"}
                </h3>
                <p style={{ color: colors.muted, fontSize: "0.9rem" }}>
                  {search ? "Try a different search term." : "Click \"New Entry\" to write your first diary entry."}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {filtered.map((entry, i) => (
                  <div key={entry.id} onClick={() => { setSelected(entry); setView("detail"); }} style={{
                    ...cardStyle, animationDelay: `${i * 0.05}s`
                  }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 28px rgba(120,70,10,0.14)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 16px rgba(120,70,10,0.07)"; e.currentTarget.style.transform = "none"; }}
                  >
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0, width: "4px",
                      background: `linear-gradient(180deg, ${colors.accent}, #e8a060)`, borderRadius: "4px 0 0 4px"
                    }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                          <span style={{ fontSize: "0.9rem" }}>{entry.weather.split(" ")[0]}</span>
                          <span style={{ fontSize: "0.75rem", color: colors.muted }}>{formatDate(entry.date)}</span>
                        </div>
                        <h3 style={{ margin: "0 0 0.35rem", fontFamily: "'Playfair Display', serif", fontSize: "1.05rem", color: colors.header, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.event}</h3>
                        <p style={{ margin: 0, color: colors.muted, fontSize: "0.85rem", lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{entry.notes}</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flexShrink: 0 }}>
                        <button onClick={e => { e.stopPropagation(); setAiEntry(entry); }} title="AI Companion" style={{
                          background: "rgba(180,130,60,0.1)", border: "none", borderRadius: "50%",
                          width: "30px", height: "30px", cursor: "pointer", fontSize: "0.85rem"
                        }}>✨</button>
                        <button onClick={e => { e.stopPropagation(); handleEdit(entry); }} title="Edit" style={{
                          background: "rgba(180,130,60,0.1)", border: "none", borderRadius: "50%",
                          width: "30px", height: "30px", cursor: "pointer", fontSize: "0.85rem"
                        }}>✏️</button>
                        <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }} title="Delete" style={{
                          background: "rgba(200,80,80,0.08)", border: "none", borderRadius: "50%",
                          width: "30px", height: "30px", cursor: "pointer", fontSize: "0.85rem"
                        }}>🗑</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
