/* ==========================================================================
   DestTraky Official Website — Interactive Logic
   ========================================================================== */

(function () {
  "use strict";

  const root = document.documentElement;
  const metaThemeColor = document.getElementById("meta-theme-color");
  const iconMoon = document.getElementById("icon-moon");
  const iconSun = document.getElementById("icon-sun");
  const heroImg = document.getElementById("hero-dashboard-img");
  const heroPreviewToggle = document.getElementById("btn-hero-preview-theme");

  let heroPreviewDark = root.getAttribute("data-theme") === "dark";

  /* ---------- 1. Theme Switching (Warm Alabaster / Warm Obsidian) ---------- */

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("desttraky-site-theme", theme);
    } catch (_) {}

    const isDark = theme === "dark";
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", isDark ? "#0c0c0b" : "#f6f4ee");
    }
    if (iconMoon && iconSun) {
      iconMoon.style.display = isDark ? "none" : "block";
      iconSun.style.display = isDark ? "block" : "none";
    }

    // Sync hero dashboard screenshot with site theme
    heroPreviewDark = isDark;
    updateHeroPreview();

    // Sync showcase if current view supports dual theme
    if (showcaseViews[currentView] && showcaseViews[currentView].darkSrc) {
      showcaseDark = isDark;
      renderShowcase(currentView);
    }
  }

  function updateHeroPreview() {
    if (!heroImg || !heroPreviewToggle) return;
    if (heroPreviewDark) {
      heroImg.src = "assets/screenshots/overview-dark.png";
      heroImg.alt =
        "DestTraky Overview Dashboard in Warm Obsidian dark theme showing Active Time, Focus Score, 7-day hatched columns, Activity Mix, Top Applications, and Session Anatomy flower";
      heroPreviewToggle.textContent = "Switch to Light Preview";
    } else {
      heroImg.src = "assets/screenshots/overview-light.png";
      heroImg.alt =
        "DestTraky Overview Dashboard in Warm Alabaster light theme showing Active Time, Focus Score, 7-day hatched columns, Activity Mix, Top Applications, and Session Anatomy flower";
      heroPreviewToggle.textContent = "Switch to Dark Preview";
    }
  }

  const themeBtn = document.getElementById("btn-theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }

  if (heroPreviewToggle) {
    heroPreviewToggle.addEventListener("click", function () {
      heroPreviewDark = !heroPreviewDark;
      updateHeroPreview();
    });
  }

  /* ---------- 2. Interactive Dashboard Gallery ---------- */

  const showcaseViews = {
    "overview-bars": {
      badge: "Overview Studio",
      windowTitle: "DestTraky / Overview · Hatched Score Columns",
      title: "At-a-glance KPIs, Hatched Columns & Session Flower",
      desc: "Track Active Time, Focus Score (0–100), Productive Hours, and Context Switches/hr with equal-length period comparisons across Today, Yesterday, 7D, 30D, or Custom ranges.",
      lightSrc: "assets/screenshots/overview-light.png",
      darkSrc: "assets/screenshots/overview-dark.png",
      alt: "DestTraky Overview Dashboard showing 7-day hatched score columns, activity mix, top applications, and session anatomy flower",
      bullets: [
        "Hatched pill score columns with dashed average benchmark line",
        "4-tier Activity Mix bar (Deep Code, Productive, Neutral, Distracting)",
        "6-petal Session Anatomy flower & Top Applications micro-meters",
      ],
    },
    "overview-waves": {
      badge: "Ember Waves Mode",
      windowTitle: "DestTraky / Overview · Ember Waves (Warm Obsidian)",
      title: "Mirrored Ember Waves Visualization",
      desc: "Toggle from Hatched Columns to glowing mirrored Ember Waves to spot daily focus rhythms, deep-code peaks, and distraction drift across your week.",
      lightSrc: "assets/screenshots/overview-waves-dark.png",
      darkSrc: null,
      alt: "DestTraky Overview Dashboard in Warm Obsidian dark theme with mirrored Ember Waves chart",
      bullets: [
        "Instant one-click toggle between Bars and Waves right on Overview",
        "Smooth multi-category wave curves in Warm Amber, Brass, and Rust",
        "Pairs with live period deltas and Top Applications breakdown",
      ],
    },
    timeline: {
      badge: "Dual-Lane Timeline",
      windowTitle: "DestTraky / Timeline · Online, Idle & App Sessions",
      title: "Dual-Lane Timeline & Manual Task Log",
      desc: "Inspect every minute of your day across a zoomable (24h / 12h / 6h) dual-lane strip showing Online, Idle, and Offline presence directly above color-coded app blocks.",
      lightSrc: "assets/screenshots/timeline-light.png",
      darkSrc: "assets/screenshots/timeline-dark.png",
      alt: "DestTraky Dual-Lane Timeline showing Online and Idle state above color-coded application sessions and tag filters",
      bullets: [
        "Dual-lane State + Apps visualization with 24h, 12h, and 6h zoom",
        "Filter instantly by category, #tag, app name, or window title",
        "Log offline meetings or deep work manually with + Log Task",
      ],
    },
    rules: {
      badge: "Regex Rule Engine",
      windowTitle: "DestTraky / Rules · Regex Rules & Live Sandbox",
      title: "Deterministic Regex Rules & Live Rule Sandbox",
      desc: "Write substring or regular-expression rules evaluated in strict WindowTitle > AppName > Neutral order, attach custom #tags, and verify matches live before saving.",
      lightSrc: "assets/screenshots/rules-light.png",
      darkSrc: null,
      alt: "DestTraky Rules view with Live Rule Sandbox, priority-ordered regex and app rules, and custom tags",
      bullets: [
        "Test any app + window title live in the built-in Rule Sandbox",
        "Custom #tags plus automatic #Work Hours, #After Hours & #Weekend tags",
        "Process Ignore List for private apps and system utilities",
      ],
    },
    focus: {
      badge: "Focus Mode",
      windowTitle: "DestTraky / Focus · Pomodoro & Streak History",
      title: "Built-In Pomodoro Timer & 7-Day Streak History",
      desc: "Run customizable deep-work cycles with short and long breaks, daily completion targets, distraction alerts, and a visual 7-day focus minutes chart.",
      lightSrc: "assets/screenshots/focus-light.png",
      darkSrc: null,
      alt: "DestTraky Focus Mode showing 25-minute Pomodoro timer, 7-day streak badge, and 7D focus minutes bar chart",
      bullets: [
        "Configurable Focus, Short Break, and Long Break cycle durations",
        "Optional distraction alert when opening distracting apps mid-session",
        "Automatic streak tracking surfaced right in the top bar",
      ],
    },
    limits: {
      badge: "Daily Budgets",
      windowTitle: "DestTraky / Limits · App & Category Budgets",
      title: "Daily App & Category Time Budgets",
      desc: "Set gentle daily time caps for distracting categories or individual apps like Discord or Chrome, with live progress bars and warning/exceeded toast notifications.",
      lightSrc: "assets/screenshots/limits-light.png",
      darkSrc: null,
      alt: "DestTraky Limits view showing Used vs Budget horizontal chart and daily app and category budget cards",
      bullets: [
        "Used vs Budget overview chart for instant daily pacing",
        "Per-app and per-category daily minute limits with live remaining time",
        "Non-intrusive warning & exceeded notifications without hard lockouts",
      ],
    },
  };

  let currentView = "overview-bars";
  let showcaseDark = root.getAttribute("data-theme") === "dark";

  const showcaseImg = document.getElementById("showcase-main-img");
  const showcaseWindowTitle = document.getElementById("showcase-window-title");
  const showcaseBadge = document.getElementById("showcase-badge");
  const showcaseTitle = document.getElementById("showcase-title");
  const showcaseDesc = document.getElementById("showcase-desc");
  const showcaseBullets = document.getElementById("showcase-bullets");
  const showcaseThemeBtn = document.getElementById("btn-showcase-theme-toggle");

  function renderShowcase(viewKey) {
    const data = showcaseViews[viewKey];
    if (!data || !showcaseImg) return;
    currentView = viewKey;

    const useDark = Boolean(data.darkSrc && showcaseDark);
    showcaseImg.src = useDark ? data.darkSrc : data.lightSrc;
    showcaseImg.alt = data.alt;
    if (showcaseWindowTitle) {
      showcaseWindowTitle.textContent =
        data.windowTitle + (data.darkSrc ? (useDark ? " · Warm Obsidian" : " · Warm Alabaster") : "");
    }
    if (showcaseBadge) showcaseBadge.textContent = data.badge;
    if (showcaseTitle) showcaseTitle.textContent = data.title;
    if (showcaseDesc) showcaseDesc.textContent = data.desc;

    if (showcaseBullets) {
      showcaseBullets.innerHTML = data.bullets
        .map(
          (item) =>
            '<li><span class="bullet-dot"></span><span>' + item + "</span></li>"
        )
        .join("");
    }

    if (showcaseThemeBtn) {
      if (data.darkSrc) {
        showcaseThemeBtn.style.display = "inline-flex";
        showcaseThemeBtn.textContent = useDark ? "Switch to Light View" : "Switch to Dark View";
      } else {
        showcaseThemeBtn.style.display = "none";
      }
    }

    document.querySelectorAll(".showcase-tab").forEach(function (tab) {
      const active = tab.getAttribute("data-view") === viewKey;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });

    document.querySelectorAll(".thumb-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-view") === viewKey);
    });
  }

  document.querySelectorAll(".showcase-tab, .thumb-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const view = btn.getAttribute("data-view");
      if (view) renderShowcase(view);
    });
  });

  if (showcaseThemeBtn) {
    showcaseThemeBtn.addEventListener("click", function () {
      showcaseDark = !showcaseDark;
      renderShowcase(currentView);
    });
  }

  /* ---------- 3. Fullscreen Screenshot Lightbox ---------- */

  const lightboxModal = document.getElementById("lightbox-modal");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const btnCloseLightbox = document.getElementById("btn-close-lightbox");

  function openLightbox(src, alt, title) {
    if (!lightboxModal || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt;
    if (lightboxCaption) lightboxCaption.textContent = title || alt;
    lightboxModal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    if (!lightboxModal) return;
    lightboxModal.classList.remove("open");
    document.body.style.overflow = "";
  }

  function bindZoomTrigger(el, getPayload) {
    if (!el) return;
    el.addEventListener("click", function () {
      const p = getPayload();
      openLightbox(p.src, p.alt, p.title);
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const p = getPayload();
        openLightbox(p.src, p.alt, p.title);
      }
    });
  }

  bindZoomTrigger(document.getElementById("hero-screenshot-trigger"), function () {
    return {
      src: heroImg ? heroImg.src : "assets/screenshots/overview-light.png",
      alt: heroImg ? heroImg.alt : "DestTraky Overview Dashboard",
      title: heroPreviewDark
        ? "DestTraky / Overview (Warm Obsidian)"
        : "DestTraky / Overview (Warm Alabaster)",
    };
  });

  bindZoomTrigger(document.getElementById("showcase-screenshot-trigger"), function () {
    return {
      src: showcaseImg ? showcaseImg.src : "assets/screenshots/overview-light.png",
      alt: showcaseImg ? showcaseImg.alt : "DestTraky Dashboard",
      title: showcaseWindowTitle ? showcaseWindowTitle.textContent : "DestTraky Dashboard",
    };
  });

  if (btnCloseLightbox) btnCloseLightbox.addEventListener("click", closeLightbox);
  if (lightboxModal) {
    lightboxModal.addEventListener("click", function (e) {
      if (e.target === lightboxModal) closeLightbox();
    });
  }

  /* ---------- 4. Interactive Live Rule Sandbox ---------- */

  const SANDBOX_RULES = [
    { match: "title", isRegex: true, pattern: "PR #\\d+|pull/\\d+", tag: "#code-review", category: "Productive", cls: "productive", priority: 40 },
    { match: "title", isRegex: false, pattern: "github", tag: "#git", category: "Productive", cls: "productive", priority: 35 },
    { match: "title", isRegex: false, pattern: "figma", tag: "#design", category: "Productive", cls: "productive", priority: 35 },
    { match: "title", isRegex: false, pattern: "linear", tag: "#planning", category: "Productive", cls: "productive", priority: 30 },
    { match: "title", isRegex: false, pattern: "youtube", tag: "#video", category: "Distracting", cls: "distracting", priority: 30 },
    { match: "title", isRegex: false, pattern: "reddit", tag: "#social", category: "Distracting", cls: "distracting", priority: 30 },
    { match: "app", isRegex: false, pattern: "code.exe", tag: "#coding", category: "Deep Code", cls: "deep-code", priority: 20 },
    { match: "app", isRegex: false, pattern: "windowsterminal.exe", tag: "#cli", category: "Productive", cls: "productive", priority: 20 },
    { match: "app", isRegex: false, pattern: "figma.exe", tag: "#design", category: "Productive", cls: "productive", priority: 15 },
    { match: "app", isRegex: false, pattern: "obsidian.exe", tag: "#notes", category: "Productive", cls: "productive", priority: 15 },
    { match: "app", isRegex: false, pattern: "discord.exe", tag: "#chat", category: "Distracting", cls: "distracting", priority: 15 },
    { match: "app", isRegex: false, pattern: "slack.exe", tag: "#comms", category: "Neutral", cls: "neutral", priority: 10 },
  ];

  function getScheduleTag() {
    const now = new Date();
    const day = now.getDay();
    const hr = now.getHours();
    if (day === 0 || day === 6) return "#Weekend";
    if (hr >= 9 && hr < 18) return "#Work Hours";
    if (hr >= 22 || hr < 6) return "#Late Night";
    return "#After Hours";
  }

  function ruleMatches(rule, text) {
    if (!text) return false;
    if (rule.isRegex) {
      try {
        return new RegExp(rule.pattern, "i").test(text);
      } catch (_) {
        return false;
      }
    }
    return text.toLowerCase().includes(rule.pattern.toLowerCase());
  }

  const sandboxApp = document.getElementById("sandbox-app-input");
  const sandboxTitle = document.getElementById("sandbox-title-input");
  const sandboxBadge = document.getElementById("sandbox-category-badge");
  const sandboxCatText = document.getElementById("sandbox-category-text");
  const sandboxMatchText = document.getElementById("sandbox-rule-match");
  const sandboxTags = document.getElementById("sandbox-tags");

  function evaluateSandbox() {
    if (!sandboxApp || !sandboxTitle) return;
    const appVal = sandboxApp.value.trim();
    const titleVal = sandboxTitle.value.trim();

    const titleMatches = SANDBOX_RULES.filter((r) => r.match === "title" && ruleMatches(r, titleVal)).sort(
      (a, b) => b.priority - a.priority
    );
    const appMatches = SANDBOX_RULES.filter((r) => r.match === "app" && ruleMatches(r, appVal)).sort(
      (a, b) => b.priority - a.priority
    );

    const winner = titleMatches[0] || appMatches[0] || null;
    const allTags = new Set();
    titleMatches.forEach((r) => allTags.add(r.tag));
    appMatches.forEach((r) => allTags.add(r.tag));
    allTags.add(getScheduleTag());

    if (sandboxBadge && sandboxCatText && sandboxMatchText) {
      if (winner) {
        sandboxBadge.className = "cat-badge " + winner.cls;
        sandboxCatText.textContent = winner.category;
        const kind = winner.match === "title" ? (winner.isRegex ? "TITLE REGEX" : "TITLE") : "APP";
        sandboxMatchText.innerHTML =
          "matched via " + kind + " <code>" + winner.pattern + "</code> (priority " + winner.priority + ")";
      } else {
        sandboxBadge.className = "cat-badge neutral";
        sandboxCatText.textContent = "Neutral";
        sandboxMatchText.textContent = "No rule matched — defaulted to Neutral";
      }
    }

    if (sandboxTags) {
      sandboxTags.innerHTML = Array.from(allTags)
        .map((t) => '<span class="tag-pill">' + t + "</span>")
        .join("");
    }
  }

  if (sandboxApp && sandboxTitle) {
    sandboxApp.addEventListener("input", evaluateSandbox);
    sandboxTitle.addEventListener("input", evaluateSandbox);
    evaluateSandbox();
  }

  document.querySelectorAll(".preset-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      if (!sandboxApp || !sandboxTitle) return;
      sandboxApp.value = chip.getAttribute("data-app") || "";
      sandboxTitle.value = chip.getAttribute("data-title") || "";
      evaluateSandbox();
    });
  });

  /* ---------- 5. FAQ Accordion ---------- */

  document.querySelectorAll(".faq-trigger").forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      const item = trigger.closest(".faq-item");
      if (!item) return;
      const isOpen = item.classList.toggle("open");
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  });

  /* ---------- 6. Copy Build Command ---------- */

  const btnCopyBuild = document.getElementById("btn-copy-build");
  const buildCmdText = document.getElementById("build-cmd-text");
  if (btnCopyBuild && buildCmdText) {
    btnCopyBuild.addEventListener("click", function () {
      const text = buildCmdText.textContent || "";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          btnCopyBuild.textContent = "Copied!";
          setTimeout(function () {
            btnCopyBuild.textContent = "Copy Command";
          }, 1800);
        });
      }
    });
  }

  /* ---------- 7. Mobile Navigation Drawer ---------- */

  const mobileMenuBtn = document.getElementById("btn-mobile-menu");
  const mobileNav = document.getElementById("mobile-nav");
  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener("click", function () {
      const open = mobileNav.classList.toggle("open");
      mobileMenuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobileNav.classList.remove("open");
        mobileMenuBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- 8. ⌘K / Ctrl+K Quick Jump Palette ---------- */

  const cmdModal = document.getElementById("cmd-modal");
  const cmdInput = document.getElementById("cmd-input");
  const cmdList = document.getElementById("cmd-list");
  const btnOpenCmd = document.getElementById("btn-open-cmd");

  const CMD_ITEMS = [
    { label: "Download DestTraky for Windows (3.5 MB)", hint: "#download", action: () => jumpTo("#download") },
    { label: "Explore Dashboard Gallery", hint: "#dashboards", action: () => jumpTo("#dashboards") },
    { label: "Preview Ember Waves (Dark)", hint: "Dashboard", action: () => { renderShowcase("overview-waves"); jumpTo("#dashboards"); } },
    { label: "Preview Dual-Lane Timeline", hint: "Dashboard", action: () => { renderShowcase("timeline"); jumpTo("#dashboards"); } },
    { label: "Try Interactive Rule Sandbox", hint: "#sandbox", action: () => jumpTo("#sandbox") },
    { label: "Compare vs RescueTime & Toggl", hint: "#compare", action: () => jumpTo("#compare") },
    { label: "Open-Source Architecture", hint: "#architecture", action: () => jumpTo("#architecture") },
    { label: "Frequently Asked Questions", hint: "#faq", action: () => jumpTo("#faq") },
    { label: "Switch Light / Dark Theme", hint: "Theme", action: () => applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark") },
    { label: "Open GitHub Repository", hint: "github.com", action: () => window.open("https://github.com/Waqar-743/DestTraky", "_blank", "noopener") },
    { label: "More Tools by Waqar Ahmed", hint: "waqarahmed.live", action: () => jumpTo("#ecosystem") },
  ];

  function jumpTo(hash) {
    const target = document.querySelector(hash);
    if (target) target.scrollIntoView({ behavior: "smooth" });
  }

  function renderCmdList(query) {
    if (!cmdList) return;
    const q = (query || "").trim().toLowerCase();
    const filtered = CMD_ITEMS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q)
    );
    cmdList.innerHTML = "";
    filtered.forEach(function (item) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cmd-item";
      btn.innerHTML = "<span>" + item.label + "</span><span>" + item.hint + "</span>";
      btn.addEventListener("click", function () {
        closeCmd();
        item.action();
      });
      li.appendChild(btn);
      cmdList.appendChild(li);
    });
  }

  function openCmd() {
    if (!cmdModal || !cmdInput) return;
    cmdModal.classList.add("open");
    document.body.style.overflow = "hidden";
    cmdInput.value = "";
    renderCmdList("");
    setTimeout(function () {
      cmdInput.focus();
    }, 30);
  }

  function closeCmd() {
    if (!cmdModal) return;
    cmdModal.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (btnOpenCmd) btnOpenCmd.addEventListener("click", openCmd);
  if (cmdInput) {
    cmdInput.addEventListener("input", function () {
      renderCmdList(cmdInput.value);
    });
  }
  if (cmdModal) {
    cmdModal.addEventListener("click", function (e) {
      if (e.target === cmdModal) closeCmd();
    });
  }

  window.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (cmdModal && cmdModal.classList.contains("open")) closeCmd();
      else openCmd();
    } else if (e.key === "Escape") {
      closeLightbox();
      closeCmd();
    }
  });

  /* ---------- 9. Live GitHub Release & Stars Hydration (Graceful Fallback) ---------- */

  fetch("https://api.github.com/repos/Waqar-743/DestTraky")
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (repo) {
      if (!repo) return;
      const starLabel = document.getElementById("github-star-label");
      if (starLabel && typeof repo.stargazers_count === "number" && repo.stargazers_count > 0) {
        starLabel.textContent = "GitHub · " + repo.stargazers_count + " ★";
      }
    })
    .catch(function () {});

  // Initialize theme icons & showcase on load
  applyTheme(root.getAttribute("data-theme") || "light");
})();
