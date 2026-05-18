FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libgomp1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir python-multipart
COPY . .
ENV MPLBACKEND=Agg
ENV PORT=8000
CMD ["python", "start.py"]
