import {ExamRoom} from "@/components/exam-room";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ExamRoom id={Number(id)}/>;}
