import {ResultPage} from "@/components/student";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ResultPage id={Number(id)}/>;}
