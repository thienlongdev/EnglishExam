package vn.edu.englishexam.api;
import jakarta.validation.constraints.*;

public class AdminRequests {
 public record Approve(@NotBlank @Pattern(regexp = "^(teacher|student)$", message = "Vai trò chỉ có thể là teacher hoặc student") String role){}
}
