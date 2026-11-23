/**
 * SmogShield AI - Presentation Layer & UI Controller
 * Implements cached DOM, reactive store, requestAnimationFrame batching,
 * accessible keyboard navigation, responsive canvas charting, and SelfTest runner.
 *
 * @module SmogShieldUI
 */

(function () {
  'use strict';

  const { CONFIG, Security, DomainLogic, SelfTest } = window.SmogShield;

  // -------------------------------------------------------------
  // 1. REACTIVE STORE & APPLICATION STATE
  // -------------------------------------------------------------

  /**
   * Factory creating a unidirectional reactive state store with RAF batching.
   * @param {Object} initialState
   * @param {Function} onStateChange
   * @returns {{ getState: () => Object, setState: (partial: Object) => void, subscribe: (fn: Function) => void }}
   */
  function createStore(initialState, onStateChange) {
    let currentState = Object.assign({}, initialState);
    let rafId = null;

    function notify() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        onStateChange(currentState);
        rafId = null;
      });
    }

    return {
      getState() {
        return currentState;
      },
      setState(partial) {
        currentState = Object.assign({}, currentState, partial);
        notify();
      }
    };
  }

  // Initial State Definition
  const store = createStore(
    {
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
      lastFocusedElement: null
    },
    // Synchronize UI whenever state transitions
    (updatedState) => {
      renderMetrics(updatedState);
      renderChart(updatedState);
      renderActionCards(updatedState);
    }
  );

  /**
   * Cached DOM Elements.
   */
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
    DOM.btnPrintPlan = document.getElementById('btn-print-plan');

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

    // Self-Test Modal Elements
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
  // 2. RENDERING & UI LOGIC
  // -------------------------------------------------------------

  /**
   * Renders the exposure simulator metrics and status badges.
   * @param {Object} [stateSnapshot]
   */
  function renderMetrics(stateSnapshot) {
    const s = stateSnapshot || store.getState();
    const metrics = DomainLogic.computeMetrics({
      aqi: s.aqi,
      household: s.household,
      commute: s.commute,
      purifier: s.purifier,
      activeActionIds: s.activeActionIds
    });

    // Update AQI controls and category pill
    if (DOM.sliderAqi) {
      DOM.sliderAqi.value = s.aqi;
      DOM.sliderAqi.setAttribute('aria-valuenow', s.aqi);
      DOM.sliderAqi.setAttribute('aria-valuetext', `AQI ${s.aqi}, Category: ${metrics.category.label}`);
    }
    if (DOM.inputAqi) {
      DOM.inputAqi.value = s.aqi;
    }

    if (DOM.aqiCategoryPill) {
      DOM.aqiCategoryPill.textContent = metrics.category.label;
      DOM.aqiCategoryPill.className = `category-pill pill-${metrics.category.key}`;
    }

    // Numerical Metric Values
    if (DOM.valOutdoorPm25) DOM.valOutdoorPm25.textContent = metrics.outdoorPm25.toFixed(1);
    if (DOM.valUnmitigatedPm25) DOM.valUnmitigatedPm25.textContent = metrics.unmitigatedIndoorPm25.toFixed(1);
    if (DOM.valProtectedPm25) DOM.valProtectedPm25.textContent = metrics.protectedIndoorPm25.toFixed(1);
    if (DOM.valCo2eAvoided) DOM.valCo2eAvoided.textContent = metrics.co2eAvoidedKg.toFixed(1);

    // Badges & Status Indicators
    if (DOM.metricOutdoorRatio) {
      DOM.metricOutdoorRatio.textContent = `${metrics.outdoorWhoTimes}x WHO`;
    }
    if (DOM.metricReductionBadge) {
      DOM.metricReductionBadge.textContent = `-${metrics.reductionPercent}% Exposure`;
      if (metrics.reductionPercent >= 50) {
        DOM.metricReductionBadge.className = 'metric-tag tag-success';
      } else if (metrics.reductionPercent >= 25) {
        DOM.metricReductionBadge.className = 'metric-tag tag-warning';
      } else {
        DOM.metricReductionBadge.className = 'metric-tag tag-danger';
      }
    }

    // Contextual Note
    if (DOM.metricProtectedNote) {
      if (s.activeActionIds.has('iaq_true_hepa')) {
        DOM.metricProtectedNote.textContent = 'True-HEPA active (NIH RAPIDS trial: -53% to -60% personal exposure).';
      } else if (s.activeActionIds.has('iaq_corsi_rosenthal')) {
        DOM.metricProtectedNote.textContent = 'DIY Corsi-Rosenthal active (MERV-13 high-CADR particle removal).';
      } else {
        DOM.metricProtectedNote.textContent = 'Enable HEPA or DIY box-fan filtration to reach sub-15 µg/m³ WHO target.';
      }
    }

    if (DOM.adoptedCounter) {
      DOM.adoptedCounter.textContent = s.activeActionIds.size;
    }
  }

  /**
   * Draws the baseline grid and the WHO 2021 reference limit dashed line.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} chartBottom
   * @param {number} maxVal
   * @param {number} chartHeight
   */
  function drawChartGridAndReferenceLine(ctx, width, chartBottom, maxVal, chartHeight) {
    // Background horizontal baseline
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
  }

  /**
   * Draws the comparison bars and value labels on the chart.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<{label: string, val: number, color: string}>} items
   * @param {number} startX
   * @param {number} barWidth
   * @param {number} gap
   * @param {number} maxVal
   * @param {number} chartHeight
   * @param {number} chartBottom
   */
  function drawChartBars(ctx, items, startX, barWidth, gap, maxVal, chartHeight, chartBottom) {
    items.forEach((item, idx) => {
      const x = startX + idx * (barWidth + gap);
      const barH = Math.max(6, (item.val / maxVal) * chartHeight);
      const y = chartBottom - barH;

      // Bar with rounded top corners
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

      // Numerical Value on top of bar
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${item.val.toFixed(1)}`, x + barWidth / 2, y - 6);

      // Label below bar
      ctx.fillStyle = '#475569';
      ctx.font = '600 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x + barWidth / 2, chartBottom + 18);
    });
  }

  /**
   * Renders the interactive bar chart comparing Outdoor, Unmitigated, Protected, and WHO Guideline.
   * @param {Object} [stateSnapshot]
   */
  function renderChart(stateSnapshot) {
    const canvas = DOM.chartCanvas;
    if (!canvas) return;

    const s = stateSnapshot || store.getState();

    // High-DPI screen calibration
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, rect.width || canvas.parentElement.clientWidth || 600);
    const height = 155;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const metrics = DomainLogic.computeMetrics({
      aqi: s.aqi,
      household: s.household,
      commute: s.commute,
      purifier: s.purifier,
      activeActionIds: s.activeActionIds
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

    drawChartGridAndReferenceLine(ctx, width, chartBottom, maxVal, chartHeight);
    drawChartBars(ctx, items, startX, barWidth, gap, maxVal, chartHeight, chartBottom);
  }

  /**
   * Safely constructs an individual recommendation card element using DOM nodes.
   * @private
   * @param {Object} action - Action item definition.
   * @param {boolean} isAdopted - Whether action is adopted.
   * @param {boolean} isRec - Whether action is recommended for current profile.
   * @returns {HTMLElement} Constructed card element.
   */
  function createActionCardElement(action, isAdopted, isRec) {
    const card = document.createElement('article');
    card.className = `action-card ${isAdopted ? 'adopted' : ''}`;
    card.setAttribute('data-action-id', action.id);

    // Top metadata row
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

    // Action Title
    const titleH3 = document.createElement('h3');
    titleH3.className = 'action-title';
    titleH3.textContent = action.title;
    card.appendChild(titleH3);

    // Plain-Language Direct Impact Box
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

    // Scientific Evidence Box
    const evidenceBox = document.createElement('p');
    evidenceBox.className = 'evidence-box';
    evidenceBox.textContent = action.scientificEvidence;
    card.appendChild(evidenceBox);

    // Footer with stats and toggle button
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
    return card;
  }

  /**
   * Renders the cards across all 3 tracks safely with clean DOM construction.
   * @param {Object} [stateSnapshot]
   */
  function renderActionCards(stateSnapshot) {
    const s = stateSnapshot || store.getState();
    const tracks = ['routines', 'iaq', 'community'];

    tracks.forEach(trackKey => {
      const container = DOM.containers[trackKey];
      if (!container) return;

      const trackActions = CONFIG.ACTIONS.filter(act => act.track === trackKey);
      const filtered = trackActions.filter(act => {
        const isRec = DomainLogic.isRecommended(act, s.household, s.aqi);
        const isAdopted = s.activeActionIds.has(act.id);

        if (s.activeFilter === 'recommended') return isRec;
        if (s.activeFilter === 'adopted') return isAdopted;
        return true;
      });

      // Clear container safely
      container.innerHTML = '';

      if (filtered.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'text-muted text-sm';
        emptyEl.style.padding = '1.5rem 0';
        emptyEl.textContent = 'No actions match the current filter selection.';
        container.appendChild(emptyEl);
        return;
      }

      // Build cards using dedicated modular helper
      filtered.forEach(action => {
        const isAdopted = s.activeActionIds.has(action.id);
        const isRec = DomainLogic.isRecommended(action, s.household, s.aqi);
        const cardEl = createActionCardElement(action, isAdopted, isRec);
        container.appendChild(cardEl);
      });
    });
  }

  /**
   * Safe micro-markdown to DOM element parser.
   * Supports bold, inline code, and line breaks without innerHTML.
   * @private
   * @param {HTMLElement} parent
   * @param {string} text
   */
  function formatAndAppendParagraphs(parent, text) {
    const lines = text.split('\n');
    lines.forEach(line => {
      if (!line.trim()) {
        const spacer = document.createElement('div');
        spacer.style.height = '0.5rem';
        parent.appendChild(spacer);
        return;
      }

      const p = document.createElement('p');
      p.style.marginBottom = '0.35rem';

      // Parse bold **...** segments without innerHTML
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
      parent.appendChild(p);
    });
  }

  /**
   * Appends an advisor chat message securely using DOM nodes.
   * @param {'user'|'bot'} sender
   * @param {string} text
   * @param {string} [title]
   * @param {string[]} [tags]
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

      formatAndAppendParagraphs(bubble, text);
    } else {
      bubble.textContent = text;
    }

    item.appendChild(bubble);
    feed.appendChild(item);
    feed.scrollTop = feed.scrollHeight;
  }

  // -------------------------------------------------------------
  // 3. EVENT BINDINGS (Modular Single-Responsibility Sub-functions)
  // -------------------------------------------------------------

  /**
   * Binds configurator selector changes to reactive store.
   * @private
   */
  function bindConfiguratorEvents() {
    DOM.selectCity.addEventListener('change', e => {
      const cityId = e.target.value;
      const preset = CONFIG.CITY_PRESETS.find(c => c.id === cityId);
      if (preset && cityId !== 'custom') {
        store.setState({ cityId, aqi: preset.defaultAqi });
      } else {
        store.setState({ cityId });
      }
    });

    DOM.selectHousehold.addEventListener('change', e => {
      store.setState({ household: e.target.value });
    });

    DOM.selectCommute.addEventListener('change', e => {
      store.setState({ commute: e.target.value });
    });

    DOM.selectPurifier.addEventListener('change', e => {
      store.setState({ purifier: e.target.value });
    });
  }

  /**
   * Binds AQI slider and numeric input synchronization.
   * @private
   */
  function bindAqiControlEvents() {
    DOM.sliderAqi.addEventListener('input', e => {
      const aqi = Security.clampNumber(e.target.value, 0, 9999, 200);
      DOM.selectCity.value = 'custom';
      store.setState({ aqi, cityId: 'custom' });
    });

    DOM.inputAqi.addEventListener('change', e => {
      const aqi = Security.clampNumber(e.target.value, 0, 9999, 200);
      DOM.selectCity.value = 'custom';
      store.setState({ aqi, cityId: 'custom' });
    });
  }

  /**
   * Binds event delegation on action tracks, filter chips, and tab navigation.
   * @private
   */
  function bindActionTrackEvents() {
    // Delegated toggle listener on action containers
    ['routines', 'iaq', 'community'].forEach(track => {
      const container = DOM.containers[track];
      if (!container) return;

      container.addEventListener('click', e => {
        const toggleBtn = e.target.closest('.btn-toggle-action');
        if (!toggleBtn) return;

        const actionId = toggleBtn.getAttribute('data-action-id');
        if (!actionId) return;

        const currentSet = new Set(store.getState().activeActionIds);
        if (currentSet.has(actionId)) {
          currentSet.delete(actionId);
        } else {
          currentSet.add(actionId);
        }

        store.setState({ activeActionIds: currentSet });
      });
    });

    // Filter Chips
    Object.keys(DOM.filters).forEach(filterKey => {
      const btn = DOM.filters[filterKey];
      if (!btn) return;

      btn.addEventListener('click', () => {
        Object.keys(DOM.filters).forEach(k => {
          const b = DOM.filters[k];
          const isActive = k === filterKey;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        store.setState({ activeFilter: filterKey });
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

    // Quick Action Buttons
    DOM.btnSelectRecommended.addEventListener('click', () => {
      const currentSet = new Set(store.getState().activeActionIds);
      const s = store.getState();
      CONFIG.ACTIONS.forEach(act => {
        if (DomainLogic.isRecommended(act, s.household, s.aqi)) {
          currentSet.add(act.id);
        }
      });
      store.setState({ activeActionIds: currentSet });
    });

    DOM.btnResetActions.addEventListener('click', () => {
      store.setState({ activeActionIds: new Set() });
    });

    if (DOM.btnPrintPlan) {
      DOM.btnPrintPlan.addEventListener('click', () => {
        window.print();
      });
    }
  }

  /**
   * Binds advisor prompt chips and form submission.
   * @private
   */
  function bindAdvisorEvents() {
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

    DOM.advisorForm.addEventListener('submit', e => {
      e.preventDefault();
      const query = DOM.advisorInput.value.trim();
      if (!query) return;
      DOM.advisorInput.value = '';
      handleAdvisorQuery(query);
    });
  }

  /**
   * Binds modal dialog actions, keyboard escape, focus trap, and chart resizing.
   * @private
   */
  function bindModalEvents() {
    DOM.btnRunChecks.addEventListener('click', () => {
      openTestModal();
      runSelfTestUI();
    });

    DOM.modalBtnClose.addEventListener('click', closeTestModal);
    DOM.modalBtnDismiss.addEventListener('click', closeTestModal);
    DOM.modalBtnRerun.addEventListener('click', runSelfTestUI);

    // WCAG Compliant Modal Focus Trap & Escape Handling
    DOM.testModal.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeTestModal();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = [
          DOM.modalBtnClose,
          DOM.testLogContainer,
          DOM.modalBtnRerun,
          DOM.modalBtnDismiss
        ].filter(Boolean);

        if (focusable.length === 0) return;

        const firstEl = focusable[0];
        const lastEl = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    });

    // High performance ResizeObserver with window resize fallback
    if (typeof window.ResizeObserver === 'function' && DOM.chartCanvas && DOM.chartCanvas.parentElement) {
      const resizeObserver = new window.ResizeObserver(() => {
        renderChart();
      });
      resizeObserver.observe(DOM.chartCanvas.parentElement);
    } else {
      window.addEventListener('resize', () => {
        renderChart();
      });
    }
  }

  /**
   * Master event initialization.
   */
  function bindEvents() {
    bindConfiguratorEvents();
    bindAqiControlEvents();
    bindActionTrackEvents();
    bindAdvisorEvents();
    bindModalEvents();
  }

  /**
   * Switches the active track tab and manages ARIA attributes.
   * @param {'routines'|'iaq'|'community'} trackKey
   */
  function switchTab(trackKey) {
    store.setState({ activeTab: trackKey });
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
  }

  /**
   * Handles user questions to the GenAI Advisor.
   * @param {string} query
   */
  function handleAdvisorQuery(query) {
    appendAdvisorMessage('user', query);

    const s = store.getState();
    const advice = DomainLogic.generateAdvisorReply({
      query,
      aqi: s.aqi,
      household: s.household,
      commute: s.commute,
      purifier: s.purifier,
      activeActionIds: s.activeActionIds
    });

    setTimeout(() => {
      appendAdvisorMessage('bot', advice.text, advice.title, advice.tags);
    }, 120);
  }

  // -------------------------------------------------------------
  // 4. AUTOMATED SELF-TEST & 10,000-ITERATION STRESS SUITE (UI)
  // -------------------------------------------------------------

  function openTestModal() {
    store.setState({ lastFocusedElement: document.activeElement });
    DOM.testModal.classList.remove('hidden');
    DOM.modalBtnClose.focus();
  }

  function closeTestModal() {
    DOM.testModal.classList.add('hidden');
    const lastFocused = store.getState().lastFocusedElement;
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  /**
   * Executes SelfTest suite including 10,000 stress iterations via the shared engine
   * and updates UI telemetry and terminal logs.
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

    // Run asynchronously to allow browser paint
    setTimeout(() => {
      const result = SelfTest.runAll({
        onLog: log,
        stressIterations: 10000
      });

      if (result.passed) {
        DOM.modalTestBadge.textContent = '100% Passed';
        DOM.modalTestBadge.className = 'test-badge test-passed';
        DOM.testSummaryResult.textContent = 'Passed';
        DOM.testSummaryResult.className = 'summary-val text-success';
        DOM.testSummaryUnit.textContent = `${result.unitPassed} / ${result.unitTotal} Passed`;
        DOM.testSummaryStress.textContent = `${result.stressIterations.toLocaleString()} / ${result.stressIterations.toLocaleString()}`;
        DOM.testSummaryTime.textContent = `${result.elapsedMs} ms`;

        DOM.testStatusBadge.textContent = `Passed (${result.elapsedMs}ms)`;
        DOM.testStatusBadge.className = 'test-badge test-passed';
      } else {
        DOM.modalTestBadge.textContent = 'Failed';
        DOM.modalTestBadge.className = 'test-badge test-failed';
        DOM.testSummaryResult.textContent = 'Failed';
        DOM.testSummaryResult.className = 'summary-val text-danger';
        DOM.testSummaryTime.textContent = `${result.elapsedMs} ms`;

        DOM.testStatusBadge.textContent = 'Failed';
        DOM.testStatusBadge.className = 'test-badge test-failed';
      }
    }, 40);
  }

  // -------------------------------------------------------------
  // 5. INITIALIZATION
  // -------------------------------------------------------------
  function init() {
    cacheDom();
    bindEvents();

    const initialSnapshot = store.getState();
    renderMetrics(initialSnapshot);
    renderChart(initialSnapshot);
    renderActionCards(initialSnapshot);

    // Initial contextual welcome greeting in advisor
    const initialAdvice = DomainLogic.generateAdvisorReply({
      query: 'initial welcome greeting',
      aqi: initialSnapshot.aqi,
      household: initialSnapshot.household,
      commute: initialSnapshot.commute,
      purifier: initialSnapshot.purifier,
      activeActionIds: initialSnapshot.activeActionIds
    });

    appendAdvisorMessage('bot', initialAdvice.text, initialAdvice.title, initialAdvice.tags);

    // Run checks initially on load to verify state
    runSelfTestUI();
  }

  // Expose SelfTest publicly on window.SmogShield for headless or console inspection
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
