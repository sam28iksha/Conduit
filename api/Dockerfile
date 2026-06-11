FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir \
    uvicorn \
    fastapi \
    python-dotenv \
    google-cloud-aiplatform \
    google-generativeai \
    google-adk \
    opentelemetry-sdk \
    arize-phoenix-otel \
    openinference-instrumentation-google-adk \
    requests
EXPOSE 8080
CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "8080"]
