# vendor — SWDR001 (lr11xx_driver)

Colocar aquí el SDK C oficial de Semtech para el LR1121 en modo transceiver.

## Cómo obtenerlo

```bash
# Versión recomendada: tag más reciente (última actualización octubre 2025)
git clone https://github.com/Lora-net/SWDR001.git vendor/lr11xx_driver
```

## Versión requerida

- **SWDR001** — tag `v2.4.x` o superior (compatible con LR1121 chip rev C+)

## Estructura esperada

Después del clone, `build.rs` buscará:
```
vendor/lr11xx_driver/
└── src/
    ├── lr11xx_radio.h
    ├── lr11xx_system.h
    ├── lr11xx_regmem.h
    └── **/*.c   (fuentes C del driver)
```

## Nota sobre modos del chip

Este crate requiere que el LR1121 esté en **modo transceiver** (firmware de fábrica).
Si el chip tiene Modem-E flashed, `Lr1121Transceiver::new()` retornará
`Err(TransceiverError::ModemEDetected)`.

Para el **nodo sensor** (que usa Modem-E), usar el crate `lr1121-modem-e`.
