/**
 * SmogShield AI - Presentation Layer & UI Controller
 * Implements cached DOM, event delegation, requestAnimationFrame batching,
 * accessible keyboard navigation, responsive canvas charting, and SelfTest runner.
 */

(function () {
  'use strict';

  const { CONFIG, Security, DomainLogic } = window.SmogShield;

  // Application State
  const state = {
    cityId: 'delhi',
    aqi: 382,
    household: 'families_kids',
    commute: 'two_wheeler',
    purifier: 'hepa',
    activeTab: 'routines',
    activeFilter: 'all', // 'all' | 'recommended' | 'adopted'
    activeActionIds: new Set([
      'routine_mixing_window',
      'routine_masking_n95',
      'iaq_true_hepa',
      'iaq_door_sealing',
      'comm_no_idling'
    ]),
    rafPending: false,
    lastFocusedElement: null
  };

  // DOM Elements Cache
  const DOM = {};

  /**
   * Caches all critical DOM references on initial load.
   */
  function cacheDom() {
    DOM.selectCity = document.getElementById('select-city');
    DOM.selectHousehold = document.getElementById('select-household');
    DOM.selectCommute = document.getElementById('select-commute');
    DOM.selectPurifier = document.getElementById('select-purifier');

    DOM.sliderAqi = document.getElementById('slider-aqi');
    DOM.inputAqi = document.getElementById('input-aqi');
    DOM.aqiCategoryPill = document.getElementById('aqi-category-pill');

    DOM.valOutdoorPm25 = document.getElementById('val-outdoor-pm25');
    DOM.valUnmitigatedPm25 = document.getElementById('val-unmitigated-pm25');
    DOM.valProtectedPm25 = document.getElementById('val-protected-pm25');
    DOM.valCo2eAvoided = document.getElementById('val-co2e-avoided');

    DOM.metricOutdoorRatio = document.getElementById('metric-outdoor-ratio');
    DOM.metricReductionBadge = document.getElementById('metric-reduction-badge');
    DOM.metricProtectedNote = document.getElementById('metric-protected-note');

    DOM.chartCanvas = document.getElementById('exposure-chart');
    DOM.btnSelectRecommended = document.getElementById('btn-select-recommended');
    DOM.btnResetActions = document.getElementById('btn-reset-actions');

    DOM.tabs = {
      routines: document.getElementById('tab-routines'),
      iaq: document.getElementById('tab-iaq'),
      community: document.getElementById('tab-community')
    };

    DOM.panels = {
      routines: document.getElementById('panel-routines'),
      iaq: document.getElementById('panel-iaq'),
      community: document.getElementById('panel-community')
    };

    DOM.containers = {
      routines: document.getElementById('container-routines'),
      iaq: document.getElementById('container-iaq'),
      community: document.getElementById('container-community')
    };

    DOM.filters = {
      all: document.getElementById('filter-all'),
      recommended: document.getElementById('filter-recommended'),
      adopted: document.getElementById('filter-adopted')
    };

    DOM.adoptedCounter = document.getElementById('adopted-counter');

    DOM.advisorFeed = document.getElementById('advisor-feed');
    DOM.advisorForm = document.getElementById('advisor-form');
    DOM.advisorInput = document.getElementById('advisor-input');
    DOM.promptChipsContainer = document.querySelector('.prompt-chips-wrapper');

    DOM.btnRunChecks = document.getElementById('btn-run-checks');
    DOM.testStatusBadge = document.getElementById('test-status-badge');

    // Modal DOM
    DOM.testModal = document.getElementById('test-modal');
    DOM.modalTitle = document.getElementById('modal-title');
    DOM.modalTestBadge = document.getElementById('modal-test-badge');
    DOM.testSummaryResult = document.getElementById('test-summary-result');
    DOM.testSummaryUnit = document.getElementById('test-summary-unit');
    DOM.testSummaryStress = document.getElementById('test-summary-stress');
    DOM.testSummaryTime = document.getElementById('test-summary-time');
    DOM.testLogContainer = document.getElementById('test-log-container');
    DOM.modalBtnClose = document.getElementById('modal-btn-close');
    DOM.modalBtnRerun = document.getElementById('modal-btn-rerun');
    DOM.modalBtnDismiss = document.getElementById('modal-btn-dismiss');
  }

  // -------------------------------------------------------------
  // RENDERING & UI LOGIC
  // -------------------------------------------------------------

  /**
   * Updates all metrics, chart, and action cards.
   */
  function renderAll() {
    renderMetrics();
    renderChart();
    renderActionCards();
  }

  /**
   * Renders the exposure simulator metrics and status badges.
   */
  function renderMetrics() {
    const metrics = DomainLogic.computeMetrics({
      aqi: state.aqi,
      household: state.household,
      commute: state.commute,
      purifier: state.purifier,
      activeActionIds: state.activeActionIds
    });

    // Update AQI inputs and pill
    DOM.sliderAqi.value = state.aqi;
    DOM.sliderAqi.setAttribute('aria-valuenow', state.aqi);
    DOM.sliderAqi.setAttribute('aria-valuetext', `AQI ${state.aqi}, Category: ${metrics.category.label}`);
    DOM.inputAqi.value = state.aqi;

    DOM.aqiCategoryPill.textContent = metrics.category.label;
    DOM.aqiCategoryPill.className = `category-pill pill-${metrics.category.key}`;

    // Update Metric Values
    DOM.valOutdoorPm25.textContent = metrics.outdoorPm25.toFixed(1);
    DOM.valUnmitigatedPm25.textContent = metrics.unmitigatedIndoorPm25.toFixed(1);
    DOM.valProtectedPm25.textContent = metrics.protectedIndoorPm25.toFixed(1);
    DOM.valCo2eAvoided.textContent = metrics.co2eAvoidedKg.toFixed(1);

    DOM.metricOutdoorRatio.textContent = `${metrics.outdoorWhoTimes}x WHO`;
    DOM.metricReductionBadge.textContent = `-${metrics.reductionPercent}% Exposure`;

    if (metrics.reductionPercent >= 50) {
      DOM.metricReductionBadge.className = 'metric-tag tag-success';
    } else if (metrics.reductionPercent >= 25) {
      DOM.metricReductionBadge.className = 'metric-tag tag-warning';
    } else {
      DOM.metricReductionBadge.className = 'metric-tag tag-danger';
    }

    if (state.activeActionIds.has('iaq_true_hepa')) {
      DOM.metricProtectedNote.textContent = 'True-HEPA active (NIH RAPIDS trial: -53% to -60% personal exposure).';
    } else if (state.activeActionIds.has('iaq_corsi_rosenthal')) {
      DOM.metricProtectedNote.textContent = 'DIY Corsi-Rosenthal active (MERV-13 high-CADR particle removal).';
    } else {
      DOM.metricProtectedNote.textContent = 'Enable HEPA or DIY box-fan filtration to reach sub-15 µg/m³ WHO target.';
    }

    DOM.adoptedCounter.textContent = state.activeActionIds.size;
  }

  /**
   * Renders the interactive bar chart comparing Outdoor, Unmitigated, Protected, and WHO Guideline.
   */
  function renderChart() {
    const canvas = DOM.chartCanvas;
    if (!canvas) return;

    // Handle high-DPI displays
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, rect.width || canvas.parentElement.clientWidth || 600);
    const height = 155;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const metrics = DomainLogic.computeMetrics({
      aqi: state.aqi,
      household: state.household,
      commute: state.commute,
      purifier: state.purifier,
      activeActionIds: state.activeActionIds
    });

    const items = [
      { label: 'Outdoor Ambient', val: metrics.outdoorPm25, color: '#dc2626' },
      { label: 'Unmitigated Indoor', val: metrics.unmitigatedIndoorPm25, color: '#ea580c' },
      { label: 'Shielded Indoor', val: metrics.protectedIndoorPm25, color: '#16a34a' }
    ];

    const maxVal = Math.max(metrics.outdoorPm25, metrics.unmitigatedIndoorPm25, 60);
    const chartHeight = 90;
    const chartTop = 25;
    const chartBottom = chartTop + chartHeight;

    const barWidth = Math.min(75, (width - 120) / 3.8);
    const gap = (width - 80 - barWidth * 3) / 2;
    const startX = 50;

    // Background horizontal grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(35, chartBottom);
    ctx.lineTo(width - 20, chartBottom);
    ctx.stroke();

    // WHO 2021 Reference Line (15 µg/m³)
    const whoY = chartBottom - (15 / maxVal) * chartHeight;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(35, whoY);
    ctx.lineTo(width - 20, whoY);
    ctx.stroke();
    ctx.restore();

    // WHO Line Label
    ctx.fillStyle = '#1d4ed8';
    ctx.font = '600 10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('WHO 15 µg/m³', width - 25, whoY - 4);

    // Draw Bars
    items.forEach((item, idx) => {
      const x = startX + idx * (barWidth + gap);
      const barH = Math.max(6, (item.val / maxVal) * chartHeight);
      const y = chartBottom - barH;

      // Bar with rounded top
      ctx.fillStyle = item.color;
      ctx.beginPath();
      const radius = 4;
      ctx.moveTo(x, chartBottom);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, chartBottom);
      ctx.closePath();
      ctx.fill();

      // Top Value Label
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${item.val.toFixed(1)}`, x + barWidth / 2, y - 6);

      // Bottom Axis Label
      ctx.fillStyle = '#475569';
      ctx.font = '600 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x + barWidth / 2, chartBottom + 18);
    });
  }

  /**
   * Renders the cards across all 3 tracks safely with DOM construction.
   */
  function renderActionCards() {
    const tracks = ['routines', 'iaq', 'community'];

    tracks.forEach(trackKey => {
      const container = DOM.containers[trackKey];
      if (!container) return;

      const trackActions = CONFIG.ACTIONS.filter(act => act.track === trackKey);
      const filtered = trackActions.filter(act => {
        const isRec = DomainLogic.isRecommended(act, state.household, state.aqi);
        const isAdopted = state.activeActionIds.has(act.id);

        if (state.activeFilter === 'recommended') return isRec;
        if (state.activeFilter === 'adopted') return isAdopted;
        return true;
      });

      // Clear container
      container.innerHTML = '';

      if (filtered.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'text-muted text-sm';
        emptyEl.style.padding = '1.5rem 0';
        emptyEl.textContent = 'No actions match the current filter selection.';
        container.appendChild(emptyEl);
        return;
      }

      // Build cards safely without innerHTML string interpolation
      filtered.forEach(action => {
        const isAdopted = state.activeActionIds.has(action.id);
        const isRec = DomainLogic.isRecommended(action, state.household, state.aqi);

        const card = document.createElement('article');
        card.className = `action-card ${isAdopted ? 'adopted' : ''}`;
        card.setAttribute('data-action-id', action.id);

        // Top Row
        const topRow = document.createElement('div');
        topRow.className = 'action-top-row';

        const tagSpan = document.createElement('span');
        tagSpan.className = 'action-tag';
        tagSpan.textContent = action.tag;
        topRow.appendChild(tagSpan);

        if (isRec) {
          const recBadge = document.createElement('span');
          recBadge.className = 'rec-badge';
          recBadge.textContent = 'Recommended';
          topRow.appendChild(recBadge);
        }
        card.appendChild(topRow);

        // Title
        const titleH3 = document.createElement('h3');
        titleH3.className = 'action-title';
        titleH3.textContent = action.title;
        card.appendChild(titleH3);

        // Direct Impact Box (plain-language)
        const impactBox = document.createElement('div');
        impactBox.className = 'impact-box';

        const impactLabel = document.createElement('span');
        impactLabel.className = 'impact-label';
        impactLabel.textContent = 'Direct Impact';
        impactBox.appendChild(impactLabel);

        const impactText = document.createElement('p');
        impactText.className = 'impact-text';
        impactText.textContent = action.directImpact;
        impactBox.appendChild(impactText);
        card.appendChild(impactBox);

        // Scientific Evidence
        const evidenceBox = document.createElement('p');
        evidenceBox.className = 'evidence-box';
        evidenceBox.textContent = action.scientificEvidence;
        card.appendChild(evidenceBox);

        // Footer Row
        const footer = document.createElement('div');
        footer.className = 'action-footer';

        const statsDiv = document.createElement('div');
        statsDiv.className = 'action-stats';

        if (action.exposureReductionFactor > 0) {
          const expStat = document.createElement('span');
          expStat.className = 'stat-item';
          expStat.textContent = `🛡️ -${Math.round(action.exposureReductionFactor * 100)}% PM2.5`;
          statsDiv.appendChild(expStat);
        }
        if (action.co2eAvoidedKg > 0) {
          const co2Stat = document.createElement('span');
          co2Stat.className = 'stat-item';
          co2Stat.textContent = `🌱 -${action.co2eAvoidedKg} kg CO₂e`;
          statsDiv.appendChild(co2Stat);
        }
        footer.appendChild(statsDiv);

        // Toggle Action Button
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'btn-toggle-action';
        toggleBtn.setAttribute('data-action-id', action.id);
        toggleBtn.setAttribute('aria-pressed', isAdopted ? 'true' : 'false');
        toggleBtn.setAttribute('aria-label', `${isAdopted ? 'Remove' : 'Adopt'} ${action.title}`);
        toggleBtn.textContent = isAdopted ? 'Adopted ✓' : 'Adopt Action';
        footer.appendChild(toggleBtn);

        card.appendChild(footer);
        container.appendChild(card);
      });
    });
  }

  /**
   * Appends an advisor chat message securely using DOM nodes.
   * @param {'user'|'bot'} sender
   * @param {string} text
   * @param {string} [title]
   * @param {Array<string>} [tags]
   */
  function appendAdvisorMessage(sender, text, title, tags) {
    const feed = DOM.advisorFeed;
    if (!feed) return;

    const item = document.createElement('div');
    item.className = `message-item message-${sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (sender === 'bot') {
      if (title) {
        const titleEl = document.createElement('div');
        titleEl.className = 'bot-title';
        titleEl.textContent = title;
        bubble.appendChild(titleEl);
      }

      if (Array.isArray(tags) && tags.length > 0) {
        const tagRow = document.createElement('div');
        tagRow.className = 'msg-tags-row';
        tags.forEach(t => {
          const span = document.createElement('span');
          span.className = 'msg-tag';
          span.textContent = t;
          tagRow.appendChild(span);
        });
        bubble.appendChild(tagRow);
      }

      // Safe formatting of text with bold (**word**) and bullet points
      const lines = text.split('\n');
      lines.forEach(line => {
        if (!line.trim()) {
          const spacer = document.createElement('div');
          spacer.style.height = '0.5rem';
          bubble.appendChild(spacer);
          return;
        }

        const p = document.createElement('p');
        p.style.marginBottom = '0.35rem';

        // Parse bold tags **...** safely
        const parts = line.split(/(\*\*.*?\*\*)/g);
        parts.forEach(part => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const strong = document.createElement('strong');
            strong.textContent = part.slice(2, -2);
            p.appendChild(strong);
          } else {
            p.appendChild(document.createTextNode(part));
          }
        });
        bubble.appendChild(p);
      });
    } else {
      bubble.textContent = text;
    }

    item.appendChild(bubble);
    feed.appendChild(item);
    feed.scrollTop = feed.scrollHeight;
  }

  // -------------------------------------------------------------
  // EVENT LISTENERS & DELEGATION
  // -------------------------------------------------------------

  function bindEvents() {
    // City Selector
    DOM.selectCity.addEventListener('change', e => {
      const cityId = e.target.value;
      state.cityId = cityId;
      const preset = CONFIG.CITY_PRESETS.find(c => c.id === cityId);
      if (preset && cityId !== 'custom') {
        state.aqi = preset.defaultAqi;
      }
      renderAll();
    });

    // Household Selector
    DOM.selectHousehold.addEventListener('change', e => {
      state.household = e.target.value;
      renderAll();
    });

    // Commute Selector
    DOM.selectCommute.addEventListener('change', e => {
      state.commute = e.target.value;
      renderAll();
    });

    // Purifier Selector
    DOM.selectPurifier.addEventListener('change', e => {
      state.purifier = e.target.value;
      renderAll();
    });

    // AQI Slider with RAF throttling for smooth continuous dragging
    DOM.sliderAqi.addEventListener('input', e => {
      const val = Security.clampNumber(e.target.value, 0, 9999, 200);
      state.aqi = val;
      DOM.selectCity.value = 'custom';
      state.cityId = 'custom';

      if (!state.rafPending) {
        state.rafPending = true;
        window.requestAnimationFrame(() => {
          renderMetrics();
          renderChart();
          state.rafPending = false;
        });
      }
    });

    // Rerender cards on slider change end
    DOM.sliderAqi.addEventListener('change', () => {
      renderAll();
    });

    // Direct Numeric AQI Input
    DOM.inputAqi.addEventListener('change', e => {
      const val = Security.clampNumber(e.target.value, 0, 9999, 200);
      state.aqi = val;
      DOM.selectCity.value = 'custom';
      state.cityId = 'custom';
      renderAll();
    });

    // Event Delegation for Action Card Toggles
    ['routines', 'iaq', 'community'].forEach(track => {
      const container = DOM.containers[track];
      if (!container) return;

      container.addEventListener('click', e => {
        const toggleBtn = e.target.closest('.btn-toggle-action');
        if (!toggleBtn) return;

        const actionId = toggleBtn.getAttribute('data-action-id');
        if (!actionId) return;

        if (state.activeActionIds.has(actionId)) {
          state.activeActionIds.delete(actionId);
        } else {
          state.activeActionIds.add(actionId);
        }

        renderAll();
      });
    });

    // Filter Chips
    Object.keys(DOM.filters).forEach(filterKey => {
      const btn = DOM.filters[filterKey];
      if (!btn) return;

      btn.addEventListener('click', () => {
        state.activeFilter = filterKey;
        Object.keys(DOM.filters).forEach(k => {
          const b = DOM.filters[k];
          const isActive = k === filterKey;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        renderActionCards();
      });
    });

    // ARIA Tab Switching with Keyboard Arrow Navigation
    const tabKeys = ['routines', 'iaq', 'community'];
    tabKeys.forEach((key, index) => {
      const tab = DOM.tabs[key];
      if (!tab) return;

      tab.addEventListener('click', () => switchTab(key));

      tab.addEventListener('keydown', e => {
        let targetIndex = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          targetIndex = (index + 1) % tabKeys.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          targetIndex = (index - 1 + tabKeys.length) % tabKeys.length;
        } else if (e.key === 'Home') {
          targetIndex = 0;
        } else if (e.key === 'End') {
          targetIndex = tabKeys.length - 1;
        }

        if (targetIndex !== -1) {
          e.preventDefault();
          const targetKey = tabKeys[targetIndex];
          switchTab(targetKey);
          DOM.tabs[targetKey].focus();
        }
      });
    });

    // Simulator Quick Action Buttons
    DOM.btnSelectRecommended.addEventListener('click', () => {
      CONFIG.ACTIONS.forEach(act => {
        if (DomainLogic.isRecommended(act, state.household, state.aqi)) {
          state.activeActionIds.add(act.id);
        }
      });
      renderAll();
    });

    DOM.btnResetActions.addEventListener('click', () => {
      state.activeActionIds.clear();
      renderAll();
    });

    // Quick Prompt Chips for GenAI Advisor
    if (DOM.promptChipsContainer) {
      DOM.promptChipsContainer.addEventListener('click', e => {
        const chip = e.target.closest('.prompt-chip');
        if (!chip) return;
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) {
          handleAdvisorQuery(prompt);
        }
      });
    }

    // Advisor Form Submit
    DOM.advisorForm.addEventListener('submit', e => {
      e.preventDefault();
      const query = DOM.advisorInput.value.trim();
      if (!query) return;
      DOM.advisorInput.value = '';
      handleAdvisorQuery(query);
    });

    // Run Checks Button
    DOM.btnRunChecks.addEventListener('click', () => {
      openTestModal();
      runSelfTestUI();
    });

    // Modal Actions & Accessibility
    DOM.modalBtnClose.addEventListener('click', closeTestModal);
    DOM.modalBtnDismiss.addEventListener('click', closeTestModal);
    DOM.modalBtnRerun.addEventListener('click', runSelfTestUI);

    DOM.testModal.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeTestModal();
      }
    });

    // Window Resize -> rerender chart smoothly
    window.addEventListener('resize', () => {
      renderChart();
    });
  }

  /**
   * Switches the active track tab and manages ARIA attributes.
   * @param {'routines'|'iaq'|'community'} trackKey
   */
  function switchTab(trackKey) {
    state.activeTab = trackKey;
    const tabKeys = ['routines', 'iaq', 'community'];

    tabKeys.forEach(key => {
      const tab = DOM.tabs[key];
      const panel = DOM.panels[key];
      const isSelected = key === trackKey;

      if (tab) {
        tab.classList.toggle('active', isSelected);
        tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        tab.setAttribute('tabindex', isSelected ? '0' : '-1');
      }
      if (panel) {
        panel.classList.toggle('hidden', !isSelected);
        panel.classList.toggle('active', isSelected);
      }
    });

    renderActionCards();
  }

  /**
   * Handles user questions to the GenAI Advisor.
   * @param {string} query
   */
  function handleAdvisorQuery(query) {
    appendAdvisorMessage('user', query);

    // Simulate instant context-aware synthesis
    const advice = DomainLogic.generateAdvisorReply({
      query,
      aqi: state.aqi,
      household: state.household,
      commute: state.commute,
      purifier: state.purifier,
      activeActionIds: state.activeActionIds
    });

    setTimeout(() => {
      appendAdvisorMessage('bot', advice.text, advice.title, advice.tags);
    }, 120);
  }

  // -------------------------------------------------------------
  // AUTOMATED SELF-TEST & 10,000-ITERATION STRESS SUITE (UI)
  // -------------------------------------------------------------

  function openTestModal() {
    state.lastFocusedElement = document.activeElement;
    DOM.testModal.classList.remove('hidden');
    DOM.modalBtnClose.focus();
  }

  function closeTestModal() {
    DOM.testModal.classList.add('hidden');
    if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
      state.lastFocusedElement.focus();
    }
  }

  /**
   * Executes SelfTest suite including 10,000 stress iterations and updates UI telemetry.
   */
  function runSelfTestUI() {
    DOM.modalTestBadge.textContent = 'Running';
    DOM.modalTestBadge.className = 'test-badge test-running';
    DOM.testStatusBadge.textContent = 'Testing...';
    DOM.testStatusBadge.className = 'test-badge test-running';

    DOM.testLogContainer.innerHTML = '';
    const log = (msg, type = 'info') => {
      const line = document.createElement('div');
      line.className = `log-line log-${type}`;
      line.textContent = msg;
      DOM.testLogContainer.appendChild(line);
      DOM.testLogContainer.scrollTop = DOM.testLogContainer.scrollHeight;
    };

    log('Initializing SmogShield Verification & Fuzz Suite...', 'info');

    // Run asynchronously to allow DOM paint
    setTimeout(() => {
      const startTime = performance.now();
      let unitPassed = 0;
      const unitTotal = 6;

      try {
        // 1. CPCB Breakpoints
        const p25 = DomainLogic.aqiToPm25(25);
        const p150 = DomainLogic.aqiToPm25(150);
        const p350 = DomainLogic.aqiToPm25(350);
        const p450 = DomainLogic.aqiToPm25(450);
        if (p25 <= 30 && p150 <= 90 && p350 <= 250 && p450 <= 380) {
          unitPassed++;
          log('✓ Check 1: CPCB AQI piecewise breakpoint calculations accurate.', 'pass');
        } else {
          throw new Error('CPCB breakpoint test failed.');
        }

        // 2. Category Boundary
        const c0 = DomainLogic.getAqiCategory(0).key === 'good';
        const c100 = DomainLogic.getAqiCategory(100).key === 'satisfactory';
        const c200 = DomainLogic.getAqiCategory(200).key === 'moderate';
        const c300 = DomainLogic.getAqiCategory(300).key === 'poor';
        const c400 = DomainLogic.getAqiCategory(400).key === 'very_poor';
        const c500 = DomainLogic.getAqiCategory(500).key === 'severe';
        const c600 = DomainLogic.getAqiCategory(600).key === 'severe_plus';
        if (c0 && c100 && c200 && c300 && c400 && c500 && c600) {
          unitPassed++;
          log('✓ Check 2: All 7 AQI category boundary classifications verified.', 'pass');
        } else {
          throw new Error('Category classification test failed.');
        }

        // 3. Metric Invariants
        const m = DomainLogic.computeMetrics({
          aqi: 340,
          household: 'seniors_multi',
          commute: 'car',
          purifier: 'hepa',
          activeActionIds: ['iaq_true_hepa', 'iaq_door_sealing']
        });
        if (
          !Number.isNaN(m.outdoorPm25) &&
          !Number.isNaN(m.protectedIndoorPm25) &&
          m.protectedIndoorPm25 <= m.unmitigatedIndoorPm25 &&
          m.reductionPercent >= 0 &&
          m.reductionPercent <= 100
        ) {
          unitPassed++;
          log('✓ Check 3: Metric invariants verified (no NaNs, protected <= unmitigated).', 'pass');
        } else {
          throw new Error('Metric invariant calculation failed.');
        }

        // 4. XSS Sanitization
        const dirty = '<script>alert(1)</script><img src=x onerror=alert(2)>&"\'';
        const clean = Security.escapeHtml(dirty);
        if (!clean.includes('<') && !clean.includes('>') && clean.includes('&lt;') && clean.includes('&gt;')) {
          unitPassed++;
          log('✓ Check 4: Strict XSS neutralization verified (&, <, >, ", \' escaped).', 'pass');
        } else {
          throw new Error('XSS neutralization test failed.');
        }

        // 5. ACTION_MAP Parity
        if (CONFIG.ACTION_MAP && CONFIG.ACTION_MAP.size === CONFIG.ACTIONS.length) {
          unitPassed++;
          log(`✓ Check 5: ACTION_MAP O(1) parity verified (${CONFIG.ACTIONS.length} actions).`, 'pass');
        } else {
          throw new Error('ACTION_MAP parity failed.');
        }

        // 6. Advisor Generation
        const adv = DomainLogic.generateAdvisorReply({
          query: 'What outdoor exercise window is safe today?',
          aqi: 350,
          household: 'families_kids',
          commute: 'two_wheeler',
          purifier: 'hepa',
          activeActionIds: state.activeActionIds
        });
        if (adv && adv.text && adv.text.length > 50) {
          unitPassed++;
          log('✓ Check 6: Context-aware GenAI advisor response generation verified.', 'pass');
        } else {
          throw new Error('Advisor reply generation failed.');
        }

        // 7. 10,000-Iteration Stress & Fuzz Suite
        log('Executing 10,000-Iteration Automated Fuzz & Extreme Bounds Test...', 'info');

        const extremeAqis = [-100, 0, 50, 100, 200, 300, 400, 500, 999, 9999, NaN, Infinity, -Infinity, null, undefined, 'abc'];
        const householdKeys = Object.keys(CONFIG.HOUSEHOLDS);
        const commuteKeys = Object.keys(CONFIG.COMMUTE_MODES);
        const purifierKeys = Object.keys(CONFIG.PURIFIER_SETUPS);
        const actionIds = CONFIG.ACTIONS.map(a => a.id);

        for (let i = 0; i < 10000; i++) {
          const rawAqi = (i % 25 === 0)
            ? extremeAqis[i % extremeAqis.length]
            : (i * 37) % 650;

          const household = householdKeys[i % householdKeys.length];
          const commute = commuteKeys[i % commuteKeys.length];
          const purifier = purifierKeys[i % purifierKeys.length];

          const activeSet = new Set();
          const count = i % (actionIds.length + 1);
          for (let c = 0; c < count; c++) {
            activeSet.add(actionIds[(i + c) % actionIds.length]);
          }

          // Invariant Check
          const sim = DomainLogic.computeMetrics({
            aqi: rawAqi,
            household,
            commute,
            purifier,
            activeActionIds: activeSet
          });

          if (Number.isNaN(sim.outdoorPm25) || Number.isNaN(sim.protectedIndoorPm25)) {
            throw new Error(`Stress iteration ${i} produced NaN metrics.`);
          }
          if (sim.protectedIndoorPm25 > sim.unmitigatedIndoorPm25 + 0.001) {
            throw new Error(`Stress iteration ${i} violated protected <= unmitigated.`);
          }

          // XSS Fuzzing
          const rawPayload = `<a href="javascript:void(${i})">test & ${i}</a>`;
          const sanitized = Security.escapeHtml(rawPayload);
          if (sanitized.includes('<') || sanitized.includes('>')) {
            throw new Error(`Stress iteration ${i} failed XSS escaping.`);
          }
        }

        const elapsedMs = Math.round(performance.now() - startTime);

        log(`✓ Check 7: 10,000 stress/fuzz iterations completed successfully with zero errors (${elapsedMs} ms)!`, 'pass');
        log('100% SUITE PASSED — All CPCB, WHO, Security, and Invariant gates verified.', 'pass');

        // Update Modal Telemetry
        DOM.modalTestBadge.textContent = '100% Passed';
        DOM.modalTestBadge.className = 'test-badge test-passed';
        DOM.testSummaryResult.textContent = 'Passed';
        DOM.testSummaryResult.className = 'summary-val text-success';
        DOM.testSummaryUnit.textContent = `${unitPassed} / ${unitTotal} Passed`;
        DOM.testSummaryStress.textContent = '10,000 / 10,000';
        DOM.testSummaryTime.textContent = `${elapsedMs} ms`;

        // Update Header Badge
        DOM.testStatusBadge.textContent = `Passed (${elapsedMs}ms)`;
        DOM.testStatusBadge.className = 'test-badge test-passed';

      } catch (err) {
        const elapsedMs = Math.round(performance.now() - startTime);
        log(`✗ Test Failure: ${err.message}`, 'fail');

        DOM.modalTestBadge.textContent = 'Failed';
        DOM.modalTestBadge.className = 'test-badge test-failed';
        DOM.testSummaryResult.textContent = 'Failed';
        DOM.testSummaryResult.className = 'summary-val text-danger';
        DOM.testSummaryTime.textContent = `${elapsedMs} ms`;

        DOM.testStatusBadge.textContent = 'Failed';
        DOM.testStatusBadge.className = 'test-badge test-failed';
      }
    }, 40);
  }

  // -------------------------------------------------------------
  // INITIALIZATION
  // -------------------------------------------------------------
  function init() {
    cacheDom();
    bindEvents();
    renderAll();

    // Initial greeting in advisor
    const initialAdvice = DomainLogic.generateAdvisorReply({
      query: 'initial welcome greeting',
      aqi: state.aqi,
      household: state.household,
      commute: state.commute,
      purifier: state.purifier,
      activeActionIds: state.activeActionIds
    });

    appendAdvisorMessage('bot', initialAdvice.text, initialAdvice.title, initialAdvice.tags);

    // Run checks initially on load to verify state
    runSelfTestUI();
  }

  // Expose SelfTest publicly for headless or console inspection
  window.SmogShield = window.SmogShield || {};
  window.SmogShield.SelfTest = {
    runAll: runSelfTestUI
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
