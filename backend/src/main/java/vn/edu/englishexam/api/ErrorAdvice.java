package vn.edu.englishexam.api;
import java.sql.SQLException;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
@RestControllerAdvice
public class ErrorAdvice {
 private static final Logger log = LoggerFactory.getLogger(ErrorAdvice.class);
 private static final Map<Integer,String> ERRORS=Map.ofEntries(
  Map.entry(51101,"Đề không tồn tại hoặc đã công bố."),Map.entry(51102,"Đề cần ít nhất 5 câu."),
  Map.entry(51103,"Mỗi câu cần 4 lựa chọn và đúng 1 đáp án."),Map.entry(51110,"Chưa lấy được khóa bắt đầu thi. Vui lòng thử lại."),
  Map.entry(51111,"Tài khoản học viên không hợp lệ."),Map.entry(51112,"Bạn chưa có ghi danh đang hoạt động."),
  Map.entry(51113,"Đề chưa sẵn sàng hoặc ngoài thời gian mở thi."),Map.entry(51114,"Bạn đã dùng hết số lượt thi."),
  Map.entry(51120,"Lượt thi đã nộp hoặc hết hạn nhận đáp án."),Map.entry(51121,"Câu hỏi không thuộc đề thi."),
  Map.entry(51122,"Lựa chọn không hợp lệ."),Map.entry(51130,"Lượt thi không tồn tại hoặc đã nộp."),
  Map.entry(51131,"Đề chưa có thang điểm hợp lệ."),Map.entry(51201,"Giáo viên đang có quan hệ nghiệp vụ."),
  Map.entry(51202,"Học viên đang có ghi danh."),Map.entry(51203,"Người phụ trách phải là giáo viên."),
  Map.entry(51204,"Ghi danh cần vai trò học viên."),Map.entry(51205,"Người giao đề phải là giáo viên."),
  Map.entry(51206,"Tác giả câu hỏi phải là giáo viên."),Map.entry(51207,"Không thể sửa câu thuộc đề đã công bố."),
  Map.entry(51208,"Không thể sửa lựa chọn thuộc đề đã công bố."),Map.entry(51209,"Không thể sửa cấu trúc đề đã công bố."),
  Map.entry(51210,"Tác giả đề phải là giáo viên."),Map.entry(51211,"Đề đã công bố không thể thay đổi."),
  Map.entry(51212,"Đề công bố cần ít nhất 5 câu hợp lệ."),Map.entry(51213,"Kết quả đã nộp không thể thay đổi."),
  Map.entry(51214,"Không thể thay đổi định danh hoặc thời gian lượt thi."),Map.entry(51215,"Lượt thi mới phải ở trạng thái đang làm."),
  Map.entry(51216,"Lượt thi không thỏa điều kiện ghi danh, lịch thi hoặc giới hạn lượt."),
  Map.entry(51217,"Điểm không khớp dữ liệu chấm."),Map.entry(51218,"Lượt đã nộp hoặc hết hạn; không thể sửa đáp án."),
  Map.entry(51219,"Câu hỏi ngoài đề hoặc thời gian trả lời không hợp lệ."));
 private ResponseEntity<?> error(int status,String code,String message){return ResponseEntity.status(status).body(Map.of("code",code,"message",message));}
 @ExceptionHandler(ApiException.class) ResponseEntity<?> domain(ApiException e){return error(e.status,e.code,e.getMessage());}
 @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class,HandlerMethodValidationException.class})
 ResponseEntity<?> validation(Exception e){return error(400,"VALIDATION","Thông tin chưa hợp lệ. Hãy kiểm tra các trường và giới hạn hiển thị.");}
 @ExceptionHandler(DataAccessException.class) ResponseEntity<?> sql(DataAccessException e){
  log.error("DataAccessException caught: {}", e.getMessage(), e);
  for(Throwable t=e;t!=null;t=t.getCause())if(t instanceof SQLException s){
   for(SQLException q=s;q!=null;q=q.getNextException())if(ERRORS.containsKey(q.getErrorCode()))return error(409,"SQL_"+q.getErrorCode(),ERRORS.get(q.getErrorCode()));
   if(s.getErrorCode()==2601||s.getErrorCode()==2627)return error(409,"DUPLICATE","Mã hoặc quan hệ này đã tồn tại.");
   if(s.getErrorCode()==547)return error(409,"CONSTRAINT","Dữ liệu không thỏa ràng buộc hoặc vẫn đang được sử dụng.");
   if(s.getErrorCode()==1205)return error(409,"RETRY","Thao tác đồng thời bị xung đột. Vui lòng tải lại và thử lại.");
  }
  return error(503,"DATABASE_UNAVAILABLE","Chưa kết nối được dữ liệu. Vui lòng đợi một lát rồi thử lại.");
 }
 @ExceptionHandler(Exception.class) ResponseEntity<?> unhandled(Exception e){
  log.error("Unhandled exception caught: {}", e.getMessage(), e);
  return error(500,"INTERNAL_ERROR","Đã xảy ra lỗi máy chủ không mong muốn: "+e.getMessage());
 }
}
