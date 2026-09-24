import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import {
  handleWeatherRequest,
  handleHealthRequest,
  fetchLive2HourForecast,
  setServerStartTime,
} from './api/_weatherCore.js';

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
setServerStartTime(serverStartTime);

const app = express();
app.use(express.json());

// ----------------------------------------------------
// 1. AI Assistant Flow (Singapore 2-Hour Weather Assistant)
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
            const matched = (rawForecasts as any[]).find(
              (f: any) =>
                f.area.toLowerCase() === locName ||
                f.area.toLowerCase().includes(locName) ||
                locName.includes(f.area.toLowerCase())
            );

            if (matched) {
              stateUpdates.selectedArea = matched.area;
              stateUpdates.currentWeather = {
                area: matched.area,
                forecast: matched.forecast,
                forecastPeriod: validPeriod,
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

  let matchedAreaItem = undefined;

  for (const f of rawForecasts) {
    if (lower.includes(f.area.toLowerCase())) {
      matchedAreaItem = f;
      break;
    }
  }

  if (!matchedAreaItem) {
    if (lower.includes('marina bay') || lower.includes('mbs') || lower.includes('city') || lower.includes('raffles')) {
      matchedAreaItem = (rawForecasts as any[]).find((f: any) => f.area.toLowerCase() === 'city');
    } else if (lower.includes('jurong')) {
      matchedAreaItem =
        (rawForecasts as any[]).find((f: any) => f.area.toLowerCase() === 'jurong west') ||
        (rawForecasts as any[]).find((f: any) => f.area.toLowerCase() === 'jurong east');
    }
  }

  if (matchedAreaItem) {
    stateUpdates.selectedArea = matchedAreaItem.area;
    stateUpdates.currentWeather = {
      area: matchedAreaItem.area,
      forecast: matchedAreaItem.forecast,
      forecastPeriod: validPeriod,
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
    const rainyAreas = (rawForecasts as any[]).filter(
      (f: any) => f.forecast.toLowerCase().includes('rain') || f.forecast.toLowerCase().includes('shower')
    );
    const summary =
      rainyAreas.length > 0
        ? `${rainyAreas.length} of 47 areas currently have rain/showers (${rainyAreas.slice(0, 3).map((a: any) => a.area).join(', ')}${rainyAreas.length > 3 ? '...' : ''}).`
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
// 2. Chat Handler (POST /api/assistant/chat)
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
// 3. Explicit Route Registration BEFORE middlewares and fallbacks
// ----------------------------------------------------
const apiRouter = express.Router();
apiRouter.get('/health', (req, res) => handleHealthRequest(req, res, serverStartTime));
apiRouter.get('/weather', (req, res) => handleWeatherRequest(req, res));
apiRouter.post('/assistant/chat', chatHandler);

// Mount router on /api
app.use('/api', apiRouter);

// Direct registration on app for both /api/* and root paths
app.get('/api/health', (req, res) => handleHealthRequest(req, res, serverStartTime));
app.get('/health', (req, res) => handleHealthRequest(req, res, serverStartTime));
app.get('/api/weather', (req, res) => handleWeatherRequest(req, res));
app.get('/weather', (req, res) => handleWeatherRequest(req, res));
app.post('/api/assistant/chat', chatHandler);

// ----------------------------------------------------
// 4. Vite middleware (dev) / static files (production)
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
