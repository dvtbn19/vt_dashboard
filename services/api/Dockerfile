# Production image for the API (always-on container host). Runs migrations, then uvicorn.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml ./
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
RUN pip install --no-cache-dir . && useradd --create-home lab
USER lab
EXPOSE 8000
# The container platform maps its public port to 8000; inside a container 0.0.0.0 is required.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]
