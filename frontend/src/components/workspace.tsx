"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {createContext,useContext,ReactNode,useState,useEffect,useRef} from "react";
import {LayoutDashboard,BookOpen,GraduationCap,History,LogOut,ArrowUpRight,Menu,X,FileQuestion,ClipboardList,Users,BarChart3} from "lucide-react";
import {Brand,ErrorBox,Loading,useData} from "./ui";
import {logout} from "@/lib/api";
import {User} from "@/lib/types";
const UserContext=createContext<User|null>(null);
export const useUser=()=>useContext(UserContext)!;
export function Workspace({children}:{children:ReactNode}){
 const {data:user,error,reload}=useData<User>("/me"),path=usePathname();const [mobile,setMobile]=useState(false),[logoutError,setLogoutError]=useState<Error|null>(null);
 const side=useRef<HTMLElement>(null),opener=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!mobile)return;
  const previous=document.body.style.overflow;document.body.style.overflow="hidden";
  side.current?.querySelector<HTMLButtonElement>("button")?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key==="Escape"){e.preventDefault();setMobile(false);}
   if(e.key==="Tab"){
    const items=Array.from(side.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')||[]).filter(el=>el.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
  };
  const size=()=>{if(window.innerWidth>767)setMobile(false);};
  document.addEventListener("keydown",key);window.addEventListener("resize",size);
  return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",key);window.removeEventListener("resize",size);opener.current?.focus();};
 },[mobile]);
 const teaching=path.startsWith("/teacher");
 const links=teaching?[["/teacher","Tổng quan",LayoutDashboard],["/teacher/questions","Ngân hàng câu hỏi",FileQuestion],["/teacher/exams","Đề thi",ClipboardList],["/teacher/classes","Lớp phụ trách",Users],["/teacher/results","Kết quả học viên",BarChart3]] as const:[["/dashboard","Tổng quan",LayoutDashboard],["/exams","Bài thi của tôi",BookOpen],["/classes","Lớp học",GraduationCap],["/history","Lịch sử bài làm",History]] as const;
 if(error)return <main id="main" className="wrap standalone"><Brand/><ErrorBox error={error} retry={reload}/>{logoutError&&<ErrorBox error={logoutError}/>}<button className="text-button" onClick={async()=>{try{await logout();}catch(e){setLogoutError(e as Error);}}}>Đăng xuất phiên hiện tại</button></main>;
 if(!user)return <main id="main"><Loading/></main>;
 return <UserContext.Provider value={user}><div className="workspace">{mobile&&<button className="menu-backdrop" tabIndex={-1} aria-label="Đóng điều hướng" onClick={()=>setMobile(false)}/>}<aside ref={side} id="workspace-navigation" role={mobile?"dialog":undefined} aria-modal={mobile||undefined} aria-label={mobile?"Điều hướng":undefined} className={"sidebar "+(mobile?"mobile-open":"")}><div className="sidebar-brand"><Brand/><button className="icon-button mobile-only" aria-label="Đóng menu" onClick={()=>setMobile(false)}><X/></button></div><p className="nav-label">{teaching?"KHÔNG GIAN GIẢNG DẠY":"KHÔNG GIAN HỌC TẬP"}</p><nav aria-label="Điều hướng chính">{links.map(([href,label,Icon])=><Link onClick={()=>setMobile(false)} aria-current={(path===href||(href!=="/teacher"&&path.startsWith(href+"/")))?"page":undefined} className={(path===href||(href!=="/teacher"&&path.startsWith(href+"/")))?"nav-item active":"nav-item"} key={href} href={href}><Icon size={19} aria-hidden="true"/>{label}</Link>)}</nav><div className="sidebar-bottom">{user.isTeacher&&!teaching&&<Link className="switch-role" href="/teacher">Không gian giảng dạy<ArrowUpRight size={16}/></Link>}{user.isStudent&&teaching&&<Link className="switch-role" href="/dashboard">Không gian học tập<ArrowUpRight size={16}/></Link>}<div className="quiet-note"><span>Take a breath.</span><p>Một câu hỏi tại một thời điểm.</p></div><div className="profile"><span className="avatar">{user.fullName.split(" ").at(-1)?.[0]}</span><div><strong>{user.fullName}</strong><small>{teaching?"Giảng viên":"Học viên"}</small></div><button className="icon-button" aria-label="Đăng xuất" onClick={async()=>{try{await logout();}catch(e){setLogoutError(e as Error);}}}><LogOut size={18}/></button></div>{logoutError&&<ErrorBox error={logoutError}/>}</div></aside><div className="workspace-body" inert={mobile}><header className="workspace-top"><button ref={opener} className="icon-button mobile-only" onClick={()=>setMobile(true)} aria-expanded={mobile} aria-controls="workspace-navigation" aria-label="Mở menu"><Menu/></button><span>English Exam <span className="crumb-separator">/</span> {teaching?"Giảng dạy":"Học tập"}</span><span className="top-caption">Focus on what matters.</span></header><main id="main" className="workspace-content">{teaching&&!user.isTeacher?<ErrorBox error="Bạn cần quyền giảng viên để truy cập trang này."/>:children}</main><footer className="workspace-footer">English Exam <span>Học tập có mục tiêu. Tiến bộ từng ngày.</span></footer></div></div></UserContext.Provider>;
}
