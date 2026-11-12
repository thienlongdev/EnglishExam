import type {Metadata} from "next";
import "@fontsource-variable/quicksand";
import "./globals.css";
export const metadata:Metadata={title:{default:"English Exam · Tập trung để tiến bộ",template:"%s · English Exam"},description:"Không gian thi trắc nghiệm tiếng Anh dành cho học viên và giảng viên."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body><a className="skip-link" href="#main">Đến nội dung chính</a>{children}</body></html>;}
