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

  /* ── DEMO CAVABLAR ─────────────────────────────────────────
     Gemini API xarici kvota sebebi ile elcatmaz olduqda, koməkci
     bank mövzusunda hazir cavablar gösterir. Acar sözlere gore
     uygun cavab secilir. ──────────────────────────────────────*/
  const DEMO_ANSWERS = [
    { keys: ["round", "yuvarlaq", "qepik", "qəpik", "yığ", "yig"], a: "Round-up (qəpik yığımı) hər alışınızı yuxarı yuvarlaqlaşdırıb aradakı fərqi yığım hesabınıza atır. Məsələn 4.30 ₼ ödəsəniz, 5 ₼-ə yuvarlaqlaşır və 0.70 ₼ avtomatik yığılır. 'Ayarlar' bölməsindən xərc və yığım hesabını seçib aktivləşdirin. İstədiyiniz vaxt söndürə bilərsiniz — ayarlarınız qalır." },
    { keys: ["çıxarış", "cixaris", "statement", "hesab çıx", "extract"], a: "Hesab çıxarışını 'Çıxarış' bölməsindən yarada bilərsiniz. Hesabı və tarix aralığını seçin — sistem əməliyyatlarınızı PDF formatında hazırlayır və yükləmək mümkündür. Çıxarışda hər əməliyyatdan sonrakı balans da göstərilir." },
    { keys: ["limit", "kart limit", "gündəlik", "aylıq limit"], a: "Kart və hesab limitlərini 'Ayarlar' bölməsindən tənzimləyə bilərsiniz. Gündəlik, aylıq və illik limit təyin etmək olar. Hər limitin istifadə faizi rəngli zolaqla göstərilir. Limit qoymasanız, standart limit tətbiq olunur." },
    { keys: ["2fa", "iki mərhələ", "iki merhele", "təhlükəsiz", "tehlukesiz", "otp", "kod gəlir"], a: "İki mərhələli doğrulamanı (2FA) 'Ayarlar' bölməsindən aktivləşdirin. Aktiv olduqda, hər girişdə emailinizə 6 rəqəmli kod gəlir — bu, hesabınıza əlavə qorunma verir. Parolunuz oğurlansa belə, kodsuz giriş mümkün olmur." },
    { keys: ["kredit", "loan", "borc", "kredit al"], a: "Kredit üçün 'Kreditlər' bölməsindən müraciət edə bilərsiniz. Məbləği (500-50000 ₼) və müddəti (6-36 ay) seçin, təxmini aylıq ödənişi dərhal görəcəksiniz. Müraciət admin tərəfindən yoxlanıb təsdiqlənir. Təsdiqlənəndə məbləğ hesabınıza köçürülür." },
    { keys: ["əmanət", "emanet", "deposit", "faiz"], a: "Əmanət açmaq üçün 'Əmanət' bölməsinə keçin. Minimum 10 ₼-dən açılır, illik 12% faiz qazandırır. Faiz hər ay avtomatik hesablanır və əsas məbləğdən ayrı göstərilir. İstədiyiniz vaxt bağlaya bilərsiniz — əsas məbləğ və qazanılan faiz birlikdə hesabınıza qayıdır." },
    { keys: ["köçür", "kocur", "transfer", "pul gönd", "pul gond", "iban"], a: "Pul köçürmək üçün 'Köçürmələr' bölməsindən istifadə edin. IBAN ilə başqa hesaba, öz hesablarınız arasında və ya kart nömrəsi ilə köçürmə edə bilərsiniz. Tez-tez köçürdüyünüz alıcıları 'sevimlilər'ə əlavə edib bir kliklə seçə bilərsiniz." },
    { keys: ["kod", "nağd", "nagd", "cashbycode", "kartsız", "kartsiz"], a: "Kodla nağdlaşdırma kartsız pul göndərməyə imkan verir. 'Kodla nağd' bölməsindən məbləği seçib 8 rəqəmli kod yaradırsınız. Pul dərhal rezerv olunur. Alıcı bu kodla pulu götürür. Kod 72 saat keçərlidir — götürülməsə, pul avtomatik geri qayıdır. İstədiyiniz vaxt ləğv edə bilərsiniz." },
    { keys: ["keşbek", "kesbek", "cashback", "bonus"], a: "Keşbek kommunal ödənişlərdə 5%, nağd çıxarışda 1% bonus qazandırır. Toplanan keşbek balansını istənilən vaxt əsas hesabınıza köçürə bilərsiniz. Keşbek balansınızı 'Panel'də görə bilərsiniz." },
    { keys: ["kommunal", "ödəniş", "odenis", "utility", "işıq", "qaz", "su"], a: "Kommunal ödənişləri 'Ödənişlər' bölməsindən edə bilərsiniz. Provayderi (işıq, qaz, su və s.) seçin, abunəçi kodunu daxil edin — borcu görüb ödəyə bilərsiniz. Üstəlik hər ödənişdə 5% keşbek qazanırsınız. Qəbzi PDF kimi saxlaya bilərsiniz." },
    { keys: ["yığım məqsəd", "savings", "hədəf", "hedef", "goal", "məqsəd"], a: "Yığım məqsədi qoymaq üçün 'Yığım' bölməsinə keçin. Hədəf məbləği təyin edin (məs. tətil, avtomobil) — sistem irəliləyişinizi faizlə izləyir və məqsədə çatmağınıza kömək edir." },
    { keys: ["hesab aç", "yeni hesab", "hesab yarat", "account"], a: "Yeni hesab açmaq üçün 'Kartlar' və ya hesablar bölməsindən istifadə edin. Fərqli valyutalarda (AZN, USD, EUR, TRY) hesab aça bilərsiniz. Hər hesabın öz IBAN nömrəsi olur." },
    { keys: ["kart", "card", "kart yarat", "yeni kart"], a: "Kartlarınızı 'Kartlar' bölməsindən idarə edə bilərsiniz. Yeni kart yaratmaq, mövcud kartlara baxmaq və kartı bloklamaq/açmaq mümkündür." },
    { keys: ["valyuta", "məzənnə", "mezenne", "currency", "dollar", "avro", "usd", "eur"], a: "Valyuta məzənnələrini 'Panel'dəki valyuta bölməsində görə bilərsiniz. USD, EUR, TRY məzənnələri göstərilir. Mini kalkulyator ilə istənilən məbləği bir valyutadan digərinə çevirə bilərsiniz." },
    { keys: ["bildiriş", "bildiris", "notification", "xəbərdarlıq", "xeberdarliq", "alert"], a: "Bildirişləri 'Panel'in yuxarısındakı zəng ikonundan görə bilərsiniz. Aşağı balans xəbərdarlığı qurmaq üçün 'Ayarlar'da hədd təyin edin — balansınız bu həddin altına düşəndə bildiriş alırsınız." },
    { keys: ["profil", "profile", "ad dəyiş", "ad deyis", "şəkil", "sekil", "foto"], a: "Profil məlumatlarınızı 'Ayarlar' bölməsindən yeniləyə bilərsiniz — ad, telefon nömrəsi və profil şəkli. Şəkil dəyişmək üçün avatarın üstünə gəlib kamera ikonuna basın. Email dəyişdirilə bilməz (təhlükəsizlik səbəbi)." },
    { keys: ["parol", "password", "parol dəyiş", "parol unut", "şifrə"], a: "Parolu dəyişmək üçün 'Ayarlar' bölməsindən istifadə edin. Parolu unutmusunuzsa, giriş səhifəsində 'Parolu unutdum' seçin — emailinizə sıfırlama kodu göndəriləcək." },
    { keys: ["dəstək", "destek", "support", "kömək", "komek", "help"], a: "Dəstək üçün 'Panel'dəki söhbət funksiyasından istifadə edə bilərsiniz — operatorla real vaxtda yazışa bilərsiniz. Həmçinin mən, Amora AI, ümumi suallarınıza kömək edirəm." },
    { keys: ["analitika", "analytics", "xərc", "xerc", "statistika"], a: "Xərclərinizin analitikasını 'Analitika' bölməsində görə bilərsiniz. Kateqoriyalar üzrə xərc bölgüsü, aylıq müqayisə və qrafiklərlə maliyyə mənzərənizi izləyə bilərsiniz." },
    { keys: ["planlaşdır", "planlasdir", "scheduled", "avtomatik ödəniş", "təkrar"], a: "Təkrarlanan ödənişləri planlaşdıra bilərsiniz — sistem təyin etdiyiniz tarixdə avtomatik ödəyir. Bu, kommunal və ya abunə ödənişləri üçün əlverişlidir." },
    { keys: ["google", "google ilə", "google giriş"], a: "Google hesabınızla da daxil ola bilərsiniz. Giriş səhifəsində 'Google ilə davam et' düyməsinə basın — Google hesabınızı seçib sürətlə giriş edin." },
    { keys: ["dil", "language", "azərbaycan", "english", "rus"], a: "Tətbiqin dilini AZ, EN və RU arasında dəyişə bilərsiniz. Dil seçimi 'Ayarlar'da və ya sağ yuxarıdakı profil menyusundadır." },
    { keys: ["blok", "block", "kart blok", "hesab blok"], a: "Kartınızı və ya hesabınızı təhlükəsizlik üçün müvəqqəti bloklaya bilərsiniz. Bu, kartınız itsə faydalıdır. Sonradan yenidən aktivləşdirə bilərsiniz." },
    { keys: ["qəbz", "qebz", "receipt", "pdf"], a: "Hər əməliyyat və ödəniş üçün PDF qəbz yükləyə bilərsiniz. Əməliyyat tarixçəsində və ya ödəniş detalında 'Qəbz' düyməsindən istifadə edin." },
    { keys: ["salam", "salm", "hi", "hello", "necəsən", "kimsən", "kim"], a: "Salam! Mən Amora AI-yam — Amorabank-ın köməkçisiyəm. Hesab, köçürmə, əmanət, kredit, kommunal ödəniş, kodla nağd, round-up yığım və digər xidmətlər haqda soruşa bilərsiniz. Necə kömək edim?" },
  ];

  function findDemoAnswer(q) {
    const low = q.toLowerCase();
    for (const item of DEMO_ANSWERS) {
      if (item.keys.some(k => low.includes(k))) return item.a;
    }
    // uygun tapilmasa — umumi cavab
    return "Amorabank-da bu xidmətlər var: hesablar, köçürmələr, əmanət, kredit, kommunal ödəniş, kodla nağdlaşdırma, round-up yığım, keşbek, yığım məqsədləri, kart idarəsi və analitika. Hansı mövzuda kömək lazımdır? Məsələn: 'Round-up nədir?', 'Kredit necə alıram?', '2FA-nı necə aktivləşdirim?'";
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
      const response = await fetch('http://localhost:5150/api/Ai/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Token istifadə edirsinizsə
          'Accept-Language': 'az'
        },
        body: JSON.stringify({ question: userMessage })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Backend Xətası:', errorData); // <-- Əsl xəta buradadır!
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Gemini API elcatmaz olduqda (kvota/xeta) — demo cavaba kec.
        // Beleliklede komekci hemise cavab verir, bosh qalmir.
        history.push({ role: "ai", text: findDemoAnswer(q) });
      } else {
        history.push({ role: "ai", text: data.answer || findDemoAnswer(q) });
      }
    } catch (e) {
      // Server elcatmaz olsa da demo cavab goster
      history.push({ role: "ai", text: findDemoAnswer(q) });
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