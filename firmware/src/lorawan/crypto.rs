//! Primitivas criptográficas LoRaWAN (LoRaWAN 1.0.2, Class A, OTAA).
//!
//! Operaciones:
//! - AES-CMAC (MIC del JoinRequest y uplinks)
//! - AES-ECB encrypt (descifrado del JoinAccept y derivación de session keys)
//! - AES-CTR (cifrado del FRMPayload)

use aes::{
    cipher::{generic_array::GenericArray, BlockEncrypt, KeyInit},
    Aes128,
};
use cmac::{Cmac, Mac};

pub type DevEui = [u8; 8];
pub type AppEui = [u8; 8];
pub type AppKey = [u8; 16];
pub type NwkSKey = [u8; 16];
pub type AppSKey = [u8; 16];
pub type DevAddr = [u8; 4]; // little-endian en el wire

fn aes_cmac_full(key: &[u8; 16], data: &[u8]) -> [u8; 16] {
    let mut mac = <Cmac<Aes128>>::new_from_slice(key).unwrap();
    mac.update(data);
    mac.finalize().into_bytes().into()
}

fn aes_ecb_encrypt(key: &[u8; 16], block: &mut [u8; 16]) {
    let cipher = Aes128::new(GenericArray::from_slice(key));
    let b = GenericArray::from_mut_slice(block);
    cipher.encrypt_block(b);
}

// --- Join Request ---

/// Construye el MIC del JoinRequest.
/// MHDR | AppEUI (LE) | DevEUI (LE) | DevNonce (LE) → CMAC[0..4]
pub fn join_request_mic(app_key: &AppKey, app_eui_le: &AppEui, dev_eui_le: &DevEui, dev_nonce: u16) -> [u8; 4] {
    let mut buf = [0u8; 19];
    buf[0] = 0x00; // MHDR JoinRequest
    buf[1..9].copy_from_slice(app_eui_le);
    buf[9..17].copy_from_slice(dev_eui_le);
    buf[17] = (dev_nonce & 0xFF) as u8;
    buf[18] = (dev_nonce >> 8) as u8;
    let full = aes_cmac_full(app_key, &buf);
    [full[0], full[1], full[2], full[3]]
}

// --- Join Accept ---

/// Descifra el JoinAccept (AES-128 ECB, la operación inversa es encrypt).
/// Modifica el slice in-place. `payload` son los bytes crudos del JoinAccept (sin MHDR, sin MIC).
pub fn decrypt_join_accept(app_key: &AppKey, payload: &mut [u8]) {
    let cipher = Aes128::new(GenericArray::from_slice(app_key));
    for chunk in payload.chunks_mut(16) {
        if chunk.len() == 16 {
            let b = GenericArray::from_mut_slice(chunk);
            cipher.encrypt_block(b);
        }
    }
}

/// Verifica el MIC del JoinAccept.
/// CMAC(AppKey, MHDR | AppNonce | NetID | DevAddr | DLSettings | RxDelay | [CFList])[0..4]
pub fn verify_join_accept_mic(
    app_key: &AppKey,
    mhdr: u8,
    decrypted_body: &[u8], // todos los bytes tras MHDR, antes del MIC
    expected_mic: &[u8; 4],
) -> bool {
    let mut buf = Vec::with_capacity(1 + decrypted_body.len());
    buf.push(mhdr);
    buf.extend_from_slice(decrypted_body);
    let full = aes_cmac_full(app_key, &buf);
    full[0] == expected_mic[0]
        && full[1] == expected_mic[1]
        && full[2] == expected_mic[2]
        && full[3] == expected_mic[3]
}

/// Deriva NwkSKey y AppSKey a partir del JoinAccept.
/// NwkSKey = AES(AppKey, 0x01 | AppNonce | NetID | DevNonce | 0x00..0x00)
/// AppSKey = AES(AppKey, 0x02 | AppNonce | NetID | DevNonce | 0x00..0x00)
pub fn derive_session_keys(
    app_key: &AppKey,
    app_nonce: [u8; 3], // little-endian
    net_id: [u8; 3],    // little-endian
    dev_nonce: u16,
) -> (NwkSKey, AppSKey) {
    let derive = |key_type: u8| -> [u8; 16] {
        let mut buf = [0u8; 16];
        buf[0] = key_type;
        buf[1..4].copy_from_slice(&app_nonce);
        buf[4..7].copy_from_slice(&net_id);
        buf[7] = (dev_nonce & 0xFF) as u8;
        buf[8] = (dev_nonce >> 8) as u8;
        // buf[9..16] = 0x00 (ya inicializados)
        aes_ecb_encrypt(app_key, &mut buf);
        buf
    };
    (derive(0x01), derive(0x02))
}

// --- Uplink ---

/// Calcula el MIC de un uplink (UnconfirmedDataUp).
/// B0 = 0x49 | 0x00000000 | dir=0x00 | DevAddr (LE) | FCnt (LE u32) | 0x00 | len
pub fn uplink_mic(nwk_skey: &NwkSKey, dev_addr: &DevAddr, fcnt: u32, frm: &[u8]) -> [u8; 4] {
    let mut b0 = [0u8; 16];
    b0[0] = 0x49;
    // b0[1..5] = 0x00
    b0[5] = 0x00; // dirección: uplink
    b0[6..10].copy_from_slice(dev_addr);
    b0[10] = (fcnt & 0xFF) as u8;
    b0[11] = ((fcnt >> 8) & 0xFF) as u8;
    b0[12] = ((fcnt >> 16) & 0xFF) as u8;
    b0[13] = ((fcnt >> 24) & 0xFF) as u8;
    // b0[14] = 0x00
    b0[15] = frm.len() as u8;

    let mut mac = <Cmac<Aes128>>::new_from_slice(nwk_skey).unwrap();
    mac.update(&b0);
    mac.update(frm);
    let full = mac.finalize().into_bytes();
    [full[0], full[1], full[2], full[3]]
}

/// Cifra (o descifra — es simétrico) el FRMPayload.
/// S_i = AES(AppSKey, 0x01 | 0x00000000 | dir=0x00 | DevAddr | FCnt | 0x00 | i)
pub fn encrypt_frm_payload(app_skey: &AppSKey, dev_addr: &DevAddr, fcnt: u32, payload: &mut [u8]) {
    for (i, chunk) in payload.chunks_mut(16).enumerate() {
        let mut s = [0u8; 16];
        s[0] = 0x01;
        // s[1..5] = 0x00
        s[5] = 0x00; // uplink
        s[6..10].copy_from_slice(dev_addr);
        s[10] = (fcnt & 0xFF) as u8;
        s[11] = ((fcnt >> 8) & 0xFF) as u8;
        s[12] = ((fcnt >> 16) & 0xFF) as u8;
        s[13] = ((fcnt >> 24) & 0xFF) as u8;
        // s[14] = 0x00
        s[15] = (i + 1) as u8;
        aes_ecb_encrypt(app_skey, &mut s);
        for (b, k) in chunk.iter_mut().zip(s.iter()) {
            *b ^= k;
        }
    }
}
