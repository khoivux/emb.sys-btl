FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Default environment variables
ENV PYTHONUNBUFFERED=1
ENV MQTT_HOST=mqtt_broker

# Expose Django port
EXPOSE 8000

# The actual command will be specified in docker-compose (daphne or mqtt_listener)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "core.asgi:application"]
