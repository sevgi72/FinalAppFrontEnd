/* ═══════════════════════════════════════════════════════════════
   currency.js — Display valyutasi (ortaq modul)
   ─────────────────────────────────────────────────────────────
   MENTIQ:
   - Butun data backend-de AZN-dir. Bu modul YALNIZ gosterisi cevirir.
   - Kocurme/depozit input-lari HEMISHE AZN qalir (money() onlara toxunmur).
   - Mezenne backend /api/Currency/rates-den bir defe cekilir, saxlanir.
   - Backend qapaliisa fallback: AZN gosterir (cokme yoxdur).

   ISTIFADE:
   - money(azn)        → "2,231.00 $" (secilen valyutaya cevrilmis, simvollu)
   - moneyNum(azn)     → 2231.00      (yalniz reqem, seceilen valyutada)
   - symbol()          → "$"          (secilen valyutanin simvolu)
   - getCurrency()     → "USD"
   - setCurrency(code) → saxlayir + reload
   - initCurrency()    → mezenneleri cekir (sehife yuklenende cagirilir)
   ═══════════════════════════════════════════════════════════════ */

// Baza API unvani (sehifelerdeki API_BASE ile eyni)
const CUR_API_BASE = "http://localhost:5150";

// Valyuta simvollari
const CUR_SYMBOLS = {
  AZN: "\u20bc",  // ₼
  USD: "$",
  EUR: "\u20ac",  // €
  TRY: "\u20ba",  // ₺
};

// Fallback mezenneler (backend cekilmese) — 1 vahid = ne qeder AZN
const CUR_FALLBACK = {
  AZN: 1.00,
  USD: 1.70,
  EUR: 1.85,
  TRY: 0.05,
};

// Cari mezenneler (backend-den gelen; ilk anda fallback)
let CUR_RATES = { ...CUR_FALLBACK };

// ── Secilen valyuta (localStorage-da saxlanir) ──
function getCurrency() {
  return localStorage.getItem("currency") || "AZN";
}

function setCurrency(code) {
  const cur = getCurrency();
  if (code !== cur) {
    localStorage.setItem("currency", code);
    location.reload();  // sehife yenilensin ki, butun meblegler tezeden render olsun
  }
}

// ── Simvol ──
function symbol(code) {
  return CUR_SYMBOLS[code || getCurrency()] || "\u20bc";
}

// ── Mezenneni backend-den cek (bir defe, sehife yuklenende) ──
async function initCurrency() {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(CUR_API_BASE + "/api/Currency/rates", {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    if (res.ok) {
      const data = await res.json();
      // data.rates: [{ code, name, rateToAzn }]
      const fresh = {};
      (data.rates || []).forEach(r => { fresh[r.code] = r.rateToAzn; });
      if (Object.keys(fresh).length) CUR_RATES = { ...CUR_FALLBACK, ...fresh };
    }
  } catch (e) {
    // backend qapaliisa fallback qalir — cokme yoxdur
    console.warn("Currency rates fetch failed, using fallback:", e);
  }
}

// ── Esas cevirme: AZN meblegi → secilen valyutada reqem ──
function moneyNum(azn) {
  const cur = getCurrency();
  if (cur === "AZN") return Number(azn ?? 0);
  const rateFrom = CUR_RATES["AZN"] || 1;   // 1
  const rateTo = CUR_RATES[cur] || 1;
  // azn → hedef: azn * (rateAZN / rateTarget) = azn / rateTo
  return Number(azn ?? 0) * (rateFrom / rateTo);
}

// ── AZN meblegi → formatlanmis metn (simvollu) ──
// nl2: "az-AZ" formati (min ayirici, 2 onluq)
function money(azn, withSymbol = true) {
  const cur = getCurrency();
  const val = moneyNum(azn);
  const formatted = Number(val).toLocaleString("az-AZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `${formatted} ${symbol(cur)}` : formatted;
}

// ── Valyuta duymelerini aktiv/passiv goster ──
function updateCurrencyButtons() {
  const cur = getCurrency();
  // Kohne stil (segmented) duymeler — geriye uygunluq ucun
  document.querySelectorAll("[data-cur]").forEach(btn => {
    const on = btn.dataset.cur === cur;
    if (btn.classList.contains("cur-opt")) {
      // dropdown daxili secim
      btn.className = "cur-opt flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-500 transition " +
        (on ? "bg-neon/12 text-teal-700" : "text-ink/60 hover:bg-mist");
    } else if (btn.classList.contains("cur-btn")) {
      btn.className = "cur-btn px-2.5 py-1.5 rounded-lg text-xs font-500 transition " +
        (on ? "bg-ink text-white" : "text-ink/40 hover:text-ink");
    }
  });
  // dropdown trigger etiketini yenile
  const lbl = document.getElementById("curTriggerLabel");
  if (lbl) lbl.textContent = symbol(cur) + " " + cur;
}

// ── Sehife yuklenende: duymeleri qur ──
document.addEventListener("DOMContentLoaded", () => {
  updateCurrencyButtons();

  // Segmented ve dropdown-daxili valyuta duymeleri
  document.querySelectorAll("[data-cur]").forEach(btn => {
    btn.addEventListener("click", () => setCurrency(btn.dataset.cur));
  });

  // Valyuta dropdown ac/bagla
  const curTrigger = document.getElementById("curTrigger");
  const curMenu = document.getElementById("curMenu");
  if (curTrigger && curMenu) {
    curTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      curMenu.classList.toggle("hidden");
      // dil menyusu aciqdirsa bagla
      const lm = document.getElementById("langMenu");
      if (lm) lm.classList.add("hidden");
    });
  }

  // Dil dropdown ac/bagla
  const langTrigger = document.getElementById("langTrigger");
  const langMenu = document.getElementById("langMenu");
  if (langTrigger && langMenu) {
    langTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      langMenu.classList.toggle("hidden");
      if (curMenu) curMenu.classList.add("hidden");
    });
    // dil trigger etiketi
    const ll = document.getElementById("langTriggerLabel");
    if (ll && typeof getLang === "function") ll.textContent = getLang().toUpperCase();
  }

  // kenara klik - hamisi baglan
  document.addEventListener("click", () => {
    if (curMenu) curMenu.classList.add("hidden");
    if (langMenu) langMenu.classList.add("hidden");
  });
});