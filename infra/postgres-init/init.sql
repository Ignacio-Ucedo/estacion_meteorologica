-- ChirpStack necesita la extensión pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Base de datos del backend WeatherOS
CREATE USER weatheros WITH PASSWORD 'weatheros';
CREATE DATABASE weatheros OWNER weatheros;
GRANT ALL PRIVILEGES ON DATABASE weatheros TO weatheros;
