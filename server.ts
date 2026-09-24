import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';

// Parse port from environment or CLI arguments (e.g. --port 3000)
function getPort(): number {
  if (process.env.PORT) {
    const p = parseInt(process.env.PORT, 10);
    if (!isNaN(p)) return p;
  }
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const p = parseInt(process.argv[portArgIdx + 1], 10);
    if (!isNaN(p)) return p;
  }
  return 3000;
}

const PORT = getPort();
const serverStartTime = Date.now();

const app = express();
app.use(express.json());

// ----------------------------------------------------
// Core Helper: Fetch Live 2-Hour Forecast from data.gov.sg
// ----------------------------------------------------
interface RawForecastItem {
  area: string;
  forecast: string;
}

interface RawAreaMeta {
  name: string;
  label_location: { latitude: number; longitude: number };
}

interface LiveWeatherPayload {
  validPeriod: { start: string; end: string; text: string };
  updateTime: string;
  areas: Array<{ name: string; forecast: string; latitude?: number; longitude?: number }>;
  rawForecasts: RawForecastItem[];
}

interface WeatherFetchResult {
  data: LiveWeatherPayload | null;
  latencyMs: number | null;
  status: 'operational' | 'error';
  httpStatus: number;
  error?: string;
}

async function fetchLive2HourForecast(): Promise<WeatherFetchResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  // If DATA_GOV_API_KEY exists, send as x-api-key header; otherwise call public endpoint
  if (process.env.DATA_GOV_API_KEY) {
    headers['x-api-key'] = process.env.DATA_GOV_API_KEY;
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast', {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      return {
        data: null,
        latencyMs,
        status: 'error',
        httpStatus: res.status,
        error: `data.gov.sg responded with HTTP ${res.status}`,
      };
    }

    const json = await res.json();
    // Validate live data.gov.sg structure:
    // data.area_metadata
    // data.items[0].forecasts
    // data.items[0].valid_period
    // data.items[0].update_timestamp
    if (json.code !== 0 || !json.data || !json.data.items || json.data.items.length === 0) {
      return {
        data: null,
        latencyMs,
        status: 'error',
        httpStatus: res.status,
        error: 'Invalid response format from data.gov.sg',
      };
    }

    const areaMetadata: RawAreaMeta[] = json.data.area_metadata || [];
    const latestItem = json.data.items[0];
    const forecasts: RawForecastItem[] = latestItem.forecasts || [];
    const validPeriod = latestItem.valid_period || { start: '', end: '', text: 'Next 2 Hours' };
    const updateTime = latestItem.update_timestamp || new Date().toISOString();

    const metaMap = new Map<string, { latitude: number; longitude: number }>();
    areaMetadata.forEach((m) => metaMap.set(m.name.toLowerCase(), m.label_location));

    const areas = forecasts.map((f) => {
      const loc = metaMap.get(f.area.toLowerCase());
      return {
        name: f.area,
        forecast: f.forecast,
        latitude: loc?.latitude,
        longitude: loc?.longitude,
      };
    });

    return {
      data: {
        validPeriod,
        updateTime,
        areas,
        rawForecasts: forecasts,
      },
      latencyMs,
      status: 'operational',
      httpStatus: res.status,
    };
  } catch (err: any) {
    return {
      data: null,
      latencyMs: null,
      status: 'error',
      httpStatus: 0,
      error: err?.message || 'Connection timeout or network failure',
    };
  }
}

// ----------------------------------------------------
// 1. Health Handler (GET /api/health)
// ----------------------------------------------------
async function healthHandler(_req: Request, res: Response) {
  const probe = await fetchLive2HourForecast();
  const isOperational = probe.status === 'operational';

  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

  // Explicit health structure matching specification:
  // - status: "ok" or "degraded"
  // - server.status: "operational"
  // - weather.status: "operational" or "error"
  // - weather.latencyMs: number or null (never "undefined ms")
  const healthData = {
    status: isOperational ? 'ok' : 'degraded',
    server: {
      status: 'operational',
      port: PORT,
      nodeVersion: process.version,
      uptimeSeconds,
      uptimeFormatted,
      environment: process.env.NODE_ENV || 'development',
    },
    weather: {
      status: isOperational ? 'operational' : 'error',
      service: 'data.gov.sg',
      feed: '2-Hour Forecast API',
      latencyMs: probe.latencyMs,
      endpoint: 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast',
      httpStatus: probe.httpStatus,
      coverage: 'Singapore forecast areas',
      ...(probe.error ? { error: probe.error } : {}),
    },
    services: {
      server: {
        status: 'operational',
        port: PORT,
        nodeVersion: process.version,
      },
      weatherDataGovSg: {
        status: isOperational ? 'operational' : 'degraded',
        feedType: '2-Hour Forecast API',
        latencyMs: probe.latencyMs,
        endpoint: 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast',
        httpStatus: probe.httpStatus,
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

  res.status(200).json(healthData);
}

// ----------------------------------------------------
// 2. Weather Handler (GET /api/weather)
// ----------------------------------------------------
async function weatherHandler(req: Request, res: Response) {
  const areaQuery = ((req.query.area as string) || '').trim().toLowerCase();

  const probe = await fetchLive2HourForecast();
  if (!probe.data) {
    res.status(502).json({
      status: 'error',
      message: 'Live 2-hour weather information is temporarily unavailable.',
    });
    return;
  }

  const { validPeriod, updateTime, areas, rawForecasts } = probe.data;

  // If specific area requested, find best match
  let matchedArea = 'Bedok';
  let matchedForecast = '';

  if (areaQuery) {
    const exact = rawForecasts.find((f) => f.area.toLowerCase() === areaQuery);
    if (exact) {
      matchedArea = exact.area;
      matchedForecast = exact.forecast;
    } else {
      const partial = rawForecasts.find(
        (f) => f.area.toLowerCase().includes(areaQuery) || areaQuery.includes(f.area.toLowerCase())
      );
      if (partial) {
        matchedArea = partial.area;
        matchedForecast = partial.forecast;
      } else {
        res.status(404).json({
          status: 'error',
          message: 'No matching 2-hour forecast area was found.',
          availableAreas: areas.map((a) => a.name),
        });
        return;
      }
    }
  } else {
    const defaultArea = rawForecasts.find((f) => f.area.toLowerCase() === 'bedok') || rawForecasts[0];
    if (defaultArea) {
      matchedArea = defaultArea.area;
      matchedForecast = defaultArea.forecast;
    }
  }

  res.status(200).json({
    status: 'ok',
    area: matchedArea,
    forecast: matchedForecast,
    forecastPeriod: validPeriod.text || 'Next 2 Hours',
    validPeriod,
    updateTime,
    areas,
  });
}

// ----------------------------------------------------
// 3. AI Assistant Flow (Singapore 2-Hour Weather Assistant)
// ----------------------------------------------------
async function executeWeatherAssistant(
  message: string,
  _currentState: any,
  apiKey: string | undefined
): Promise<{ reply: string; actions: any[]; stateUpdates: any }> {
  const executedActions: any[] = [];
  const stateUpdates: any = {};

  const probe = await fetchLive2HourForecast();
  if (!probe.data) {
    return {
      reply: 'Live 2-hour weather information is temporarily unavailable.',
      actions: [],
      stateUpdates: {},
    };
  }

  const { validPeriod, updateTime, rawForecasts } = probe.data;

  const getWeatherDeclaration: FunctionDeclaration = {
    name: 'get_2hr_weather',
    description:
      'Retrieve official Singapore 2-hour weather forecast for a specific Singapore forecast area (e.g. Bedok, Jurong, Tampines, Orchard, Changi, etc.).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: 'The Singapore forecast area name, e.g. "Bedok", "Jurong", "Tampines", "Orchard"',
        },
      },
      required: ['location'],
    },
  };

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const systemInstruction = `You are the official Singapore 2-Hour Weather Assistant.
Your ONLY role is to provide official live 2-hour weather forecasts for Singapore using live data.gov.sg information.
Rules:
1. Always call the 'get_2hr_weather' tool with the requested location to fetch current live weather.
2. Never fabricate, predict, or guess weather information. All answers must come from the live tool response.
3. Do not provide daily, 4-day, 7-day, or long-range forecasts. This app is strictly for the current 2-hour window.
4. Keep replies concise, polite, and factual (1-2 sentences). State the forecast and valid time period clearly.
5. If the requested area is not an available Singapore forecast area, state clearly that it is not available in the official 47 forecast areas.`;

      const contents = [{ role: 'user', parts: [{ text: message }] }];

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI model response timed out')), 5000)
      );

      const response: any = await Promise.race([
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: [getWeatherDeclaration] }],
          },
        }),
        timeoutPromise,
      ]);

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          const { name, args } = call;
          if (name === 'get_2hr_weather') {
            const locName = ((args as any)?.location || '').trim().toLowerCase();
            const matched = rawForecasts.find(
              (f) =>
                f.area.toLowerCase() === locName ||
                f.area.toLowerCase().includes(locName) ||
                locName.includes(f.area.toLowerCase())
            );

            if (matched) {
              stateUpdates.selectedArea = matched.area;
              stateUpdates.currentWeather = {
                area: matched.area,
                forecast: matched.forecast,
                forecastPeriod: validPeriod.text || 'Next 2 Hours',
                validPeriod,
                updateTime,
              };

              executedActions.push({
                id: `act-${Date.now()}-1`,
                tool: 'get_2hr_weather',
                label: `Retrieved data.gov.sg 2-hour forecast for ${matched.area}`,
                details: `Forecast: ${matched.forecast} · Valid: ${validPeriod.text}`,
                timestamp: new Date().toLocaleTimeString(),
              });

              const lowerMsg = message.toLowerCase();
              const isRainQuery = lowerMsg.includes('rain') || lowerMsg.includes('shower');
              const willRain =
                matched.forecast.toLowerCase().includes('rain') ||
                matched.forecast.toLowerCase().includes('shower');

              let replyText = `In ${matched.area}, the 2-hour forecast is ${matched.forecast} (valid ${validPeriod.text}).`;
              if (isRainQuery) {
                replyText = willRain
                  ? `Yes, ${matched.forecast.toLowerCase()} is forecast for ${matched.area} during the 2-hour window (${validPeriod.text}).`
                  : `No rain is expected in ${matched.area} for the current 2-hour window (${validPeriod.text}); the forecast is ${matched.forecast}.`;
              }

              return {
                reply: replyText,
                actions: executedActions,
                stateUpdates,
              };
            }
          }
        }
      }

      if (response.text) {
        return {
          reply: response.text,
          actions: executedActions,
          stateUpdates,
        };
      }
    } catch {
      // Fall through to deterministic router
    }
  }

  // Deterministic Semantic Router
  const lower = message.toLowerCase();

  if (lower.includes('health') || lower.includes('/api/health')) {
    executedActions.push({
      id: `act-${Date.now()}-1`,
      tool: 'api_health_check',
      label: 'Verified system health and data.gov.sg weather connection',
      details: 'Express Server: Operational · data.gov.sg: Operational',
      timestamp: new Date().toLocaleTimeString(),
    });
    return {
      reply: 'System health check completed (/api/health): The Express server and data.gov.sg 2-hour weather API are both operational and connected.',
      actions: executedActions,
      stateUpdates,
    };
  }

  let matchedAreaItem: RawForecastItem | undefined = undefined;

  for (const f of rawForecasts) {
    if (lower.includes(f.area.toLowerCase())) {
      matchedAreaItem = f;
      break;
    }
  }

  if (!matchedAreaItem) {
    if (lower.includes('marina bay') || lower.includes('mbs') || lower.includes('city') || lower.includes('raffles')) {
      matchedAreaItem = rawForecasts.find((f) => f.area.toLowerCase() === 'city');
    } else if (lower.includes('jurong')) {
      matchedAreaItem =
        rawForecasts.find((f) => f.area.toLowerCase() === 'jurong west') ||
        rawForecasts.find((f) => f.area.toLowerCase() === 'jurong east');
    }
  }

  if (matchedAreaItem) {
    stateUpdates.selectedArea = matchedAreaItem.area;
    stateUpdates.currentWeather = {
      area: matchedAreaItem.area,
      forecast: matchedAreaItem.forecast,
      forecastPeriod: validPeriod.text || 'Next 2 Hours',
      validPeriod,
      updateTime,
    };

    executedActions.push({
      id: `act-${Date.now()}-1`,
      tool: 'get_2hr_weather',
      label: `Retrieved data.gov.sg 2-hour forecast for ${matchedAreaItem.area}`,
      details: `Forecast: ${matchedAreaItem.forecast} · Valid: ${validPeriod.text}`,
      timestamp: new Date().toLocaleTimeString(),
    });

    const isRainQuery = lower.includes('rain') || lower.includes('shower');
    const willRain =
      matchedAreaItem.forecast.toLowerCase().includes('rain') ||
      matchedAreaItem.forecast.toLowerCase().includes('shower') ||
      matchedAreaItem.forecast.toLowerCase().includes('thunder');

    let reply = `In ${matchedAreaItem.area}, the 2-hour forecast is ${matchedAreaItem.forecast} (valid ${validPeriod.text}).`;
    if (isRainQuery) {
      reply = willRain
        ? `Yes, ${matchedAreaItem.forecast.toLowerCase()} is forecast in ${matchedAreaItem.area} during the 2-hour window (${validPeriod.text}).`
        : `No rain is expected in ${matchedAreaItem.area} for the current 2-hour window (${validPeriod.text}); the forecast is ${matchedAreaItem.forecast}.`;
    }

    return {
      reply,
      actions: executedActions,
      stateUpdates,
    };
  }

  if (lower.includes('singapore') || lower.includes('all') || lower.includes('overview') || lower.includes('current')) {
    const rainyAreas = rawForecasts.filter(
      (f) => f.forecast.toLowerCase().includes('rain') || f.forecast.toLowerCase().includes('shower')
    );
    const summary =
      rainyAreas.length > 0
        ? `${rainyAreas.length} of 47 areas currently have rain/showers (${rainyAreas.slice(0, 3).map((a) => a.area).join(', ')}${rainyAreas.length > 3 ? '...' : ''}).`
        : 'All 47 forecast areas currently report fair or cloudy conditions with no rain.';

    return {
      reply: `Singapore 2-Hour Weather Overview (${validPeriod.text}): ${summary} You can ask for any specific area like Bedok, Tampines, Jurong, or Orchard.`,
      actions: executedActions,
      stateUpdates,
    };
  }

  return {
    reply: `I can check the live 2-hour weather forecast for any of Singapore's 47 official forecast areas (e.g. "What's the weather in Bedok?", "Will it rain in Jurong?", "Check weather in Orchard").`,
    actions: executedActions,
    stateUpdates,
  };
}

// ----------------------------------------------------
// 4. Chat Handler (POST /api/assistant/chat)
// ----------------------------------------------------
async function chatHandler(req: Request, res: Response) {
  const { message, currentState } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    const result = await executeWeatherAssistant(message, currentState, process.env.GEMINI_API_KEY);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({
      reply: 'An error occurred while retrieving live weather: ' + (err.message || 'unknown error'),
      actions: [],
      stateUpdates: {},
    });
  }
}

// ----------------------------------------------------
// 5. Explicit Route Registration BEFORE middlewares and fallbacks
// ----------------------------------------------------
// Express Router mounted at /api
const apiRouter = express.Router();
apiRouter.get('/health', healthHandler);
apiRouter.get('/weather', weatherHandler);
apiRouter.post('/assistant/chat', chatHandler);
app.use('/api', apiRouter);

// Direct registration on app for both /api/* and root paths
app.get('/api/health', healthHandler);
app.get('/health', healthHandler);
app.get('/api/weather', weatherHandler);
app.get('/weather', weatherHandler);
app.post('/api/assistant/chat', chatHandler);

// ----------------------------------------------------
// 6. Vite middleware (dev) / static files (production)
// MUST BE REGISTERED AFTER ALL /api ROUTES
// ----------------------------------------------------
if (!isProd) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Singapore 2-Hour Weather Assistant running at http://0.0.0.0:${PORT}`);
});
