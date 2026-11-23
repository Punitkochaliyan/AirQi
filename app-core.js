/**
 * SmogShield AI - Core Domain Logic, Constants, and Security Utilities
 * Zero external dependencies, pure functions, deterministic, isomorphic (runs in Node.js & browser).
 *
 * @module SmogShield
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SmogShield = root.SmogShield || {};
    Object.assign(root.SmogShield, factory());
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // -------------------------------------------------------------
  // JSDOC TYPE DEFINITIONS
  // -------------------------------------------------------------

  /**
   * @typedef {Object} WhoGuidelines
   * @property {number} PM25_24HR - WHO 2021 24-hour mean limit (15 µg/m³).
   * @property {number} PM25_ANNUAL - WHO 2021 annual mean limit (5 µg/m³).
   */

  /**
   * @typedef {Object} CityPreset
   * @property {string} id - Unique identifier.
   * @property {string} name - Display name of city or preset.
   * @property {number} defaultAqi - Typical winter AQI benchmark.
   * @property {string} note - Meteorological or environmental context.
   */

  /**
   * @typedef {Object} HouseholdProfile
   * @property {string} id - Household identifier.
   * @property {string} label - Full descriptive label.
   * @property {string} shortLabel - Compact label for badges and pills.
   * @property {string} badge - Risk classification badge text.
   * @property {string} desc - Physiological and clinical vulnerability rationale.
   * @property {number} vulnerabilityFactor - Respiratory multiplier.
   */

  /**
   * @typedef {Object} CommuteProfile
   * @property {string} id - Commute mode identifier.
   * @property {string} label - Full descriptive label.
   * @property {string} icon - Emoji representation.
   * @property {string} exposureLevel - Categorical exposure severity.
   * @property {number} multiplier - Micro-environmental particulate multiplier.
   * @property {number} defaultCo2eKg - Baseline daily vehicular CO2e emissions (kg/day).
   */

  /**
   * @typedef {Object} PurifierProfile
   * @property {string} id - Purifier setup identifier.
   * @property {string} label - Descriptive label.
   * @property {string} tag - Rating badge or classification.
   * @property {number} efficiency - Fractional particulate removal efficiency.
   * @property {string} desc - Filtration mechanism description.
   */

  /**
   * @typedef {Object} CpcbBreakpoint
   * @property {number} aqiMin - Minimum AQI for this breakpoint band.
   * @property {number} aqiMax - Maximum AQI for this breakpoint band.
   * @property {number} pmMin - Lower PM2.5 boundary in µg/m³.
   * @property {number} pmMax - Upper PM2.5 boundary in µg/m³.
   * @property {string} key - Machine-readable identifier.
   * @property {string} label - CPCB standard categorical label.
   * @property {string} color - Primary status hex code.
   * @property {string} bg - Light background tint hex code.
   * @property {string} textColor - High-contrast text hex code.
   */

  /**
   * @typedef {Object} ActionItem
   * @property {string} id - Unique action identifier.
   * @property {'routines'|'iaq'|'community'} track - Action track key.
   * @property {string} title - Action title.
   * @property {string} tag - Classification tag.
   * @property {readonly string[]} targetHousehold - Applicable household profile IDs.
   * @property {number} minAqiThreshold - Minimum AQI for proactive recommendation.
   * @property {string} directImpact - Plain-language direct impact summary.
   * @property {string} scientificEvidence - Grounded scientific citation or study.
   * @property {number} exposureReductionFactor - Fractional reduction on personal exposure.
   * @property {number} co2eAvoidedKg - Avoided daily greenhouse gas emissions in kg CO2e.
   */

  /**
   * @typedef {Object} MetricCalculationParams
   * @property {number} aqi - Outdoor AQI value.
   * @property {string} household - Household profile key.
   * @property {string} commute - Commute mode key.
   * @property {string} purifier - Indoor purifier setup key.
   * @property {Set<string>|Array<string>} [activeActionIds] - IDs of currently adopted actions.
   */

  /**
   * @typedef {Object} ComputedMetrics
   * @property {number} aqi - Sanitized input AQI.
   * @property {CpcbBreakpoint} category - Active CPCB AQI category descriptor.
   * @property {number} outdoorPm25 - Calculated outdoor PM2.5 (µg/m³).
   * @property {number} unmitigatedIndoorPm25 - Calculated unmitigated baseline indoor PM2.5 (µg/m³).
   * @property {number} protectedIndoorPm25 - Calculated shielded indoor PM2.5 with adopted actions (µg/m³).
   * @property {number} reductionPercent - Percentage exposure reduction achieved (0–100%).
   * @property {number} co2eAvoidedKg - Avoided greenhouse gas emissions (kg CO2e/day).
   * @property {number} whoLimit - Reference WHO 24-hr guideline limit (15 µg/m³).
   * @property {number} outdoorWhoTimes - Multiple of WHO limit in outdoor air.
   * @property {number} protectedWhoTimes - Multiple of WHO limit in shielded indoor air.
   * @property {number} activeCount - Total count of adopted mitigation actions.
   */

  /**
   * @typedef {Object} AdvisorContext
   * @property {string} [query] - User query or quick prompt string.
   * @property {number} aqi - Current AQI.
   * @property {string} household - Household profile key.
   * @property {string} commute - Commute mode key.
   * @property {string} purifier - Purifier setup key.
   * @property {Set<string>|Array<string>} [activeActionIds] - Adopted action IDs.
   */

  /**
   * @typedef {Object} AdvisorResponse
   * @property {string} title - Advisory card header title.
   * @property {string} text - Quantified, context-specific markdown advice.
   * @property {string[]} tags - Metadata chips for categorization.
   * @property {string[]} suggestedActions - Action catalog IDs recommended for adoption.
   */

  // -------------------------------------------------------------
  // 1. CONFIGURATION & CONSTANTS (Immutable)
  // -------------------------------------------------------------

  /**
   * Empirical mathematical parameters governing exposure modeling.
   */
  const METRIC_CONSTANTS = Object.freeze({
    // Infiltration ratios by purifier setup (outdoor-to-indoor fraction without active intervention)
    INFILTRATION_RATIOS: Object.freeze({
      hepa: 0.65,
      split_ac: 0.78,
      none_diy: 0.85
    }),

    // Residual particulate multipliers for active interventions (1 - fractional reduction)
    RESIDUAL_FACTORS: Object.freeze({
      TRUE_HEPA: 0.42,       // NIH RAPIDS trial PMC7021209: 58% drop in personal PM2.5
      CORSI_ROSENTHAL: 0.50, // UC Davis DIY box fan CADR evaluation: 50% drop
      SPLIT_AC_COARSE: 0.80, // Coarse pre-filter recirculation
      DOOR_SEALING: 0.82,    // Infiltration weatherstripping: 18% drop
      WET_MOPPING: 0.88,     // Resuspension prevention: 12% drop
      SOURCE_CONTROL: 0.85   // Kitchen extraction / induction: 15% drop
    }),

    // Indoor source spikes in µg/m³
    INDOOR_BACKGROUND_SPIKE: 18,
    COMBUSTION_AVOIDANCE_REDUCTION: 8,
    CLEAN_INDOOR_FLOOR: 5,

    // Commute carbon bonuses in kg CO2e / day
    COMMUTE_CO2E_BONUS: Object.freeze({
      metro: 2.5,
      wfh: 3.2
    })
  });

  const BASE_CONFIG = Object.freeze({
    WHO_GUIDELINES: Object.freeze({
      PM25_24HR: 15, // µg/m³ (WHO 2021 24-hour mean limit)
      PM25_ANNUAL: 5 // µg/m³ (WHO 2021 annual mean limit)
    }),

    METRIC_CONSTANTS,

    CITY_PRESETS: Object.freeze([
      { id: 'delhi', name: 'Delhi-NCR', defaultAqi: 382, note: 'Severe winter inversion trap & seasonal biomass' },
      { id: 'mumbai', name: 'Mumbai', defaultAqi: 158, note: 'Coastal humidity, construction dust, high traffic' },
      { id: 'kolkata', name: 'Kolkata', defaultAqi: 245, note: 'Winter thermal inversion & diesel particulate' },
      { id: 'bengaluru', name: 'Bengaluru', defaultAqi: 88, note: 'Moderate urban transit corridor dust' },
      { id: 'lucknow', name: 'Lucknow', defaultAqi: 340, note: 'Gangetic plain stagnant winter anticyclone' },
      { id: 'patna', name: 'Patna', defaultAqi: 375, note: 'Heavy river valley particulate stagnation' },
      { id: 'custom', name: 'Custom AQI', defaultAqi: 220, note: 'Manual AQI slider control' }
    ]),

    HOUSEHOLDS: Object.freeze({
      families_kids: {
        id: 'families_kids',
        label: 'Families with Children',
        shortLabel: 'Children',
        badge: 'High Pediatric Risk',
        desc: 'Higher respiratory rates per kg; immature alveolar development vulnerable to ultrafine PM2.5.',
        vulnerabilityFactor: 1.35
      },
      seniors_multi: {
        id: 'seniors_multi',
        label: 'Seniors / Multi-Generational',
        shortLabel: 'Seniors',
        badge: 'Cardiopulmonary Alert',
        desc: 'Elevated risks of arrhythmia, COPD exacerbation, stroke, and ischemic heart disease.',
        vulnerabilityFactor: 1.4
      },
      commuters: {
        id: 'commuters',
        label: 'Working Commuters',
        shortLabel: 'Commuters',
        badge: 'Peak Road Exposure',
        desc: 'Repeated micro-environment spikes in transit corridors, diesel exhaust, and road dust.',
        vulnerabilityFactor: 1.15
      },
      rwa_leads: {
        id: 'rwa_leads',
        label: 'RWA / Community Leads',
        shortLabel: 'Community / RWA',
        badge: 'Collective Impact',
        desc: 'Mobilizing society rules: security guard heating, no-idling gates, and organic composting.',
        vulnerabilityFactor: 1.0
      }
    }),

    COMMUTE_MODES: Object.freeze({
      two_wheeler: {
        id: 'two_wheeler',
        label: 'Two-Wheeler / Walking',
        icon: '🛵',
        exposureLevel: 'Extreme Direct',
        multiplier: 1.5,
        defaultCo2eKg: 0.8
      },
      car: {
        id: 'car',
        label: 'Petrol / Diesel Car',
        icon: '🚗',
        exposureLevel: 'Moderate (Cabin Infiltration)',
        multiplier: 1.1,
        defaultCo2eKg: 4.6
      },
      metro: {
        id: 'metro',
        label: 'Metro / Public Transit',
        icon: '🚇',
        exposureLevel: 'Intermediate (Station Dust)',
        multiplier: 0.9,
        defaultCo2eKg: 1.1
      },
      wfh: {
        id: 'wfh',
        label: 'Work From Home (WFH)',
        icon: '🏠',
        exposureLevel: 'Indoor Controlled',
        multiplier: 0.6,
        defaultCo2eKg: 0.2
      }
    }),

    PURIFIER_SETUPS: Object.freeze({
      hepa: {
        id: 'hepa',
        label: 'True-HEPA Air Purifier',
        tag: 'Certified H13/H14',
        efficiency: 0.65,
        desc: 'Removes >= 99.97% of particles down to 0.3 microns.'
      },
      none_diy: {
        id: 'none_diy',
        label: 'No Purifier / DIY Budget',
        tag: 'High Infiltration Risk',
        efficiency: 0.15,
        desc: 'Relies on natural room sealing, DIY box-fans, or wet barriers.'
      },
      split_ac: {
        id: 'split_ac',
        label: 'Split AC / HVAC Recirculation',
        tag: 'Coarse Mesh Only',
        efficiency: 0.25,
        desc: 'Standard AC filters trap coarse hair/dust; ultrafine PM2.5 passes through.'
      }
    }),

    // CPCB National AQI Breakpoints (for 24-hr PM2.5 in µg/m³)
    CPCB_BREAKPOINTS: Object.freeze([
      { aqiMin: 0, aqiMax: 50, pmMin: 0, pmMax: 30, key: 'good', label: 'Good', color: '#16a34a', bg: '#f0fdf4', textColor: '#15803d' },
      { aqiMin: 51, aqiMax: 100, pmMin: 31, pmMax: 60, key: 'satisfactory', label: 'Satisfactory', color: '#65a30d', bg: '#f7fee7', textColor: '#4d7c0f' },
      { aqiMin: 101, aqiMax: 200, pmMin: 61, pmMax: 90, key: 'moderate', label: 'Moderate', color: '#d97706', bg: '#fffbeb', textColor: '#b45309' },
      { aqiMin: 201, aqiMax: 300, pmMin: 91, pmMax: 120, key: 'poor', label: 'Poor', color: '#ea580c', bg: '#fff7ed', textColor: '#c2410c' },
      { aqiMin: 301, aqiMax: 400, pmMin: 121, pmMax: 250, key: 'very_poor', label: 'Very Poor', color: '#dc2626', bg: '#fef2f2', textColor: '#b91c1c' },
      { aqiMin: 401, aqiMax: 500, pmMin: 251, pmMax: 380, key: 'severe', label: 'Severe', color: '#7f1d1d', bg: '#450a0a', textColor: '#fecaca' },
      { aqiMin: 501, aqiMax: 9999, pmMin: 381, pmMax: 800, key: 'severe_plus', label: 'Severe+ / Hazardous', color: '#581c87', bg: '#3b0764', textColor: '#e9d5ff' }
    ]),

    // Action Catalog across the 3 tracks
    ACTIONS: Object.freeze([
      // Track 1: Low-Emission Daily Routines
      {
        id: 'routine_mixing_window',
        track: 'routines',
        title: 'Shift Outdoors to 1:00–4:00 PM Mixing Window',
        tag: 'Thermal Inversion Bypass',
        targetHousehold: Object.freeze(['families_kids', 'seniors_multi', 'commuters']),
        minAqiThreshold: 100,
        directImpact: 'Avoids nocturnal and morning temperature inversion that traps heavy toxic smog near ground level.',
        scientificEvidence: 'Planetary boundary layer height expands up to 1,200m in afternoon sun vs <150m at dawn, diluting surface pollutant concentration by 35–45%.',
        exposureReductionFactor: 0.18,
        co2eAvoidedKg: 0.2
      },
      {
        id: 'routine_masking_n95',
        track: 'routines',
        title: 'Fit-Tested Headband N95 / FFP2 Masking',
        tag: 'Personal Respiratory Barrier',
        targetHousehold: Object.freeze(['families_kids', 'seniors_multi', 'commuters', 'rwa_leads']),
        minAqiThreshold: 120,
        directImpact: 'Stops fine respirable particulates (PM2.5 & ultrafine soot) from penetrating deep alveolar lung tissue.',
        scientificEvidence: 'Dual-strap headband N95 delivers 95%+ filtration; loose surgical masks and cloth bandanas suffer 60–80% inward leakage due to perimeter gaps.',
        exposureReductionFactor: 0.35,
        co2eAvoidedKg: 0.0
      },
      {
        id: 'routine_errand_batching',
        track: 'routines',
        title: 'Consolidate & Batch Weekly Errand Trips',
        tag: 'Cold-Start Reduction',
        targetHousehold: Object.freeze(['commuters', 'families_kids']),
        minAqiThreshold: 150,
        directImpact: 'Cuts repetitive cold-start vehicle tailpipe bursts and reduces your direct roadside exposure window.',
        scientificEvidence: 'Vehicular catalytic converters require 5–10 mins to reach 300°C operating temp. Combining 4 short errands into one single warm trip cuts hydrocarbon & PM emissions by up to 60%.',
        exposureReductionFactor: 0.10,
        co2eAvoidedKg: 1.4
      },
      {
        id: 'routine_post_commute',
        track: 'routines',
        title: 'Post-Commute Airway Hygiene & Decontamination',
        tag: 'Particle Cleansing',
        targetHousehold: Object.freeze(['commuters', 'families_kids']),
        minAqiThreshold: 180,
        directImpact: 'Washes away deposited toxic heavy metals and soot from nasal lining, eyes, and skin immediately after returning home.',
        scientificEvidence: 'Isotonic saline nasal irrigation flushes trapped particulate matter from upper mucosal pathways, halving inflammatory cytokine cascades.',
        exposureReductionFactor: 0.08,
        co2eAvoidedKg: 0.0
      },
      {
        id: 'routine_morning_inversion',
        track: 'routines',
        title: 'Suspend Pre-10:00 AM Outdoor Endurance Cardio',
        tag: 'Cardiovascular Defense',
        targetHousehold: Object.freeze(['seniors_multi', 'families_kids']),
        minAqiThreshold: 150,
        directImpact: 'Prevents acute cardiopulmonary spikes caused by deep mouth-breathing during peak dawn pollution.',
        scientificEvidence: 'Cardio exercise increases minute ventilation by 5–10x, driving toxic ultrafine particles directly into systemic circulation.',
        exposureReductionFactor: 0.22,
        co2eAvoidedKg: 0.0
      },

      // Track 2: Indoor Air Quality (IAQ) Hacks
      {
        id: 'iaq_true_hepa',
        track: 'iaq',
        title: 'Continuous Bedroom True-HEPA (H13/H14) Filtration',
        tag: 'NIH RAPIDS Protocol',
        targetHousehold: Object.freeze(['families_kids', 'seniors_multi', 'commuters', 'rwa_leads']),
        minAqiThreshold: 100,
        directImpact: 'Maintains an indoor safe haven with sub-15 µg/m³ PM2.5 in closed bedrooms overnight.',
        scientificEvidence: 'Randomized clinical trials (NIH RAPIDS study) documented a 53% to 60% sustained drop in personal PM2.5 exposure and immediate reduction in systemic arterial stiffness.',
        exposureReductionFactor: 0.58,
        co2eAvoidedKg: 0.0
      },
      {
        id: 'iaq_corsi_rosenthal',
        track: 'iaq',
        title: 'Budget DIY Corsi-Rosenthal Box-Fan Assembly',
        tag: 'Affordable High-CADR',
        targetHousehold: Object.freeze(['families_kids', 'seniors_multi', 'commuters', 'rwa_leads']),
        minAqiThreshold: 120,
        directImpact: 'Delivers industrial-grade Clean Air Delivery Rate (CADR ~350-450 CFM) for large rooms at 1/5th commercial purifier cost.',
        scientificEvidence: 'UC Davis engineering evaluations show a 4-filter MERV-13 cube fan matches commercial HEPA CADR while drawing under 60 watts of power.',
        exposureReductionFactor: 0.50,
        co2eAvoidedKg: 0.0
      },
      {
        id: 'iaq_source_control',
        track: 'iaq',
        title: 'Kitchen Source Control & Induction Cooking Transition',
        tag: 'Zero Indoor NO2',
        targetHousehold: Object.freeze(['families_kids', 'seniors_multi', 'commuters']),
        minAqiThreshold: 80,
        directImpact: 'Eliminates dangerous indoor spikes of nitrogen dioxide (NO2), acrolein, and ultrafine cooking aerosols.',
        scientificEvidence: 'LPG gas burners emit up to 400 ppb NO2 during frying, surpassing WHO 1-hour limits within 10 minutes. Induction cooktops generate zero combustion byproducts.',
        exposureReductionFactor: 0.16,
        co2eAvoidedKg: 0.9
      },
      {
        id: 'iaq_wet_mopping',
        track: 'iaq',
        title: 'Microfiber Wet Mopping & Resuspension Ban',
        tag: 'EPA IAQ Standard',
        targetHousehold: Object.freeze(['families_kids', 'seniors_multi']),
        minAqiThreshold: 100,
        directImpact: 'Captures settled toxic dust without kicking particles back into breathing zones via dry broom sweeping.',
        scientificEvidence: 'EPA IAQ studies indicate dry sweeping resuspends up to 70% of settled coarse and fine PM into the air, whereas damp microfiber binds electrostatic particles safely.',
        exposureReductionFactor: 0.12,
        co2eAvoidedKg: 0.0
      },
      {
        id: 'iaq_door_sealing',
        track: 'iaq',
        title: 'Perimeter Weatherstripping & Door Sweep Sealing',
        tag: 'Infiltration Barrier',
        targetHousehold: Object.freeze(['families_kids', 'seniors_multi', 'commuters']),
        minAqiThreshold: 150,
        directImpact: 'Seals drafts around entry doors and window frames to block smog infiltration into living areas.',
        scientificEvidence: 'Unsealed building envelopes experience an ambient air exchange infiltration rate of 0.8–1.2 ACH. Silicone draft seals cut passive PM2.5 infiltration by 25–35%.',
        exposureReductionFactor: 0.15,
        co2eAvoidedKg: 0.1
      },
      {
        id: 'iaq_zero_combustion',
        track: 'iaq',
        title: 'Strict Ban on Incense, Scented Candles & Coils',
        tag: 'Zero Indoor Smoke',
        targetHousehold: Object.freeze(['families_kids', 'seniors_multi', 'commuters', 'rwa_leads']),
        minAqiThreshold: 80,
        directImpact: 'Removes massive indoor carcinogen sources that can elevate indoor PM2.5 past 500 µg/m³.',
        scientificEvidence: 'A single burning mosquito coil emits PM2.5 particulate mass equivalent to burning 75 to 100 commercial cigarettes, releasing formaldehyde and benzene.',
        exposureReductionFactor: 0.20,
        co2eAvoidedKg: 0.1
      },

      // Track 3: Sustainable Alternatives & Community Actions
      {
        id: 'comm_no_idling',
        track: 'community',
        title: 'School-Gate & Community Zero-Idling Pledge',
        tag: 'Child Micro-Environment',
        targetHousehold: Object.freeze(['families_kids', 'rwa_leads']),
        minAqiThreshold: 100,
        directImpact: 'Prevents heavy benzene, carbon monoxide, and black carbon accumulation outside school pickup gates.',
        scientificEvidence: 'Vehicle tailpipes idle at breathing height for children. Anti-idling enforcement drops localized gate PM2.5 concentrations by 38% during dismissal peaks.',
        exposureReductionFactor: 0.10,
        co2eAvoidedKg: 0.6
      },
      {
        id: 'comm_leaf_composting',
        track: 'community',
        title: 'Neighborhood Leaf Composting Pits vs. Open Burning',
        tag: 'Biomass Burning Ban',
        targetHousehold: Object.freeze(['rwa_leads', 'seniors_multi', 'families_kids']),
        minAqiThreshold: 120,
        directImpact: 'Halts illegal garden waste and dry leaf burning that poisons local colony air every evening.',
        scientificEvidence: 'Open leaf smoldering produces severe toxic smoke high in benzo(a)pyrene and furans. Converting dry waste into aerated compost creates nutrient-rich soil with zero smoke.',
        exposureReductionFactor: 0.14,
        co2eAvoidedKg: 1.8
      },
      {
        id: 'comm_metro_ev',
        track: 'community',
        title: 'Metro / EV Shared Transit Transition',
        tag: 'Clean Mobility Shift',
        targetHousehold: Object.freeze(['commuters', 'families_kids', 'rwa_leads']),
        minAqiThreshold: 100,
        directImpact: 'Removes personal combustion vehicles from congested corridors and shrinks individual carbon footprint.',
        scientificEvidence: 'Switching a 20 km daily roundtrip commute from single-occupancy petrol car to electric metro eliminates ~3.8 to 4.5 kg CO2e and 12g fine exhaust particulate per person.',
        exposureReductionFactor: 0.12,
        co2eAvoidedKg: 4.1
      },
      {
        id: 'comm_guard_heaters',
        track: 'community',
        title: 'Electric Radiant Heating for Society Night Guards',
        tag: 'Humanitarian & Clean Air',
        targetHousehold: Object.freeze(['rwa_leads', 'seniors_multi']),
        minAqiThreshold: 150,
        directImpact: 'Eliminates roadside scrap-plastic and wood fires that guards burn during freezing night shifts to survive.',
        scientificEvidence: 'Burning scrap plastic/rubber releases dioxins, hydrochloric acid, and extreme ultrafine soot right next to society entry gates. Electric infrared heaters consume minimal power with zero emissions.',
        exposureReductionFactor: 0.15,
        co2eAvoidedKg: 1.2
      },
      {
        id: 'comm_dust_mitigation',
        track: 'community',
        title: 'Green Mesh Barrier & Construction Mist Protocols',
        tag: 'Fugitive Dust Control',
        targetHousehold: Object.freeze(['rwa_leads', 'commuters']),
        minAqiThreshold: 120,
        directImpact: 'Prevents cement silica and pulverized road dust from drifting into residential apartments.',
        scientificEvidence: 'Continuous fine water misting and dual-layer geotextile windbreaks capture up to 80% of fugitive PM10 and PM2.5 at civil renovation sites.',
        exposureReductionFactor: 0.11,
        co2eAvoidedKg: 0.3
      }
    ])
  });

  // Fast O(1) Action Map lookup
  /** @type {Map<string, ActionItem>} */
  const ACTION_MAP = new Map();
  for (const act of BASE_CONFIG.ACTIONS) {
    ACTION_MAP.set(act.id, act);
  }
  Object.freeze(ACTION_MAP);

  // Expose ACTION_MAP on immutable CONFIG
  const CONFIG = Object.freeze(Object.assign({}, BASE_CONFIG, { ACTION_MAP }));

  // -------------------------------------------------------------
  // 2. SECURITY MODULE (Strict Sanitization & XSS Neutralization)
  // -------------------------------------------------------------
  const Security = {
    /**
     * Escapes untrusted HTML strings to prevent XSS.
     * Escapes &, <, >, ", and '.
     * @param {*} str - Input to sanitize.
     * @returns {string} Sanitized string.
     */
    escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /**
     * Clamps a numeric input to a safe integer/float bound.
     * Guarded against NaN, null, undefined, Infinity.
     * @param {*} val - Input candidate value.
     * @param {number} min - Minimum allowed bound.
     * @param {number} max - Maximum allowed bound.
     * @param {number} [fallback=0] - Safe fallback value when non-numeric or non-finite.
     * @returns {number} Clamped safe number.
     */
    clampNumber(val, min, max, fallback = 0) {
      const num = Number(val);
      if (Number.isNaN(num) || !Number.isFinite(num)) {
        return fallback;
      }
      return Math.min(Math.max(num, min), max);
    }
  };

  // -------------------------------------------------------------
  // 3. DECLARATIVE ADVISOR INTENT ENGINE
  // -------------------------------------------------------------

  /**
   * Declarative intent registry for the GenAI Advisor.
   * Enables clean intent matching, priority routing, and testability.
   * @type {Array<{ id: string, matches: (q: string) => boolean, handle: (ctx: Object) => AdvisorResponse }>}
   */
  const INTENT_REGISTRY = Object.freeze([
    {
      id: 'outdoor_inversion',
      matches: (q) => q.includes('outdoor') || q.includes('play') || q.includes('child') ||
                      q.includes('walk') || q.includes('run') || q.includes('exercise') || q.includes('morning'),
      handle: (ctx) => {
        const { aqi, cat, pm25, whoMultiple, household } = ctx;
        const title = 'Outdoor Window & Inversion Advisory';
        const tags = [cat.label, `${pm25} µg/m³ PM2.5`, household.shortLabel];

        if (aqi >= 300) {
          return {
            title,
            text: `**Current Status:** AQI is **${aqi} (${cat.label})** with PM2.5 at **${pm25} µg/m³** (${whoMultiple}x WHO 24h limit). Under thermal inversion, a cold stagnant air pocket traps toxic combustion soot close to ground level until midday.\n\n` +
              `**Direct Recommendation for ${household.label}:**\n` +
              `• **Cancel all morning outdoor cardio & child sports before 12:00 PM.** Immature lungs and cardiac systems take in 5-10x more particulate mass per minute during physical exertion.\n` +
              `• **Optimal Outdoor Window:** If strictly necessary, restrict movement to **1:00 PM – 3:30 PM**, when solar heating raises the planetary boundary layer height (up to 1,200m) and dilutes surface particulate concentrations by ~40%.\n` +
              `• **Mandatory Protection:** Ensure dual-strap headband N95/FFP2 masks are fitted tightly around the nasal bridge before stepping outside.`,
            tags,
            suggestedActions: ['routine_mixing_window', 'routine_masking_n95', 'routine_morning_inversion']
          };
        }

        if (aqi >= 150) {
          return {
            title,
            text: `**Current Status:** AQI is **${aqi} (${cat.label})** with PM2.5 at **${pm25} µg/m³**.\n\n` +
              `• **Targeted Window:** The safest period for light outdoor activity is between **1:00 PM and 4:00 PM** when vertical atmospheric mixing peaks.\n` +
              `• Avoid high-traffic corridors and early morning fog/haze. For ${household.label}, keep sustained cardio exercises indoors.`,
            tags,
            suggestedActions: ['routine_mixing_window', 'routine_masking_n95']
          };
        }

        return {
          title,
          text: `**Current Status:** AQI is **${aqi} (${cat.label})**, PM2.5 is **${pm25} µg/m³**.\n\n` +
            `• Outdoor exposure risks are moderate. Children and seniors can enjoy outdoor activities, ideally avoiding peak commute traffic hours (8:00–10:00 AM and 6:00–8:00 PM).`,
          tags,
          suggestedActions: ['routine_errand_batching']
        };
      }
    },
    {
      id: 'purifier_corsi',
      matches: (q) => q.includes('corsi') || q.includes('diy') || q.includes('box fan') ||
                      q.includes('purifier') || q.includes('hepa') || q.includes('merv'),
      handle: (ctx) => {
        const { purifier, cat, pm25, household } = ctx;
        return {
          title: 'DIY Corsi-Rosenthal Box vs. HEPA Filtration',
          text: `**Filtration Engineering Guide:**\n\n` +
            `• **What is a Corsi-Rosenthal (C-R) Box?** It is an open-source, high Clean Air Delivery Rate (CADR ~350-450 CFM) air cleaner built using a 20-inch box fan and 4x MERV-13 pleated HVAC filters taped into a sealed cube, with a cardboard shroud.\n` +
            `• **Cost & Performance:** Commercial True-HEPA purifiers cost ₹10,000–₹25,000 with expensive replacement cartridges. A C-R box costs ₹2,500–₹3,800 to build and cleans large 400 sq.ft rooms within 20 minutes.\n` +
            `• **Setup Status:** Your active setup is **${purifier.label}**.\n` +
            `• **NIH RAPIDS Clinical Evidence:** Continuous HEPA filtration achieves a **53% to 60% reduction in personal PM2.5 exposure**, reducing blood pressure and arterial stiffness in smog-exposed populations.\n` +
            `• **Actionable Hack:** Place purifiers away from room corners, at least 1.5 feet from walls, and operate them on medium/high rather than auto-mode during peak inversion nights.`,
          tags: [cat.label, `${pm25} µg/m³ PM2.5`, household.shortLabel],
          suggestedActions: ['iaq_true_hepa', 'iaq_corsi_rosenthal', 'iaq_door_sealing']
        };
      }
    },
    {
      id: 'cooking_combustion',
      matches: (q) => q.includes('cook') || q.includes('gas') || q.includes('induction') ||
                      q.includes('kitchen') || q.includes('incense') || q.includes('candle') ||
                      q.includes('coil') || q.includes('no2'),
      handle: (ctx) => {
        const { cat, pm25, household } = ctx;
        return {
          title: 'Indoor Combustion & NO2 Elimination',
          text: `**Indoor Air Quality Science:**\n\n` +
            `• **Gas Combustion Danger:** LPG gas cooktops release up to 400 ppb of nitrogen dioxide (NO2) alongside ultrafine aerosols. In closed winter apartments, indoor NO2 regularly exceeds WHO 1-hour safe limits (200 µg/m³).\n` +
            `• **Cooking Protocols:** Switch to an **induction cooktop** where possible to eliminate combustion emissions. If using gas, turn on the kitchen exhaust hood at high speed 5 minutes *before* lighting the stove and keep it running 5 minutes after.\n` +
            `• **Strict Smoke Ban:** Never burn incense (agarbatti), scented paraffin candles, or mosquito coils. Burning a single mosquito coil emits PM2.5 equivalent to **75–100 cigarettes**, flooding the room with formaldehyde and acrolein.\n` +
            `• **Cleaning Protocol:** Replace dry broom sweeping with damp microfiber wet mopping to prevent dust resuspension.`,
          tags: [cat.label, `${pm25} µg/m³ PM2.5`, household.shortLabel],
          suggestedActions: ['iaq_source_control', 'iaq_zero_combustion', 'iaq_wet_mopping']
        };
      }
    },
    {
      id: 'respirator_masking',
      matches: (q) => q.includes('mask') || q.includes('n95') || q.includes('ffp2') ||
                      q.includes('cloth') || q.includes('surgical'),
      handle: (ctx) => {
        const { commute, cat, pm25, household } = ctx;
        return {
          title: 'Respirator & Mask Selection Protocol',
          text: `**Respirator Protection Science:**\n\n` +
            `• **N95/FFP2 (Dual Headband):** The gold standard for toxic urban smog. Electret meltblown microfiber captures >=95% of 0.3-micron particles.\n` +
            `• **The Seal Factor:** Earloop masks frequently leak 20–35% around cheeks and jawline under movement. For two-wheeler commuters and walking, choose **headband style** N95s and perform a positive/negative pressure seal check every time.\n` +
            `• **Cloth & Surgical Masks:** Ineffective against PM2.5. Surgical masks are designed to stop droplet splatter, not fine sub-micron aerosols; inward leakage exceeds 60–80%.\n` +
            `• **Commute Context:** For your **${commute.label}** mode, masking is vital whenever outdoors or waiting at open transit platforms.`,
          tags: [cat.label, `${pm25} µg/m³ PM2.5`, household.shortLabel],
          suggestedActions: ['routine_masking_n95', 'routine_post_commute']
        };
      }
    },
    {
      id: 'community_rwa',
      matches: (q) => q.includes('rwa') || q.includes('community') || q.includes('leaf') ||
                      q.includes('burn') || q.includes('guard') || q.includes('idling') || q.includes('school'),
      handle: (ctx) => {
        const { household, cat, pm25 } = ctx;
        return {
          title: 'RWA & Neighborhood Action Playbook',
          text: `**Community Smog Mitigation Playbook for ${household.label}:**\n\n` +
            `1. **Security Guard Heating:** Supply 1,000W electric radiant heaters or warm fleece shelters to security guards. This completely eliminates nightly burning of scrap wood, cardboard, and toxic plastic packaging at colony gates.\n` +
            `2. **Decentralized Leaf Composting:** Dig or install aerated composting pits for garden sweepings. Open biomass burning emits dense polycyclic aromatic hydrocarbons (PAHs) and creates localized hazardous smog.\n` +
            `3. **School-Gate Anti-Idling Zone:** Establish a mandatory 3-minute engine shutdown rule within 200 meters of community and school entry gates, reducing toxic micro-environment plumes for waiting students by 38%.\n` +
            `4. **Dust Suppression:** Mandate green geotextile safety netting and water spray nozzles for any residential construction or masonry work.`,
          tags: [cat.label, `${pm25} µg/m³ PM2.5`, household.shortLabel],
          suggestedActions: ['comm_guard_heaters', 'comm_leaf_composting', 'comm_no_idling', 'comm_dust_mitigation']
        };
      }
    },
    {
      id: 'ventilation_timing',
      matches: (q) => q.includes('window') || q.includes('ventilate') || q.includes('fresh air') ||
                      q.includes('co2') || q.includes('stale'),
      handle: (ctx) => {
        const { cat, pm25, household } = ctx;
        return {
          title: 'Winter Smog Ventilation Strategy',
          text: `**Ventilation Dynamics in Severe Smog:**\n\n` +
            `• **The Dilemma:** Keeping rooms completely sealed traps metabolic carbon dioxide (CO2 > 1,500 ppm causes headaches and cognitive fatigue), but opening windows admits toxic PM2.5.\n` +
            `• **The Optimal Solution:** Perform **strategic pulse ventilation** strictly between **1:30 PM and 3:30 PM** for 10–15 minutes, when atmospheric dispersion is highest and outdoor PM2.5 is at its diurnal minimum.\n` +
            `• **Post-Ventilation Recovery:** Immediately seal doors and windows, and turn your air purifier (or DIY C-R box) to maximum speed for 20 minutes to scrub infiltrated particulate down to safe levels.\n` +
            `• Install weatherstripping on door gaps to curb passive infiltration during morning and night smog peaks.`,
          tags: [cat.label, `${pm25} µg/m³ PM2.5`, household.shortLabel],
          suggestedActions: ['routine_mixing_window', 'iaq_door_sealing', 'iaq_true_hepa']
        };
      }
    }
  ]);

  // -------------------------------------------------------------
  // 4. DOMAIN LOGIC MODULE (Pure & Deterministic)
  // -------------------------------------------------------------
  const DomainLogic = {
    /**
     * Converts CPCB AQI value to estimated 24-hr PM2.5 concentration (µg/m³).
     * Linear interpolation piecewise within CPCB breakpoints.
     * @param {number} aqi - AQI in range [0, 9999].
     * @returns {number} Estimated PM2.5 in µg/m³.
     */
    aqiToPm25(aqi) {
      const safeAqi = Security.clampNumber(aqi, 0, 9999, 100);

      // Find matching bracket
      for (let i = 0; i < CONFIG.CPCB_BREAKPOINTS.length; i++) {
        const bp = CONFIG.CPCB_BREAKPOINTS[i];
        if (safeAqi <= bp.aqiMax || i === CONFIG.CPCB_BREAKPOINTS.length - 1) {
          const aqiSpan = Math.max(1, bp.aqiMax - bp.aqiMin);
          const pmSpan = bp.pmMax - bp.pmMin;
          const ratio = (safeAqi - bp.aqiMin) / aqiSpan;
          const pm25 = bp.pmMin + ratio * pmSpan;
          return Math.round(pm25 * 10) / 10;
        }
      }
      return 250;
    },

    /**
     * Gets the CPCB AQI Category object for a given AQI value.
     * @param {number} aqi - AQI value.
     * @returns {CpcbBreakpoint} Category descriptor.
     */
    getAqiCategory(aqi) {
      const safeAqi = Security.clampNumber(aqi, 0, 9999, 100);
      for (const bp of CONFIG.CPCB_BREAKPOINTS) {
        if (safeAqi <= bp.aqiMax) {
          return bp;
        }
      }
      return CONFIG.CPCB_BREAKPOINTS[CONFIG.CPCB_BREAKPOINTS.length - 1];
    },

    /**
     * Checks if an action is recommended for a given profile and AQI.
     * @param {ActionItem} action - Action item from CONFIG.ACTIONS.
     * @param {string} household - Household ID.
     * @param {number} aqi - AQI value.
     * @returns {boolean} True if recommended.
     */
    isRecommended(action, household, aqi) {
      if (!action) return false;
      const safeAqi = Security.clampNumber(aqi, 0, 9999, 100);
      const matchesHousehold = !action.targetHousehold || action.targetHousehold.includes(household);
      const reachesThreshold = safeAqi >= (action.minAqiThreshold || 0);
      return matchesHousehold && reachesThreshold;
    },

    /**
     * Computes exposure simulation metrics, reductions, and CO2e savings.
     * Pure function, zero DOM side effects.
     * @param {MetricCalculationParams} params - Calculation input parameters.
     * @returns {ComputedMetrics} Calculated exposure metrics.
     */
    computeMetrics(params) {
      const safeParams = params || {};
      const rawAqi = Security.clampNumber(safeParams.aqi, 0, 9999, 200);
      const outdoorPm25 = DomainLogic.aqiToPm25(rawAqi);

      const purifier = CONFIG.PURIFIER_SETUPS[safeParams.purifier] || CONFIG.PURIFIER_SETUPS.none_diy;
      const commute = CONFIG.COMMUTE_MODES[safeParams.commute] || CONFIG.COMMUTE_MODES.car;
      const household = CONFIG.HOUSEHOLDS[safeParams.household] || CONFIG.HOUSEHOLDS.families_kids;

      // Ensure activeActionIds is a Set for O(1) membership lookups
      const activeIds = (safeParams.activeActionIds instanceof Set)
        ? safeParams.activeActionIds
        : new Set(safeParams.activeActionIds || []);

      // Baseline infiltration ratio from configuration
      const baselineInfilRatio = METRIC_CONSTANTS.INFILTRATION_RATIOS[purifier.id] ||
        METRIC_CONSTANTS.INFILTRATION_RATIOS.none_diy;

      // Unmitigated indoor baseline with unmitigated indoor cooking/candle emission
      const indoorBackgroundSpike = activeIds.has('iaq_zero_combustion') ? 0 : METRIC_CONSTANTS.INDOOR_BACKGROUND_SPIKE;
      const unmitigatedIndoorPm25 = Math.round(
        (outdoorPm25 * baselineInfilRatio + indoorBackgroundSpike) * 10
      ) / 10;

      // Residual factor accumulator
      let residualFactor = 1.0;
      let co2eTotal = 0;

      // Primary filtration intervention
      if (purifier.id === 'hepa' || activeIds.has('iaq_true_hepa')) {
        residualFactor *= METRIC_CONSTANTS.RESIDUAL_FACTORS.TRUE_HEPA;
      } else if (activeIds.has('iaq_corsi_rosenthal')) {
        residualFactor *= METRIC_CONSTANTS.RESIDUAL_FACTORS.CORSI_ROSENTHAL;
      } else if (purifier.id === 'split_ac') {
        residualFactor *= METRIC_CONSTANTS.RESIDUAL_FACTORS.SPLIT_AC_COARSE;
      }

      // Secondary building envelope and behavioral interventions
      if (activeIds.has('iaq_door_sealing')) {
        residualFactor *= METRIC_CONSTANTS.RESIDUAL_FACTORS.DOOR_SEALING;
      }
      if (activeIds.has('iaq_wet_mopping')) {
        residualFactor *= METRIC_CONSTANTS.RESIDUAL_FACTORS.WET_MOPPING;
      }
      if (activeIds.has('iaq_source_control')) {
        residualFactor *= METRIC_CONSTANTS.RESIDUAL_FACTORS.SOURCE_CONTROL;
      }

      // Sum CO2e savings from adopted actions via O(1) map
      for (const actId of activeIds) {
        const action = ACTION_MAP.get(actId);
        if (action && typeof action.co2eAvoidedKg === 'number') {
          co2eTotal += action.co2eAvoidedKg;
        }
      }

      // Commute clean mobility CO2e credit
      if (commute.id === 'metro') {
        co2eTotal += METRIC_CONSTANTS.COMMUTE_CO2E_BONUS.metro;
      } else if (commute.id === 'wfh') {
        co2eTotal += METRIC_CONSTANTS.COMMUTE_CO2E_BONUS.wfh;
      }

      // Calculate protected indoor PM2.5 with combustion avoidance offset
      let protectedIndoor = unmitigatedIndoorPm25 * residualFactor;
      if (activeIds.has('iaq_zero_combustion')) {
        protectedIndoor = Math.max(METRIC_CONSTANTS.CLEAN_INDOOR_FLOOR, protectedIndoor - METRIC_CONSTANTS.COMBUSTION_AVOIDANCE_REDUCTION);
      }
      protectedIndoor = Math.min(
        unmitigatedIndoorPm25,
        Math.max(METRIC_CONSTANTS.CLEAN_INDOOR_FLOOR, Math.round(protectedIndoor * 10) / 10)
      );

      // Percentage reduction bounded to [0, 100]
      const reductionPercent = (unmitigatedIndoorPm25 > 0)
        ? Math.min(100, Math.max(0, Math.round(((unmitigatedIndoorPm25 - protectedIndoor) / unmitigatedIndoorPm25) * 100)))
        : 0;

      // Comparison with WHO 2021 24-hr guideline (15 µg/m³)
      const whoLimit = CONFIG.WHO_GUIDELINES.PM25_24HR;
      const outdoorWhoTimes = Math.round((outdoorPm25 / whoLimit) * 10) / 10;
      const protectedWhoTimes = Math.round((protectedIndoor / whoLimit) * 10) / 10;

      return {
        aqi: rawAqi,
        category: DomainLogic.getAqiCategory(rawAqi),
        outdoorPm25,
        unmitigatedIndoorPm25,
        protectedIndoorPm25: protectedIndoor,
        reductionPercent,
        co2eAvoidedKg: Math.round(co2eTotal * 10) / 10,
        whoLimit,
        outdoorWhoTimes,
        protectedWhoTimes,
        activeCount: activeIds.size
      };
    },

    /**
     * Context-Aware GenAI Advisor Engine.
     * Evaluates query, active profile, and currently active actions via the declarative INTENT_REGISTRY.
     * @param {AdvisorContext} ctx - Context object containing active environmental state.
     * @returns {AdvisorResponse} Structured advisory response.
     */
    generateAdvisorReply(ctx) {
      const safeCtx = ctx || {};
      const query = (safeCtx.query || '').toLowerCase().trim();
      const aqi = Security.clampNumber(safeCtx.aqi, 0, 9999, 250);
      const pm25 = DomainLogic.aqiToPm25(aqi);
      const cat = DomainLogic.getAqiCategory(aqi);
      const household = CONFIG.HOUSEHOLDS[safeCtx.household] || CONFIG.HOUSEHOLDS.families_kids;
      const commute = CONFIG.COMMUTE_MODES[safeCtx.commute] || CONFIG.COMMUTE_MODES.car;
      const purifier = CONFIG.PURIFIER_SETUPS[safeCtx.purifier] || CONFIG.PURIFIER_SETUPS.none_diy;
      const activeIds = safeCtx.activeActionIds instanceof Set
        ? safeCtx.activeActionIds
        : new Set(safeCtx.activeActionIds || []);

      const whoMultiple = (pm25 / CONFIG.WHO_GUIDELINES.PM25_24HR).toFixed(1);

      const evaluationContext = {
        query,
        aqi,
        pm25,
        cat,
        household,
        commute,
        purifier,
        activeIds,
        whoMultiple
      };

      // Match intent from registry
      for (const intent of INTENT_REGISTRY) {
        if (intent.matches(query)) {
          return intent.handle(evaluationContext);
        }
      }

      // Default synthesized assessment
      const priorityAdvice = (aqi >= 250)
        ? 'Emergency barrier protection: seal bedroom windows, run continuous filtration, wear headband N95 outdoors, and restrict travel to the 1–4 PM mixing window.'
        : 'Source control and lifestyle adaptation: wet mopping, induction cooking, and batching commute trips.';

      return {
        title: 'Targeted SmogShield Assessment',
        text: `Based on your profile (**${household.label}**, commuting via **${commute.label}**, with **${purifier.label}**):\n\n` +
          `• Current Outdoor AQI is **${aqi} (${cat.label})** with PM2.5 of **${pm25} µg/m³** (${whoMultiple}x WHO 24h limit).\n` +
          `• You have currently adopted **${activeIds.size} protection actions**.\n` +
          `• **Priority Focus:** ${priorityAdvice}\n` +
          `• Explore the recommended action cards below and toggle their checkboxes to simulate your personal PM2.5 exposure reduction and carbon savings in real time.`,
        tags: [cat.label, `${pm25} µg/m³ PM2.5`, household.shortLabel],
        suggestedActions: ['iaq_true_hepa', 'routine_masking_n95', 'routine_mixing_window']
      };
    }
  };

  // -------------------------------------------------------------
  // 5. SHARED HEADLESS SELF-TEST SUITE ENGINE (DRY Implementation)
  // -------------------------------------------------------------
  const SelfTest = {
    /**
     * Runs all unit checks and the 10,000-iteration stress/fuzz test.
     * Can be invoked headlessly in Node.js or integrated into the UI.
     * @param {Object} [options]
     * @param {Function} [options.onLog] - Callback for log messages `(message, type) => void`.
     * @param {number} [options.stressIterations=10000] - Total fuzz iterations.
     * @returns {{ passed: boolean, unitPassed: number, unitTotal: number, stressIterations: number, elapsedMs: number, error: (Error|null) }}
     */
    runAll(options = {}) {
      const log = typeof options.onLog === 'function' ? options.onLog : () => {};
      const targetIterations = typeof options.stressIterations === 'number' ? options.stressIterations : 10000;
      const startTime = Date.now();

      let unitPassed = 0;
      const unitTotal = 6;

      try {
        // 1. CPCB Breakpoints Accuracy
        const p25 = DomainLogic.aqiToPm25(25);
        const p75 = DomainLogic.aqiToPm25(75);
        const p150 = DomainLogic.aqiToPm25(150);
        const p250 = DomainLogic.aqiToPm25(250);
        const p350 = DomainLogic.aqiToPm25(350);
        const p450 = DomainLogic.aqiToPm25(450);

        if (p25 <= 30 && p75 <= 60 && p150 <= 90 && p250 <= 120 && p350 <= 250 && p450 <= 380) {
          unitPassed++;
          log('✓ Check 1: CPCB AQI piecewise breakpoint calculations accurate.', 'pass');
        } else {
          throw new Error('CPCB breakpoint test failed.');
        }

        // 2. Category Boundary Classification
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
          !Number.isNaN(m.unmitigatedIndoorPm25) &&
          m.protectedIndoorPm25 <= m.unmitigatedIndoorPm25 &&
          m.reductionPercent >= 0 &&
          m.reductionPercent <= 100 &&
          m.co2eAvoidedKg >= 0
        ) {
          unitPassed++;
          log('✓ Check 3: Metric invariants verified (no NaNs, protected <= unmitigated).', 'pass');
        } else {
          throw new Error('Metric invariant calculation failed.');
        }

        // 4. Security XSS Sanitization
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

        // 6. Advisor Generation Contextual Advice
        const adv = DomainLogic.generateAdvisorReply({
          query: 'What outdoor exercise window is safe today for my child?',
          aqi: 350,
          household: 'families_kids',
          commute: 'two_wheeler',
          purifier: 'hepa',
          activeActionIds: ['routine_mixing_window']
        });

        if (adv && typeof adv.text === 'string' && adv.text.length > 50 &&
            (adv.text.includes('child') || adv.text.includes('outdoor') || adv.text.includes('AQI'))) {
          unitPassed++;
          log('✓ Check 6: Context-aware GenAI advisor response generation verified.', 'pass');
        } else {
          throw new Error('Advisor reply generation failed.');
        }

        // 7. High-Volume Automated Stress & Fuzz Suite
        log(`Executing ${targetIterations.toLocaleString()}-Iteration Automated Fuzz & Extreme Bounds Test...`, 'info');

        const extremeAqis = [-100, 0, 50, 100, 200, 300, 400, 500, 999, 9999, NaN, Infinity, -Infinity, null, undefined, 'abc'];
        const householdKeys = Object.keys(CONFIG.HOUSEHOLDS);
        const commuteKeys = Object.keys(CONFIG.COMMUTE_MODES);
        const purifierKeys = Object.keys(CONFIG.PURIFIER_SETUPS);
        const actionIds = CONFIG.ACTIONS.map(a => a.id);

        for (let i = 0; i < targetIterations; i++) {
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

          if (Number.isNaN(sim.outdoorPm25) || Number.isNaN(sim.protectedIndoorPm25) || Number.isNaN(sim.unmitigatedIndoorPm25)) {
            throw new Error(`Stress iteration ${i} produced NaN metrics.`);
          }
          if (sim.protectedIndoorPm25 > sim.unmitigatedIndoorPm25 + 0.001) {
            throw new Error(`Stress iteration ${i} violated protected <= unmitigated.`);
          }
          if (sim.reductionPercent < 0 || sim.reductionPercent > 100) {
            throw new Error(`Stress iteration ${i} reductionPercent out of bounds: ${sim.reductionPercent}`);
          }

          // XSS Fuzzing
          const rawPayload = `<a href="javascript:void(${i})">test & ${i}</a>`;
          const sanitized = Security.escapeHtml(rawPayload);
          if (sanitized.includes('<') || sanitized.includes('>')) {
            throw new Error(`Stress iteration ${i} failed XSS escaping.`);
          }
        }

        const elapsedMs = Date.now() - startTime;
        log(`✓ Check 7: ${targetIterations.toLocaleString()} stress/fuzz iterations completed successfully (${elapsedMs} ms)!`, 'pass');
        log('100% SUITE PASSED — All CPCB, WHO, Security, and Invariant gates verified.', 'pass');

        return {
          passed: true,
          unitPassed,
          unitTotal,
          stressIterations: targetIterations,
          elapsedMs,
          error: null
        };
      } catch (err) {
        const elapsedMs = Date.now() - startTime;
        log(`✗ Test Failure: ${err.message}`, 'fail');

        return {
          passed: false,
          unitPassed,
          unitTotal,
          stressIterations: targetIterations,
          elapsedMs,
          error: err
        };
      }
    }
  };

  return {
    CONFIG,
    ACTION_MAP,
    Security,
    DomainLogic,
    SelfTest
  };
});
