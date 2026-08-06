# vendor — SWDR009 (lr1121_modemE_driver)

Colocar aquí el SDK C oficial de Semtech para el firmware Modem-E del LR1121.

## Cómo obtenerlo

```bash
# Clonar en vendor/lr1121_modemE_driver/
git clone https://github.com/Lora-net/SWL2001.git vendor/lr1121_modemE_driver
```

> **Nota**: el repositorio oficial de SWDR009 puede estar en `Lora-net/SWL2001` o
> `Semtech/SWDR009`. Verificar el MD5 del binario descargado contra el publicado
> por Semtech antes de usarlo.

## Versión requerida

- **SWDR009 v2.0.0** — compatible con Modem-E v2.1.0

## Estructura esperada

Después del clone, `build.rs` buscará:
```
vendor/lr1121_modemE_driver/
└── lr1121_modem/
    ├── lr1121_modem_lorawan.h
    ├── lr1121_modem_common.h
    └── *.c   (fuentes C del driver)
```

## Firmware Modem-E

El binario `lr1121_modem_v2.1.0.bin` se descarga de:
```
https://github.com/Lora-net/radio_firmware_images
```

Flash procedure: ver tarea 1.1 y `hardware/flashing-modem-e.md`.
