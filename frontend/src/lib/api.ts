export class ApiError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
let csrf:Promise<{token:string;headerName:string}>|null=null;
export function resetCsrf(){csrf=null;}
export async function logout(){
 // Use top-level navigation so the OIDC provider can end its own session.
 const token=await api<{token:string;parameterName:string}>("/auth/csrf");
 const form=document.createElement("form");form.method="POST";form.action="/api/logout";
 const input=document.createElement("input");input.type="hidden";input.name=token.parameterName;input.value=token.token;
 form.append(input);document.body.append(form);resetCsrf();form.submit();
}
export async function api<T>(path:string,init:RequestInit={}):Promise<T>{
 const method=init.method||"GET";
 const headers=new Headers(init.headers);headers.set("Accept","application/json");
 if(init.body)headers.set("Content-Type","application/json");
 if(!["GET","HEAD"].includes(method)){
  csrf??=fetch("/api/auth/csrf",{cache:"no-store",credentials:"same-origin",signal:AbortSignal.timeout(45000)}).then(async r=>{if(!r.ok)throw new Error("Không lấy được phiên làm việc.");return r.json();}).catch(()=>{csrf=null;throw new ApiError(0,"SESSION_UNAVAILABLE","Chưa kết nối được phiên làm việc. Vui lòng thử lại.");});
  const c=await csrf;headers.set(c.headerName,c.token);
 }
 let res:Response;
 try{res=await fetch("/api"+path,{...init,method,headers,cache:"no-store",credentials:"same-origin",signal:init.signal??AbortSignal.timeout(45000)});}
 catch{throw new ApiError(0,"NETWORK","Kết nối đang chậm hoặc bị gián đoạn. Máy chủ có thể đang khởi động; vui lòng thử lại.");}
 if(!res.ok){if(res.status===401||res.status===403)csrf=null;const e=await res.json().catch(()=>({}));throw new ApiError(res.status,e.code||"HTTP_ERROR",e.message||"Chưa hoàn tất thao tác. Vui lòng thử lại.");}
 if(res.status===204||res.headers.get("content-length")==="0")return undefined as T;
 const text=await res.text();return text?JSON.parse(text):undefined as T;
}
export const send=<T>(path:string,method:string,body?:unknown)=>api<T>(path,{method,body:body===undefined?undefined:JSON.stringify(body)});
export const date=(s:string)=>new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(s));
export const number=(n:number)=>new Intl.NumberFormat("vi-VN",{maximumFractionDigits:2}).format(n);
