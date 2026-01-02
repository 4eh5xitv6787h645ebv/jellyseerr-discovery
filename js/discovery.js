// Jellyseerr Discovery - Actor Filmography & Studio Catalogs
// Shows content from Jellyseerr/TMDb on Person and Studio pages
(() => {
  "use strict";

  const CONFIG = {
    enabled: true,
    apiBase: "JellyseerrDiscovery",
    pollMs: 300,
    pollMax: 25,
  };

  if (!CONFIG.enabled) return;
  if (window.__JellyseerrDiscoveryV2) return;
  window.__JellyseerrDiscoveryV2 = true;

  const log = (...a) => pluginConfig?.DebugMode && console.log("[Discovery]", ...a);

  let lastUrl = "";
  let isProcessing = false;

  function apiReady() {
    return !!(window.ApiClient && ApiClient.getUrl && ApiClient.accessToken);
  }

  function getTokenHeaders() {
    const t = ApiClient.accessToken?.();
    const h = { Accept: "application/json" };
    if (t) { h["X-Emby-Token"] = t; h["X-MediaBrowser-Token"] = t; }
    return h;
  }

  async function fetchJson(url) {
    try {
      const res = await fetch(url, { credentials: "same-origin", headers: getTokenHeaders() });
      return res.ok ? res.json() : null;
    } catch { return null; }
  }

  function getHashParams() {
    const hash = window.location.hash || "";
    const q = hash.includes("?") ? hash.split("?")[1] : "";
    try { return q ? new URLSearchParams(q) : null; } catch { return null; }
  }

  async function getItemInfo(itemId) {
    if (!itemId) return null;
    const uid = ApiClient.getCurrentUserId?.();
    if (!uid) return null;
    try { return await ApiClient.getItem(uid, itemId); } catch { return null; }
  }

  // Dedupe by tmdbId+mediaType
  function dedupeItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = `${item.mediaType}-${item.id || item.tmdbId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Keep Jellyseerr's order (popularity), just push items without poster/year to bottom
  function sortItems(items) {
    const complete = [];
    const incomplete = [];

    for (const item of items) {
      const hasPoster = !!item.posterPath;
      const hasYear = !!(item.releaseDate || item.firstAirDate);
      if (hasPoster && hasYear) {
        complete.push(item);
      } else {
        incomplete.push(item);
      }
    }

    return [...complete, ...incomplete];
  }

  // Config cache for plugin settings
  let pluginConfig = null;
  async function getPluginConfig() {
    if (pluginConfig) return pluginConfig;
    const url = ApiClient.getUrl(`${CONFIG.apiBase}/health`);
    const data = await fetchJson(url);
    pluginConfig = data || {};
    return pluginConfig;
  }

  // TMDb genre IDs for talk/news shows
  const TALK_GENRE_IDS = [10767, 10763]; // Talk, News

  // Title patterns for talk/award shows
  const TALK_TITLE_PATTERNS = [
    /\btonight show\b/i,
    /\blate show\b/i,
    /\blate night\b/i,
    /\bdaily show\b/i,
    /\btalk show\b/i,
    /\bmorning show\b/i,
    /\bawards?\b/i,
    /\bemmy\b/i,
    /\boscar\b/i,
    /\bgolden globe\b/i,
    /\bgrammys?\b/i,
    /\bsag awards\b/i,
    /\bbafta\b/i,
    /\bcritics.?choice\b/i,
    /\bpeople.?s choice\b/i,
    /\bkelly clarkson show\b/i,
    /\bellen\b.*\bshow\b/i,
    /\bjimmy kimmel\b/i,
    /\bjimmy fallon\b/i,
    /\bstephen colbert\b/i,
    /\bseth meyers\b/i,
    /\bjames corden\b/i,
    /\bconan\b/i,
    /\bjohn oliver\b/i,
    /\btrevor noah\b/i,
    /\bwendy williams\b/i,
    /\breal time with\b/i,
    /\bdrew barrymore show\b/i,
    /\bgood morning\b/i,
    /\btoday show\b/i,
    /\bthe view\b/i,
    /\bthe talk\b/i,
    /\blive with\b/i,
    /\baccess hollywood\b/i,
    /\bentertainment tonight\b/i,
    /\bextra\b.*\btv\b/i,
  ];

  function isTalkOrAwardShow(item) {
    // Check genre IDs
    const genreIds = item.genreIds || [];
    if (genreIds.some(id => TALK_GENRE_IDS.includes(id))) return true;

    // Check genres by name
    const genres = (item.genres || []).map(g => typeof g === "string" ? g : g.name || "").join(" ").toLowerCase();
    if (genres.includes("talk") || genres.includes("news")) return true;

    // Check title patterns
    const title = (item.title || item.name || "").toLowerCase();
    if (TALK_TITLE_PATTERNS.some(pattern => pattern.test(title))) return true;

    return false;
  }

  // Filter out talk/award shows if enabled
  function filterTalkShows(items, excludeTalkShows) {
    if (!excludeTalkShows) return items;
    return items.filter(item => !isTalkOrAwardShow(item));
  }

  // Use Jellyfin Enhanced's request modal (same as search results)
  async function showRequestModal(item) {
    const type = item.mediaType === "tv" ? "tv" : "movie";
    const tmdbId = item.id || item.tmdbId;
    const title = item.title || item.name || "Unknown";
    const backdropPath = item.backdropPath || "";

    const JE = window.JellyfinEnhanced;

    // Check if Jellyfin Enhanced is available
    if (!JE?.jellyseerrUI) {
      log("Jellyfin Enhanced not available");
      alert("Jellyfin Enhanced plugin is required for request functionality.");
      return;
    }

    // Use Jellyfin Enhanced's request modals
    if (type === "tv") {
      // TV always shows season selection modal (it respects showAdvanced internally)
      JE.jellyseerrUI.showSeasonSelectionModal(tmdbId, "tv", title, null);
    } else {
      // Movies: show modal with or without advanced options based on setting
      if (JE.pluginConfig?.JellyseerrShowAdvanced) {
        JE.jellyseerrUI.showMovieRequestModal(tmdbId, title, null, false);
      } else {
        // Simple confirmation modal without advanced options
        const { modalElement, show, close } = JE.jellyseerrModal.create({
          title: JE.t?.("jellyseerr_modal_title_movie") || "Request Movie",
          subtitle: title,
          bodyHtml: "",
          backdropPath: backdropPath,
          onSave: async (modalEl, requestBtn, closeFn) => {
            requestBtn.disabled = true;
            requestBtn.innerHTML = `${JE.t?.("jellyseerr_modal_requesting") || "Requesting..."}<span class="jellyseerr-button-spinner"></span>`;
            try {
              await JE.jellyseerrAPI.requestMedia(tmdbId, "movie", {}, false, null);
              JE.toast?.(JE.t?.("jellyseerr_toast_requested") || "Request submitted!", 3000);
              closeFn();
            } catch (err) {
              JE.toast?.(JE.t?.("jellyseerr_toast_request_failed") || "Request failed", 3000);
              requestBtn.disabled = false;
              requestBtn.textContent = JE.t?.("jellyseerr_modal_request") || "Request";
            }
          }
        });
        show();
      }
    }
  }

  // Create native Jellyfin-style card
  function createCard(item) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card portraitCard card-hoverable card-withuserdata";
    card.dataset.tmdbid = item.id || item.tmdbId;
    card.dataset.mediatype = item.mediaType;

    const title = item.title || item.name || "Unknown";
    const year = (item.releaseDate || item.firstAirDate || "").substring(0, 4);
    const posterUrl = item.posterPath ? `https://image.tmdb.org/t/p/w300${item.posterPath}` : "";
    const rating = item.voteAverage ? item.voteAverage.toFixed(1) : "";

    // Status indicator
    let statusClass = "";
    let statusIcon = "";
    const status = item.mediaInfo?.status;
    if (status === 5) { statusClass = "available"; statusIcon = "check_circle"; }
    else if (status === 2 || status === 3) { statusClass = "requested"; statusIcon = "schedule"; }
    else if (status === 4) { statusClass = "partial"; statusIcon = "downloading"; }

    card.innerHTML = `
      <div class="cardBox visualCardBox">
        <div class="cardScalable visualCardBox-cardScalable">
          <div class="cardPadder cardPadder-portrait"></div>
          <div class="cardContent">
            <div class="cardImageContainer coveredImage" style="background-color:#1a1a1a;">
              ${posterUrl ? `<img class="cardImage cardImage-img lazy-image-fadein-fast" src="${posterUrl}" alt="${title}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" />` : `<div class="cardImage" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#666;"><span class="material-icons" style="font-size:3em;">${item.mediaType === "tv" ? "tv" : "movie"}</span></div>`}
              ${statusIcon ? `<div class="indicators seerr-status seerr-${statusClass}"><span class="material-icons">${statusIcon}</span></div>` : ""}
              ${rating ? `<div class="indicators indicator-rating">${rating}</div>` : ""}
            </div>
          </div>
        </div>
        <div class="cardFooter visualCardBox-cardFooter">
          <div class="cardText cardTextCentered">${title}</div>
          <div class="cardText cardText-secondary cardTextCentered">${year}${item.character ? ` &bull; ${item.character}` : ""}</div>
        </div>
      </div>
    `;

    card.addEventListener("click", () => showRequestModal(item));

    return card;
  }

  // Inject styles once
  function injectStyles() {
    if (document.getElementById("seerr-discovery-styles")) return;
    const style = document.createElement("style");
    style.id = "seerr-discovery-styles";
    style.textContent = `
      /* Minimal overrides - inherit skin styling */
      .seerr-discovery-section .card.portraitCard { background: transparent; border: none; padding: 0; cursor: pointer; }
      .seerr-discovery-section .card:hover .cardBox { transform: scale(1.03); transition: transform 0.15s; }
      .seerr-discovery-section .card:focus { outline: 2px solid #00a4dc; outline-offset: 2px; }
      .seerr-discovery-section .cardBox { background: transparent; }
      .seerr-discovery-section .cardText-secondary { opacity: 0.7; }
      .seerr-status { position: absolute; top: 0.3em; right: 0.3em; padding: 0.25em; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 1; }
      .seerr-status .material-icons { font-size: 1em; }
      .seerr-available { background: rgba(76, 175, 80, 0.95); color: #fff; }
      .seerr-requested { background: rgba(255, 152, 0, 0.95); color: #fff; }
      .seerr-partial { background: rgba(156, 39, 176, 0.95); color: #fff; }
      .indicator-rating { position: absolute; bottom: 0.3em; left: 0.3em; background: rgba(0,0,0,0.8); color: #ffd700; padding: 0.2em 0.5em; border-radius: 4px; font-size: 0.75em; font-weight: 600; }

      /* Simple Request Modal Styles */
      .seerr-modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.65); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1em; }
      .seerr-modal-simple { background: #303030; border-radius: 8px; padding: 1.5em 2em; max-width: 400px; width: 100%; text-align: left; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
      .seerr-modal-heading { margin: 0 0 0.5em; font-size: 1.25em; font-weight: 600; color: #fff; }
      .seerr-modal-item-title { margin: 0 0 0.75em; font-size: 1em; color: #ccc; }
      .seerr-modal-question { margin: 0 0 1.25em; font-size: 0.95em; color: #aaa; }
      .seerr-modal-buttons { display: flex; gap: 0.75em; justify-content: flex-end; }
      .seerr-btn { padding: 0.65em 1.25em; border: none; border-radius: 6px; font-size: 0.95em; cursor: pointer; transition: background 0.2s; font-weight: 500; }
      .seerr-btn-cancel { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); }
      .seerr-btn-cancel:hover { background: rgba(255,255,255,0.12); }
      .seerr-btn-request { background: #00a4dc; color: #fff; }
      .seerr-btn-request:hover { background: #0090c4; }
      .seerr-btn-request:disabled { background: #555; cursor: not-allowed; }
      .seerr-btn-success { background: #4caf50 !important; }

      /* Loading indicator and infinite scroll */
      .seerr-load-trigger { height: 1px; width: 100%; }
      .seerr-loading-indicator { text-align: center; padding: 1.5em; color: #888; display: flex; align-items: center; justify-content: center; gap: 0.5em; width: 100%; }
      @keyframes seerr-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .seerr-spin { animation: seerr-spin 1s linear infinite; }
    `;
    document.head.appendChild(style);
  }

  // Pagination state for infinite scroll - allItems stores actual item objects, seenKeys for deduplication
  let studioState = { name: "", page: 1, totalPages: 1, loading: false, allItems: [], seenKeys: new Set(), excludeTalkShows: true, observer: null };

  function createSection(title, sectionId) {
    const section = document.createElement("div");
    section.id = sectionId;
    section.className = "verticalSection verticalSection-cards seerr-discovery-section";

    section.innerHTML = `
      <div class="sectionTitleContainer sectionTitleContainer-cards padded-left padded-right">
        <h2 class="sectionTitle sectionTitle-cards">${title}</h2>
      </div>
      <div class="itemsContainer vertical-wrap padded-left padded-right"></div>
      <div class="seerr-load-trigger"></div>
      <div class="seerr-loading-indicator" style="display:none;">
        <span class="material-icons seerr-spin">refresh</span> Loading more...
      </div>
    `;

    return section;
  }

  function appendCards(section, items, instant = false) {
    const container = section.querySelector(".itemsContainer");
    items.forEach((item, i) => {
      const card = createCard(item);
      if (instant) card.classList.add("seerr-instant");
      else card.style.animationDelay = `${i * 0.03}s`;  // Stagger animation
      container.appendChild(card);
    });
  }

  // Create skeleton placeholder cards
  function createSkeletonCards(count) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement("div");
      skeleton.className = "seerr-skeleton-card";
      skeleton.innerHTML = `
        <div class="seerr-skeleton seerr-skeleton-poster"></div>
        <div class="seerr-skeleton seerr-skeleton-text"></div>
        <div class="seerr-skeleton seerr-skeleton-text-small"></div>
      `;
      fragment.appendChild(skeleton);
    }
    return fragment;
  }

  function removeSkeletons(section) {
    section.querySelectorAll(".seerr-skeleton-card").forEach(el => el.remove());
  }

  // Re-render ALL studio items sorted - called when new items are loaded
  function renderAllStudioItems() {
    const section = document.getElementById("seerr-discovery-studio");
    if (!section) { log("renderAllStudioItems: section not found"); return; }

    const container = section.querySelector(".itemsContainer");
    if (!container) { log("renderAllStudioItems: container not found"); return; }

    log("renderAllStudioItems: sorting", studioState.allItems.length, "total items");

    // Clear and re-render with ALL items sorted
    container.innerHTML = "";

    // Sort and filter ALL accumulated items (keeps Jellyseerr order, pushes incomplete to bottom)
    const sortedItems = filterTalkShows(sortItems(studioState.allItems), studioState.excludeTalkShows);
    sortedItems.forEach(item => container.appendChild(createCard(item)));

    // Update title with new count
    const titleEl = section.querySelector(".sectionTitle");
    if (titleEl) {
      titleEl.textContent = `More from ${studioState.name} on Jellyseerr (${sortedItems.length})`;
    }
    log("renderAllStudioItems: rendered", sortedItems.length, "items");
  }

  async function loadPersonFilmography(item) {
    const tmdbId = item.ProviderIds?.Tmdb || item.ProviderIds?.tmdb;
    if (!tmdbId) { log("No TMDb ID for", item.Name); return; }

    log("Loading filmography for", item.Name, "TMDb:", tmdbId);

    const detailPage = document.querySelector("#itemDetailPage:not(.hide)");
    if (!detailPage) return;

    // Remove existing
    document.getElementById("seerr-discovery-person")?.remove();

    // Find insertion point
    const insertPoint = detailPage.querySelector(".detailPagePrimaryContainer") ||
                       detailPage.querySelector(".detailPageContent");
    if (!insertPoint) return;

    // Show section with skeletons while loading
    const section = createSection(`More from ${item.Name}`, "seerr-discovery-person");
    const container = section.querySelector(".itemsContainer");
    container.appendChild(createSkeletonCards(15));
    insertPoint.appendChild(section);

    // Fetch data
    const url = ApiClient.getUrl(`${CONFIG.apiBase}/person/${tmdbId}`);
    const [data, config] = await Promise.all([fetchJson(url), getPluginConfig()]);

    // Remove skeletons
    removeSkeletons(section);

    if (!data?.Credits?.length) {
      section.remove();
      log("No credits found");
      return;
    }

    const excludeTalkShows = config.ExcludeTalkShows !== false;
    let credits = sortItems(dedupeItems(data.Credits));
    credits = filterTalkShows(credits, excludeTalkShows);
    log("Got", credits.length, "unique credits (after filtering)");

    // Update title with count and add cards with animation
    const titleEl = section.querySelector(".sectionTitle");
    if (titleEl) titleEl.textContent = `More from ${item.Name} (${credits.length})`;

    appendCards(section, credits.slice(0, 50));
  }

  async function loadMoreStudioItems() {
    if (studioState.loading || studioState.page >= studioState.totalPages) return;

    studioState.loading = true;
    const section = document.getElementById("seerr-discovery-studio");
    const container = section?.querySelector(".itemsContainer");
    if (!section || !container) return;

    // Show skeleton placeholders while loading
    const skeletons = createSkeletonCards(10);
    container.appendChild(skeletons);

    try {
      studioState.page++;
      log("Loading page", studioState.page, "for", studioState.name);

      const searchUrl = ApiClient.getUrl(`${CONFIG.apiBase}/studio/search?name=${encodeURIComponent(studioState.name)}&page=${studioState.page}`);
      const data = await fetchJson(searchUrl);

      // Remove skeletons
      removeSkeletons(section);

      if (data?.Items?.length) {
        // Track which items are new for animation
        const newKeys = new Set();

        for (const item of dedupeItems(data.Items)) {
          const key = `${item.mediaType}-${item.id || item.tmdbId}`;
          if (!studioState.seenKeys.has(key)) {
            studioState.seenKeys.add(key);
            studioState.allItems.push(item);
            newKeys.add(key);
          }
        }

        if (newKeys.size > 0) {
          // Re-render all items sorted, but only animate new ones
          container.innerHTML = "";
          const sortedItems = filterTalkShows(sortItems(studioState.allItems), studioState.excludeTalkShows);

          let animIndex = 0;
          sortedItems.forEach(item => {
            const card = createCard(item);
            const key = `${item.mediaType}-${item.id || item.tmdbId}`;
            if (newKeys.has(key)) {
              card.style.animationDelay = `${animIndex * 0.03}s`;
              animIndex++;
            } else {
              card.classList.add("seerr-instant");  // No animation for existing items
            }
            container.appendChild(card);
          });

          // Update title count
          const titleEl = section.querySelector(".sectionTitle");
          if (titleEl) {
            titleEl.textContent = `More from ${studioState.name} on Jellyseerr (${sortedItems.length})`;
          }
          log("Added", newKeys.size, "new items, total:", studioState.allItems.length);
        }
      }
    } catch (e) {
      removeSkeletons(section);
      log("Error loading more:", e);
    } finally {
      studioState.loading = false;
    }
  }

  async function loadStudioCatalog(studioName) {
    log("Loading catalog for studio:", studioName);

    // Reset state and clean up old observer
    if (studioState.observer) studioState.observer.disconnect();

    // Search for studio by name
    const searchUrl = ApiClient.getUrl(`${CONFIG.apiBase}/studio/search?name=${encodeURIComponent(studioName)}&page=1`);
    log("Studio search URL:", searchUrl);
    const [data, config] = await Promise.all([fetchJson(searchUrl), getPluginConfig()]);
    log("Studio search result:", data);

    if (!data?.Items?.length) { log("No items found for studio"); return; }

    const excludeTalkShows = config.ExcludeTalkShows !== false;

    // Initialize state with actual items (not just keys)
    const seenKeys = new Set();
    const allItems = [];
    for (const item of dedupeItems(data.Items)) {
      const key = `${item.mediaType}-${item.id || item.tmdbId}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allItems.push(item);
      }
    }

    studioState = {
      name: studioName,
      page: 1,
      totalPages: data.TotalPages || 1,
      loading: false,
      allItems: allItems,
      seenKeys: seenKeys,
      observer: null,
      excludeTalkShows: excludeTalkShows
    };

    // Get filtered and sorted items for display
    const displayItems = filterTalkShows(sortItems(allItems), excludeTalkShows);
    log("Got", displayItems.length, "items (after filtering), total pages:", studioState.totalPages);

    // Remove existing
    document.getElementById("seerr-discovery-studio")?.remove();

    // Find the page content area - try multiple selectors
    log("Looking for page content container...");
    log("  .pageWithAbsoluteTabs .itemsContainer:", document.querySelector(".pageWithAbsoluteTabs .itemsContainer"));
    log("  .itemsContainer.vertical-wrap:", document.querySelector(".itemsContainer.vertical-wrap"));
    log("  .itemsContainer:", document.querySelector(".itemsContainer"));
    log("  .verticalSection:", document.querySelector(".verticalSection"));
    log("  #itemDetailPage:", document.querySelector("#itemDetailPage"));

    const pageContent = document.querySelector(".pageWithAbsoluteTabs .itemsContainer") ||
                       document.querySelector(".itemsContainer.vertical-wrap") ||
                       document.querySelector(".itemsContainer") ||
                       document.querySelector(".verticalSection");
    if (!pageContent) { log("Could not find items container - no valid selector found"); return; }
    log("Found page content:", pageContent);

    // Create section
    const section = createSection(`More from ${studioName} on Jellyseerr (${displayItems.length})`, "seerr-discovery-studio");
    appendCards(section, displayItems, true);  // instant=true for initial load
    pageContent.parentElement?.appendChild(section);

    // Set up infinite scroll observer
    if (studioState.totalPages > 1) {
      const trigger = section.querySelector(".seerr-load-trigger");
      studioState.observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !studioState.loading) {
          loadMoreStudioItems();
        }
      }, { rootMargin: "800px" });  // Preload early for smoother experience
      studioState.observer.observe(trigger);
    }
  }

  async function checkAndLoad() {
    if (!apiReady() || isProcessing) return;

    const currentUrl = window.location.hash;
    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;

    const params = getHashParams();
    log("checkAndLoad: URL =", currentUrl);
    log("checkAndLoad: params =", params ? Array.from(params.entries()) : "null");
    if (!params) return;

    isProcessing = true;
    injectStyles();

    try {
      // Check for Person detail page
      const itemId = params.get("id");
      if (itemId && currentUrl.includes("details")) {
        const item = await getItemInfo(itemId);
        if (item?.Type === "Person") {
          // Wait for page to render
          await new Promise(r => setTimeout(r, 500));
          await loadPersonFilmography(item);
        }
      }

      // Check for Studio list page - try multiple parameter names
      const studioId = params.get("studioIds") || params.get("studioId") || params.get("studio");
      log("checkAndLoad: studioId =", studioId);
      if (studioId) {
        log("Found studioId:", studioId);
        const item = await getItemInfo(studioId);
        log("Studio item lookup result:", item);
        log("Studio item Type:", item?.Type, "Name:", item?.Name);
        if (item?.Type === "Studio" && item.Name) {
          await new Promise(r => setTimeout(r, 500));
          await loadStudioCatalog(item.Name);
        } else {
          log("Not a studio or no name, skipping. Type was:", item?.Type);
        }
      }

    } catch (e) {
      log("Error:", e);
    } finally {
      isProcessing = false;
    }
  }

  // Listen for navigation
  window.addEventListener("hashchange", () => { lastUrl = ""; checkAndLoad(); });

  // Observe DOM for SPA navigation
  let debounceTimer = null;
  const mo = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkAndLoad, 300);
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // Init
  (async () => {
    for (let i = 0; i < 40 && !apiReady(); i++) await new Promise(r => setTimeout(r, 200));
    if (apiReady()) { injectStyles(); checkAndLoad(); }
    log("Loaded v2");
  })();
})();
