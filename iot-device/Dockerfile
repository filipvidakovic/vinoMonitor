# Simulator IoT uređaja (bez hardvera) - za razvoj i demo.
# Na pravom Raspberry Pi-ju koristi se systemd servis (vinomonitor-iot.service).
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY vinomonitor_iot ./vinomonitor_iot

RUN useradd -m -u 1000 appuser
USER appuser

CMD ["python", "-m", "vinomonitor_iot", "--config", "/config/settings.json", "--simulate"]
