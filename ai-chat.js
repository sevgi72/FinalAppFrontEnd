/* ══════════════════════════════════════════════════════════════
   AMORABANK — AI KOMEKCI (Gemini)
   Istifadesi: <script src="ai-chat.js"></script> — sehifeye elave et,
   qalanini ozu qurur (uzen duyme + panel).
   Sert: i18n.js daha evvel yuklenmeli, localStorage-da "token" olmalidir.
   ══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const AI_API_BASE = "http://localhost:5150";
  const getTok = () => localStorage.getItem("token");

  // token yoxdursa widget-i qurma (auth sehifesi ve s.)
  if (!getTok()) return;

  // t() hazir deyilse sade fallback
  const tr = (k, fallback) => (typeof t === "function" && t(k) !== k) ? t(k) : fallback;

  let history = [];      // {role:"user"|"ai", text:string}
  let busy = false;

  /* ── 1. HTML-i qur ───────────────────────────────────────── */
  const root = document.createElement("div");
  root.innerHTML = `
    <!-- Uzen duyme -->
    <button id="aiFab" type="button" aria-label="AI"
      class="fixed z-40 bottom-20 lg:bottom-5 right-5 w-14 h-14 rounded-2xl
             bg-gradient-to-br from-neon to-lilac shadow-lg shadow-lilac/30
             grid place-items-center hover:scale-105 active:scale-95 transition">
      <i data-lucide="sparkles" style="width:22px;height:22px" class="text-ink-2"></i>
    </button>

    <!-- Panel -->
    <div id="aiPanel"
      class="hidden fixed z-50 bottom-20 lg:bottom-5 right-5 w-[380px] max-w-[calc(100vw-2.5rem)]
             bg-white rounded-2xl border border-line shadow-2xl shadow-ink/20 flex flex-col"
      style="height:520px; max-height:calc(100vh-8rem)">

      <!-- Basliq -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-line shrink-0">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-neon to-lilac grid place-items-center shrink-0">
          <i data-lucide="sparkles" style="width:17px;height:17px" class="text-ink-2"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-display font-600 text-ink text-sm leading-tight">Amora AI</p>
          <p class="text-[11px] text-ink/45" id="aiStatus">${tr("ai.ready", "Sualınızı yazın")}</p>
        </div>
        <button id="aiClear" type="button" title="${tr("ai.clear", "Təmizlə")}"
          class="w-8 h-8 grid place-items-center rounded-lg hover:bg-mist text-ink/40 hover:text-ink transition">
          <i data-lucide="rotate-ccw" style="width:15px;height:15px"></i>
        </button>
        <button id="aiClose" type="button"
          class="w-8 h-8 grid place-items-center rounded-lg hover:bg-mist text-ink/50 transition">
          <i data-lucide="x" style="width:17px;height:17px"></i>
        </button>
      </div>

      <!-- Mesajlar -->
      <div id="aiBody" class="flex-1 overflow-y-auto px-4 py-4 space-y-3"></div>

      <!-- Input -->
      <form id="aiForm" class="p-3 border-t border-line shrink-0 flex gap-2">
        <input id="aiInput" type="text" maxlength="1000" autocomplete="off"
          placeholder="${tr("ai.placeholder", "Məsələn: Çıxarışı necə yaradıram?")}"
          class="flex-1 h-11 px-3.5 rounded-xl border border-line bg-mist text-sm
                 focus:border-neon focus:bg-white outline-none transition">
        <button type="submit" id="aiSend"
          class="w-11 h-11 shrink-0 rounded-xl bg-ink text-white grid place-items-center
                 hover:bg-ink-2 active:scale-95 disabled:opacity-50 transition">
          <i data-lucide="send" style="width:16px;height:16px"></i>
        </button>
      </form>
    </div>`;
  document.body.appendChild(root);

  const $ = (id) => document.getElementById(id);
  const panel = $("aiPanel"), bodyEl = $("aiBody"), input = $("aiInput"), sendBtn = $("aiSend");

  /* ── 2. Render ───────────────────────────────────────────── */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // sade formatlama: **qalin** ve setir kecidi
  function fmt(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  const SUGGESTIONS = [
    ["ai.s1", "Hesab çıxarışını necə yaradıram?"],
    ["ai.s2", "Round-up nədir?"],
    ["ai.s3", "Kartıma limit necə qoyuram?"],
    ["ai.s4", "2FA-nı necə aktivləşdirim?"],
  ];

  function render() {
    if (!history.length) {
      bodyEl.innerHTML = `
        <div class="py-6 text-center">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon/15 to-lilac/15 grid place-items-center mx-auto mb-3">
            <i data-lucide="sparkles" style="width:22px;height:22px" class="text-lilac"></i>
          </div>
          <p class="font-display font-600 text-ink text-sm">${tr("ai.welcome", "Salam! Mən Amora AI-yam")}</p>
          <p class="text-[12px] text-ink/45 mt-1 px-4">${tr("ai.welcomeHint", "Bank əməliyyatları haqqında soruşun")}</p>
        </div>
        <div class="space-y-2">
          ${SUGGESTIONS.map(([k, d]) => {
            const q = tr(k, d);
            return `<button type="button" class="ai-sug w-full text-left px-3.5 py-2.5 rounded-xl border border-line
                      text-[12px] text-ink/70 hover:border-neon hover:bg-neon/5 transition">${escapeHtml(q)}</button>`;
          }).join("")}
        </div>`;
      bodyEl.querySelectorAll(".ai-sug").forEach(b => {
        b.onclick = () => { input.value = b.textContent.trim(); ask(); };
      });
      if (window.lucide) lucide.createIcons();
      return;
    }

    bodyEl.innerHTML = history.map(m => m.role === "user"
      ? `<div class="flex justify-end">
           <div class="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-ink text-white text-[13px] leading-relaxed">
             ${escapeHtml(m.text)}
           </div>
         </div>`
      : `<div class="flex gap-2">
           <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-neon to-lilac grid place-items-center shrink-0 mt-0.5">
             <i data-lucide="sparkles" style="width:13px;height:13px" class="text-ink-2"></i>
           </div>
           <div class="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-mist text-ink-2 text-[13px] leading-relaxed">
             ${fmt(m.text)}
           </div>
         </div>`).join("");

    if (busy) {
      bodyEl.insertAdjacentHTML("beforeend", `
        <div class="flex gap-2" id="aiTyping">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-neon to-lilac grid place-items-center shrink-0">
            <i data-lucide="sparkles" style="width:13px;height:13px" class="text-ink-2"></i>
          </div>
          <div class="px-3.5 py-3 rounded-2xl rounded-bl-md bg-mist flex gap-1 items-center">
            <span class="w-1.5 h-1.5 rounded-full bg-ink/30 animate-bounce" style="animation-delay:0ms"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-ink/30 animate-bounce" style="animation-delay:150ms"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-ink/30 animate-bounce" style="animation-delay:300ms"></span>
          </div>
        </div>`);
    }

    if (window.lucide) lucide.createIcons();
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  /* ── 3. Sual gonder — POST /api/Ai/ask ───────────────────── */
  async function ask() {
    const q = input.value.trim();
    if (!q || busy) return;

    history.push({ role: "user", text: q });
    input.value = "";
    busy = true;
    sendBtn.disabled = true;
    $("aiStatus").textContent = tr("ai.thinking", "Düşünür…");
    render();

    try {
      const res = await fetch(AI_API_BASE + "/api/Ai/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": (typeof getLang === "function" ? getLang() : "az"),
          "Authorization": "Bearer " + getTok(),
        },
        body: JSON.stringify({ question: q }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // 429 = rate limit, 400 = servis xetasi (mes. Gemini yuklu)
        const msg = res.status === 429
          ? tr("ai.tooMany", "Çox sürətli yazırsınız. Bir dəqiqə gözləyin.")
          : (data.error || data.message || tr("ai.failed", "Cavab alınmadı. Yenidən cəhd edin."));
        history.push({ role: "ai", text: msg });
      } else {
        history.push({ role: "ai", text: data.answer || tr("ai.failed", "Cavab alınmadı.") });
      }
    } catch (e) {
      history.push({ role: "ai", text: tr("ai.offline", "Serverə qoşulmaq mümkün olmadı.") });
    } finally {
      busy = false;
      sendBtn.disabled = false;
      $("aiStatus").textContent = tr("ai.ready", "Sualınızı yazın");
      render();
    }
  }

  /* ── 4. Hadiseler ────────────────────────────────────────── */
  $("aiFab").onclick = () => {
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
      render();
      setTimeout(() => input.focus(), 60);
    }
  };
  $("aiClose").onclick = () => panel.classList.add("hidden");
  $("aiClear").onclick = () => { history = []; render(); };
  $("aiForm").onsubmit = (e) => { e.preventDefault(); ask(); };

  // Escape ile bagla
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.classList.contains("hidden")) panel.classList.add("hidden");
  });

  if (window.lucide) lucide.createIcons();
  render();
})();