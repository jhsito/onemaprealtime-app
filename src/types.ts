export type ThemeMode = 'day' | 'night';

export interface ForecastArea {
  name: string;
  forecast: string;
  latitude?: number;
  longitude?: number;
}

export interface WeatherData {
  area: string;
  forecast: string;
  forecastPeriod: string; // e.g. "5.00 pm to 7.00 pm"
  validPeriod: {
    start: string;
    end: string;
    text: string;
  };
  updateTime: string; // ISO string or timestamp from API
}

export interface WeatherApiResponse {
  status: 'ok' | 'error';
  area: string;
  forecast: string;
  forecastPeriod: string;
  validPeriod: {
    start: string;
    end: string;
    text: string;
  };
  updateTime: string;
  areas: ForecastArea[];
  message?: string;
}

export interface AgentAction {
  id: string;
  tool: string;
  label: string;
  details?: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actions?: AgentAction[];
}

export interface AppState {
  selectedArea: string | null;
  currentWeather: WeatherData | null;
  availableAreas: ForecastArea[];
}

export interface HealthReport {
  status: 'ok' | 'degraded' | 'error';
  server: {
    status: string;
    port?: number | string;
    nodeVersion?: string;
    uptimeSeconds?: number;
    uptimeFormatted?: string;
    environment?: string;
  } | string;
  weather?: {
    status: 'operational' | 'error' | 'degraded';
    service?: string;
    feed?: string;
    latencyMs: number | null;
    endpoint?: string;
    httpStatus?: number;
    coverage?: string;
    error?: string;
  };
  timestamp: string;
  uptimeSeconds?: number;
  uptimeFormatted?: string;
  environment?: string;
  port?: number | string;
  nodeVersion?: string;
  services?: {
    server?: {
      status: string;
      port?: number | string;
      nodeVersion?: string;
    };
    weatherDataGovSg?: {
      status: 'operational' | 'degraded';
      feedType: string;
      latencyMs: number | null;
      endpoint?: string;
      httpStatus?: number;
      coverage?: string;
      error?: string;
    };
    geminiAi?: {
      status: string;
      model: string;
    };
  };
}
