//! Only for the end-to-end test build (`--features e2e`): opens the port for
//! the Chrome DevTools Protocol (CDP), so that Playwright can connect to the
//! WebView2 page. The release build does not contain this code.
//!
//! WebView2 ignores `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` because wry
//! always sets its own browser arguments. So the app sets the port itself.

/// Must match `CDP_PORT_VARIABLE` in `e2e-desktop/launch.ts`.
pub const CDP_PORT_VARIABLE: &str = "CSV_CRYPT_CDP_PORT";

/// The arguments that wry uses when the app sets none (wry 0.57,
/// `webview2/mod.rs`). Own arguments replace them, so the test build
/// repeats them: it must behave like the release build.
const WRY_DEFAULT_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection \
     --autoplay-policy=no-user-gesture-required";

/// The browser arguments for the value of [`CDP_PORT_VARIABLE`].
/// No value: wry's defaults (`None`). A wrong value is an error, so that
/// the test fails at once and not only after its timeout.
pub fn browser_args(port: Option<&str>) -> Result<Option<String>, String> {
    let Some(port) = port else {
        return Ok(None);
    };
    let port: u16 = port
        .parse()
        .ok()
        .filter(|&port| port != 0)
        .ok_or_else(|| format!("{CDP_PORT_VARIABLE} is not a port: {port:?}"))?;
    Ok(Some(format!(
        "{WRY_DEFAULT_ARGS} --remote-debugging-port={port}"
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_port_keeps_the_defaults_of_wry() {
        assert_eq!(browser_args(None), Ok(None));
    }

    #[test]
    fn a_port_adds_the_cdp_argument_to_the_defaults_of_wry() {
        assert_eq!(
            browser_args(Some("9222")),
            Ok(Some(
                "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection \
                 --autoplay-policy=no-user-gesture-required \
                 --remote-debugging-port=9222"
                    .to_string()
            ))
        );
    }

    #[test]
    fn a_wrong_port_is_an_error() {
        for wrong in ["", "abc", "0", "65536", "-1", "9222 --other"] {
            let error = browser_args(Some(wrong)).unwrap_err();
            assert!(error.contains(CDP_PORT_VARIABLE), "{wrong}: {error}");
        }
    }
}
