"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Clock3,Flag,LoaderCircle,RefreshCw,ShieldCheck,WifiOff} from "lucide-react";
import {api,send,number} from "@/lib/api";
import {Attempt} from "@/lib/types";
import {Brand,Dialog,ErrorBox,Loading,useData} from "./ui";
export function ExamRoom({id}:{id:number}){
 const {data,error,reload}=useData<Attempt>("/student/attempts/"+id);
 if(error)return <main id="main" className="wrap standalone"><Brand/><ErrorBox error={error} retry={reload}/></main>;
 if(!data)return <main id="main"><Loading text="Đang mở bài làm của bạn…"/></main>;
 return <Room initial={data} id={id}/>;
}
function Room({initial,id}:{initial:Attempt;id:number}){
 const router=useRouter(),[attempt,setAttempt]=useState(initial),[index,setIndex]=useState(0);
 const [saved,setSaved]=useState<Record<number,string>>(()=>Object.fromEntries(initial.questions.filter(q=>q.selectedOptionCode).map(q=>[q.questionId,q.selectedOptionCode!])));
 const [drafts,setDrafts]=useState<Record<number,string>>({}),[failures,setFailures]=useState<Record<number,string>>({}),[saving,setSaving]=useState(0),[flags,setFlags]=useState<number[]>([]);
 const [remaining,setRemaining]=useState(0),[offline,setOffline]=useState(false),[confirm,setConfirm]=useState(false),[submitting,setSubmitting]=useState(false),[submitError,setSubmitError]=useState<Error|null>(null),[syncError,setSyncError]=useState(false);
 const anchor=useRef({remaining:Date.parse(initial.deadlineAt)-Date.parse(initial.serverNow),at:performance.now()});
 const queue=useRef(Promise.resolve()),versions=useRef<Record<number,number>>({}),pending=useRef<Record<number,string>>({}),autoSubmit=useRef(false),submitLock=useRef(false);
 const expired=remaining<=0,q=attempt.questions[index],answered=Object.keys(saved).length;
 useEffect(()=>{if(initial.status==="Submitted")router.replace("/results/"+id);},[id,initial.status,router]);
 const sync=useCallback(async()=>{
  try{const a=await api<Attempt>("/student/attempts/"+id);if(a.status==="Submitted"){router.replace("/results/"+id);return;}
   anchor.current={remaining:Date.parse(a.deadlineAt)-Date.parse(a.serverNow),at:performance.now()};setAttempt(a);setSyncError(false);
   setSaved(old=>{const next={...old};for(const q of a.questions)if(!pending.current[q.questionId]){if(q.selectedOptionCode)next[q.questionId]=q.selectedOptionCode;else delete next[q.questionId];}return next;});
  }catch{setSyncError(true);}
 },[id,router]);
 useEffect(()=>{const tick=()=>setRemaining(Math.max(0,Math.ceil((anchor.current.remaining-(performance.now()-anchor.current.at))/1000)));tick();const t=setInterval(tick,250);const resync=setInterval(sync,30000);const online=()=>{setOffline(false);void sync();};const offline=()=>setOffline(true);const visible=()=>{if(!document.hidden)void sync();};setOffline(!navigator.onLine);window.addEventListener("online",online);window.addEventListener("offline",offline);document.addEventListener("visibilitychange",visible);return()=>{clearInterval(t);clearInterval(resync);window.removeEventListener("online",online);window.removeEventListener("offline",offline);document.removeEventListener("visibilitychange",visible);};},[sync]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(Object.keys(pending.current).length){e.preventDefault();e.returnValue="";}};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[]);
 async function submit(){
  if(submitLock.current)return;submitLock.current=true;setSubmitting(true);setSubmitError(null);
  try{await queue.current;await send("/student/attempts/"+id+"/submit","POST");pending.current={};router.replace("/results/"+id);}
  catch(e){setSubmitError(e as Error);setSubmitting(false);submitLock.current=false;setConfirm(false);}
 }
 useEffect(()=>{if(anchor.current.remaining-(performance.now()-anchor.current.at)<=0&&saving===0&&!autoSubmit.current&&attempt.status!=="Submitted"){autoSubmit.current=true;void submit();}},[remaining,saving,attempt.status]);
 function choose(question:number,option:string){
  if(expired||submitting)return;
  const version=(versions.current[question]||0)+1;versions.current[question]=version;
  pending.current[question]=option;setDrafts({...pending.current});setFailures(f=>{const next={...f};delete next[question];return next;});setSaving(n=>n+1);
  queue.current=queue.current.then(async()=>{
   try{const s=await send<{selectedOptionCode:string}>("/student/attempts/"+id+"/answers/"+question,"PUT",{optionCode:option});setSaved(old=>({...old,[question]:s.selectedOptionCode}));
    if(versions.current[question]===version){delete pending.current[question];setDrafts({...pending.current});}
   }catch(e){if(versions.current[question]===version)setFailures(old=>({...old,[question]:(e as Error).message}));}
   finally{setSaving(n=>n-1);}
  });
 }
 function discard(question:number){delete pending.current[question];setDrafts({...pending.current});setFailures(f=>{const next={...f};delete next[question];return next;});}
 function move(i:number){setIndex(i);requestAnimationFrame(()=>{const heading=document.getElementById("question-heading");heading?.focus({preventScroll:true});if(window.innerWidth<768)heading?.scrollIntoView({block:"start",behavior:"instant"});});}
 if(!q)return <main id="main"><ErrorBox error="Bài thi không có câu hỏi hợp lệ."/></main>;
 const selected=drafts[q.questionId]??saved[q.questionId],pendingCount=Object.keys(drafts).length;
 return <div className="exam-room"><header className="exam-top"><Brand/><div className="exam-top-title"><span>{attempt.classCode} · Lượt {attempt.attemptNo}</span><strong>{attempt.title}</strong></div><div className={"timer "+(remaining<120?"urgent":"")} role="timer" aria-label="Thời gian còn lại"><Clock3 size={20}/><div><span>THỜI GIAN CÒN LẠI</span><strong>{Math.floor(remaining/60).toString().padStart(2,"0")}:{(remaining%60).toString().padStart(2,"0")}</strong></div></div></header>
 <main id="main" className="exam-container">
 {(offline||syncError)&&<div className="notice warning" role="status"><WifiOff size={20}/><span>{offline?"Bạn đang ngoại tuyến.":"Chưa đồng bộ được với máy chủ."} Đáp án chưa có xác nhận sẽ chưa được tính là đã lưu.</span><button className="text-button" onClick={sync}>Kết nối lại</button></div>}
 {expired&&<div className="notice warning" role="status"><Clock3 size={20}/>Đã hết thời gian. Hệ thống chỉ chấm các đáp án đã được máy chủ lưu.</div>}
 {submitError&&<ErrorBox error={submitError} retry={submit}/>}
 <div className="exam-grid"><section className="question-panel"><div className="question-topline"><span className="eyebrow">CÂU {String(index+1).padStart(2,"0")} <span className="muted">/ {attempt.questions.length}</span></span><span className="question-points">{number(q.points)} điểm</span></div><div className="question-progress"><span style={{width:((index+1)/attempt.questions.length)*100+"%"}}/></div><p className="question-category">{q.category}</p><h1 id="question-heading" tabIndex={-1} className="question-text" lang="en">{q.questionText}</h1><p className="answer-hint">Chọn một đáp án đúng.</p><fieldset className="answer-options" disabled={expired||submitting}><legend className="sr-only">Đáp án cho câu {index+1}</legend>{q.options.map(o=><label className={"answer-option "+(selected===o.optionCode?"selected":"")} key={q.questionId+o.optionCode}><input type="radio" name={"question-"+q.questionId} value={o.optionCode} checked={selected===o.optionCode} onChange={()=>choose(q.questionId,o.optionCode)}/><span className="option-letter">{o.optionCode}</span><span className="option-text" lang="en">{o.optionText}</span><span className="option-check">{selected===o.optionCode&&<Check size={17} aria-hidden="true"/>}</span></label>)}</fieldset>
 <div className="answer-footer"><div role="status" aria-live="polite" className={"save-status "+(failures[q.questionId]?"save-error":"")}>{failures[q.questionId]?<><WifiOff size={16}/><span>Chưa lưu đáp án</span></>:drafts[q.questionId]?<><LoaderCircle size={16} className="spin"/><span>Đang lưu…</span></>:saved[q.questionId]?<><CheckCircle2 size={16}/><span>Đã lưu đáp án {saved[q.questionId]}</span></>:<span>Chưa chọn đáp án</span>}</div><button className={"text-button flag "+(flags.includes(q.questionId)?"flagged":"")} aria-pressed={flags.includes(q.questionId)} onClick={()=>setFlags(f=>f.includes(q.questionId)?f.filter(i=>i!==q.questionId):[...f,q.questionId])}><Flag size={16}/>{flags.includes(q.questionId)?"Đã đánh dấu":"Xem lại sau"}</button></div>
 {failures[q.questionId]&&<div className="notice error"><div><p>{failures[q.questionId]}</p><div className="inline-actions"><button className="text-button" disabled={expired} onClick={()=>choose(q.questionId,drafts[q.questionId])}><RefreshCw size={16}/>Thử lưu lại</button><button className="text-button" onClick={()=>discard(q.questionId)}>Bỏ thay đổi chưa lưu</button></div></div></div>}
 <div className="question-pagination"><button className="button secondary" disabled={index===0} onClick={()=>move(index-1)}><ArrowLeft size={18}/>Câu trước</button><span>{index+1} / {attempt.questions.length}</span><button className="button" disabled={index===attempt.questions.length-1} onClick={()=>move(index+1)}>Câu tiếp<ArrowRight size={18}/></button></div></section>
 <aside className="exam-navigator"><div className="navigator-header"><h2>Bài làm của bạn</h2><p><strong>{answered}</strong> / {attempt.questions.length} câu đã lưu</p><div className="overall-progress"><span style={{width:answered/attempt.questions.length*100+"%"}}/></div></div><nav className="question-numbers" aria-label="Điều hướng câu hỏi">{attempt.questions.map((item,i)=><button key={item.questionId} onClick={()=>move(i)} aria-current={index===i?"step":undefined} aria-label={"Câu "+(i+1)+(saved[item.questionId]?", đã lưu":"")+(drafts[item.questionId]?", chưa lưu thay đổi":"")+(flags.includes(item.questionId)?", đánh dấu xem lại":"")} className={(saved[item.questionId]?"answered ":"")+(index===i?"current ":"")+(drafts[item.questionId]?"unsaved ":"")}>{i+1}{flags.includes(item.questionId)&&<span className="flag-marker" aria-hidden="true"/>}</button>)}</nav><div className="navigator-legend"><span><i className="legend-saved"/>Đã lưu</span><span><i/>Chưa trả lời</span><span><i className="legend-flag"/>Xem lại</span></div>{pendingCount>0&&<p className="pending-notice">{pendingCount} câu có thay đổi chưa được lưu.</p>}<button className="button full" disabled={submitting||saving>0||(!expired&&pendingCount>0)} onClick={()=>expired?submit():setConfirm(true)}>{submitting?"Đang nộp bài…":expired?"Nộp lại bài đã lưu":"Nộp bài"}<Check size={18}/></button><p className="navigator-note"><ShieldCheck size={16}/>Bạn có thể kiểm tra lại trước khi nộp.</p><Link className="text-link leave-exam" href="/dashboard" onClick={event=>{if(Object.keys(pending.current).length){event.preventDefault();setSubmitError(new Error("Vui lòng lưu lại hoặc bỏ các thay đổi chưa lưu trước khi rời bài thi."));}}}>Về tổng quan</Link></aside></div></main>
 <Dialog open={confirm} onClose={()=>{if(!submitting)setConfirm(false);}} title="Kiểm tra trước khi nộp"><p>Bạn đã lưu đáp án cho <strong>{answered}/{attempt.questions.length} câu</strong>.</p>{answered<attempt.questions.length&&<p className="notice warning">Còn {attempt.questions.length-answered} câu chưa trả lời. Những câu này được tính 0 điểm.</p>}{flags.length>0&&<p>Bạn đã đánh dấu {flags.length} câu để xem lại.</p>}<p>Sau khi nộp, bạn không thể thay đổi bài làm.</p><div className="dialog-actions"><button className="button secondary" disabled={submitting} onClick={()=>setConfirm(false)}>Tiếp tục kiểm tra</button><button className="button" disabled={submitting||pendingCount>0||saving>0} onClick={submit}>{submitting?"Đang nộp…":"Xác nhận nộp bài"}</button></div></Dialog></div>;
}
