/**
 * TypeScript Type Definitions for SmogShield AI (AirQi)
 */

export interface WhoGuidelines {
  readonly PM25_24HR: number;
  readonly PM25_ANNUAL: number;
}

export interface CityPreset {
  readonly id: string;
  readonly name: string;
  readonly defaultAqi: number;
  readonly note: string;
}

export interface HouseholdProfile {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly badge: string;
  readonly desc: string;
  readonly vulnerabilityFactor: number;
}

export interface CommuteProfile {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly exposureLevel: string;
  readonly multiplier: number;
  readonly defaultCo2eKg: number;
}

export interface PurifierProfile {
  readonly id: string;
  readonly label: string;
  readonly tag: string;
  readonly efficiency: number;
  readonly desc: string;
}

export interface CpcbBreakpoint {
  readonly aqiMin: number;
  readonly aqiMax: number;
  readonly pmMin: number;
  readonly pmMax: number;
  readonly key: string;
  readonly label: string;
  readonly color: string;
  readonly bg: string;
  readonly textColor: string;
}

export interface ActionItem {
  readonly id: string;
  readonly track: 'routines' | 'iaq' | 'community';
  readonly title: string;
  readonly tag: string;
  readonly targetHousehold: readonly string[];
  readonly minAqiThreshold: number;
  readonly directImpact: string;
  readonly scientificEvidence: string;
  readonly exposureReductionFactor: number;
  readonly co2eAvoidedKg: number;
}

export interface MetricCalculationParams {
  aqi: number;
  household: string;
  commute: string;
  purifier: string;
  activeActionIds?: Set<string> | string[] | null;
}

export interface ComputedMetrics {
  aqi: number;
  category: CpcbBreakpoint;
  outdoorPm25: number;
  unmitigatedIndoorPm25: number;
  protectedIndoorPm25: number;
  reductionPercent: number;
  co2eAvoidedKg: number;
  whoLimit: number;
  outdoorWhoTimes: number;
  protectedWhoTimes: number;
  activeCount: number;
}

export interface AdvisorContext {
  query?: string;
  aqi: number;
  household: string;
  commute: string;
  purifier: string;
  activeActionIds?: Set<string> | string[] | null;
}

export interface AdvisorResponse {
  title: string;
  text: string;
  tags: string[];
  suggestedActions: string[];
}

export interface SelfTestOptions {
  onLog?: (msg: string, type: 'pass' | 'fail' | 'info') => void;
  stressIterations?: number;
}

export interface SelfTestResult {
  passed: boolean;
  unitPassed: number;
  unitTotal: number;
  stressIterations: number;
  elapsedMs: number;
  error: Error | null;
}

export interface ConfigType {
  readonly WHO_GUIDELINES: WhoGuidelines;
  readonly METRIC_CONSTANTS: Record<string, unknown>;
  readonly CITY_PRESETS: readonly CityPreset[];
  readonly HOUSEHOLDS: Record<string, HouseholdProfile>;
  readonly COMMUTE_MODES: Record<string, CommuteProfile>;
  readonly PURIFIER_SETUPS: Record<string, PurifierProfile>;
  readonly CPCB_BREAKPOINTS: readonly CpcbBreakpoint[];
  readonly ACTIONS: readonly ActionItem[];
  readonly ACTION_MAP: Map<string, ActionItem>;
}

export declare const CONFIG: ConfigType;
export declare const ACTION_MAP: Map<string, ActionItem>;

export declare const Security: {
  escapeHtml(str: unknown): string;
  clampNumber(val: unknown, min: number, max: number, fallback?: number): number;
};

export declare const DomainLogic: {
  aqiToPm25(aqi: number): number;
  getAqiCategory(aqi: number): CpcbBreakpoint;
  isRecommended(action: ActionItem, household: string, aqi: number): boolean;
  computeMetrics(params: MetricCalculationParams): ComputedMetrics;
  generateAdvisorReply(ctx: AdvisorContext): AdvisorResponse;
};

export declare const SelfTest: {
  runAll(options?: SelfTestOptions): SelfTestResult;
};
