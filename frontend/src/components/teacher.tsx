"use client";
import {FormEvent,useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowDown,ArrowLeft,ArrowUp,ArrowUpRight,BookOpen,Check,Clock3,Edit,FileQuestion,LockKeyhole,Plus,Search,Trash2,Users} from "lucide-react";
import {Arrow,Badge,Dialog,Empty,ErrorBox,Loading,PageHeading,useData} from "./ui";
import {api,date,number,send} from "@/lib/api";
import {ClassExam,ClassItem,Question,Student,TeacherExam,TeacherResultRow} from "@/lib/types";
import {useUser} from "./workspace";

function Pager({page,setPage,count}:{page:number;setPage:(p:number)=>void;count:number}){
 return <div className="pagination"><button className="button secondary small" disabled={page===0} onClick={()=>setPage(page-1)}>Trang trước</button><span>Trang {page+1}</span><button className="button secondary small" disabled={count<20} onClick={()=>setPage(page+1)}>Trang tiếp</button></div>;
}

export function TeacherDashboard(){
 const user=useUser(),exams=useData<TeacherExam[]>("/teacher/exams"),classes=useData<ClassItem[]>("/teacher/classes");
 return <>
  <PageHeading eyebrow="KHÔNG GIAN GIẢNG DẠY" title={"Chào "+user.fullName.split(" ").at(-1)+"."} description="Chuẩn bị một bài thi tốt. Tạo nên một trải nghiệm học tập tốt."/>
  <section className="teacher-welcome">
   <div>
    <p className="eyebrow">TỪ Ý TƯỞNG ĐẾN BÀI THI</p>
    <h2>Mỗi câu hỏi đều<br/><em>có một mục đích.</em></h2>
    <p>Biên soạn, sắp xếp và giao đề cho đúng lớp học.</p>
    <Link className="button" href="/teacher/questions">Mở ngân hàng câu hỏi <Arrow/></Link>
   </div>
   <div className="workflow-steps">
    <span><FileQuestion/>Biên soạn</span><span><BookOpen/>Công bố</span><span><Users/>Giao cho lớp</span>
   </div>
  </section>
  <section className="section-block">
   <div className="section-head"><h2>Đề thi gần đây</h2><Link className="text-link" href="/teacher/exams">Quản lý đề thi <Arrow/></Link></div>
   {exams.error?<ErrorBox error={exams.error} retry={exams.reload}/>:!exams.data?<Loading/>:<ExamTable exams={exams.data.slice(0,5)}/>}
  </section>
  <section className="section-block">
   <div className="section-head"><h2>Lớp phụ trách</h2><Link className="text-link" href="/teacher/classes">Quản lý lớp <Arrow/></Link></div>
   {classes.error?<ErrorBox error={classes.error}/>:classes.data?<div className="class-grid">{classes.data.map(c=><div className="mini-class" key={c.classId}><Users size={25} aria-hidden="true"/><div><strong>{c.className}</strong><p>{c.classCode} · {c.studentCount} học viên đang ghi danh</p></div></div>)}</div>:<Loading/>}
  </section>
 </>;
}

function ExamTable({exams}:{exams:TeacherExam[]}){
 if(!exams.length)return <Empty title="Chưa có đề thi">Tạo đề nháp, thêm câu hỏi và công bố khi bạn đã sẵn sàng.</Empty>;
 return <div className="table-wrap" role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem đầy đủ" tabIndex={0}><table><thead><tr><th>Đề thi</th><th>Trạng thái</th><th>Câu / điểm</th><th>Đã nộp</th><th>TB (%)</th><th><span className="sr-only">Quản lý</span></th></tr></thead><tbody>{exams.map(e=><tr key={e.examId}><td><strong>{e.title}</strong><small>{e.examCode} · {e.durationMinutes} phút</small></td><td><Badge tone={e.status==="Published"?"success":"warm"}>{e.status==="Published"?"Đã công bố":"Bản nháp"}</Badge></td><td>{e.questionCount} / {number(e.totalPoints)}</td><td>{e.submittedCount}/{e.attemptCount}</td><td>{e.averagePercent===null?"—":number(e.averagePercent)}</td><td><Link className="text-link" href={"/teacher/exams/"+e.examId}>Mở đề<ArrowUpRight size={16}/></Link></td></tr>)}</tbody></table></div>;
}

export function TeacherExams(){
 const [page,setPage]=useState(0),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[failure,setFailure]=useState<Error|null>(null),router=useRouter();
 const {data,error,reload}=useData<TeacherExam[]>("/teacher/exams?page="+page);
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const f=new FormData(event.currentTarget);setBusy(true);setFailure(null);
  try{
   const r=await send<{examId:number}>("/teacher/exams","POST",{examCode:f.get("examCode"),title:f.get("title"),durationMinutes:Number(f.get("durationMinutes"))});
   router.push("/teacher/exams/"+r.examId);
  }catch(e){setFailure(e as Error);}finally{setBusy(false);}
 }
 return <>
  <PageHeading eyebrow="BIÊN SOẠN & TỔ CHỨC" title="Đề thi" description="Đề đã công bố được giữ nguyên để bảo toàn kết quả." action={<button className="button" onClick={()=>{setFailure(null);setOpen(true);}}><Plus size={18}/>Tạo đề thi</button>}/>
  {error?<ErrorBox error={error} retry={reload}/>:data?<ExamTable exams={data}/>:<Loading/>}
  <Pager page={page} setPage={setPage} count={data?.length||0}/>
  <Dialog open={open} onClose={()=>{if(!busy)setOpen(false);}} title="Tạo đề thi mới">
   <form onSubmit={create} className="form-stack">
    <label>Mã đề<input aria-label="Mã đề" aria-describedby="exam-code-hint" name="examCode" required maxLength={20} pattern={"[A-Za-z0-9_\\-]+"} placeholder="ENG-MIDTERM-01"/><small id="exam-code-hint">Tối đa 20 ký tự: chữ không dấu, số, dấu gạch.</small></label>
    <label>Tên bài thi<input name="title" required maxLength={160} placeholder="English foundations"/></label>
    <label>Thời lượng (phút)<input name="durationMinutes" type="number" min={1} max={180} defaultValue={30} required/></label>
    {failure&&<ErrorBox error={failure}/>}
    <button className="button full" disabled={busy}>{busy?"Đang tạo…":"Tạo bản nháp"}<Arrow/></button>
   </form>
  </Dialog>
 </>;
}

const blank=()=>({questionText:"",category:"Grammar",difficulty:"Easy",options:["A","B","C","D"].map((optionCode,i)=>({optionCode,optionText:"",isCorrect:i===0}))});

export function QuestionBank(){
 const [page,setPage]=useState(0),[search,setSearch]=useState(""),[query,setQuery]=useState(""),[open,setOpen]=useState(false),[editing,setEditing]=useState<number|null>(null),[form,setForm]=useState(blank),[busy,setBusy]=useState(false),[failure,setFailure]=useState<Error|null>(null),[isFrozen,setIsFrozen]=useState(false);
 const {data,error,reload}=useData<Question[]>("/teacher/questions?page="+page+"&search="+encodeURIComponent(query));
 async function edit(qSummary:Question){
  setFailure(null);setBusy(true);
  try{
   const q=await api<Question>("/teacher/questions/"+qSummary.questionId);
   const options=["A","B","C","D"].map(code=>{
    const found=q.options.find(o=>o.optionCode===code);
    return found?{optionCode:code,optionText:found.optionText,isCorrect:!!found.isCorrect}:{optionCode:code,optionText:"",isCorrect:false};
   });
   setForm({questionText:q.questionText,category:q.category,difficulty:q.difficulty,options});
   setEditing(qSummary.questionId);
   setIsFrozen(!!qSummary.frozen);
   setOpen(true);
  }catch(e){setFailure(e as Error);}finally{setBusy(false);}
 }
 async function save(event:FormEvent){
  event.preventDefault();setBusy(true);setFailure(null);
  try{
   // Allow draft questions to save options with text.
   const filledOptions=form.options.filter(o=>o.optionText.trim().length>0);
   await send("/teacher/questions"+(editing?"/"+editing:""),editing?"PUT":"POST",{...form,options:filledOptions.length>0?filledOptions:form.options});
   setOpen(false);reload();
  }catch(e){setFailure(e as Error);}finally{setBusy(false);}
 }
 return <>
  <PageHeading eyebrow="NỘI DUNG CỦA BẠN" title="Ngân hàng câu hỏi" description="Bốn lựa chọn, một đáp án đúng. Câu đã dùng trong đề công bố sẽ được khóa." action={<button className="button" onClick={()=>{setForm(blank());setEditing(null);setIsFrozen(false);setFailure(null);setOpen(true);}}><Plus size={18}/>Thêm câu hỏi</button>}/>
  <form className="search-form" onSubmit={e=>{e.preventDefault();setQuery(search);setPage(0);}}><Search size={18}/><input aria-label="Tìm nội dung câu hỏi" placeholder="Tìm trong câu hỏi của bạn…" value={search} maxLength={100} onChange={e=>setSearch(e.target.value)}/><button className="button secondary small">Tìm kiếm</button></form>
  {failure&&!open&&<ErrorBox error={failure}/>}
  {error?<ErrorBox error={error} retry={reload}/>:!data?<Loading/>:!data.length?<Empty title="Chưa có câu hỏi phù hợp">Thêm câu hỏi đầu tiên hoặc thử một từ khóa khác.</Empty>:<div className="question-bank-list">{data.map(q=><article key={q.questionId} className="bank-question"><div><div className="row-kicker"><span>{q.category}</span><Badge>{({Easy:"Cơ bản",Medium:"Trung bình",Hard:"Nâng cao"} as Record<string,string>)[q.difficulty]}</Badge>{q.frozen&&<Badge tone="warm"><LockKeyhole size={12}/>Đã khóa</Badge>}</div><p lang="en">{q.questionText}</p></div><button className="button secondary small" disabled={busy} onClick={()=>edit(q)}>{q.frozen?"Xem câu hỏi":"Chỉnh sửa"}</button></article>)}</div>}
  <Pager page={page} setPage={setPage} count={data?.length||0}/>
  <Dialog open={open} onClose={()=>{if(!busy)setOpen(false);}} title={editing?(isFrozen?"Chi tiết câu hỏi (Đã khóa)":"Chỉnh sửa câu hỏi"):"Thêm câu hỏi mới"}>
   <form onSubmit={save} className="form-stack">
    {isFrozen&&<div className="notice warning"><LockKeyhole size={16}/><span>Câu hỏi này thuộc đề thi đã công bố nên nội dung và các lựa chọn đã được khóa để bảo toàn dữ liệu chấm điểm.</span></div>}
    <fieldset disabled={isFrozen||busy} className="form-stack" style={{border:"none",padding:0,margin:0}}>
     <label>Nội dung câu hỏi<textarea required maxLength={1000} rows={3} lang="en" value={form.questionText} onChange={e=>setForm({...form,questionText:e.target.value})}/></label>
     <div className="form-grid">
      <label>Chủ đề<input required maxLength={60} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label>
      <label>Độ khó<select value={form.difficulty} onChange={e=>setForm({...form,difficulty:e.target.value})}><option value="Easy">Cơ bản</option><option value="Medium">Trung bình</option><option value="Hard">Nâng cao</option></select></label>
     </div>
     <fieldset className="option-editor"><legend>Các lựa chọn · chọn một đáp án đúng</legend>{form.options.map((o,i)=><div className="option-edit-row" key={o.optionCode}><label className="correct-choice"><input type="radio" name="correct" aria-label={"Đáp án đúng "+o.optionCode} checked={o.isCorrect} onChange={()=>setForm({...form,options:form.options.map((x,j)=>({...x,isCorrect:i===j}))})}/>{o.optionCode}</label><input aria-label={"Nội dung lựa chọn "+o.optionCode} lang="en" maxLength={300} placeholder={"Nội dung lựa chọn "+o.optionCode} value={o.optionText} onChange={e=>setForm({...form,options:form.options.map((x,j)=>j===i?{...x,optionText:e.target.value}:x)})}/></div>)}</fieldset>
    </fieldset>
    {failure&&<ErrorBox error={failure}/>}
    <p className="form-hint">Hệ thống hỗ trợ lưu câu hỏi nháp. Khi công bố đề thi, câu hỏi cần có đủ 4 lựa chọn (A, B, C, D) và đúng một đáp án đúng.</p>
    {!isFrozen&&<button className="button full" disabled={busy}>{busy?"Đang lưu…":"Lưu câu hỏi"}<Check size={18}/></button>}
   </form>
  </Dialog>
 </>;
}

type Weight={questionId:number;questionOrder:number;points:number;questionText:string};

export function ExamEditor({id}:{id:number}){
 const exam=useData<TeacherExam>("/teacher/exams/"+id),classes=useData<ClassItem[]>("/teacher/classes");
 const [libraryPage,setLibraryPage]=useState(0),[librarySearch,setLibrarySearch]=useState(""),[libraryQuery,setLibraryQuery]=useState(""),[libraryOpen,setLibraryOpen]=useState(false);
 const library=useData<Question[]>("/teacher/questions?page="+libraryPage+"&search="+encodeURIComponent(libraryQuery));
 const [weights,setWeights]=useState<Weight[]>([]),[busy,setBusy]=useState(false),[failure,setFailure]=useState<Error|null>(null),[notice,setNotice]=useState(""),[publishOpen,setPublishOpen]=useState(false),[assignOpen,setAssignOpen]=useState(false),[dirty,setDirty]=useState(false);
 const [assignTarget,setAssignTarget]=useState<Partial<{classId:number;opensAt:string;closesAt:string;maxAttempts:number;isActive:boolean}>>({});
 useEffect(()=>{if(exam.data){setWeights(exam.data.questions.map(q=>({questionId:q.questionId,questionOrder:q.questionOrder,points:q.points,questionText:q.questionText})));setDirty(false);}},[exam.data]);
 if(exam.error)return <ErrorBox error={exam.error} retry={exam.reload}/>;if(!exam.data)return <Loading/>;const e=exam.data,isDraft=e.status==="Draft";
 async function perform(work:()=>Promise<unknown>,message:string){setBusy(true);setFailure(null);setNotice("");try{await work();setNotice(message);exam.reload();return true;}catch(e){setFailure(e as Error);return false;}finally{setBusy(false);}}
 async function saveMeta(event:FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);await perform(()=>send("/teacher/exams/"+id,"PUT",{examCode:f.get("examCode"),title:f.get("title"),durationMinutes:Number(f.get("durationMinutes"))}),"Đã lưu thông tin đề.");}
 async function saveStructure(){await perform(()=>send("/teacher/exams/"+id+"/questions","PUT",{questions:weights.map((q,i)=>({questionId:q.questionId,questionOrder:i+1,points:q.points}))}),"Đã lưu cấu trúc đề.");}
 async function publish(){const ok=await perform(()=>send("/teacher/exams/"+id+"/publish","POST"),"Đã công bố đề.");if(ok)setPublishOpen(false);}
 async function assign(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const f=new FormData(event.currentTarget);
  const ok=await perform(()=>send("/teacher/exams/"+id+"/assignments","PUT",{classId:Number(f.get("classId")),opensAt:new Date(String(f.get("opensAt"))).toISOString(),closesAt:new Date(String(f.get("closesAt"))).toISOString(),maxAttempts:Number(f.get("maxAttempts")),isActive:f.get("isActive")==="on"}),"Đã cập nhật giao đề.");
  if(ok)setAssignOpen(false);
 }
 function reorder(i:number,direction:number){const a=[...weights];[a[i],a[i+direction]]=[a[i+direction],a[i]];setWeights(a);setDirty(true);}
 function openEditAssignment(a:any){
  const toLocalInput=(iso:string)=>{try{const d=new Date(iso);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16);}catch{return "";}};
  setAssignTarget({classId:a.classId,opensAt:toLocalInput(a.opensAt),closesAt:toLocalInput(a.closesAt),maxAttempts:a.maxAttempts,isActive:a.isActive});
  setAssignOpen(true);
 }
 return <>
  <Link className="text-link back-link" href="/teacher/exams"><ArrowLeft size={16}/>Danh sách đề thi</Link>
  <PageHeading eyebrow={e.examCode} title={e.title} action={<Badge tone={isDraft?"warm":"success"}>{isDraft?"Bản nháp":"Đã công bố"}</Badge>}/>
  {failure&&<ErrorBox error={failure}/>}{notice&&<div className="notice success" role="status"><Check size={18}/>{notice}</div>}
  <section className="panel section-block"><div className="section-head"><h2>Thông tin đề thi</h2>{!isDraft&&<span className="muted"><LockKeyhole size={15}/> Đã khóa nội dung</span>}</div><form onSubmit={saveMeta} className="form-stack"><fieldset disabled={!isDraft||busy} className="form-grid exam-meta-form"><label>Mã đề<input name="examCode" defaultValue={e.examCode} required pattern={"[A-Za-z0-9_\\-]+"} maxLength={20}/></label><label>Tên bài thi<input name="title" defaultValue={e.title} required maxLength={160}/></label><label>Thời lượng (phút)<input type="number" name="durationMinutes" defaultValue={e.durationMinutes} min={1} max={180} required/></label></fieldset>{isDraft&&<button className="button secondary align-start" disabled={busy}>Lưu thông tin</button>}</form></section>
  <section className="panel section-block"><div className="section-head"><div><h2>Cấu trúc bài thi</h2><p className="muted">{weights.length} câu · {number(weights.reduce((s,q)=>s+q.points,0))} điểm</p></div>{isDraft&&<button className="button secondary small" onClick={()=>setLibraryOpen(true)}><Plus size={16}/>Thêm câu</button>}</div>{!weights.length?<Empty title="Đề thi đang chờ những câu hỏi hay">Thêm ít nhất 5 câu hỏi hợp lệ trước khi công bố.</Empty>:<div className="structure-list">{weights.map((q,i)=><div className="structure-row" key={q.questionId}><span className="structure-number">{i+1}</span><p lang="en">{q.questionText}</p><label className="points-label">Điểm<input aria-label={"Điểm câu "+(i+1)} disabled={!isDraft||busy} type="number" min="0.01" max="9999.99" step="0.01" value={q.points} onChange={ev=>{setWeights(weights.map((x,j)=>j===i?{...x,points:Number(ev.target.value)}:x));setDirty(true);}}/></label>{isDraft&&<div className="structure-controls"><button className="icon-button" aria-label={"Đưa câu "+(i+1)+" lên"} disabled={i===0||busy} onClick={()=>reorder(i,-1)}><ArrowUp size={16}/></button><button className="icon-button" aria-label={"Đưa câu "+(i+1)+" xuống"} disabled={i===weights.length-1||busy} onClick={()=>reorder(i,1)}><ArrowDown size={16}/></button><button className="icon-button danger-text" aria-label={"Bỏ câu "+(i+1)} disabled={busy} onClick={()=>{setWeights(weights.filter(x=>x.questionId!==q.questionId));setDirty(true);}}><Trash2 size={16}/></button></div>}</div>)}</div>}{isDraft&&<div className="editor-actions"><button className="button secondary" disabled={busy||!dirty||weights.some(q=>q.points<=0||q.points>9999.99)} onClick={saveStructure}>Lưu cấu trúc</button><button className="button" disabled={busy||dirty||weights.length<5} onClick={()=>setPublishOpen(true)}>Công bố đề <Arrow/></button>{dirty&&<span className="muted">Có thay đổi chưa lưu.</span>}</div>}</section>
  {!isDraft&&<section className="panel section-block">
   <div className="section-head"><h2>Giao đề cho các lớp</h2><button className="button small" onClick={()=>{setAssignTarget({});setAssignOpen(true);}}><Plus size={17}/>Giao / cập nhật lịch</button></div>
   {e.assignments.length?<div className="table-wrap" role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem đầy đủ" tabIndex={0}><table><thead><tr><th>Lớp</th><th>Mở đề</th><th>Đóng đề</th><th>Lượt tối đa</th><th>Người duyệt</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{e.assignments.map(a=><tr key={a.classId}><td><strong>{a.classCode}</strong><small>{a.className}</small></td><td>{date(a.opensAt)}</td><td>{date(a.closesAt)}</td><td>{a.maxAttempts}</td><td>{a.authorizedByName||"—"}</td><td><Badge tone={a.isActive?"success":"warm"}>{a.isActive?"Hoạt động":"Tạm ngừng"}</Badge></td><td><button className="button secondary small" onClick={()=>openEditAssignment(a)}><Edit size={14}/>Chỉnh sửa</button></td></tr>)}</tbody></table></div>:<Empty title="Chưa giao đề cho lớp">Chọn một lớp bạn phụ trách và đặt thời gian mở thi.</Empty>}
  </section>}
  <Dialog open={libraryOpen} onClose={()=>setLibraryOpen(false)} title="Chọn từ ngân hàng câu hỏi"><form className="search-form" onSubmit={ev=>{ev.preventDefault();setLibraryQuery(librarySearch);setLibraryPage(0);}}><input aria-label="Tìm câu hỏi để thêm" placeholder="Tìm câu hỏi…" value={librarySearch} maxLength={100} onChange={ev=>setLibrarySearch(ev.target.value)}/><button className="button secondary small">Tìm</button></form>{library.error?<ErrorBox error={library.error}/>:!library.data?<Loading/>:!library.data.length?<p>Chưa có câu hỏi. <Link href="/teacher/questions">Mở ngân hàng để biên soạn.</Link></p>:library.data.map(q=><div className="library-row" key={q.questionId}><p lang="en">{q.questionText}</p><button className="button secondary small" disabled={weights.some(w=>w.questionId===q.questionId)} onClick={()=>{setWeights([...weights,{questionId:q.questionId,questionOrder:weights.length+1,points:1,questionText:q.questionText}]);setDirty(true);}}>{weights.some(w=>w.questionId===q.questionId)?"Đã thêm":"Thêm"}</button></div>)}<Pager page={libraryPage} setPage={setLibraryPage} count={library.data?.length||0}/><button className="button full" onClick={()=>setLibraryOpen(false)}>Xong · {weights.length} câu trong đề</button></Dialog>
  <Dialog open={publishOpen} onClose={()=>{if(!busy)setPublishOpen(false);}} title="Công bố đề thi?"><p>Nội dung câu hỏi, lựa chọn, thứ tự, trọng số và thời lượng sẽ được khóa sau khi công bố.</p>{failure&&<ErrorBox error={failure}/>}<div className="dialog-actions"><button className="button secondary" disabled={busy} onClick={()=>setPublishOpen(false)}>Kiểm tra lại</button><button className="button" disabled={busy} onClick={publish}>{busy?"Đang công bố…":"Xác nhận công bố"}</button></div></Dialog>
  <Dialog open={assignOpen} onClose={()=>{if(!busy)setAssignOpen(false);}} title="Giao đề thi cho lớp">
   <form onSubmit={assign} className="form-stack">
    <label>Lớp phụ trách
     <select name="classId" aria-label="Lớp phụ trách" required defaultValue={assignTarget.classId||""}>
      <option value="" disabled>Chọn lớp</option>
      {classes.data?.map(c=><option value={c.classId} key={c.classId}>{c.classCode} · {c.className}</option>)}
     </select>
    </label>
    {classes.error&&<ErrorBox error={classes.error}/>}
    <label>Thời gian mở đề<input name="opensAt" type="datetime-local" defaultValue={assignTarget.opensAt} required/></label>
    <label>Thời gian đóng đề<input name="closesAt" type="datetime-local" defaultValue={assignTarget.closesAt} required/></label>
    <label>Lượt thi tối đa<input name="maxAttempts" type="number" min={1} max={10} defaultValue={assignTarget.maxAttempts??1} required/></label>
    <label className="checkbox-label"><input name="isActive" type="checkbox" defaultChecked={assignTarget.isActive??true}/>Cho phép tham gia</label>
    <p className="form-hint">Thời gian theo múi giờ thiết bị. Chọn lớp đã giao để cập nhật lịch; hạn của lượt đã bắt đầu được giữ nguyên.</p>
    {failure&&<ErrorBox error={failure}/>}
    <button className="button full" disabled={busy||!classes.data?.length}>{busy?"Đang lưu…":"Lưu lịch thi"}</button>
   </form>
  </Dialog>
 </>;
}

export function TeacherClasses(){
 const classes=useData<ClassItem[]>("/teacher/classes");
 const [createOpen,setCreateOpen]=useState(false),[editClassItem,setEditClassItem]=useState<ClassItem|null>(null);
 const [selected,setSelected]=useState<ClassItem|null>(null),[classTab,setClassTab]=useState<"students"|"exams">("students");
 const [students,setStudents]=useState<Student[]|null>(null),[classExams,setClassExams]=useState<ClassExam[]|null>(null);
 const [version,setVersion]=useState(0),[busy,setBusy]=useState(false),[failure,setFailure]=useState<Error|null>(null);
 const [assignModalOpen,setAssignModalOpen]=useState(false);
 const teacherExams=useData<TeacherExam[]>("/teacher/exams");

 useEffect(()=>{
  if(!selected)return;
  let active=true;setFailure(null);
  if(classTab==="students"){
   setStudents(null);
   api<Student[]>("/teacher/classes/"+selected.classId+"/students").then(s=>{if(active)setStudents(s);}).catch(e=>{if(active)setFailure(e);});
  }else{
   setClassExams(null);
   api<ClassExam[]>("/teacher/classes/"+selected.classId+"/exams").then(x=>{if(active)setClassExams(x);}).catch(e=>{if(active)setFailure(e);});
  }
  return()=>{active=false;};
 },[selected,classTab,version]);

 async function handleCreateClass(ev:FormEvent<HTMLFormElement>){
  ev.preventDefault();const f=new FormData(ev.currentTarget);setBusy(true);setFailure(null);
  try{
   await send("/teacher/classes","POST",{classCode:f.get("classCode"),className:f.get("className"),isActive:f.get("isActive")==="on"});
   setCreateOpen(false);classes.reload();
  }catch(e){setFailure(e as Error);}finally{setBusy(false);}
 }

 async function handleEditClass(ev:FormEvent<HTMLFormElement>){
  ev.preventDefault();const f=new FormData(ev.currentTarget);setBusy(true);setFailure(null);
  try{
   await send("/teacher/classes/"+editClassItem!.classId,"PUT",{classCode:f.get("classCode"),className:f.get("className"),isActive:f.get("isActive")==="on"});
   setEditClassItem(null);classes.reload();
  }catch(e){setFailure(e as Error);}finally{setBusy(false);}
 }

 async function enroll(ev:FormEvent<HTMLFormElement>){
  ev.preventDefault();const form=ev.currentTarget,f=new FormData(form);setBusy(true);setFailure(null);
  try{
   await send("/teacher/classes/"+selected!.classId+"/enrollments","PUT",{email:f.get("email"),isActive:f.get("isActive")==="on"});
   form.reset();setVersion(v=>v+1);classes.reload();
  }catch(e){setFailure(e as Error);}finally{setBusy(false);}
 }

 async function removeStudent(studentId:number){
  if(!confirm("Bạn có chắc chắn muốn xóa học viên này khỏi lớp?"))return;
  setBusy(true);setFailure(null);
  try{
   await send("/teacher/classes/"+selected!.classId+"/enrollments/"+studentId,"DELETE");
   setVersion(v=>v+1);classes.reload();
  }catch(e){setFailure(e as Error);}finally{setBusy(false);}
 }

 async function toggleStudentActive(s:Student){
  setBusy(true);setFailure(null);
  try{
   await send("/teacher/classes/"+selected!.classId+"/enrollments","PUT",{email:s.email,isActive:!s.isActive});
   setVersion(v=>v+1);classes.reload();
  }catch(e){setFailure(e as Error);}finally{setBusy(false);}
 }

 async function handleAssignToClass(ev:FormEvent<HTMLFormElement>){
  ev.preventDefault();const f=new FormData(ev.currentTarget);setBusy(true);setFailure(null);
  try{
   await send("/teacher/classes/"+selected!.classId+"/assignments","POST",{
    examId:Number(f.get("examId")),
    opensAt:new Date(String(f.get("opensAt"))).toISOString(),
    closesAt:new Date(String(f.get("closesAt"))).toISOString(),
    maxAttempts:Number(f.get("maxAttempts")),
    isActive:f.get("isActive")==="on"
   });
   setAssignModalOpen(false);setVersion(v=>v+1);classes.reload();
  }catch(e){setFailure(e as Error);}finally{setBusy(false);}
 }

 return <>
  <PageHeading eyebrow="GIẢNG DẠY CÓ KẾT NỐI" title="Lớp phụ trách" description="Quản lý các lớp bạn phụ trách, ghi danh học viên và theo dõi đề thi đã giao." action={<button className="button" onClick={()=>{setFailure(null);setCreateOpen(true);}}><Plus size={18}/>Tạo lớp</button>}/>
  {classes.error?<ErrorBox error={classes.error}/>:!classes.data?<Loading/>:!classes.data.length?<Empty title="Chưa có lớp phụ trách">Bấm nút "Tạo lớp" để tạo lớp học đầu tiên của bạn.</Empty>:
   <div className="class-grid">
    {classes.data.map(c=><article className="class-card" key={c.classId}>
     <div className="section-head"><Users size={26}/><Badge tone={c.isActive?"success":"neutral"}>{c.isActive?"Hoạt động":"Tạm ngừng"}</Badge></div>
     <p className="eyebrow">{c.classCode}</p>
     <h2>{c.className}</h2>
     <p className="muted">{c.studentCount} học viên đang ghi danh{c.activeExamCount!==undefined?` · ${c.activeExamCount} bài thi`:""}</p>
     <div style={{display:"flex",gap:"8px",marginTop:"12px"}}>
      <button className="button secondary small" style={{flex:1}} onClick={()=>{setClassTab("students");setSelected(c);}}>Danh sách học viên <Arrow/></button>
      <button className="button secondary small" aria-label={"Sửa lớp "+c.classCode} onClick={()=>{setFailure(null);setEditClassItem(c);}}><Edit size={15}/></button>
     </div>
    </article>)}
   </div>
  }

  {/* Modal: Tạo lớp */}
  <Dialog open={createOpen} onClose={()=>{if(!busy)setCreateOpen(false);}} title="Tạo lớp học mới">
   <form onSubmit={handleCreateClass} className="form-stack">
    <label>Mã lớp<input name="classCode" required maxLength={20} pattern="[A-Za-z0-9_\-]+" placeholder="ENG-A1"/><small className="form-hint">Tối đa 20 ký tự: chữ không dấu, số, dấu gạch ngang/dưới.</small></label>
    <label>Tên lớp học<input name="className" required maxLength={100} placeholder="Tiếng Anh A1 - Giao tiếp cơ bản"/></label>
    <label className="checkbox-label"><input name="isActive" type="checkbox" defaultChecked/>Lớp đang hoạt động</label>
    {failure&&<ErrorBox error={failure}/>}
    <button className="button full" disabled={busy}>{busy?"Đang tạo…":"Tạo lớp"}<Arrow/></button>
   </form>
  </Dialog>

  {/* Modal: Sửa lớp */}
  <Dialog open={!!editClassItem} onClose={()=>{if(!busy)setEditClassItem(null);}} title={"Chỉnh sửa lớp: "+editClassItem?.classCode}>
   {editClassItem&&<form onSubmit={handleEditClass} className="form-stack">
    <label>Mã lớp<input name="classCode" defaultValue={editClassItem.classCode} required maxLength={20} pattern="[A-Za-z0-9_\-]+"/></label>
    <label>Tên lớp học<input name="className" defaultValue={editClassItem.className} required maxLength={100}/></label>
    <label className="checkbox-label"><input name="isActive" type="checkbox" defaultChecked={editClassItem.isActive}/>Lớp đang hoạt động</label>
    {failure&&<ErrorBox error={failure}/>}
    <button className="button full" disabled={busy}>{busy?"Đang lưu…":"Lưu thay đổi"}<Check size={18}/></button>
   </form>}
  </Dialog>

  {/* Modal: Quản lý lớp (Học viên & Đề thi đã giao) */}
  <Dialog open={!!selected} onClose={()=>{if(!busy)setSelected(null);}} title={selected?.className+" ("+selected?.classCode+")"}>
   <div className="tabs" aria-label="Quản lý lớp" style={{marginBottom:"18px"}}>
    <button className={classTab==="students"?"tab active":"tab"} onClick={()=>setClassTab("students")}>Học viên ghi danh</button>
    <button className={classTab==="exams"?"tab active":"tab"} onClick={()=>setClassTab("exams")}>Đề thi đã giao</button>
   </div>
   {failure&&<ErrorBox error={failure}/>}

   {classTab==="students"&&<>
    {students?
     <div className="student-list">
      {students.length?students.map(s=><div key={s.userId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"10px",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
       <div><strong>{s.fullName}</strong><br/><small>{s.email}</small></div>
       <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
        <Badge tone={s.isActive?"success":"neutral"}>{s.isActive?"Đang học":"Ngừng ghi danh"}</Badge>
        <button className="button secondary small" style={{fontSize:"11px",padding:"4px 8px"}} disabled={busy} onClick={()=>toggleStudentActive(s)}>{s.isActive?"Tạm ngừng":"Bật lại"}</button>
        <button className="icon-button danger-text" aria-label={"Xóa học viên "+s.fullName} disabled={busy} onClick={()=>removeStudent(s.userId)}><Trash2 size={15}/></button>
       </div>
      </div>):<p>Chưa có học viên nào được ghi danh vào lớp này.</p>}
     </div>:<Loading/>}
    <form className="form-stack enrollment-form" onSubmit={enroll} style={{marginTop:"20px"}}>
     <h3>Ghi danh học viên mới</h3>
     <label>Email học viên<input type="email" name="email" required maxLength={200} placeholder="hocvien@example.com"/></label>
     <label className="checkbox-label"><input name="isActive" type="checkbox" defaultChecked/>Ghi danh đang hoạt động</label>
     <p className="form-hint">Học viên phải có tài khoản học viên trong hệ thống. Nếu đã ghi danh, thao tác này cập nhật trạng thái.</p>
     <button className="button" disabled={busy}>{busy?"Đang lưu…":"Lưu ghi danh"}</button>
    </form>
   </>}

   {classTab==="exams"&&<>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
     <p className="muted" style={{margin:0}}>Danh sách đề thi được phân công cho lớp này</p>
     <button className="button small" onClick={()=>setAssignModalOpen(true)}><Plus size={16}/>Giao đề cho lớp</button>
    </div>
    {classExams?
     classExams.length?
      <div className="table-wrap">
       <table>
        <thead><tr><th>Đề thi</th><th>Thời gian mở - đóng</th><th>Lượt tối đa</th><th>Người duyệt</th><th>Trạng thái</th></tr></thead>
        <tbody>{classExams.map(x=><tr key={x.examId}>
         <td><strong>{x.title}</strong><br/><small>{x.examCode} · {x.durationMinutes} phút · {x.questionCount} câu</small></td>
         <td><small>{date(x.opensAt)}<br/>đến {date(x.closesAt)}</small></td>
         <td>{x.maxAttempts}</td>
         <td>{x.authorizedByName||"—"}</td>
         <td><Badge tone={x.isActive?"success":"warm"}>{x.isActive?"Hoạt động":"Tạm ngừng"}</Badge></td>
        </tr>)}</tbody>
       </table>
      </div>
      :<Empty title="Chưa có bài thi nào được giao cho lớp này">Bấm "Giao đề cho lớp" để chọn từ các đề thi bạn đã công bố.</Empty>
     :<Loading/>}
   </>}
  </Dialog>

  {/* Modal con: Giao đề từ phía lớp */}
  <Dialog open={assignModalOpen} onClose={()=>setAssignModalOpen(false)} title={"Giao đề thi cho lớp "+selected?.classCode}>
   <form onSubmit={handleAssignToClass} className="form-stack">
    <label>Chọn đề thi đã công bố
     <select name="examId" required defaultValue="">
      <option value="" disabled>Chọn đề thi</option>
      {teacherExams.data?.filter(e=>e.status==="Published").map(e=><option key={e.examId} value={e.examId}>{e.examCode} · {e.title} ({e.durationMinutes} phút)</option>)}
     </select>
    </label>
    <label>Thời gian mở đề<input name="opensAt" type="datetime-local" required/></label>
    <label>Thời gian đóng đề<input name="closesAt" type="datetime-local" required/></label>
    <label>Lượt thi tối đa<input name="maxAttempts" type="number" min={1} max={10} defaultValue={1} required/></label>
    <label className="checkbox-label"><input name="isActive" type="checkbox" defaultChecked/>Cho phép tham gia</label>
    {failure&&<ErrorBox error={failure}/>}
    <button className="button full" disabled={busy}>{busy?"Đang giao đề…":"Xác nhận giao đề"}</button>
   </form>
  </Dialog>
 </>;
}

export function TeacherResults(){
 const [page,setPage]=useState(0);
 const [classId,setClassId]=useState<string>("");
 const [examId,setExamId]=useState<string>("");
 const [status,setStatus]=useState<string>("");
 const [search,setSearch]=useState<string>("");
 const [querySearch,setQuerySearch]=useState<string>("");

 const classes=useData<ClassItem[]>("/teacher/classes");
 const exams=useData<TeacherExam[]>("/teacher/exams");

 const url=`/teacher/results?page=${page}${classId?`&classId=${classId}`:""}${examId?`&examId=${examId}`:""}${status?`&status=${status}`:""}${querySearch?`&search=${encodeURIComponent(querySearch)}`:""}`;
 const {data,error,reload}=useData<TeacherResultRow[]>(url);

 return <>
  <PageHeading eyebrow="KẾT QUẢ TỪ LỚP HỌC" title="Kết quả học viên" description="Toàn bộ lượt làm bài và kết quả chính thức từ các lớp bạn phụ trách."/>
  
  <div className="panel" style={{marginBottom:"24px",padding:"18px"}}>
   <div className="form-grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"14px",alignItems:"flex-end"}}>
    <label>Lọc theo lớp
     <select value={classId} onChange={e=>{setClassId(e.target.value);setPage(0);}}>
      <option value="">Tất cả các lớp</option>
      {classes.data?.map(c=><option key={c.classId} value={c.classId}>{c.classCode} · {c.className}</option>)}
     </select>
    </label>
    <label>Lọc theo bài thi
     <select value={examId} onChange={e=>{setExamId(e.target.value);setPage(0);}}>
      <option value="">Tất cả đề thi</option>
      {exams.data?.map(x=><option key={x.examId} value={x.examId}>{x.examCode} · {x.title}</option>)}
     </select>
    </label>
    <label>Trạng thái lượt thi
     <select value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}>
      <option value="">Tất cả trạng thái</option>
      <option value="Submitted">Đã nộp bài</option>
      <option value="InProgress">Đang làm bài</option>
     </select>
    </label>
    <form className="search-form" onSubmit={e=>{e.preventDefault();setQuerySearch(search);setPage(0);}} style={{margin:0}}>
     <Search size={16}/>
     <input placeholder="Tìm tên/email học viên…" value={search} onChange={e=>setSearch(e.target.value)}/>
     <button className="button secondary small">Tìm</button>
    </form>
   </div>
  </div>

  {error?<ErrorBox error={error} retry={reload}/>:!data?<Loading/>:!data.length?<Empty title="Không có kết quả nào">Không tìm thấy lượt làm bài phù hợp với bộ lọc đã chọn.</Empty>:
   <div className="table-wrap" role="region" aria-label="Bảng dữ liệu kết quả" tabIndex={0}>
    <table>
     <thead><tr><th>Học viên</th><th>Lớp</th><th>Bài thi</th><th>Lượt</th><th>Trạng thái</th><th>Điểm</th><th>Tỷ lệ</th><th>Thời gian</th></tr></thead>
     <tbody>{data.map(r=><tr key={r.attemptId}>
      <td><strong>{r.fullName}</strong><br/><small>{r.email}</small></td>
      <td><Badge tone="neutral">{r.classCode}</Badge></td>
      <td><strong>{r.title}</strong><br/><small>{r.examCode}</small></td>
      <td>Lượt {r.attemptNo}</td>
      <td><Badge tone={r.status==="Submitted"?"success":"warm"}>{r.status==="Submitted"?"Đã nộp":"Đang làm"}</Badge></td>
      <td>{r.status==="Submitted"?`${number(r.earnedPoints??0)} / ${number(r.maxPoints)}`:"—"}</td>
      <td className="score-cell">{r.status==="Submitted"?`${number(r.scorePercent??0)}%`:"—"}</td>
      <td><small>{r.status==="Submitted"?date(r.submittedAt!):`Bắt đầu: ${date(r.startedAt)}`}</small></td>
     </tr>)}</tbody>
    </table>
   </div>
  }
  <Pager page={page} setPage={setPage} count={data?.length||0}/>
 </>;
}
