import type { NextConfig } from "next";
const backend=process.env.BACKEND_URL||"http://127.0.0.1:8081";
const serviceReady=process.env.APP_SERVICE_MODE!=="preview"&&(!process.env.VERCEL||!!process.env.BACKEND_URL);
const config:NextConfig={
 distDir:process.env.NEXT_DIST_DIR||".next",
 output:"standalone",
 poweredByHeader:false,
 async rewrites(){return serviceReady?["/api/:path*","/oauth2/:path*","/login/oauth2/:path*"].map(source=>({source,destination:backend+source})):[];},
 async headers(){return [{source:"/:path*",headers:[{key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},{key:"X-Frame-Options",value:"DENY"},{key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"}]},{source:"/api/:path*",headers:[{key:"Cache-Control",value:"no-store"}]}];}
};export default config;
