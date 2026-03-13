//! TUI reception flow — stub (implemented in Task 4).
use color_eyre::eyre::Result;
use super::http::Credentials;
use crate::Config;

pub fn ensure_credentials(
    _cfg: &Config,
    _base_url: &str,
) -> Result<Credentials> {
    todo!("reception TUI not yet implemented")
}
