import { handleWeatherRequest } from './_weatherCore.js';

export default async function handler(req, res) {
  return handleWeatherRequest(req, res);
}
