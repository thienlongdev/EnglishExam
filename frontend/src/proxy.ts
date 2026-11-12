import {NextRequest,NextResponse} from 'next/server';
import {serviceReady} from './lib/service-mode';
export function proxy(request:NextRequest){
 if(serviceReady)return NextResponse.next();
 if(request.nextUrl.pathname.startsWith('/api/'))return NextResponse.json({code:'SERVICE_NOT_READY',message:'Cổng thi chưa mở. Vui lòng quay lại sau.'},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'3600'}});
 return NextResponse.redirect(new URL('/login?error=unavailable',request.url));
}
export const config={matcher:['/api/:path*','/oauth2/:path*','/login/oauth2/:path*','/dashboard','/classes','/exams/:path*','/history','/results/:path*','/teacher/:path*','/attempts/:path*']};
