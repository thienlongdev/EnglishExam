"use client";
import {useEffect,useRef,useState,useId,ReactNode} from "react";
import {AlertCircle,ArrowRight,BookOpen,Check,LoaderCircle,RefreshCw,X} from "lucide-react";
import Link from "next/link";
import {api,ApiError} from "@/lib/api";
export function Brand(){return <Link className="brand" href="/" aria-label="EnglishExam · Trang chủ"><span className="brand-mark"><BookOpen size={22} aria-hidden="true"/></span><span>English<span className="brand-light">Exam</span></span></Link>;}
export function Arrow(){return <ArrowRight size={18} aria-hidden="true"/>;}
export function Loading({text="Đang tải dữ liệu của bạn…"}:{text?:string}){return <div className="loading" role="status"><LoaderCircle className="spin" size={24} aria-hidden="true"/><span>{text}</span><small>Kết nối lần đầu có thể mất một chút thời gian.</small></div>;}
export function ErrorBox({error,retry}:{error:Error|string;retry?:()=>void}){return <div className="notice error" role="alert"><AlertCircle size={20} aria-hidden="true"/><div><strong>{typeof error==="string"?error:error.message}</strong>{error instanceof ApiError&&error.status===401?<p><a href="/login">Đăng nhập để tiếp tục <Arrow/></a></p>:retry&&<button className="text-button" onClick={retry}><RefreshCw size={15} aria-hidden="true"/>Thử lại</button>}</div></div>;}
export function Empty({title,children}:{title:string;children:ReactNode}){return <div className="empty"><BookOpen size={30} aria-hidden="true"/><h3>{title}</h3><p>{children}</p></div>;}
export function useData<T>(path:string){
 const [data,setData]=useState<T|null>(null),[error,setError]=useState<Error|null>(null),[version,setVersion]=useState(0);
 useEffect(()=>{const controller=new AbortController();setError(null);setData(null);api<T>(path,{signal:controller.signal}).then(d=>{if(!controller.signal.aborted)setData(d);}).catch(e=>{if(!controller.signal.aborted)setError(e);});return()=>controller.abort();},[path,version]);
 return {data,error,reload:()=>setVersion(v=>v+1),setData};
}
export function PageHeading({eyebrow,title,description,action}:{eyebrow:string;title:string;description?:string;action?:ReactNode}){return <header className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description&&<p className="muted">{description}</p>}</div>{action}</header>;}
export function Badge({children,tone="neutral"}:{children:ReactNode;tone?:string}){return <span className={"badge "+tone}>{tone==="success"&&<Check size={12} aria-hidden="true"/>}{children}</span>;}
export function Dialog({open,onClose,title,children}:{open:boolean;onClose:()=>void;title:string;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{if(open)ref.current?.showModal();else ref.current?.close();},[open]);
 return <dialog ref={ref} className="dialog" onCancel={event=>{event.preventDefault();onClose();}} onClose={onClose} aria-labelledby={titleId}><div className="dialog-head"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Đóng"><X size={20}/></button></div>{children}</dialog>;
}
