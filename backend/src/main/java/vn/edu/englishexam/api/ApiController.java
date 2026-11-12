package vn.edu.englishexam.api;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.web.csrf.CsrfToken;
import vn.edu.englishexam.security.Identity;
import vn.edu.englishexam.service.*;
import vn.edu.englishexam.persistence.SqlStore;
@RestController
@RequestMapping("/api")
public class ApiController {
 private final Identity identity;private final StudentService student;private final TeacherService teacher;private final SqlStore db;
 public ApiController(Identity identity,StudentService student,TeacherService teacher,SqlStore db){this.identity=identity;this.student=student;this.teacher=teacher;this.db=db;}
 @GetMapping("/public/status") public Object status(){return Map.of("name","English Exam","serverNow",db.now(),"authentication","OIDC");}
 @GetMapping("/auth/csrf") public Object csrf(CsrfToken token){return Map.of("token",token.getToken(),"headerName",token.getHeaderName(),"parameterName",token.getParameterName());}
 @GetMapping("/me") public Object me(){return identity.current();}
 @GetMapping("/student/classes") public Object classes(){return student.classes(identity.student().userId());}
 @GetMapping("/student/exams") public Object exams(){return Map.of("items",student.exams(identity.student().userId()),"serverNow",db.now());}
 @GetMapping("/student/attempts") public Object history(@RequestParam(defaultValue="0") @Min(0) @Max(10000) int page){return student.history(identity.student().userId(),page);}
 @PostMapping("/student/attempts") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
 public Object start(@Valid @RequestBody Requests.Start body){return Map.of("attemptId",student.start(identity.student().userId(),body.examId(),body.classId()));}
 @GetMapping("/student/attempts/{id}") public Object attempt(@PathVariable int id){return student.attempt(identity.student().userId(),id);}
 @PutMapping("/student/attempts/{id}/answers/{question}") public Object save(@PathVariable int id,@PathVariable int question,@Valid @RequestBody Requests.Answer body){return student.save(identity.student().userId(),id,question,body.optionCode());}
 @PostMapping("/student/attempts/{id}/submit") public Object submit(@PathVariable int id){return student.submit(identity.student().userId(),id);}
 @GetMapping("/student/attempts/{id}/result") public Object result(@PathVariable int id){return student.result(identity.student().userId(),id);}
 @GetMapping("/teacher/classes") public Object teacherClasses(){return teacher.classes(identity.teacher().userId());}
 @PostMapping("/teacher/classes") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
 public Object createClass(@Valid @RequestBody Requests.ClassRecord body){return Map.of("classId",teacher.createClass(identity.teacher().userId(),body));}
 @GetMapping("/teacher/classes/{id}") public Object teacherClass(@PathVariable int id){return teacher.classDetails(identity.teacher().userId(),id);}
 @PutMapping("/teacher/classes/{id}") public void editClass(@PathVariable int id,@Valid @RequestBody Requests.ClassRecord body){teacher.editClass(identity.teacher().userId(),id,body);}
 @GetMapping("/teacher/classes/{id}/exams") public Object teacherClassExams(@PathVariable int id){return teacher.classExams(identity.teacher().userId(),id);}
 @PostMapping("/teacher/classes/{id}/assignments") public void assignToClass(@PathVariable int id,@Valid @RequestBody Requests.ClassAssignment body){teacher.assignToClass(identity.teacher().userId(),id,body);}
 @GetMapping("/teacher/classes/{id}/students") public Object participants(@PathVariable int id){return teacher.participants(identity.teacher().userId(),id);}
 @PutMapping("/teacher/classes/{id}/enrollments") public void enroll(@PathVariable int id,@Valid @RequestBody Requests.Enrollment body){teacher.enroll(identity.teacher().userId(),id,body);}
 @DeleteMapping("/teacher/classes/{id}/enrollments/{studentId}") public void removeEnrollment(@PathVariable int id,@PathVariable int studentId){teacher.removeEnrollment(identity.teacher().userId(),id,studentId);}
 @GetMapping("/teacher/exams") public Object teacherExams(@RequestParam(defaultValue="0") @Min(0) @Max(10000) int page){return teacher.exams(identity.teacher().userId(),page);}
 @GetMapping("/teacher/exams/{id}") public Object teacherExam(@PathVariable int id){return teacher.exam(identity.teacher().userId(),id);}
 @PostMapping("/teacher/exams") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
 public Object createExam(@Valid @RequestBody Requests.Exam body){return Map.of("examId",teacher.createExam(identity.teacher().userId(),body));}
 @PutMapping("/teacher/exams/{id}") public void editExam(@PathVariable int id,@Valid @RequestBody Requests.Exam body){teacher.editExam(identity.teacher().userId(),id,body);}
 @PutMapping("/teacher/exams/{id}/questions") public void structure(@PathVariable int id,@Valid @RequestBody Requests.Structure body){teacher.structure(identity.teacher().userId(),id,body);}
 @PostMapping("/teacher/exams/{id}/publish") public void publish(@PathVariable int id){teacher.publish(identity.teacher().userId(),id);}
 @PutMapping("/teacher/exams/{id}/assignments") public void assign(@PathVariable int id,@Valid @RequestBody Requests.Assignment body){teacher.assign(identity.teacher().userId(),id,body);}
 @GetMapping("/teacher/questions") public Object questions(@RequestParam(defaultValue="0") @Min(0) @Max(10000) int page,@RequestParam(defaultValue="") @Size(max=100) String search){return teacher.questions(identity.teacher().userId(),page,search);}
 @GetMapping("/teacher/questions/{id}") public Object question(@PathVariable int id){return teacher.question(identity.teacher().userId(),id);}
 @PostMapping("/teacher/questions") @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
 public Object createQuestion(@Valid @RequestBody Requests.Question body){return Map.of("questionId",teacher.saveQuestion(identity.teacher().userId(),null,body));}
 @PutMapping("/teacher/questions/{id}") public void editQuestion(@PathVariable int id,@Valid @RequestBody Requests.Question body){teacher.saveQuestion(identity.teacher().userId(),id,body);}
 @GetMapping("/teacher/results") public Object results(@RequestParam(defaultValue="0") @Min(0) @Max(10000) int page,
  @RequestParam(required=false) Integer classId,
  @RequestParam(required=false) Integer examId,
  @RequestParam(required=false) String status,
  @RequestParam(defaultValue="") @Size(max=100) String search){
  return teacher.results(identity.teacher().userId(),page,classId,examId,status!=null&&!status.isBlank()?status:null,search);
 }
}
