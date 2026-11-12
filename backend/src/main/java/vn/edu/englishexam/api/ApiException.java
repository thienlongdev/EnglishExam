package vn.edu.englishexam.api;
public class ApiException extends RuntimeException {
 public final int status;
 public final String code;
 public ApiException(int status,String code,String message){super(message);this.status=status;this.code=code;}
 public static ApiException forbidden(){return new ApiException(403,"FORBIDDEN","Bạn không có quyền thực hiện thao tác này.");}
 public static ApiException missing(){return new ApiException(404,"NOT_FOUND","Không tìm thấy nội dung bạn được phép truy cập.");}
}
