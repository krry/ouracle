// src/main.rs

use std::io;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use color_eyre::eyre::Result;
use crossterm::{
    // event::{self, Event, KeyCode},
    event::{self},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    Terminal,
};

mod app;
mod ui;
mod aura;
mod api;

use crate::app::App;
use crate::api::{ApiRequest, ApiResponse, execute as execute_api};

fn main() -> Result<()> {
    color_eyre::install()?;
    run()
}

fn run() -> Result<()> {
    // 1. Set up terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;
    terminal.clear()?;

    // 2. Run app loop
    let res = app_loop(&mut terminal);

    // 3. Restore terminal even if app_loop errors
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    res
}

fn app_loop(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
) -> Result<()> {
    let mut app = App::new();
    let (req_tx, req_rx) = mpsc::channel::<ApiRequest>();
    let (resp_tx, resp_rx) = mpsc::channel::<ApiResponse>();

    thread::spawn(move || {
        while let Ok(req) = req_rx.recv() {
            let resp = execute_api(req);
            let _ = resp_tx.send(resp);
        }
    });

    let mut last_tick = Instant::now();
    let tick_rate = Duration::from_millis(100);

    loop {
        terminal.draw(|frame| ui::draw(frame, &app))?;

        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or(Duration::from_secs(0));

        if event::poll(timeout)? {
            let ev = event::read()?;
            let (should_quit, req) = app.on_event(&ev);
            if let Some(req) = req {
                let _ = req_tx.send(req);
            }
            if should_quit {
                let _ = req_tx.send(ApiRequest::Shutdown);
                return Ok(());
            }
        }

        while let Ok(resp) = resp_rx.try_recv() {
            app.handle_api_response(resp);
        }

        if last_tick.elapsed() >= tick_rate {
            app.on_tick(last_tick.elapsed());
            last_tick = Instant::now();
        }
    }
}
