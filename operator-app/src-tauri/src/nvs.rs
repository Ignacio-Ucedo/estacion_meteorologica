/// Generador de partición NVS compatible con ESP-IDF v1 (sin multipage blob).
///
/// Implementa el mismo formato binario que `nvs_partition_gen.py --version 1`.
/// Referencias: esp-idf/components/nvs_flash/src/nvs_page.cpp
///
/// Formato de partición:
/// - Tamaño estándar: 0x6000 bytes (6 páginas × 4096 bytes)
/// - Solo se utiliza la página 0; el resto queda como 0xFF
/// - Cabecera de página [0..32): estado, seq_num, versión, CRC32
/// - Tabla de estado de entradas [32..64): 2 bits por entrada
/// - Entradas [64..4096): bloques de 32 bytes (meta + datos raw)

const PAGE_SIZE: usize = 4096;
const PAGE_HDR_SIZE: usize = 32;
const ENTRY_TABLE_OFFSET: usize = PAGE_HDR_SIZE;
const ENTRIES_OFFSET: usize = PAGE_HDR_SIZE + 32; // = 64
const ENTRY_SIZE: usize = 32;

// Estados de página
const PAGE_STATE_ACTIVE: u32 = 0xFFFFFFFE;

// Versiones de formato
const NVS_VERSION1: u8 = 0xFF; // Multipage blob deshabilitado
const NVS_CHUNK_ANY: u8 = 0xFF;

// Tipos de dato NVS
const TYPE_U8: u8 = 0x01;
const TYPE_STR: u8 = 0x21;
const TYPE_BLOB: u8 = 0x41;

/// Parámetros para generar la partición NVS.
#[derive(Debug, serde::Deserialize)]
pub struct NvsParams {
    /// Device EUI — 16 hex chars (ej: "70B3D5FFFE000001")
    pub dev_eui_hex: String,
    /// Application/Join EUI — 16 hex chars (ej: "0000000000000000")
    pub app_eui_hex: String,
    /// Application Key — 32 hex chars (ej: "00112233...")
    pub app_key_hex: String,
    /// SSID de la red WiFi (string)
    pub wifi_ssid: String,
    /// Contraseña WiFi (string)
    pub wifi_pass: String,
    /// Host del ChirpStack Gateway Bridge (ej: "192.168.1.10:1700").
    /// Solo para gateways; vacío en nodos sensor.
    pub chirpstack_host: String,
}

/// Genera el binario de partición NVS con los parámetros dados.
/// Retorna los bytes listos para flashear en la dirección 0x9000.
pub fn generate(params: &NvsParams) -> Result<Vec<u8>, String> {
    let dev_eui = hex_to_bytes(&params.dev_eui_hex, 8)?;
    let app_eui = hex_to_bytes(&params.app_eui_hex, 8)?;
    let app_key = hex_to_bytes(&params.app_key_hex, 16)?;

    let ssid_bytes = string_with_null(&params.wifi_ssid);
    let pass_bytes = string_with_null(&params.wifi_pass);

    let mut page = vec![0xFF_u8; PAGE_SIZE];

    write_page_header(&mut page, 0);

    let mut entry_idx = 0usize;

    // Namespace: lorawan (índice 1)
    write_namespace_entry(&mut page, &mut entry_idx, "lorawan", 1)?;
    write_var_entry(&mut page, &mut entry_idx, 1, TYPE_BLOB, "dev_eui", &dev_eui)?;
    write_var_entry(&mut page, &mut entry_idx, 1, TYPE_BLOB, "app_eui", &app_eui)?;
    write_var_entry(&mut page, &mut entry_idx, 1, TYPE_BLOB, "app_key", &app_key)?;

    // Namespace: wifi (índice 2)
    write_namespace_entry(&mut page, &mut entry_idx, "wifi", 2)?;
    write_var_entry(&mut page, &mut entry_idx, 2, TYPE_STR, "ssid", &ssid_bytes)?;
    write_var_entry(&mut page, &mut entry_idx, 2, TYPE_STR, "pass", &pass_bytes)?;

    // Namespace: config (índice 3) — solo cuando hay host ChirpStack (gateways)
    if !params.chirpstack_host.is_empty() {
        let host_bytes = string_with_null(&params.chirpstack_host);
        write_namespace_entry(&mut page, &mut entry_idx, "config", 3)?;
        write_var_entry(&mut page, &mut entry_idx, 3, TYPE_STR, "gw_host", &host_bytes)?;
    }

    // Resto del binario de partición: páginas 1..5 ya son 0xFF (sin datos)
    let mut partition = page;
    partition.resize(0x6000, 0xFF);

    Ok(partition)
}

// ── Helpers internos ──────────────────────────────────────────────────────────

fn write_page_header(page: &mut Vec<u8>, seq_num: u32) {
    let mut hdr = [0xFF_u8; PAGE_HDR_SIZE];
    hdr[0..4].copy_from_slice(&PAGE_STATE_ACTIVE.to_le_bytes());
    hdr[4..8].copy_from_slice(&seq_num.to_le_bytes());
    hdr[8] = NVS_VERSION1;
    // bytes [9..28]: ya son 0xFF
    let crc = nvs_crc32(&hdr[4..28]);
    hdr[28..32].copy_from_slice(&crc.to_le_bytes());
    page[0..PAGE_HDR_SIZE].copy_from_slice(&hdr);
}

fn write_namespace_entry(
    page: &mut Vec<u8>,
    entry_idx: &mut usize,
    name: &str,
    ns_idx: u8,
) -> Result<(), String> {
    if name.len() > 15 {
        return Err(format!("Nombre de namespace demasiado largo: '{name}'"));
    }
    let mut entry = [0xFF_u8; ENTRY_SIZE];
    entry[0] = 0x00; // ns_index = 0 para entradas de namespace
    entry[1] = TYPE_U8;
    entry[2] = 1; // span = 1
    entry[3] = NVS_CHUNK_ANY;
    write_key(&mut entry, name);
    entry[24] = ns_idx; // valor = índice asignado
    // [25..32] = 0xFF (ya inicializado)
    let crc = entry_crc32(&entry);
    entry[4..8].copy_from_slice(&crc.to_le_bytes());

    push_entry(page, entry_idx, &entry);
    Ok(())
}

fn write_var_entry(
    page: &mut Vec<u8>,
    entry_idx: &mut usize,
    ns_idx: u8,
    type_byte: u8,
    key: &str,
    data: &[u8],
) -> Result<(), String> {
    if key.len() > 15 {
        return Err(format!("Clave demasiado larga: '{key}'"));
    }
    let data_size = data.len();
    let rounded = ((data_size + 31) / 32) * 32;
    let span = (1 + rounded / 32) as u8;

    let data_crc = nvs_crc32(data);

    let mut meta = [0xFF_u8; ENTRY_SIZE];
    meta[0] = ns_idx;
    meta[1] = type_byte;
    meta[2] = span;
    meta[3] = NVS_CHUNK_ANY;
    write_key(&mut meta, key);
    meta[24..26].copy_from_slice(&(data_size as u16).to_le_bytes());
    // meta[26..28] = 0xFF (reservado)
    meta[28..32].copy_from_slice(&data_crc.to_le_bytes());
    let crc = entry_crc32(&meta);
    meta[4..8].copy_from_slice(&crc.to_le_bytes());

    push_entry(page, entry_idx, &meta);

    // Entradas de datos raw (paddeadas con 0xFF)
    let mut padded = vec![0xFF_u8; rounded];
    padded[..data_size].copy_from_slice(data);
    for chunk in padded.chunks_exact(32) {
        let mut raw = [0xFF_u8; ENTRY_SIZE];
        raw.copy_from_slice(chunk);
        push_entry(page, entry_idx, &raw);
    }

    Ok(())
}

/// Escribe una entrada de 32 bytes en la posición entry_idx y actualiza la tabla de estado.
fn push_entry(page: &mut Vec<u8>, entry_idx: &mut usize, entry: &[u8; ENTRY_SIZE]) {
    mark_written(page, *entry_idx);
    let offset = ENTRIES_OFFSET + *entry_idx * ENTRY_SIZE;
    page[offset..offset + ENTRY_SIZE].copy_from_slice(entry);
    *entry_idx += 1;
}

/// Marca la entrada j como WRITTEN (10b) en la tabla de estado de entradas.
/// La tabla usa 2 bits por entrada; un bit 0 del par se pone en 0: 11→10.
fn mark_written(page: &mut Vec<u8>, j: usize) {
    let byte_pos = ENTRY_TABLE_OFFSET + j / 4;
    let bit_pos = (j % 4) * 2; // bit 0 del par
    page[byte_pos] &= !(1_u8 << bit_pos);
}

/// Escribe el nombre de la clave en los bytes [8..24] de la entrada (null-terminado).
fn write_key(entry: &mut [u8; ENTRY_SIZE], key: &str) {
    let kb = key.as_bytes();
    entry[8..8 + kb.len()].copy_from_slice(kb);
    if kb.len() < 16 {
        entry[8 + kb.len()] = 0; // null terminator
    }
    // resto del campo key ya es 0xFF; lo dejamos o ponemos 0x00
    // (nvs_partition_gen.py los deja en 0x00 también)
    for i in (8 + kb.len() + 1)..24 {
        entry[i] = 0x00;
    }
}

/// Equivalente a `zlib.crc32(data, 0xFFFFFFFF) & 0xFFFFFFFF` de Python.
///
/// CPython implementa `zlib.crc32(data, value)` como:
///   `raw_crc32(value ^ 0xFFFFFFFF, data) ^ 0xFFFFFFFF`
/// Para value=0xFFFFFFFF: `raw_crc32(0, data) ^ 0xFFFFFFFF`.
/// Por eso el estado inicial es 0 (no 0xFFFFFFFF) y hay XOR final.
fn nvs_crc32(data: &[u8]) -> u32 {
    let mut crc = 0u32;
    for &byte in data {
        crc ^= u32::from(byte);
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xEDB8_8320;
            } else {
                crc >>= 1;
            }
        }
    }
    crc ^ 0xFFFF_FFFF
}

/// CRC de una entrada NVS: cubre bytes [0..4] || [8..32] (excluye el campo crc).
fn entry_crc32(entry: &[u8; ENTRY_SIZE]) -> u32 {
    let mut buf = [0u8; 28];
    buf[0..4].copy_from_slice(&entry[0..4]);
    buf[4..28].copy_from_slice(&entry[8..32]);
    nvs_crc32(&buf)
}

/// Convierte un string hexadecimal a bytes con validación de longitud.
fn hex_to_bytes(hex: &str, expected_len: usize) -> Result<Vec<u8>, String> {
    let hex = hex.trim().replace(['-', ':'], "");
    if hex.len() != expected_len * 2 {
        return Err(format!(
            "Longitud inválida: '{}' debe tener {} chars hex (={} bytes)",
            hex,
            expected_len * 2,
            expected_len
        ));
    }
    (0..expected_len)
        .map(|i| {
            u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16)
                .map_err(|_| format!("Carácter hex inválido en '{hex}'"))
        })
        .collect()
}

/// Convierte un string a bytes UTF-8 con null terminator.
fn string_with_null(s: &str) -> Vec<u8> {
    let mut v = s.as_bytes().to_vec();
    v.push(0);
    v
}

// ── Tests ──────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn test_params() -> NvsParams {
        NvsParams {
            dev_eui_hex: "70B3D5FFFE000001".to_string(),
            app_eui_hex: "0000000000000000".to_string(),
            app_key_hex: "00112233445566778899AABBCCDDEEFF".to_string(),
            wifi_ssid: "TestWiFi".to_string(),
            wifi_pass: "password123".to_string(),
            chirpstack_host: String::new(),
        }
    }

    fn gateway_params() -> NvsParams {
        NvsParams {
            dev_eui_hex: "0000000000000000".to_string(),
            app_eui_hex: "0000000000000000".to_string(),
            app_key_hex: "00000000000000000000000000000000".to_string(),
            wifi_ssid: "GwWiFi".to_string(),
            wifi_pass: "gwpass".to_string(),
            chirpstack_host: "192.168.1.10:1700".to_string(),
        }
    }

    #[test]
    fn test_generate_size() {
        let bin = generate(&test_params()).unwrap();
        assert_eq!(bin.len(), 0x6000);
    }

    #[test]
    fn test_page_header_state() {
        let bin = generate(&test_params()).unwrap();
        let state = u32::from_le_bytes(bin[0..4].try_into().unwrap());
        assert_eq!(state, PAGE_STATE_ACTIVE);
    }

    #[test]
    fn test_page_header_crc() {
        let bin = generate(&test_params()).unwrap();
        let stored_crc = u32::from_le_bytes(bin[28..32].try_into().unwrap());
        let computed_crc = nvs_crc32(&bin[4..28]);
        assert_eq!(stored_crc, computed_crc, "CRC de cabecera de página incorrecto");
    }

    #[test]
    fn test_entry_table_12_entries_written() {
        let bin = generate(&test_params()).unwrap();
        // 12 entradas escritas → 3 bytes de 0xAA + resto 0xFF
        assert_eq!(bin[32], 0xAA, "byte 0 de tabla de entradas");
        assert_eq!(bin[33], 0xAA, "byte 1 de tabla de entradas");
        assert_eq!(bin[34], 0xAA, "byte 2 de tabla de entradas");
        assert_eq!(bin[35], 0xFF, "byte 3 de tabla (entradas vacías)");
    }

    #[test]
    fn test_namespace_lorawan_entry() {
        let bin = generate(&test_params()).unwrap();
        let off = ENTRIES_OFFSET; // entry 0
        assert_eq!(bin[off], 0x00, "ns_index de entrada namespace = 0");
        assert_eq!(bin[off + 1], TYPE_U8);
        assert_eq!(bin[off + 2], 1, "span");
        assert_eq!(&bin[off + 8..off + 15], b"lorawan");
        assert_eq!(bin[off + 24], 1, "índice asignado del namespace lorawan");
    }

    #[test]
    fn test_dev_eui_blob_meta() {
        let bin = generate(&test_params()).unwrap();
        let off = ENTRIES_OFFSET + ENTRY_SIZE; // entry 1
        assert_eq!(bin[off], 1, "ns_index = lorawan (1)");
        assert_eq!(bin[off + 1], TYPE_BLOB);
        assert_eq!(bin[off + 2], 2, "span = 2");
        assert_eq!(&bin[off + 8..off + 15], b"dev_eui");
        let data_size = u16::from_le_bytes(bin[off + 24..off + 26].try_into().unwrap());
        assert_eq!(data_size, 8);
    }

    #[test]
    fn test_dev_eui_blob_data() {
        let bin = generate(&test_params()).unwrap();
        let off = ENTRIES_OFFSET + 2 * ENTRY_SIZE; // entry 2 (datos)
        let expected = bytes_from_hex("70B3D5FFFE000001");
        assert_eq!(&bin[off..off + 8], &expected);
    }

    #[test]
    fn test_all_entry_crcs_valid() {
        let bin = generate(&test_params()).unwrap();
        // Solo las entradas meta tienen CRC; las de datos raw son bytes sin estructura.
        // Meta entries: 0 (ns lorawan), 1 (dev_eui), 3 (app_eui), 5 (app_key),
        //               7 (ns wifi), 8 (ssid), 10 (pass)
        let meta_entries = [0, 1, 3, 5, 7, 8, 10];
        for &i in &meta_entries {
            let off = ENTRIES_OFFSET + i * ENTRY_SIZE;
            let entry: [u8; 32] = bin[off..off + 32].try_into().unwrap();
            let stored = u32::from_le_bytes(entry[4..8].try_into().unwrap());
            let computed = entry_crc32(&entry);
            assert_eq!(stored, computed, "CRC incorrecto en entrada {i}");
        }
    }

    #[test]
    fn test_wifi_ssid_string() {
        let bin = generate(&test_params()).unwrap();
        // wifi namespace = entry 7, ssid meta = entry 8, ssid data = entry 9
        let off_meta = ENTRIES_OFFSET + 8 * ENTRY_SIZE;
        assert_eq!(bin[off_meta], 2, "ns_index = wifi (2)");
        assert_eq!(bin[off_meta + 1], TYPE_STR);
        let data_size = u16::from_le_bytes(bin[off_meta + 24..off_meta + 26].try_into().unwrap());
        assert_eq!(data_size, 9, "len('TestWiFi') + 1 null = 9");

        let off_data = ENTRIES_OFFSET + 9 * ENTRY_SIZE;
        assert_eq!(&bin[off_data..off_data + 9], b"TestWiFi\0");
    }

    #[test]
    fn test_pages_after_first_are_erased() {
        let bin = generate(&test_params()).unwrap();
        assert!(
            bin[PAGE_SIZE..].iter().all(|&b| b == 0xFF),
            "páginas 1..5 deben ser 0xFF"
        );
    }

    fn bytes_from_hex(hex: &str) -> Vec<u8> {
        (0..hex.len() / 2)
            .map(|i| u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).unwrap())
            .collect()
    }

    #[test]
    fn test_gateway_gw_host_entry() {
        let bin = generate(&gateway_params()).unwrap();
        // Layout: lorawan(0) + dev_eui(1,2) + app_eui(3,4) + app_key(5,6)
        //       + wifi(7) + ssid(8,9) + pass(10,11) + config(12) + gw_host(13,14)
        let off_ns = ENTRIES_OFFSET + 12 * ENTRY_SIZE;
        assert_eq!(bin[off_ns], 0x00, "namespace entry has ns_index = 0");
        assert_eq!(bin[off_ns + 1], TYPE_U8);
        assert_eq!(&bin[off_ns + 8..off_ns + 8 + 6], b"config");

        let off_meta = ENTRIES_OFFSET + 13 * ENTRY_SIZE;
        assert_eq!(bin[off_meta], 3, "ns_index = config (3)");
        assert_eq!(bin[off_meta + 1], TYPE_STR);
        assert_eq!(&bin[off_meta + 8..off_meta + 8 + 7], b"gw_host");
        let data_size = u16::from_le_bytes(bin[off_meta + 24..off_meta + 26].try_into().unwrap());
        // "192.168.1.10:1700" = 17 chars + 1 null = 18
        assert_eq!(data_size, 18);

        let off_data = ENTRIES_OFFSET + 14 * ENTRY_SIZE;
        assert_eq!(&bin[off_data..off_data + 18], b"192.168.1.10:1700\0");
    }
}
