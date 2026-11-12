package vn.edu.englishexam.api;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
public class Requests {
 public record Start(@Positive int examId,@Positive int classId){}
 public record Answer(@NotNull @Pattern(regexp="[ABCD]") String optionCode){}
 public record Exam(@NotBlank @Size(max=20) @Pattern(regexp="[A-Za-z0-9_-]+") String examCode,@NotBlank @Size(max=160) String title,@Min(1) @Max(180) int durationMinutes){}
 public record Option(@NotBlank @Pattern(regexp="[ABCD]") String optionCode,@NotBlank @Size(max=300) String optionText,boolean isCorrect){}
 public record Question(@NotBlank @Size(max=1000) String questionText,@NotBlank @Size(max=60) String category,@NotBlank @Pattern(regexp="Easy|Medium|Hard") String difficulty,@NotNull @Size(max=4) List<@Valid Option> options){}
 public record Weight(@Positive int questionId,@Min(1) @Max(32767) int questionOrder,@NotNull @DecimalMin("0.01") @DecimalMax("9999.99") @Digits(integer=4,fraction=2) BigDecimal points){}
 public record Structure(@NotNull @Size(max=500) List<@Valid Weight> questions){}
 public record Assignment(@Positive int classId,@NotNull Instant opensAt,@NotNull Instant closesAt,@Min(1) @Max(10) int maxAttempts,boolean isActive){}
 public record ClassAssignment(@Positive int examId,@NotNull Instant opensAt,@NotNull Instant closesAt,@Min(1) @Max(10) int maxAttempts,boolean isActive){}
 public record Enrollment(@NotBlank @Email @Size(max=200) String email,boolean isActive){}
 public record ClassRecord(@NotBlank @Size(max=20) @Pattern(regexp="[A-Za-z0-9_-]+") String classCode,@NotBlank @Size(max=100) String className,boolean isActive){}
}
