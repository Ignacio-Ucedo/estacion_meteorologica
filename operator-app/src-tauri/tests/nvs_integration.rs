/// Test de integración: compara la salida del generador NVS de Rust contra el
/// binario de referencia producido por `nvs_partition_gen.py --version 1`.
///
/// CSV de referencia:
///   lorawan → dev_eui=70B3D5FFFE000001, app_eui=0000000000000000,
///             app_key=00112233445566778899AABBCCDDEEFF
///   wifi    → ssid=TestWiFi, pass=password123

use operator_app_lib::nvs::{NvsParams, generate};

#[test]
fn nvs_output_matches_reference_binary() {
    let params = NvsParams {
        dev_eui_hex: "70B3D5FFFE000001".to_string(),
        app_eui_hex: "0000000000000000".to_string(),
        app_key_hex: "00112233445566778899AABBCCDDEEFF".to_string(),
        wifi_ssid:   "TestWiFi".to_string(),
        wifi_pass:   "password123".to_string(),
    };

    let generated = generate(&params).expect("Error generando NVS bin");

    let reference = std::fs::read(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/test_nvs_reference.bin"
    ))
    .expect("No se pudo leer el binario de referencia");

    assert_eq!(
        generated.len(),
        reference.len(),
        "Tamaño de partición diferente"
    );

    let mismatches: Vec<_> = generated
        .iter()
        .zip(reference.iter())
        .enumerate()
        .filter(|(_, (a, b))| a != b)
        .map(|(i, (a, b))| (i, *a, *b))
        .collect();

    if !mismatches.is_empty() {
        for (i, ours, theirs) in mismatches.iter().take(10) {
            eprintln!("offset 0x{i:04X}: ours=0x{ours:02X} reference=0x{theirs:02X}");
        }
        panic!(
            "{} bytes difieren respecto al binario de nvs_partition_gen.py",
            mismatches.len()
        );
    }
}
