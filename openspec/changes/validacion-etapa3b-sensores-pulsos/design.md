# Design: validacion-etapa3b-sensores-pulsos

## Context

Los sensores de pulsos usan reed switches que cierran el circuito brevemente en cada evento (cucharada del pluviómetro o vuelta del anemómetro). El ESP32 detecta el flanco de bajada via ISR GPIO y acumula el conteo en un contador atómico. En cada ciclo de envío, el firmware lee y resetea los contadores, construye el payload y los envía como `lluvia_pulsos` y `viento_pulsos`.

La veleta usa un potenciómetro resistivo cuya salida varía con la dirección del viento. La tensión se lee via ADC1 y se convierte a grados o sector cardinal (N/NE/E/SE/S/SO/O/NO) según la curva de calibración del sensor.

El payload de 14 bytes ya contempla estos campos. Si `veleta-wind-direction` agrega un campo de dirección, podría requerir un cambio de formato de payload (breaking change) — se documenta como riesgo.

Flujo de datos:
```
Pluviómetro (reed switch) → GPIO ISR → contador lluvia_pulsos
Anemómetro (reed switch)  → GPIO ISR → contador viento_pulsos
Veleta (potenciómetro)    → ADC1     → dirección_viento (grados o sector)
        ↓
sensor-node: construye payload 14 bytes con valores reales
        ↓
lr1121-modem-e → RF AU915 → gateway → ChirpStack → InfluxDB
```

## Goals / Non-Goals

**Goals:**
- Verificar que los ISR de pluviómetro y anemómetro cuentan pulsos sin rebote (debounce en firmware)
- Verificar que la veleta ADC cubre el rango completo (0–360° o todos los sectores cardinales)
- Confirmar que `lluvia_pulsos` y `viento_pulsos` en InfluxDB corresponden a los eventos físicos generados
- Completar la integración de todos los sensores: la estación está operativa

**Non-Goals:**
- No se hace calibración fina de la relación pulso/mm o pulso/km·h⁻¹ (eso es para el informe)
- No se valida el enclosure 3D ni la estanqueidad al agua
- No se evalúa el comportamiento bajo lluvia real o viento real de alta intensidad
- No se hace prueba de duración larga (test de 24 h en campo)

## Decisions

**Verificación manual de pulsos**: Para el pluviómetro, agitar manualmente para generar N cucharadas y verificar que `lluvia_pulsos = N` en el log. Para el anemómetro, girar manualmente N vueltas y verificar `viento_pulsos = N`. Es el método más directo para validar el conteo ISR.

**Debounce en firmware (no en hardware)**: La solución de debounce por software (ignorar pulsos dentro de N ms del último) es suficiente para sensores meteorológicos cuya frecuencia máxima es baja (pluviómetro: < 1 pulso/s en lluvia intensa; anemómetro: < 10 pulsos/s a velocidades extremas).

**Veleta en sectores cardinales**: Para la validación, se verifica que la veleta da lecturas diferentes para N, E, S, O. No se requiere calibración exacta en esta etapa.

## Risks / Trade-offs

**[Riesgo] Driver de pulsos ISR no implementado en `firmware-sensor-drivers`** → Bloqueador. Esta etapa requiere que las tareas de ISR de pluviómetro y anemómetro en `firmware-sensor-drivers` estén completas.

**[Riesgo] Rebote del reed switch genera pulsos falsos** → Mitigación: ajustar el tiempo de debounce en `firmware/src/pulse.rs`. Verificar con osciloscopio si el problema persiste.

**[Riesgo] Cables de campo largos generan interferencia en las líneas ISR** → Mitigación: usar pull-up en los pines ISR (ya previsto en el diseño). Si hay interferencia, agregar filtro RC de 100 Ω + 100 nF en la entrada.

**[Riesgo] `veleta-wind-direction` requiere cambio de formato de payload (campo adicional)** → Si el campo de dirección de viento no cabe en los 14 bytes actuales, será un breaking change de payload. Documentar la decisión antes de implementar y abrir un change específico si es necesario.

## Open Questions

- OQ1: ¿Qué GPIOs se usan para el ISR del pluviómetro y el anemómetro? El netlist actual no los especifica. Sugerencia: GPIO32 (pluviómetro) y GPIO33 (anemómetro), ambos con pull-up interno.
- OQ2: ¿La veleta agrega un campo al payload de 14 bytes, o se transmite en un FPort separado? Depende de la implementación en `veleta-wind-direction`.
