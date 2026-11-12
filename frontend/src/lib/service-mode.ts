// A public UI release must never pretend an unconfigured exam service is available.
export const serviceReady=process.env.APP_SERVICE_MODE!=="preview"&&(!process.env.VERCEL||!!process.env.BACKEND_URL);
