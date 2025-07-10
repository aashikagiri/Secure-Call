#!/bin/bash

echo "Starting SecureCall application..."

# Wait for database to be ready
echo "Waiting for database to be ready..."
while ! pg_isready -h db -p 5432 -U videocall_user; do
  echo "Database is not ready yet. Waiting..."
  sleep 2
done

echo "Database is ready! Starting Flask application..."
python app.py
