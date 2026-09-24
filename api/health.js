import { handleHealthRequest } from './_weatherCore.js';

export default async function handler(req, res) {
  return handleHealthRequest(req, res);
}
