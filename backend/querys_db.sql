/* stations*/

INSERT INTO stations (id, name, location, status)
VALUES
    ('alpha', 'Alpha Base Station', 'Mendoza, Argentina', 'online'),
    ('beta', 'Beta Weather Node', 'Córdoba, Argentina', 'online'),
    ('gamma', 'Gamma Mountain Station', 'Bariloche, Argentina', 'degraded');

/* Readings (Alpha)*/
INSERT INTO readings (
    id,
    station_id,
    timestamp,
    temperature,
    humidity,
    wind_speed,
    wind_direction,
    precipitation
)
VALUES
    (
        gen_random_uuid(),
        'alpha',
        '2026-06-26 08:00:00-03',
        12.5,
        82,
        8.3,
        'NE',
        0
    ),
    (
        gen_random_uuid(),
        'alpha',
        '2026-06-26 10:00:00-03',
        15.2,
        76,
        12.1,
        'N',
        0
    ),
    (
        gen_random_uuid(),
        'alpha',
        '2026-06-26 12:00:00-03',
        18.8,
        68,
        15.4,
        'NW',
        0
    ),
    (
        gen_random_uuid(),
        'alpha',
        '2026-06-26 14:00:00-03',
        24.8,
        61,
        18.4,
        'NE',
        12.6
    ),
    (
        gen_random_uuid(),
        'alpha',
        '2026-06-26 16:00:00-03',
        22.1,
        64,
        14.8,
        'E',
        0
    );

/* Readings (Beta)*/

INSERT INTO readings (
    id,
    station_id,
    timestamp,
    temperature,
    humidity,
    wind_speed,
    wind_direction,
    precipitation
)
VALUES
    (
        gen_random_uuid(),
        'beta',
        '2026-06-26 08:00:00-03',
        10.2,
        88,
        5.4,
        'SE',
        1.2
    ),
    (
        gen_random_uuid(),
        'beta',
        '2026-06-26 12:00:00-03',
        16.4,
        71,
        9.7,
        'S',
        0
    ),
    (
        gen_random_uuid(),
        'beta',
        '2026-06-26 16:00:00-03',
        19.3,
        65,
        11.8,
        'SW',
        0
    );

/* Readings (Gamma)*/

INSERT INTO readings (
    id,
    station_id,
    timestamp,
    temperature,
    humidity,
    wind_speed,
    wind_direction,
    precipitation
)
VALUES
    (
        gen_random_uuid(),
        'gamma',
        '2026-06-26 09:00:00-03',
        4.1,
        92,
        28.7,
        'W',
        8.4
    ),
    (
        gen_random_uuid(),
        'gamma',
        '2026-06-26 13:00:00-03',
        7.8,
        84,
        32.5,
        'NW',
        0
    );

/* para los últimos 30 días*/
INSERT INTO readings (
    id,
    station_id,
    timestamp,
    temperature,
    humidity,
    wind_speed,
    wind_direction,
    precipitation
)
SELECT
    gen_random_uuid(),
    'alpha',
    NOW() - (n || ' days')::interval,
    10 + random() * 15,
    50 + random() * 40,
    5 + random() * 20,
    'NE',
    random() * 10
FROM generate_series(1,30) n;

/*para lectura de 24hs */
INSERT INTO readings (
    id,
    station_id,
    timestamp,
    temperature,
    humidity,
    wind_speed,
    wind_direction,
    precipitation
)
SELECT
    gen_random_uuid(),
    'alpha',
    date_trunc('hour', NOW()) - (n || ' hours')::interval,
    12 + random() * 10,
    55 + random() * 20,
    5 + random() * 15,
    'NE',
    random() * 2
FROM generate_series(0,24) n;
