import {ExamEditor} from "@/components/teacher";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ExamEditor id={Number(id)}/>;}
