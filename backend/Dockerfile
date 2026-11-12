FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:21-jre-jammy
RUN useradd --system --uid 10001 --create-home exam
WORKDIR /app
COPY --from=build --chown=exam:exam /build/target/english-exam-api-1.0.0.jar app.jar
USER exam
ENV SERVER_ADDRESS=0.0.0.0 PORT=8081 COOKIE_SECURE=true
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:InitialRAMPercentage=20 -Duser.timezone=UTC"
EXPOSE 8081
ENTRYPOINT ["java","-jar","app.jar"]
