use std::env;
use std::path::PathBuf;

fn main() {
    embuild::espidf::sysenv::relay();
    embuild::espidf::sysenv::output();

    let vendor = PathBuf::from("vendor/lr11xx_driver");
    if !vendor.exists() {
        println!("cargo:warning=lr1121-transceiver: vendor/lr11xx_driver not found — crate will not link. See vendor/README.md.");
        return;
    }

    // Compile SWDR001 C sources.
    let inc = vendor.join("src");
    let mut cc = cc::Build::new();
    cc.include(&inc)
        .include(vendor.join("src").join("common"))
        .flag_if_supported("-Wno-unused-parameter");

    for entry in walkdir(&inc) {
        if entry.extension().map(|e| e == "c").unwrap_or(false) {
            cc.file(&entry);
        }
    }
    cc.compile("lr11xx");
    println!("cargo:rerun-if-changed=vendor/");

    let bindings = bindgen::Builder::default()
        .header(vendor.join("src/lr11xx_radio.h").to_str().unwrap())
        .header(vendor.join("src/lr11xx_system.h").to_str().unwrap())
        .clang_arg(format!("-I{}", inc.display()))
        .use_core()
        .generate()
        .expect("bindgen failed for SWDR001");

    let out = PathBuf::from(env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out.join("swdr001_bindings.rs"))
        .expect("write bindings");
}

/// Recursive file iterator — evita dependencia `walkdir` o `glob`.
fn walkdir(dir: &std::path::Path) -> Vec<std::path::PathBuf> {
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                files.extend(walkdir(&path));
            } else {
                files.push(path);
            }
        }
    }
    files
}
