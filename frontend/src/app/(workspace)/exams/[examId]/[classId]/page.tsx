import {Overview} from "@/components/student";
export default async function Page({params}:{params:Promise<{examId:string;classId:string}>}){const p=await params;return <Overview examId={Number(p.examId)} classId={Number(p.classId)}/>;}
