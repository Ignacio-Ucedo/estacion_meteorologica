use std::env;
use std::path::PathBuf;

fn main() {
    // Relay ESP-IDF build environment so esp-idf-hal/svc resolve correctly.
    embuild::espidf::sysenv::relay();
    embuild::espidf::sysenv::output();

    let vendor = PathBuf::from("vendor/lr1121_modemE_driver");
    if !vendor.exists() {
        // C SDK not present. The crate will fail to LINK without it.
        // See vendor/README.md for download instructions (SWDR009).
        println!("cargo:warning=lr1121-modem-e: vendor/lr1121_modemE_driver not found — crate will not link. See vendor/README.md.");
        return;
    }

    // Compile SWDR009 C sources.
    let inc = vendor.join("lr1121_modem");
    let mut cc = cc::Build::new();
    cc.include(&inc).flag_if_supported("-Wno-unused-parameter");

    for entry in std::fs::read_dir(&inc).expect("read vendor dir") {
        let path = entry.unwrap().path();
        if path.extension().map(|e| e == "c").unwrap_or(false) {
            cc.file(&path);
        }
    }
    cc.compile("lr1121_modem_e");
    println!("cargo:rerun-if-changed=vendor/");

    // Generate bindings from SWDR009 headers.
    let bindings = bindgen::Builder::default()
        .header(inc.join("lr1121_modem_lorawan.h").to_str().unwrap())
        .header(inc.join("lr1121_modem_common.h").to_str().unwrap())
        .clang_arg(format!("-I{}", inc.display()))
        .use_core()
        .generate()
        .expect("bindgen failed for SWDR009");

    let out = PathBuf::from(env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out.join("swdr009_bindings.rs"))
        .expect("write bindings");
}
