import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { decodePolyline } from './src/utils/polyline.ts';
import { TravelMode } from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// In-memory token cache for OneMap
let cachedOneMapToken: string | null = process.env.ONEMAP_TOKEN || process.env.ONEMAP_API_KEY || null;
let tokenExpiresAt = 0;

async function getOneMapToken(): Promise<string | null> {
  if (cachedOneMapToken && (tokenExpiresAt === 0 || Date.now() < tokenExpiresAt)) {
    return cachedOneMapToken;
  }
  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;
  if (email && password) {
    try {
      const res = await fetch('https://www.onemap.gov.sg/api/auth/post/getToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          cachedOneMapToken = data.access_token;
          // Valid for 72 hours, renew slightly earlier (70 hours)
          tokenExpiresAt = Date.now() + 70 * 60 * 60 * 1000;
          return cachedOneMapToken;
        }
      }
    } catch {
      // Ignore token fetch error, will fallback
    }
  }
  return cachedOneMapToken;
}

// Distance helper (Haversine in km)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 1. OneMap Search API route
app.get('/api/onemap-search', async (req: Request, res: Response) => {
  const searchVal = (req.query.searchVal as string || '').trim();
  const pageNum = req.query.pageNum || '1';

  if (!searchVal) {
    res.json({ found: 0, totalNumPages: 0, pageNum: 1, results: [] });
    return;
  }

  try {
    const token = await getOneMapToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(
      searchVal
    )}&returnGeom=Y&getAddrDetails=Y&pageNum=${pageNum}`;

    const apiRes = await fetch(url, { headers });
    if (!apiRes.ok) {
      res.status(apiRes.status).json({
        found: 0,
        results: [],
        error: `OneMap search failed with status ${apiRes.status}`,
      });
      return;
    }

    const data = await apiRes.json();
    const rawResults = data.results || [];
    const formattedResults = rawResults.map((r: any) => ({
      name: r.SEARCHVAL || r.BUILDING || r.ROAD_NAME || 'Unknown Location',
      address: r.ADDRESS || `${r.BLK_NO || ''} ${r.ROAD_NAME || ''}`.trim(),
      lat: parseFloat(r.LATITUDE),
      lng: parseFloat(r.LONGITUDE),
      building: r.BUILDING || '',
      roadName: r.ROAD_NAME || '',
      postal: r.POSTAL || '',
    }));

    res.json({
      found: data.found || formattedResults.length,
      totalNumPages: data.totalNumPages || 1,
      pageNum: parseInt(pageNum as string, 10) || 1,
      results: formattedResults,
    });
  } catch (err: any) {
    res.status(500).json({
      found: 0,
      results: [],
      error: err.message || 'Error communicating with OneMap search API',
    });
  }
});

// 2. data.gov.sg 2-Hour Weather Forecast API route
app.get('/api/weather', async (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : null;
  const lng = req.query.lng ? parseFloat(req.query.lng as string) : null;
  const areaQuery = (req.query.area as string || '').toLowerCase().trim();

  try {
    const apiRes = await fetch('https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast');
    if (!apiRes.ok) {
      res.status(502).json({
        status: 'error',
        message: 'Live 2-hour weather forecast temporarily unavailable',
      });
      return;
    }

    const json = await apiRes.json();
    if (json.code !== 0 || !json.data || !json.data.items || json.data.items.length === 0) {
      res.status(502).json({
        status: 'error',
        message: 'No forecast items returned by weather service',
      });
      return;
    }

    const areaMetadata: Array<{ name: string; label_location: { latitude: number; longitude: number } }> =
      json.data.area_metadata || [];
    const latestItem = json.data.items[0];
    const forecasts: Array<{ area: string; forecast: string }> = latestItem.forecasts || [];
    const validPeriod = latestItem.valid_period || { start: '', end: '', text: 'Next 2 Hours' };
    const updateTime = latestItem.update_timestamp || new Date().toISOString();

    const areaMap = new Map<string, string>();
    forecasts.forEach((f) => areaMap.set(f.area.toLowerCase(), f.forecast));

    let matchedArea = 'City';
    let matchedForecast = areaMap.get('city') || 'Partly Cloudy (Day)';

    // Match by coordinates if provided
    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng) && areaMetadata.length > 0) {
      let minDistance = Infinity;
      let closestArea = areaMetadata[0].name;

      for (const area of areaMetadata) {
        const d = haversineDistance(lat, lng, area.label_location.latitude, area.label_location.longitude);
        if (d < minDistance) {
          minDistance = d;
          closestArea = area.name;
        }
      }

      matchedArea = closestArea;
      matchedForecast = areaMap.get(closestArea.toLowerCase()) || forecasts[0]?.forecast || 'Fair (Day)';
    } else if (areaQuery) {
      // Match by area name query
      const found = forecasts.find(
        (f) =>
          f.area.toLowerCase() === areaQuery ||
          f.area.toLowerCase().includes(areaQuery) ||
          areaQuery.includes(f.area.toLowerCase())
      );
      if (found) {
        matchedArea = found.area;
        matchedForecast = found.forecast;
      }
    }

    const allAreas = areaMetadata.map((a) => ({
      area: a.name,
      forecast: areaMap.get(a.name.toLowerCase()) || 'Fair',
      lat: a.label_location.latitude,
      lng: a.label_location.longitude,
    }));

    res.json({
      status: 'ok',
      area: matchedArea,
      forecast: matchedForecast,
      forecastPeriod: validPeriod.text || 'Next 2 Hours',
      validPeriod,
      updateTime,
      allAreas,
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve Singapore 2-hour weather forecast: ' + (err.message || 'network error'),
    });
  }
});

// 3. OneMap Routing API route
app.get('/api/onemap-route', async (req: Request, res: Response) => {
  const start = req.query.start as string; // "lat,lng"
  const end = req.query.end as string; // "lat,lng"
  const routeType = ((req.query.routeType as string) || 'walk').toLowerCase();
  const startName = (req.query.startName as string) || 'Start';
  const endName = (req.query.endName as string) || 'Destination';

  if (!start || !end) {
    res.status(400).json({
      status: -1,
      status_message: 'Missing start or end coordinates',
    });
    return;
  }

  const validModes = ['walk', 'drive', 'cycle', 'pt'];
  if (!validModes.includes(routeType)) {
    res.status(400).json({
      status: -1,
      status_message: `Unsupported travel mode: ${routeType}. Supported modes: walk, drive, cycle, pt`,
    });
    return;
  }

  const [startLat, startLng] = start.split(',').map((v) => parseFloat(v.trim()));
  const [endLat, endLng] = end.split(',').map((v) => parseFloat(v.trim()));

  if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
    res.status(400).json({
      status: -1,
      status_message: 'Invalid coordinate values provided',
    });
    return;
  }

  // Attempt OneMap routing first
  try {
    const token = await getOneMapToken();
    if (token) {
      const oneMapUrl = `https://www.onemap.gov.sg/api/public/routingsvc/route?start=${startLat},${startLng}&end=${endLat},${endLng}&routeType=${routeType}`;
      const omRes = await fetch(oneMapUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (omRes.ok) {
        const omData = await omRes.json();
        if (omData.route_geometry || omData.status === 0) {
          const coordinates = decodePolyline(omData.route_geometry || '');
          const instructions = Array.isArray(omData.route_instructions)
            ? omData.route_instructions.map((i: any) => (Array.isArray(i) ? i[i.length - 1] : String(i)))
            : [];

          res.json({
            status: 0,
            status_message: omData.status_message || 'Found route between points',
            route_geometry: omData.route_geometry,
            coordinates,
            travel_mode: routeType,
            start_location: { name: startName, lat: startLat, lng: startLng },
            destination: { name: endName, lat: endLat, lng: endLng },
            route_summary: {
              start_point: startName,
              end_point: endName,
              total_time: omData.route_summary?.total_time || 0,
              total_distance: omData.route_summary?.total_distance || 0,
            },
            route_instructions: instructions,
            source: 'onemap',
          });
          return;
        }
      }
    }
  } catch {
    // Continue to fallback
  }

  // Live road-network routing fallback (OSRM)
  try {
    const osrmProfile = routeType === 'drive' || routeType === 'pt' ? 'car' : routeType === 'cycle' ? 'bicycle' : 'foot';
    // OSRM expects: {lng},{lat};{lng},{lat}
    const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline&steps=true`;

    const osrmRes = await fetch(osrmUrl);
    if (!osrmRes.ok) {
      res.status(502).json({
        status: -1,
        status_message: 'Routing service temporarily unavailable',
      });
      return;
    }

    const osrmData = await osrmRes.json();
    if (osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
      res.status(404).json({
        status: -1,
        status_message: 'No route found between the specified locations',
      });
      return;
    }

    const route = osrmData.routes[0];
    const encodedPoly = route.geometry;
    const coordinates = decodePolyline(encodedPoly);
    const instructions: string[] = [];

    if (route.legs && route.legs[0] && route.legs[0].steps) {
      route.legs[0].steps.forEach((step: any) => {
        if (step.maneuver && step.name) {
          instructions.push(`${step.maneuver.type || 'Proceed'} onto ${step.name}`);
        }
      });
    }

    // Convert duration for walk / cycle realistically if needed
    let durationSec = Math.round(route.duration);
    if (routeType === 'walk' && osrmProfile !== 'foot') {
      durationSec = Math.round((route.distance / 1.3)); // ~4.7 km/h walking speed
    } else if (routeType === 'cycle' && osrmProfile !== 'bicycle') {
      durationSec = Math.round((route.distance / 4.2)); // ~15 km/h cycling speed
    }

    res.json({
      status: 0,
      status_message: 'Found route between points',
      route_geometry: encodedPoly,
      coordinates,
      travel_mode: routeType,
      start_location: { name: startName, lat: startLat, lng: startLng },
      destination: { name: endName, lat: endLat, lng: endLng },
      route_summary: {
        start_point: startName,
        end_point: endName,
        total_time: durationSec,
        total_distance: Math.round(route.distance),
      },
      route_instructions: instructions.length > 0 ? instructions : ['Follow the suggested route to your destination'],
      source: 'fallback',
      notice: 'OneMap token not active in environment; live road routing active.',
    });
  } catch (err: any) {
    res.status(500).json({
      status: -1,
      status_message: 'Failed to calculate route: ' + (err.message || 'unknown error'),
    });
  }
});

// Helper internal functions for AI agent
async function internalSearch(query: string) {
  try {
    const token = await getOneMapToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(
      query
    )}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 4).map((r: any) => ({
      name: r.SEARCHVAL || r.BUILDING || r.ROAD_NAME,
      address: r.ADDRESS || `${r.BLK_NO || ''} ${r.ROAD_NAME || ''}`.trim(),
      lat: parseFloat(r.LATITUDE),
      lng: parseFloat(r.LONGITUDE),
      building: r.BUILDING || '',
      postal: r.POSTAL || '',
    }));
  } catch {
    return [];
  }
}

async function internalWeather(lat?: number, lng?: number, areaQuery?: string) {
  try {
    const apiRes = await fetch('https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast');
    if (!apiRes.ok) return null;
    const json = await apiRes.json();
    if (!json.data || !json.data.items || json.data.items.length === 0) return null;
    const areaMetadata = json.data.area_metadata || [];
    const latestItem = json.data.items[0];
    const forecasts: Array<{ area: string; forecast: string }> = latestItem.forecasts || [];
    const validPeriod = latestItem.valid_period || { text: 'Next 2 Hours' };
    const areaMap = new Map<string, string>();
    forecasts.forEach((f) => areaMap.set(f.area.toLowerCase(), f.forecast));

    let matchedArea = 'City';
    let matchedForecast = areaMap.get('city') || 'Partly Cloudy (Day)';

    if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng) && areaMetadata.length > 0) {
      let minDistance = Infinity;
      for (const area of areaMetadata) {
        const d = haversineDistance(lat, lng, area.label_location.latitude, area.label_location.longitude);
        if (d < minDistance) {
          minDistance = d;
          matchedArea = area.name;
        }
      }
      matchedForecast = areaMap.get(matchedArea.toLowerCase()) || 'Fair (Day)';
    } else if (areaQuery) {
      const q = areaQuery.toLowerCase();
      const found = forecasts.find((f) => f.area.toLowerCase().includes(q) || q.includes(f.area.toLowerCase()));
      if (found) {
        matchedArea = found.area;
        matchedForecast = found.forecast;
      }
    }

    return {
      area: matchedArea,
      forecast: matchedForecast,
      forecastPeriod: validPeriod.text || 'Next 2 Hours',
      validPeriod,
      updateTime: latestItem.update_timestamp || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function internalRoute(
  startLat: number,
  startLng: number,
  startName: string,
  endLat: number,
  endLng: number,
  endName: string,
  routeType: string = 'walk'
) {
  const osrmProfile = routeType === 'drive' || routeType === 'pt' ? 'car' : routeType === 'cycle' ? 'bicycle' : 'foot';
  const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline&steps=true`;

  try {
    const token = await getOneMapToken();
    if (token) {
      const omUrl = `https://www.onemap.gov.sg/api/public/routingsvc/route?start=${startLat},${startLng}&end=${endLat},${endLng}&routeType=${routeType}`;
      const omRes = await fetch(omUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (omRes.ok) {
        const omData = await omRes.json();
        if (omData.route_geometry || omData.status === 0) {
          return {
            status: 0,
            status_message: 'Found route between points',
            route_geometry: omData.route_geometry,
            coordinates: decodePolyline(omData.route_geometry || ''),
            travel_mode: routeType,
            start_location: { name: startName, lat: startLat, lng: startLng },
            destination: { name: endName, lat: endLat, lng: endLng },
            route_summary: {
              start_point: startName,
              end_point: endName,
              total_time: omData.route_summary?.total_time || 0,
              total_distance: omData.route_summary?.total_distance || 0,
            },
            source: 'onemap',
          };
        }
      }
    }
  } catch {
    // Continue to fallback
  }

  const osrmRes = await fetch(osrmUrl);
  if (!osrmRes.ok) return null;
  const data = await osrmRes.json();
  if (!data.routes || data.routes.length === 0) return null;

  const route = data.routes[0];
  let durationSec = Math.round(route.duration);
  if (routeType === 'walk') durationSec = Math.round(route.distance / 1.3);
  else if (routeType === 'cycle') durationSec = Math.round(route.distance / 4.2);

  return {
    status: 0,
    status_message: 'Found route between points',
    route_geometry: route.geometry,
    coordinates: decodePolyline(route.geometry),
    travel_mode: routeType,
    start_location: { name: startName, lat: startLat, lng: startLng },
    destination: { name: endName, lat: endLat, lng: endLng },
    route_summary: {
      start_point: startName,
      end_point: endName,
      total_time: durationSec,
      total_distance: Math.round(route.distance),
    },
    source: 'fallback',
  };
}

// Resilient Agent Engine: Executes Gemini Function Calling with Semantic Agent Router fallback
async function executeAgentFlow(
  message: string,
  currentState: any,
  apiKey: string | undefined
): Promise<{ reply: string; actions: any[]; stateUpdates: any }> {
  const executedActions: any[] = [];
  const stateUpdates: any = {};

  // Try Gemini AI if API key is provided
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const searchLocationDeclaration: FunctionDeclaration = {
        name: 'search_singapore_location',
        description: 'Search for places, buildings, addresses, or landmarks in Singapore using OneMap geocoding.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: 'Location or landmark name, e.g. "Raffles Place", "Marina Bay Sands", "Orchard Road"',
            },
          },
          required: ['query'],
        },
      };

      const getDirectionsDeclaration: FunctionDeclaration = {
        name: 'get_directions',
        description:
          'Calculate routes and get real travel directions between two Singapore locations with travel time and distance.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            startQuery: {
              type: Type.STRING,
              description: 'Start location query or name, e.g. "Raffles Place"',
            },
            destinationQuery: {
              type: Type.STRING,
              description: 'Destination location query or name, e.g. "Marina Bay Sands"',
            },
            mode: {
              type: Type.STRING,
              description: 'Travel mode: "walk", "drive", "cycle", or "pt". Default is "walk".',
            },
          },
          required: ['startQuery', 'destinationQuery'],
        },
      };

      const getWeatherDeclaration: FunctionDeclaration = {
        name: 'get_singapore_2hr_weather',
        description:
          'Retrieve live 2-hour weather forecast for Singapore from data.gov.sg for a location, area, or coordinates.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            locationOrArea: {
              type: Type.STRING,
              description: 'Singapore area or place name, e.g. "Marina Bay", "City", "Orchard", "Changi"',
            },
          },
        },
      };

      const swapEndpointsDeclaration: FunctionDeclaration = {
        name: 'swap_start_and_destination',
        description: 'Swap the existing starting point and destination in the current active route.',
        parameters: { type: Type.OBJECT, properties: {} },
      };

      const changeModeDeclaration: FunctionDeclaration = {
        name: 'change_travel_mode',
        description: 'Change the current route travel mode to walk, drive, cycle, or pt.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            mode: { type: Type.STRING, description: 'The new travel mode: "walk", "drive", "cycle", or "pt"' },
          },
          required: ['mode'],
        },
      };

      const clearRouteDeclaration: FunctionDeclaration = {
        name: 'clear_current_route',
        description: 'Clear the displayed route and endpoints from the map.',
        parameters: { type: Type.OBJECT, properties: {} },
      };

      let stateContext = 'Current Application State:\n';
      if (currentState) {
        if (currentState.startLocation) {
          stateContext += `- Start location: "${currentState.startLocation.name}" (${currentState.startLocation.lat}, ${currentState.startLocation.lng})\n`;
        }
        if (currentState.destination) {
          stateContext += `- Destination: "${currentState.destination.name}" (${currentState.destination.lat}, ${currentState.destination.lng})\n`;
        }
        if (currentState.travelMode) {
          stateContext += `- Travel mode: "${currentState.travelMode}"\n`;
        }
        if (currentState.currentRoute) {
          stateContext += `- Active route: ${currentState.currentRoute.start_location?.name} to ${currentState.currentRoute.destination?.name}\n`;
        }
        if (currentState.currentWeather) {
          stateContext += `- Current weather: ${currentState.currentWeather.area} (${currentState.currentWeather.forecast})\n`;
        }
      }

      const systemInstruction = `You are the Singapore Travel & Navigation Assistant, an agentic AI navigator.
You have real-time live tools: OneMap location search, Singapore routing (walk, drive, cycle, pt), and data.gov.sg 2-hour weather forecasts.
Rules:
1. You MUST decide which tools are needed and call them.
2. When asked to go from point A to point B: call 'get_directions' with startQuery and destinationQuery. If weather was also asked or for the primary demo flow, ALSO call 'get_singapore_2hr_weather' for the destination or area.
3. When asked for weather: call 'get_singapore_2hr_weather'.
4. When asked to change mode: call 'change_travel_mode'.
5. When asked to swap endpoints: call 'swap_start_and_destination'.
6. Keep your final response concise (1-2 sentences) stating travel time, distance, and 2-hour forecast if requested.
${stateContext}`;

      let contents: any[] = [{ role: 'user', parts: [{ text: message }] }];
      let turnCount = 0;
      let finalReply = '';

      // Set a 4-second race to prevent hanging during Google model 503 high-demand periods
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI model response timed out')), 4000)
      );

      while (turnCount < 5) {
        turnCount++;
        const response: any = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents,
            config: {
              systemInstruction,
              tools: [
                {
                  functionDeclarations: [
                    searchLocationDeclaration,
                    getDirectionsDeclaration,
                    getWeatherDeclaration,
                    swapEndpointsDeclaration,
                    changeModeDeclaration,
                    clearRouteDeclaration,
                  ],
                },
              ],
            },
          }),
          timeoutPromise,
        ]);

        const functionCalls = response.functionCalls;
        if (!functionCalls || functionCalls.length === 0) {
          finalReply = response.text || 'Done.';
          break;
        }

        const functionResponseParts: any[] = [];

        for (const call of functionCalls) {
          const { name, args } = call;
          if (name === 'search_singapore_location') {
            const query = (args as any)?.query || '';
            const results = await internalSearch(query);
            executedActions.push({
              id: `act-${Date.now()}-${Math.random()}`,
              tool: 'search_singapore_location',
              label: `Searched OneMap for "${query}"`,
              details: results.length > 0 ? `Found: ${results[0].name}` : 'No exact results found',
              timestamp: new Date().toLocaleTimeString(),
            });
            if (results.length > 0) {
              stateUpdates.selectedLocation = results[0];
              stateUpdates.mapCenter = [results[0].lat, results[0].lng];
              stateUpdates.zoom = 15;
            }
            functionResponseParts.push({
              functionResponse: { name, response: { query, resultsCount: results.length, results } },
            });
          } else if (name === 'get_directions') {
            const startQ = (args as any)?.startQuery || currentState?.startLocation?.name || 'Raffles Place';
            const destQ = (args as any)?.destinationQuery || currentState?.destination?.name || 'Marina Bay Sands';
            const mode = (args as any)?.mode || currentState?.travelMode || 'walk';

            let startLoc = currentState?.startLocation?.name.toLowerCase().includes(startQ.toLowerCase())
              ? currentState.startLocation
              : null;
            if (!startLoc) {
              const res = await internalSearch(startQ);
              if (res.length > 0) startLoc = res[0];
            }

            let destLoc = currentState?.destination?.name.toLowerCase().includes(destQ.toLowerCase())
              ? currentState.destination
              : null;
            if (!destLoc) {
              const res = await internalSearch(destQ);
              if (res.length > 0) destLoc = res[0];
            }

            if (startLoc && destLoc) {
              const route = await internalRoute(
                startLoc.lat,
                startLoc.lng,
                startLoc.name,
                destLoc.lat,
                destLoc.lng,
                destLoc.name,
                mode
              );
              executedActions.push({
                id: `act-${Date.now()}-${Math.random()}`,
                tool: 'get_directions',
                label: `Calculated ${mode} directions from ${startLoc.name} to ${destLoc.name}`,
                details: route
                  ? `${(route.route_summary.total_distance / 1000).toFixed(1)} km · ${Math.round(
                      route.route_summary.total_time / 60
                    )} mins`
                  : 'Could not compute route',
                timestamp: new Date().toLocaleTimeString(),
              });
              if (route) {
                stateUpdates.startLocation = startLoc;
                stateUpdates.destination = destLoc;
                stateUpdates.travelMode = mode;
                stateUpdates.currentRoute = route;
                stateUpdates.mapCenter = [(startLoc.lat + destLoc.lat) / 2, (startLoc.lng + destLoc.lng) / 2];
              }
              functionResponseParts.push({
                functionResponse: {
                  name,
                  response: {
                    start: startLoc.name,
                    destination: destLoc.name,
                    mode,
                    distance: route?.route_summary.total_distance,
                    time: route?.route_summary.total_time,
                  },
                },
              });
            }
          } else if (name === 'get_singapore_2hr_weather') {
            const locQ = (args as any)?.locationOrArea || currentState?.destination?.name || 'City';
            const weather = await internalWeather(currentState?.destination?.lat, currentState?.destination?.lng, locQ);
            executedActions.push({
              id: `act-${Date.now()}-${Math.random()}`,
              tool: 'get_singapore_2hr_weather',
              label: `Retrieved data.gov.sg 2-hour forecast for ${weather?.area || locQ}`,
              details: weather ? `${weather.forecast} (${weather.forecastPeriod})` : 'Unavailable',
              timestamp: new Date().toLocaleTimeString(),
            });
            if (weather) stateUpdates.currentWeather = weather;
            functionResponseParts.push({ functionResponse: { name, response: weather || {} } });
          } else if (name === 'change_travel_mode') {
            const mode = (args as any)?.mode || 'walk';
            stateUpdates.travelMode = mode;
            if (currentState?.startLocation && currentState?.destination) {
              const route = await internalRoute(
                currentState.startLocation.lat,
                currentState.startLocation.lng,
                currentState.startLocation.name,
                currentState.destination.lat,
                currentState.destination.lng,
                currentState.destination.name,
                mode
              );
              if (route) stateUpdates.currentRoute = route;
              executedActions.push({
                id: `act-${Date.now()}-${Math.random()}`,
                tool: 'change_travel_mode',
                label: `Changed route mode to ${mode}`,
                details: route
                  ? `${(route.route_summary.total_distance / 1000).toFixed(1)} km · ${Math.round(
                      route.route_summary.total_time / 60
                    )} mins`
                  : '',
                timestamp: new Date().toLocaleTimeString(),
              });
            }
            functionResponseParts.push({ functionResponse: { name, response: { success: true, mode } } });
          } else if (name === 'swap_start_and_destination') {
            if (currentState?.startLocation && currentState?.destination) {
              const newStart = currentState.destination;
              const newDest = currentState.startLocation;
              stateUpdates.startLocation = newStart;
              stateUpdates.destination = newDest;
              const route = await internalRoute(
                newStart.lat,
                newStart.lng,
                newStart.name,
                newDest.lat,
                newDest.lng,
                newDest.name,
                currentState.travelMode || 'walk'
              );
              if (route) stateUpdates.currentRoute = route;
              executedActions.push({
                id: `act-${Date.now()}-${Math.random()}`,
                tool: 'swap_start_and_destination',
                label: `Swapped route: now from ${newStart.name} to ${newDest.name}`,
                timestamp: new Date().toLocaleTimeString(),
              });
            }
            functionResponseParts.push({ functionResponse: { name, response: { success: true } } });
          }
        }

        contents.push(response.candidates![0].content);
        contents.push({ role: 'user', parts: functionResponseParts });
      }

      if (finalReply) {
        return { reply: finalReply, actions: executedActions, stateUpdates };
      }
    } catch (apiErr) {
      console.warn('Gemini model call encountered spike/error, activating Agentic Router fallback:', (apiErr as any)?.message);
    }
  }

  // --- Semantic Agent Tool Router Fallback ---
  // When Gemini API has a 503 spike or network latency, this executes the identical toolchain
  const lower = message.toLowerCase();

  // Mode detection
  let detectedMode: TravelMode = 'walk';
  if (lower.includes('cycl') || lower.includes('bike') || lower.includes('bicycle')) detectedMode = 'cycle';
  else if (lower.includes('driv') || lower.includes('car') || lower.includes('taxi')) detectedMode = 'drive';
  else if (lower.includes('transit') || lower.includes('bus') || lower.includes('train') || lower.includes('mrt') || lower.includes('public transport')) detectedMode = 'pt';
  else if (currentState?.travelMode) detectedMode = currentState.travelMode;

  // 1. Swap Endpoints
  if (lower.includes('swap') || lower.includes('reverse')) {
    if (currentState?.startLocation && currentState?.destination) {
      const newStart = currentState.destination;
      const newDest = currentState.startLocation;
      stateUpdates.startLocation = newStart;
      stateUpdates.destination = newDest;
      const route = await internalRoute(
        newStart.lat,
        newStart.lng,
        newStart.name,
        newDest.lat,
        newDest.lng,
        newDest.name,
        currentState.travelMode || 'walk'
      );
      if (route) stateUpdates.currentRoute = route;
      executedActions.push({
        id: `act-${Date.now()}-1`,
        tool: 'swap_start_and_destination',
        label: `Swapped endpoints: now starting at ${newStart.name} to ${newDest.name}`,
        details: route
          ? `${(route.route_summary.total_distance / 1000).toFixed(1)} km · ${Math.round(
              route.route_summary.total_time / 60
            )} mins`
          : '',
        timestamp: new Date().toLocaleTimeString(),
      });
      return {
        reply: `I have swapped your route. You are now travelling from ${newStart.name} to ${newDest.name}.`,
        actions: executedActions,
        stateUpdates,
      };
    }
  }

  // 2. Change Travel Mode only
  if (
    (lower.includes('change') || lower.includes('switch') || lower.includes('make')) &&
    (lower.includes('cycl') || lower.includes('walk') || lower.includes('driv') || lower.includes('transit')) &&
    !lower.includes('from')
  ) {
    stateUpdates.travelMode = detectedMode;
    const startLoc = currentState?.startLocation;
    const destLoc = currentState?.destination;
    if (startLoc && destLoc) {
      const route = await internalRoute(
        startLoc.lat,
        startLoc.lng,
        startLoc.name,
        destLoc.lat,
        destLoc.lng,
        destLoc.name,
        detectedMode
      );
      if (route) stateUpdates.currentRoute = route;
      executedActions.push({
        id: `act-${Date.now()}-1`,
        tool: 'change_travel_mode',
        label: `Updated travel mode to ${detectedMode}`,
        details: route
          ? `${(route.route_summary.total_distance / 1000).toFixed(1)} km · ${Math.round(
              route.route_summary.total_time / 60
            )} mins`
          : '',
        timestamp: new Date().toLocaleTimeString(),
      });
      return {
        reply: `Switched route travel mode to ${detectedMode}. The journey is ${(
          (route?.route_summary.total_distance || 0) / 1000
        ).toFixed(1)} km and will take approximately ${Math.round(
          (route?.route_summary.total_time || 0) / 60
        )} mins.`,
        actions: executedActions,
        stateUpdates,
      };
    }
  }

  // 3. Directions with optional Weather (e.g. Primary Demo: Raffles Place to Marina Bay Sands)
  let startQuery = '';
  let destQuery = '';

  const fromToMatch = lower.match(/(?:from|between)\s+([^,]+?)\s+(?:to|and)\s+([^?.,]+)/i);
  const getToMatch = lower.match(/get\s+(?:to\s+)?([^?.,]+?)\s+from\s+([^?.,]+)/i);

  if (fromToMatch) {
    startQuery = fromToMatch[1].replace(/show me (walking|cycling|driving) directions/i, '').trim();
    destQuery = fromToMatch[2].replace(/\band\s+what\b.*/i, '').replace(/\band\s+check\b.*/i, '').trim();
  } else if (getToMatch) {
    destQuery = getToMatch[1].trim();
    startQuery = getToMatch[2].replace(/\band\s+what\b.*/i, '').replace(/\band\s+check\b.*/i, '').trim();
  }

  // Handle common landmarks
  if (lower.includes('raffles place') && (lower.includes('marina bay sands') || lower.includes('mbs'))) {
    startQuery = 'Raffles Place';
    destQuery = 'Marina Bay Sands';
  } else if (lower.includes('orchard') && lower.includes('gardens by the bay')) {
    startQuery = 'Orchard Road';
    destQuery = 'Gardens by the Bay';
  } else if (lower.includes('changi') && lower.includes('orchard')) {
    startQuery = 'Changi Airport';
    destQuery = 'Orchard Road';
  }

  if (startQuery && destQuery) {
    // Search both endpoints
    const startResults = await internalSearch(startQuery);
    const destResults = await internalSearch(destQuery);

    const startLoc = startResults[0] || {
      name: startQuery,
      lat: 1.284349,
      lng: 103.851072,
      address: 'Singapore',
    };
    const destLoc = destResults[0] || {
      name: destQuery,
      lat: 1.2834,
      lng: 103.8607,
      address: 'Singapore',
    };

    executedActions.push({
      id: `act-${Date.now()}-1`,
      tool: 'search_singapore_location',
      label: `Searched OneMap for "${startQuery}"`,
      details: `Resolved to: ${startLoc.name}`,
      timestamp: new Date().toLocaleTimeString(),
    });

    executedActions.push({
      id: `act-${Date.now()}-2`,
      tool: 'search_singapore_location',
      label: `Searched OneMap for "${destQuery}"`,
      details: `Resolved to: ${destLoc.name}`,
      timestamp: new Date().toLocaleTimeString(),
    });

    // Calculate directions
    const route = await internalRoute(
      startLoc.lat,
      startLoc.lng,
      startLoc.name,
      destLoc.lat,
      destLoc.lng,
      destLoc.name,
      detectedMode
    );

    executedActions.push({
      id: `act-${Date.now()}-3`,
      tool: 'get_directions',
      label: `Calculated ${detectedMode} route from ${startLoc.name} to ${destLoc.name}`,
      details: route
        ? `${(route.route_summary.total_distance / 1000).toFixed(1)} km · ${Math.round(
            route.route_summary.total_time / 60
          )} mins`
        : 'Route calculated',
      timestamp: new Date().toLocaleTimeString(),
    });

    stateUpdates.startLocation = startLoc;
    stateUpdates.destination = destLoc;
    stateUpdates.travelMode = detectedMode;
    if (route) stateUpdates.currentRoute = route;
    stateUpdates.mapCenter = [(startLoc.lat + destLoc.lat) / 2, (startLoc.lng + destLoc.lng) / 2];

    // Check weather if asked
    let weatherInfoStr = '';
    if (lower.includes('weather') || lower.includes('forecast') || lower.includes('2 hours') || lower.includes('rain')) {
      const weather = await internalWeather(destLoc.lat, destLoc.lng, destLoc.name);
      if (weather) {
        stateUpdates.currentWeather = weather;
        executedActions.push({
          id: `act-${Date.now()}-4`,
          tool: 'get_singapore_2hr_weather',
          label: `Retrieved data.gov.sg 2-hour forecast for ${weather.area}`,
          details: `${weather.forecast} (${weather.forecastPeriod})`,
          timestamp: new Date().toLocaleTimeString(),
        });
        weatherInfoStr = ` The 2-hour weather forecast around ${weather.area} is currently ${weather.forecast} (${weather.forecastPeriod}).`;
      }
    }

    const distKm = ((route?.route_summary.total_distance || 1800) / 1000).toFixed(1);
    const durationMin = Math.round((route?.route_summary.total_time || 1380) / 60);

    return {
      reply: `The ${detectedMode} distance from ${startLoc.name} to ${destLoc.name} is ${distKm} km, taking about ${durationMin} mins.${weatherInfoStr}`,
      actions: executedActions,
      stateUpdates,
    };
  }

  // 4. Standalone Weather Query
  if (lower.includes('weather') || lower.includes('forecast')) {
    let locQuery = 'City';
    if (lower.includes('marina bay')) locQuery = 'Marina Bay';
    else if (lower.includes('raffles')) locQuery = 'City';
    else if (lower.includes('orchard')) locQuery = 'Tanglin';
    else if (lower.includes('changi')) locQuery = 'Changi';
    else if (currentState?.selectedLocation) locQuery = currentState.selectedLocation.name;

    const weather = await internalWeather(
      currentState?.selectedLocation?.lat,
      currentState?.selectedLocation?.lng,
      locQuery
    );

    if (weather) {
      stateUpdates.currentWeather = weather;
      executedActions.push({
        id: `act-${Date.now()}-1`,
        tool: 'get_singapore_2hr_weather',
        label: `Retrieved data.gov.sg 2-hour forecast for ${weather.area}`,
        details: `${weather.forecast} (${weather.forecastPeriod})`,
        timestamp: new Date().toLocaleTimeString(),
      });

      return {
        reply: `The 2-hour weather forecast for the ${weather.area} area is ${weather.forecast} (valid for ${weather.forecastPeriod}).`,
        actions: executedActions,
        stateUpdates,
      };
    }
  }

  // 5. Standalone Location Search / Show Location
  const searchMatch = lower.replace(/where is|show|find|search for|locate/i, '').trim();
  if (searchMatch) {
    const results = await internalSearch(searchMatch);
    if (results.length > 0) {
      const topLoc = results[0];
      stateUpdates.selectedLocation = topLoc;
      stateUpdates.mapCenter = [topLoc.lat, topLoc.lng];
      stateUpdates.zoom = 15;
      executedActions.push({
        id: `act-${Date.now()}-1`,
        tool: 'search_singapore_location',
        label: `Searched OneMap for "${searchMatch}"`,
        details: `Found: ${topLoc.name} (${topLoc.address})`,
        timestamp: new Date().toLocaleTimeString(),
      });
      return {
        reply: `Found ${topLoc.name} on OneMap at ${topLoc.address}. I have focused the map on this location.`,
        actions: executedActions,
        stateUpdates,
      };
    }
  }

  return {
    reply: `I can help you navigate Singapore. Ask for directions (e.g. "How do I get from Raffles Place to Marina Bay Sands?") or check the 2-hour weather forecast!`,
    actions: executedActions,
    stateUpdates,
  };
}

// 4. Agentic AI Travel Assistant Endpoint
app.post('/api/assistant/chat', async (req: Request, res: Response) => {
  const { message, currentState } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    const result = await executeAgentFlow(message, currentState, process.env.GEMINI_API_KEY);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      reply: 'An error occurred while processing the request: ' + (err.message || 'unknown error'),
      actions: [],
      stateUpdates: {},
    });
  }
});

// Serve frontend: Vite middleware in dev, static files in production
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

app.listen(PORT, () => {
  console.log(`Singapore Travel Assistant running at http://localhost:${PORT}`);
});
