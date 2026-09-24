/**
 * Shared weather core service for both Vercel Serverless Functions
 * and Express dev server in AI Studio.
 */

export const WEATHER_URL = 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast';

let serverStartTime = Date.now();

export function setServerStartTime(time) {
  serverStartTime = time;
}

export function getServerStartTime() {
  return serverStartTime;
}

/**
 * Perform a live request to data.gov.sg 2-hour weather forecast.
 * Accurately measures latency and inspects response.ok before parsing JSON.
 */
export async function fetchLive2HourForecast(timeoutMs = 6000) {
  const headers = {
    Accept: 'application/json',
  };

  // Optional API key if present in environment; never required.
  if (process.env.DATA_GOV_API_KEY) {
    headers['x-api-key'] = process.env.DATA_GOV_API_KEY;
  }

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(WEATHER_URL, {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    // Check response.ok BEFORE parsing
    if (!response.ok) {
      return {
        status: 'error',
        upstreamStatus: response.status,
        latencyMs,
        error: 'data.gov.sg weather request failed',
        data: null,
      };
    }

    const json = await response.json();

    // Verify expected data.gov.sg structure
    if (
      !json ||
      json.code !== 0 ||
      !json.data ||
      !Array.isArray(json.data.items) ||
      json.data.items.length === 0
    ) {
      return {
        status: 'error',
        upstreamStatus: response.status,
        latencyMs,
        error: 'Unexpected response structure from data.gov.sg',
        data: null,
      };
    }

    const areaMetadata = json.data.area_metadata || [];
    const latestItem = json.data.items[0];
    const forecasts = latestItem.forecasts || [];
    const validPeriod = latestItem.valid_period || {
      start: '',
      end: '',
      text: 'Next 2 Hours',
    };
    const updateTime = latestItem.update_timestamp || new Date().toISOString();

    // Index metadata coordinates by lowercased area name
    const metaMap = new Map();
    if (Array.isArray(areaMetadata)) {
      for (const meta of areaMetadata) {
        if (meta && meta.name) {
          metaMap.set(meta.name.toLowerCase(), meta.label_location);
        }
      }
    }

    // Combine metadata and forecasts
    const areas = forecasts.map((f) => {
      const loc = metaMap.get(f.area?.toLowerCase());
      return {
        name: f.area,
        forecast: f.forecast,
        ...(loc?.latitude !== undefined ? { latitude: loc.latitude } : {}),
        ...(loc?.longitude !== undefined ? { longitude: loc.longitude } : {}),
      };
    });

    return {
      status: 'operational',
      upstreamStatus: response.status,
      latencyMs,
      data: {
        validPeriod,
        updateTime,
        areas,
        rawForecasts: forecasts,
      },
    };
  } catch (err) {
    return {
      status: 'error',
      upstreamStatus: 0,
      latencyMs: null,
      error: err?.message || 'Connection timeout or network failure',
      data: null,
    };
  }
}

/**
 * Handle GET /api/weather for both Vercel Serverless and Express
 */
export async function handleWeatherRequest(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  const probe = await fetchLive2HourForecast();

  if (!probe.data) {
    res.status(probe.upstreamStatus && probe.upstreamStatus >= 400 ? probe.upstreamStatus : 502).json({
      success: false,
      status: 'error',
      error: probe.error || 'data.gov.sg weather request failed',
      upstreamStatus: probe.upstreamStatus,
      message: 'Live 2-hour weather information is temporarily unavailable.',
    });
    return;
  }

  const { validPeriod, updateTime, areas, rawForecasts } = probe.data;
  const areaQuery = ((req.query?.area || '')).trim().toLowerCase();

  let matchedArea = 'Bedok';
  let matchedForecast = '';

  if (areaQuery) {
    const exact = rawForecasts.find((f) => f.area.toLowerCase() === areaQuery);
    if (exact) {
      matchedArea = exact.area;
      matchedForecast = exact.forecast;
    } else {
      const partial = rawForecasts.find(
        (f) =>
          f.area.toLowerCase().includes(areaQuery) ||
          areaQuery.includes(f.area.toLowerCase())
      );
      if (partial) {
        matchedArea = partial.area;
        matchedForecast = partial.forecast;
      } else {
        res.status(404).json({
          success: false,
          status: 'error',
          message: 'No matching 2-hour forecast area was found.',
          availableAreas: areas.map((a) => a.name),
        });
        return;
      }
    }
  } else {
    const defaultArea =
      rawForecasts.find((f) => f.area.toLowerCase() === 'bedok') ||
      rawForecasts[0];
    if (defaultArea) {
      matchedArea = defaultArea.area;
      matchedForecast = defaultArea.forecast;
    }
  }

  res.status(200).json({
    success: true,
    status: 'ok',
    area: matchedArea,
    forecast: matchedForecast,
    forecastPeriod: validPeriod,
    validPeriod: validPeriod,
    lastUpdated: updateTime,
    updateTime: updateTime,
    areas,
  });
}

/**
 * Handle GET /api/health for both Vercel Serverless and Express
 * @param {any} req
 * @param {any} res
 * @param {number} [customStartTime]
 */
export async function handleHealthRequest(req, res, customStartTime = 0) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const probe = await fetchLive2HourForecast();
  const isOperational = probe.status === 'operational';

  const startTime = customStartTime || serverStartTime;
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

  const healthPayload = {
    status: isOperational ? 'ok' : 'degraded',
    server: {
      status: 'operational',
      port: process.env.PORT || 3000,
      nodeVersion: process.version,
      uptimeSeconds,
      uptimeFormatted,
      environment: process.env.NODE_ENV || 'development',
    },
    weather: {
      status: isOperational ? 'operational' : 'error',
      service: 'data.gov.sg',
      feed: '2-Hour Weather Forecast',
      upstreamStatus: probe.upstreamStatus,
      latencyMs: probe.latencyMs,
      endpoint: WEATHER_URL,
      coverage: 'Singapore forecast areas',
      ...(probe.error ? { error: probe.error } : {}),
    },
    services: {
      server: {
        status: 'operational',
        port: process.env.PORT || 3000,
        nodeVersion: process.version,
      },
      weatherDataGovSg: {
        status: isOperational ? 'operational' : 'degraded',
        feedType: '2-Hour Forecast API',
        latencyMs: probe.latencyMs,
        endpoint: WEATHER_URL,
        upstreamStatus: probe.upstreamStatus,
        httpStatus: probe.upstreamStatus,
        coverage: 'Singapore forecast areas',
        ...(probe.error ? { error: probe.error } : {}),
      },
      geminiAi: {
        status: 'ready',
        model: 'gemini-3.8-flash',
      },
    },
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(healthPayload);
}
