// Jellyseerr Discovery - Actor Filmography & Studio Catalogs
// Shows content from Jellyseerr/TMDb on Person and Studio pages
// Integrates with Jellyfin Enhanced for consistent card styling and modal
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

  let DEBUG = false; // Will be set from config.DebugMode
  const log = (...a) => DEBUG && console.log("[Discovery]", ...a);

  console.log("[Discovery] Script loaded v1.5.5.0");

  let lastUrl = "";
  let isProcessing = false;
  let pluginConfig = null;

  // Icons matching Jellyfin Enhanced
  const icons = {
    star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="#fbbf24" style="width:1em;height:1em;vertical-align:middle;"><path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clip-rule="evenodd" /></svg>',
    check: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" /></svg>',
    clock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clip-rule="evenodd"></path></svg>',
    partial: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM6.75 9.25a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clip-rule="evenodd" /></svg>',
    spinner: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>',
  };

  function apiReady() {
    return !!(window.ApiClient && ApiClient.getUrl && ApiClient.accessToken && ApiClient.getCurrentUserId?.());
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

  async function getItemInfo(itemId, retries = 3) {
    if (!itemId) return null;
    const uid = ApiClient.getCurrentUserId?.();
    if (!uid) return null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const item = await ApiClient.getItem(uid, itemId);
        if (item) return item;
      } catch (e) {
        log("getItemInfo error:", e.message);
      }
      if (attempt < retries) await new Promise(r => setTimeout(r, 500));
    }
    return null;
  }

  async function getPluginConfig() {
    if (pluginConfig) return pluginConfig;
    try {
      pluginConfig = await fetchJson(ApiClient.getUrl(`${CONFIG.apiBase}/config`));
      return pluginConfig || {};
    } catch { return {}; }
  }

  function dedupeItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = `${item.mediaType}-${item.id || item.tmdbId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function sortItems(items) {
    const complete = [], incomplete = [];
    for (const item of items) {
      const hasPoster = !!item.posterPath;
      const hasYear = !!(item.releaseDate || item.firstAirDate);
      (hasPoster && hasYear ? complete : incomplete).push(item);
    }
    return [...complete, ...incomplete];
  }

  function filterTalkShows(items, exclude) {
    if (!exclude) return items;
    const talkShowGenres = [10767];
    return items.filter(item => !item.genreIds?.some(g => talkShowGenres.includes(g)));
  }

  // Check if Jellyfin Enhanced is available
  function hasJellyfinEnhanced() {
    return !!(window.JellyfinEnhanced?.jellyseerrMoreInfo?.open);
  }

  // Get Jellyfin Enhanced reference
  function getJE() {
    return window.JellyfinEnhanced;
  }

  // Add discovery-specific styles (complementing Jellyfin Enhanced styles)
  function addStyles() {
    if (document.getElementById('discovery-styles')) return;
    const style = document.createElement('style');
    style.id = 'discovery-styles';
    style.textContent = `
      .discovery-section { margin-bottom: 1.5em; }
      .discovery-section .sectionTitle { font-size: 1.4em; font-weight: 500; margin-bottom: 0.6em; display: flex; align-items: center; gap: 0.5em; }
      .discovery-section .itemsContainer { display: flex; flex-wrap: wrap; gap: 1em; }
      .discovery-section .itemsContainer.scroll-horizontal { flex-wrap: nowrap; overflow-x: auto; scroll-behavior: smooth; padding-bottom: 10px; }

      /* Card styles matching Jellyfin Enhanced */
      .discovery-card { position: relative; width: 170px; flex-shrink: 0; cursor: pointer; }
      @media (min-width: 1200px) { .discovery-card { width: 185px; } }
      @media (min-width: 1600px) { .discovery-card { width: 200px; } }
      .discovery-card .cardBox { background: transparent; border-radius: 8px; overflow: visible; }
      .discovery-card .cardScalable { position: relative; contain: paint; }
      .discovery-card .cardPadder { padding-top: 150%; }
      .discovery-card .cardImageContainer { position: absolute; inset: 0; border-radius: 8px; overflow: hidden; background: #1a1a1a; }
      .discovery-card .cardImage { width: 100%; height: 100%; object-fit: cover; }
      .discovery-card .cardImage-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; color: #666; font-size: 3em; }

      /* Status badge */
      .discovery-status-badge { position: absolute; top: 8px; right: 8px; z-index: 100; width: 1.5em; height: 1.5em; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1.5px solid rgba(255,255,255,0.3); box-shadow: 0 0 1px rgba(255,255,255,0.4) inset, 0 4px 12px rgba(0,0,0,0.6); }
      .discovery-status-badge svg { width: 1.4em; height: 1.4em; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)); }
      .discovery-status-badge.status-available { background-color: rgba(34, 197, 94, 0.7); border-color: rgba(34, 197, 94, 0.3); }
      .discovery-status-badge.status-requested { background-color: rgba(136, 61, 206, 0.7); border-color: rgba(147, 51, 234, 0.3); }
      .discovery-status-badge.status-pending { background-color: rgba(251, 146, 60, 0.7); border-color: rgba(251, 146, 60, 0.3); }
      .discovery-status-badge.status-partial { background-color: rgba(34, 197, 94, 0.7); border-color: rgba(34, 197, 94, 0.3); }
      .discovery-status-badge.status-processing { background-color: rgba(99, 102, 241, 0.7); border-color: rgba(99, 102, 241, 0.3); }
      .discovery-status-badge.status-processing svg { animation: discovery-spin 1s linear infinite; }
      @keyframes discovery-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

      /* Media type badge */
      .discovery-media-badge { position: absolute; top: 8px; left: 8px; z-index: 100; color: #fff; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(0,0,0,0.2); font-size: 0.75em; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px); }
      .discovery-media-badge.movie { background-color: rgba(59, 130, 246, .9); box-shadow: 0 0 0 1px rgba(59,130,246,.35), 0 8px 24px rgba(59,130,246,.25); }
      .discovery-media-badge.tv { background-color: rgba(243, 51, 214, .9); box-shadow: 0 0 0 1px rgba(236,72,153,.35), 0 8px 24px rgba(236,72,153,.25); }

      /* Collection badge */
      .discovery-collection-badge { position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 100; color: #fff; padding: 4px 12px; border-radius: 999px; font-size: 0.7em; font-weight: 600; display: flex; align-items: center; gap: 4px; background-color: rgba(16, 185, 129, .85); box-shadow: 0 0 0 1px rgba(16,185,129,.35); backdrop-filter: blur(8px); max-width: 90%; cursor: pointer; }
      .discovery-collection-badge:hover { transform: translateX(-50%) translateY(-2px); box-shadow: 0 0 0 1px rgba(16,185,129,.5), 0 12px 32px rgba(16,185,129,.35); }
      .discovery-collection-badge span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .discovery-collection-badge .material-icons { font-size: 1.1em; }

      /* Card text */
      .discovery-card .cardText { text-align: center; padding: 0.4em 0.2em; font-size: 0.9em; }
      .discovery-card .cardText-title { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .discovery-card .cardText-role { color: #aaa; font-size: 0.8em; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 0.2em; }
      .discovery-card .cardText-meta { display: flex; justify-content: center; align-items: center; gap: 0.8em; color: #999; font-size: 0.85em; }
      .discovery-card .cardText-meta .rating { display: flex; align-items: center; gap: 0.2em; }

      /* Hover overlay */
      .discovery-card .cardOverlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.78) 75%, rgba(0,0,0,.92) 100%); color: #e5e7eb; padding: 12px; opacity: 0; pointer-events: none; transition: opacity 0.2s; display: flex; flex-direction: column; justify-content: flex-end; border-radius: 8px; }
      .discovery-card:hover .cardOverlay { opacity: 1; pointer-events: auto; }
      .discovery-card .cardOverlay .overview { font-size: 0.75em; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }

      /* Scroll navigation */
      .discovery-section .scroll-nav { display: flex; gap: 0.5em; }
      .discovery-section .scroll-nav button { background: rgba(255,255,255,0.1); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      .discovery-section .scroll-nav button:hover { background: rgba(255,255,255,0.2); }

      /* Infinite scroll trigger */
      .discovery-load-trigger { width: 100%; height: 50px; }

      /* Loading skeleton */
      .discovery-skeleton { width: 170px; flex-shrink: 0; }
      @media (min-width: 1200px) { .discovery-skeleton { width: 185px; } }
      @media (min-width: 1600px) { .discovery-skeleton { width: 200px; } }
      .discovery-skeleton .cardBox { background: #1a1a1a; border-radius: 8px; animation: discovery-pulse 1.5s ease-in-out infinite; }
      .discovery-skeleton .cardPadder { padding-top: 150%; }
      @keyframes discovery-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
    `;
    document.head.appendChild(style);
  }

  // Create a card matching Jellyfin Enhanced style
  function createCard(item, config = null) {
    // Use passed config or fallback to cached config
    const cfg = config || pluginConfig || {};

    const card = document.createElement('div');
    card.className = 'discovery-card card overflowPortraitCard card-hoverable card-withuserdata';
    if (hasJellyfinEnhanced()) card.classList.add('jellyseerr-card');

    const tmdbId = item.id || item.tmdbId;
    const mediaType = item.mediaType || 'movie';
    const title = item.title || item.name || 'Unknown';
    const year = (item.releaseDate || item.firstAirDate || '').substring(0, 4) || 'N/A';
    const posterUrl = item.posterPath ? `https://image.tmdb.org/t/p/w300${item.posterPath}` : '';
    const rating = item.voteAverage ? item.voteAverage.toFixed(1) : 'N/A';
    const overview = item.overview || '';

    // Role info (character for cast, job for crew)
    const showRoleName = cfg.ShowRoleName !== false;
    const role = showRoleName ? (item.character ? `as ${item.character}` : (item.job || '')) : '';

    // Determine status (only if ShowMediaStatus is enabled)
    let statusHtml = '';
    const showMediaStatus = cfg.ShowMediaStatus !== false;
    if (showMediaStatus) {
      const status = item.mediaInfo?.status;
      if (status === 5) {
        statusHtml = `<div class="discovery-status-badge status-available">${icons.check}</div>`;
      } else if (status === 2) {
        statusHtml = `<div class="discovery-status-badge status-pending">${icons.clock}</div>`;
      } else if (status === 3 || status === 7) {
        const hasDownloads = item.mediaInfo?.downloadStatus?.length > 0;
        statusHtml = hasDownloads
          ? `<div class="discovery-status-badge status-processing">${icons.spinner}</div>`
          : `<div class="discovery-status-badge status-requested">${icons.clock}</div>`;
      } else if (status === 4) {
        statusHtml = `<div class="discovery-status-badge status-partial">${icons.partial}</div>`;
      }
    }

    // Media type badge (only if ShowMediaTypeBadge is enabled)
    const showMediaTypeBadge = cfg.ShowMediaTypeBadge !== false;
    const mediaLabel = mediaType === 'tv' ? 'SERIES' : 'MOVIE';
    const mediaBadgeClass = mediaType === 'tv' ? 'tv' : 'movie';
    const mediaBadgeHtml = showMediaTypeBadge
      ? `<div class="discovery-media-badge ${mediaBadgeClass}">${mediaLabel}</div>`
      : '';

    // Collection badge (only if ShowCollectionBadge is enabled)
    const showCollectionBadge = cfg.ShowCollectionBadge !== false;
    let collectionHtml = '';
    if (showCollectionBadge && item.collection && mediaType === 'movie') {
      collectionHtml = `<div class="discovery-collection-badge" data-collection-id="${item.collection.id}" data-collection-name="${item.collection.name || 'Collection'}"><span class="material-icons">collections</span><span>${item.collection.name || 'Collection'}</span></div>`;
    }

    // Overview on hover (only if ShowOverviewOnHover is enabled)
    const showOverviewOnHover = cfg.ShowOverviewOnHover !== false;
    const overlayHtml = showOverviewOnHover
      ? `<div class="cardOverlay"><div class="overview">${overview.slice(0, 300)}${overview.length > 300 ? '...' : ''}</div></div>`
      : '';

    // Year display (only if ShowYear is enabled)
    const showYear = cfg.ShowYear !== false;
    const yearHtml = showYear ? `<span>${year}</span>` : '';

    // Rating display (only if ShowRatings is enabled)
    const showRatings = cfg.ShowRatings !== false;
    const ratingHtml = showRatings ? `<span class="rating">${icons.star} ${rating}</span>` : '';

    // Build meta section (only show if we have content)
    const hasMetaContent = showYear || showRatings;
    const metaHtml = hasMetaContent
      ? `<div class="cardText cardText-meta">${yearHtml}${ratingHtml}</div>`
      : '';

    card.innerHTML = `
      <div class="cardBox cardBox-bottompadded">
        <div class="cardScalable">
          <div class="cardPadder"></div>
          <div class="cardImageContainer coveredImage cardContent" style="${posterUrl ? `background-image: url('${posterUrl}');background-size:cover;` : ''}">
            ${!posterUrl ? `<div class="cardImage-placeholder"><span class="material-icons">${mediaType === 'tv' ? 'tv' : 'movie'}</span></div>` : ''}
            ${statusHtml}
            ${mediaBadgeHtml}
            ${collectionHtml}
            ${overlayHtml}
          </div>
        </div>
        <div class="cardText cardText-title"><bdi>${title}</bdi></div>
        ${role ? `<div class="cardText cardText-role">${role}</div>` : ''}
        ${metaHtml}
      </div>
    `;

    // Mark complete/incomplete for sorting
    const hasPoster = !!item.posterPath;
    const hasYear = !!(item.releaseDate || item.firstAirDate);
    card.dataset.complete = (hasPoster && hasYear) ? '1' : '0';
    card.dataset.tmdbid = tmdbId;
    card.dataset.mediatype = mediaType;

    // Click handler - open Jellyfin Enhanced modal if available
    card.addEventListener('click', (e) => {
      // Don't handle if clicking collection badge
      if (e.target.closest('.discovery-collection-badge')) {
        e.preventDefault();
        e.stopPropagation();
        const badge = e.target.closest('.discovery-collection-badge');
        const collectionId = badge.dataset.collectionId;
        const collectionName = badge.dataset.collectionName;
        const je = getJE();
        if (je?.jellyseerrUI?.showCollectionRequestModal) {
          je.jellyseerrUI.showCollectionRequestModal(parseInt(collectionId), collectionName, item);
        } else if (je?.jellyseerrMoreInfo?.open) {
          je.jellyseerrMoreInfo.open(parseInt(collectionId), 'collection');
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const je = getJE();
      if (je?.jellyseerrMoreInfo?.open) {
        log('Opening JE modal for', tmdbId, mediaType);
        je.jellyseerrMoreInfo.open(parseInt(tmdbId), mediaType);
      } else {
        // Fallback: Try to open Jellyseerr URL
        log('JE not available, trying fallback');
        const config = pluginConfig;
        if (config?.JellyseerrUrl) {
          window.open(`${config.JellyseerrUrl}/${mediaType}/${tmdbId}`, '_blank');
        }
      }
    });

    return card;
  }

  function createSkeletonCards(count) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'discovery-skeleton';
      skeleton.innerHTML = '<div class="cardBox"><div class="cardPadder"></div></div>';
      fragment.appendChild(skeleton);
    }
    return fragment;
  }

  function removeSkeletons(section) {
    section.querySelectorAll('.discovery-skeleton').forEach(el => el.remove());
  }

  // Create section container
  function createSection(title, hasScroll = false) {
    const section = document.createElement('div');
    section.className = 'discovery-section verticalSection';
    section.innerHTML = `
      <div class="sectionTitleContainer flex align-items-center">
        <h2 class="sectionTitle">${title}</h2>
        ${hasScroll ? `
          <div class="scroll-nav">
            <button class="scroll-left paper-icon-button-light"><span class="material-icons">chevron_left</span></button>
            <button class="scroll-right paper-icon-button-light"><span class="material-icons">chevron_right</span></button>
          </div>
        ` : ''}
      </div>
      <div class="itemsContainer ${hasScroll ? 'scroll-horizontal' : ''}"></div>
    `;

    if (hasScroll) {
      const container = section.querySelector('.itemsContainer');
      section.querySelector('.scroll-left').addEventListener('click', () => {
        container.scrollBy({ left: -450, behavior: 'smooth' });
      });
      section.querySelector('.scroll-right').addEventListener('click', () => {
        container.scrollBy({ left: 450, behavior: 'smooth' });
      });
    }

    return section;
  }

  // Studio state for infinite scroll
  let studioState = {
    name: '',
    page: 1,
    totalPages: 1,
    loading: false,
    allItems: [],
    seenKeys: new Set(),
    observer: null,
    excludeTalkShows: true,
    lastLoadTime: 0,
    triggerLeftViewport: false,  // Track if trigger left viewport since last load
    pendingRetry: null  // Timeout ID for scheduled retry when throttled
  };

  async function loadMoreStudioItems() {
    // Check if infinite scroll is enabled
    if (!studioState.enableInfiniteScroll) return;
    if (studioState.loading || studioState.page >= studioState.totalPages) return;

    const now = Date.now();
    const timeSinceLastLoad = now - studioState.lastLoadTime;

    // Use different delays based on whether user scrolled or stayed at bottom
    // If trigger left viewport (user scrolled), allow quick reload (1 second)
    // If trigger stayed visible (at bottom), require longer delay (4 seconds)
    const requiredDelay = studioState.triggerLeftViewport ? 1000 : 4000;

    if (timeSinceLastLoad < requiredDelay) {
      const remaining = requiredDelay - timeSinceLastLoad;
      log('Throttled - need', requiredDelay, 'ms, only', timeSinceLastLoad, 'ms passed, retry in', remaining, 'ms');
      // Schedule a retry after throttle expires (if not already scheduled)
      if (!studioState.pendingRetry) {
        studioState.pendingRetry = setTimeout(() => {
          studioState.pendingRetry = null;
          loadMoreStudioItems();
        }, remaining + 100);  // Add 100ms buffer
      }
      return;
    }
    // Clear any pending retry since we're proceeding with load
    if (studioState.pendingRetry) {
      clearTimeout(studioState.pendingRetry);
      studioState.pendingRetry = null;
    }

    studioState.loading = true;
    studioState.lastLoadTime = now;
    studioState.triggerLeftViewport = false; // Reset for next cycle

    const section = document.getElementById('discovery-studio-section');
    const container = section?.querySelector('.itemsContainer');
    if (!section || !container) return;

    // Show skeletons
    const skeletons = createSkeletonCards(10);
    const trigger = container.querySelector('.discovery-load-trigger');
    if (trigger) {
      container.insertBefore(skeletons, trigger);
    } else {
      container.appendChild(skeletons);
    }

    try {
      studioState.page++;
      log('Loading page', studioState.page);

      const searchUrl = ApiClient.getUrl(`${CONFIG.apiBase}/studio/search?name=${encodeURIComponent(studioState.name)}&page=${studioState.page}`);
      const data = await fetchJson(searchUrl);

      removeSkeletons(section);

      if (data?.Items?.length) {
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
          const newItems = studioState.allItems.filter(item => {
            const key = `${item.mediaType}-${item.id || item.tmdbId}`;
            return newKeys.has(key);
          });
          const filteredNew = filterTalkShows(newItems, studioState.excludeTalkShows);

          // Sort: complete first, incomplete last
          const completeNew = [], incompleteNew = [];
          for (const item of filteredNew) {
            const hasPoster = !!item.posterPath;
            const hasYear = !!(item.releaseDate || item.firstAirDate);
            (hasPoster && hasYear ? completeNew : incompleteNew).push(item);
          }

          // Find first incomplete card
          const firstIncomplete = container.querySelector('.discovery-card[data-complete="0"]');
          const loadTrigger = container.querySelector('.discovery-load-trigger');

          // Get config from studioState
          const cfg = studioState.config || null;

          // Insert complete items
          let animIndex = 0;
          for (const item of completeNew) {
            const card = createCard(item, cfg);
            card.style.animationDelay = `${animIndex * 0.03}s`;
            if (firstIncomplete) {
              container.insertBefore(card, firstIncomplete);
            } else if (loadTrigger) {
              container.insertBefore(card, loadTrigger);
            } else {
              container.appendChild(card);
            }
            animIndex++;
          }

          // Append incomplete items
          for (const item of incompleteNew) {
            const card = createCard(item, cfg);
            card.style.animationDelay = `${animIndex * 0.03}s`;
            if (loadTrigger) {
              container.insertBefore(card, loadTrigger);
            } else {
              container.appendChild(card);
            }
            animIndex++;
          }

          // Update count
          const totalDisplayed = container.querySelectorAll('.discovery-card').length;
          const titleEl = section.querySelector('.sectionTitle');
          if (titleEl) {
            titleEl.textContent = `More from ${studioState.name} on Jellyseerr (${totalDisplayed})`;
          }
          log('Added', completeNew.length + incompleteNew.length, 'items, total:', totalDisplayed);
        }
      }
    } catch (e) {
      removeSkeletons(section);
      log('Error loading more:', e);
    } finally {
      studioState.loading = false;
      // Check if trigger is still visible and we have more pages - schedule next load
      if (studioState.page < studioState.totalPages) {
        const trigger = document.querySelector('.discovery-load-trigger');
        if (trigger) {
          const rect = trigger.getBoundingClientRect();
          const isVisible = rect.top < window.innerHeight + 300;  // Match rootMargin
          if (isVisible && !studioState.pendingRetry) {
            // Trigger still visible, schedule next load after throttle delay
            const delay = studioState.triggerLeftViewport ? 1000 : 4000;
            log('Trigger still visible, scheduling next load in', delay, 'ms');
            studioState.pendingRetry = setTimeout(() => {
              studioState.pendingRetry = null;
              loadMoreStudioItems();
            }, delay + 100);
          }
        }
      }
    }
  }

  async function loadPersonFilmography(item) {
    const tmdbId = item.ProviderIds?.Tmdb || item.ProviderIds?.tmdb;
    if (!tmdbId) { log('No TMDb ID for', item.Name); return; }

    log('Loading filmography for', item.Name, 'TMDb:', tmdbId);

    const url = ApiClient.getUrl(`${CONFIG.apiBase}/person/${tmdbId}`);
    const [data, config] = await Promise.all([fetchJson(url), getPluginConfig()]);

    // Check if person discovery is enabled
    if (config.ShowPersonDiscovery === false) {
      log('Person discovery disabled in settings');
      return;
    }

    // Apply debug mode from config
    if (config.DebugMode !== undefined) {
      DEBUG = config.DebugMode;
    }

    const excludeTalkShows = config.ExcludeTalkShows !== false;
    const showCastCredits = config.ShowCastCredits !== false;
    const showCrewCredits = config.ShowCrewCredits !== false;

    // Get cast (Appearances) and crew separately
    let castCredits = data?.Cast || [];
    let crewCredits = data?.Crew || [];

    // Apply filtering and sorting
    castCredits = filterTalkShows(sortItems(dedupeItems(castCredits)), excludeTalkShows);
    crewCredits = filterTalkShows(sortItems(dedupeItems(crewCredits)), excludeTalkShows);

    log('Got', castCredits.length, 'cast credits and', crewCredits.length, 'crew credits');

    // Check if we have any credits to show based on settings
    const hasCastToShow = showCastCredits && castCredits.length > 0;
    const hasCrewToShow = showCrewCredits && crewCredits.length > 0;

    if (!hasCastToShow && !hasCrewToShow) {
      log('No credits to show (either none found or disabled in settings)');
      return;
    }

    // Remove existing sections
    document.getElementById('discovery-person-appearances')?.remove();
    document.getElementById('discovery-person-crew')?.remove();

    // Find insert point - after the last verticalSection in VISIBLE page
    const visiblePage = document.querySelector('.page:not(.hide)');
    const allSections = visiblePage
      ? visiblePage.querySelectorAll('.verticalSection')
      : document.querySelectorAll('.verticalSection');
    const lastSection = allSections[allSections.length - 1];
    if (!lastSection) { log('No sections found'); return; }

    let insertPoint = lastSection;

    // Create Appearances section (cast credits) - vertical wrap layout
    if (hasCastToShow) {
      const appearancesSection = createSection(`Appearances (${castCredits.length})`, false);
      appearancesSection.id = 'discovery-person-appearances';

      const container = appearancesSection.querySelector('.itemsContainer');
      // Use DocumentFragment for batch DOM insertion (reduces reflows)
      const fragment = document.createDocumentFragment();
      castCredits.forEach((credit, i) => {
        const card = createCard(credit, config);
        // Cap animation delay to first 20 cards for performance
        if (i < 20) card.style.animationDelay = `${i * 0.02}s`;
        fragment.appendChild(card);
      });
      container.appendChild(fragment);

      insertPoint.parentNode.insertBefore(appearancesSection, insertPoint.nextSibling);
      insertPoint = appearancesSection;
    }

    // Create Crew section - vertical wrap layout
    if (hasCrewToShow) {
      const crewSection = createSection(`Crew (${crewCredits.length})`, false);
      crewSection.id = 'discovery-person-crew';

      const container = crewSection.querySelector('.itemsContainer');
      // Use DocumentFragment for batch DOM insertion
      const fragment = document.createDocumentFragment();
      crewCredits.forEach((credit, i) => {
        const card = createCard(credit, config);
        if (i < 20) card.style.animationDelay = `${i * 0.02}s`;
        fragment.appendChild(card);
      });
      container.appendChild(fragment);

      insertPoint.parentNode.insertBefore(crewSection, insertPoint.nextSibling);
    }

    // Verify sections are visible, re-insert if needed
    await new Promise(r => setTimeout(r, 100));
    const appearancesSection = document.getElementById('discovery-person-appearances');
    const crewSection2 = document.getElementById('discovery-person-crew');

    if ((appearancesSection && appearancesSection.offsetHeight === 0) ||
        (crewSection2 && crewSection2.offsetHeight === 0)) {
      log('Person sections not visible, looking for correct page...');
      const correctPage = document.querySelector('.page:not(.hide)');
      if (correctPage) {
        const sections = correctPage.querySelectorAll('.verticalSection');
        const lastSection = sections[sections.length - 1];
        if (lastSection && lastSection.id !== 'discovery-person-appearances' && lastSection.id !== 'discovery-person-crew') {
          let insertPoint = lastSection;
          if (appearancesSection && appearancesSection.offsetHeight === 0) {
            log('Re-inserting appearances section');
            insertPoint.parentNode.insertBefore(appearancesSection, insertPoint.nextSibling);
            insertPoint = appearancesSection;
          }
          if (crewSection2 && crewSection2.offsetHeight === 0) {
            log('Re-inserting crew section');
            insertPoint.parentNode.insertBefore(crewSection2, insertPoint.nextSibling);
          }
        }
      }
    }
  }

  async function loadStudioCatalog(studioName) {
    log('Loading catalog for studio:', studioName);

    // Reset state
    if (studioState.observer) studioState.observer.disconnect();
    if (studioState.pendingRetry) {
      clearTimeout(studioState.pendingRetry);
      studioState.pendingRetry = null;
    }

    const searchUrl = ApiClient.getUrl(`${CONFIG.apiBase}/studio/search?name=${encodeURIComponent(studioName)}&page=1`);
    const [data, config] = await Promise.all([fetchJson(searchUrl), getPluginConfig()]);

    // Check if studio discovery is enabled
    if (config.ShowStudioDiscovery === false) {
      log('Studio discovery disabled in settings');
      return;
    }

    // Apply debug mode from config
    if (config.DebugMode !== undefined) {
      DEBUG = config.DebugMode;
    }

    if (!data?.Items?.length) { log('No items found'); return; }

    const excludeTalkShows = config.ExcludeTalkShows !== false;
    const enableInfiniteScroll = config.EnableInfiniteScroll !== false;

    // Initialize state
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
      allItems,
      seenKeys,
      observer: null,
      excludeTalkShows,
      enableInfiniteScroll,
      config,
      lastLoadTime: 0,
      triggerLeftViewport: true,  // Allow first load immediately
      pendingRetry: null
    };

    const displayItems = filterTalkShows(sortItems(allItems), excludeTalkShows);
    log('Got', displayItems.length, 'items, total pages:', studioState.totalPages);

    // Remove existing
    document.getElementById('discovery-studio-section')?.remove();

    // Find container - poll for correct element in VISIBLE page only
    let pageContent = null;
    for (let i = 0; i < 15; i++) {
      // Only look in visible pages (without 'hide' class)
      const visiblePage = document.querySelector('.page.libraryPage:not(.hide)');
      if (visiblePage) {
        pageContent = visiblePage.querySelector('.itemsContainer.vertical-wrap.centered') ||
                      visiblePage.querySelector('.padded-left.padded-right .itemsContainer.vertical-wrap');
        if (pageContent && !pageContent.classList.contains('nextUpItems')) break;
      }
      pageContent = null;
      if (i < 14) await new Promise(r => setTimeout(r, 200));
    }

    if (!pageContent) { log('No studio container found'); return; }

    const section = createSection(`More from ${studioName} on Jellyseerr (${displayItems.length})`, false);
    section.id = 'discovery-studio-section';

    const container = section.querySelector('.itemsContainer');
    // Use DocumentFragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    displayItems.forEach((item, i) => {
      const card = createCard(item, config);
      // Cap animation delay to first 15 cards for performance
      if (i < 15) card.style.animationDelay = `${i * 0.03}s`;
      fragment.appendChild(card);
    });
    container.appendChild(fragment);

    // Add infinite scroll trigger (only if enabled and more pages exist)
    if (enableInfiniteScroll && studioState.totalPages > 1) {
      const trigger = document.createElement('div');
      trigger.className = 'discovery-load-trigger';
      container.appendChild(trigger);

      studioState.observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          // Trigger is visible - try to load if conditions are met
          if (!studioState.loading) {
            loadMoreStudioItems();
          }
        } else {
          // Trigger left viewport - user scrolled up
          // This enables faster loading when they scroll back down
          studioState.triggerLeftViewport = true;
          log('Trigger left viewport - fast reload enabled');
        }
      }, { rootMargin: '300px' });
      studioState.observer.observe(trigger);
    }

    // Insert AFTER the existing items container, not before
    pageContent.parentNode.insertBefore(section, pageContent.nextSibling);

    // Verify the section is actually visible (parent page not hidden)
    // If not, try to re-insert into the correct visible page
    await new Promise(r => setTimeout(r, 100));
    if (section.offsetHeight === 0) {
      log('Section not visible, looking for correct page...');
      const correctPage = document.querySelector('.page.libraryPage:not(.hide)');
      if (correctPage) {
        const correctContainer = correctPage.querySelector('.itemsContainer.vertical-wrap.centered') ||
                                 correctPage.querySelector('.padded-left.padded-right .itemsContainer.vertical-wrap');
        if (correctContainer && !correctContainer.classList.contains('nextUpItems')) {
          log('Re-inserting into visible page');
          correctContainer.parentNode.insertBefore(section, correctContainer.nextSibling);
        }
      }
    }
  }

  async function handleNavigation() {
    const url = window.location.hash;
    log('handleNavigation called, url:', url);
    if (url === lastUrl || isProcessing) {
      log('Skipping - same url or processing');
      return;
    }
    lastUrl = url;
    isProcessing = true;

    try {
      if (!apiReady()) {
        log('API not ready');
        return;
      }

      addStyles();

      const params = getHashParams();
      const itemId = params?.get('id');
      log('Parsed itemId:', itemId);

      // Studio list page
      const studioId = params?.get('studioId');
      if (studioId && (url.includes('#/list') || url.includes('#!/list'))) {
        let studioName = null;

        // Try direct item lookup first
        const item = await getItemInfo(studioId);
        if (item?.Type === 'Studio') {
          studioName = item.Name;
        }

        // If that fails, get studio name from an item that belongs to this studio
        if (!studioName) {
          try {
            const uid = ApiClient.getCurrentUserId?.();
            const itemsUrl = ApiClient.getUrl('Items', {
              userId: uid,
              StudioIds: studioId,
              Recursive: true,
              Fields: 'Studios',
              Limit: 1
            });
            const resp = await fetchJson(itemsUrl);
            if (resp?.Items?.[0]?.Studios) {
              const studio = resp.Items[0].Studios.find(s => s.Id === studioId);
              if (studio) studioName = studio.Name;
            }
          } catch (e) {
            log('Studio lookup from items failed:', e.message);
          }
        }

        log('Studio list page, studioName:', studioName);
        if (studioName) {
          await loadStudioCatalog(studioName);
        }
        return;
      }

      // Details page - check for both #/details and #!/details patterns
      const isDetailsPage = url.includes('#/details') || url.includes('#!/details') || url.includes('#/item') || url.includes('#!/item');
      log('Is details page:', isDetailsPage);

      if (isDetailsPage) {
        if (!itemId) {
          log('No itemId found');
          return;
        }
        const item = await getItemInfo(itemId);
        log('Got item:', item?.Type, item?.Name);
        if (!item) return;

        if (item.Type === 'Person') {
          log('Loading person filmography for', item.Name);
          await loadPersonFilmography(item);
        } else if (item.Type === 'Studio') {
          log('Loading studio catalog for', item.Name);
          await loadStudioCatalog(item.Name);
        } else {
          log('Item type not handled:', item.Type);
        }
      }
    } catch (e) {
      log('Navigation error:', e);
    } finally {
      isProcessing = false;
    }
  }

  // Wait for API and start
  function waitForApi() {
    let tries = 0;
    const check = setInterval(() => {
      tries++;
      if (apiReady()) {
        clearInterval(check);
        log('API ready, starting');
        handleNavigation();
        window.addEventListener('hashchange', handleNavigation);
        document.addEventListener('viewshow', () => setTimeout(handleNavigation, 100));
      } else if (tries > CONFIG.pollMax) {
        clearInterval(check);
        log('API timeout');
      }
    }, CONFIG.pollMs);
  }

  waitForApi();
})();
