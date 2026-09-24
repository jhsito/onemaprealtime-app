export type TravelMode = 'walk' | 'drive' | 'cycle' | 'pt';
export type ThemeMode = 'day' | 'night';

export interface LocationItem {
  name: string;
  address: string;
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;
  building?: string;
  roadName?: string;
  postal?: string;
}

export interface RouteSummary {
  start_point?: string;
  end_point?: string;
  total_time: number; // in seconds
  total_distance: number; // in meters
}

export interface RouteInstruction {
  instruction: string;
  distance: string;
  time?: number;
}

export interface RouteData {
  status: number;
  status_message: string;
  route_geometry?: string;
  coordinates: [number, number][]; // [lat, lng] array
  route_summary: RouteSummary;
  travel_mode: TravelMode;
  start_location: LocationItem;
  destination: LocationItem;
  route_instructions?: string[];
  source?: 'onemap' | 'fallback';
  notice?: string;
}

export interface WeatherData {
  area: string;
  forecast: string;
  forecastPeriod: string; // e.g. "3.30 pm to 5.30 pm"
  validPeriod: {
    start: string;
    end: string;
    text: string;
  };
  updateTime: string;
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
  mapCenter: [number, number];
  zoom: number;
  selectedLocation: LocationItem | null;
  startLocation: LocationItem | null;
  destination: LocationItem | null;
  travelMode: TravelMode;
  currentRoute: RouteData | null;
  currentWeather: WeatherData | null;
}

export interface HealthReport {
  status: 'ok' | 'degraded' | 'error';
  server: string;
  timestamp: string;
  uptimeSeconds?: number;
  uptimeFormatted?: string;
  environment?: string;
  port?: number | string;
  nodeVersion?: string;
  services: {
    onemap: {
      status: 'operational' | 'degraded';
      tokenConfigured: boolean;
      latencyMs: number | null;
      httpStatus?: number;
      error?: string;
    };
    weatherDataGovSg: {
      status: 'operational' | 'degraded';
      latencyMs: number | null;
      endpoint: string;
      httpStatus?: number;
      error?: string;
    };
    geminiAi: {
      status: string;
      model: string;
    };
  };
}
