// src/main.rs

use std::io;
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use color_eyre::eyre::Result;
use libc;
use crossterm::{
    // event::{self, Event, KeyCode},
    event::{self, DisableMouseCapture, EnableMouseCapture},
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
mod theme;
mod totem;

use crate::app::App;
use crate::api::{ApiRequest, ApiResponse, execute as execute_api};

// Global ambient PID so SIGTERM handler can kill it (process::exit skips Drop)
static AMBIENT_PID: AtomicI32 = AtomicI32::new(0);

fn restore_terminal() {
    let _ = disable_raw_mode();
    let _ = execute!(io::stdout(), DisableMouseCapture, LeaveAlternateScreen);
}

fn main() -> Result<()> {
    color_eyre::install()?;

    // Restore terminal on panic
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        restore_terminal();
        default_hook(info);
    }));

    // Restore terminal on SIGTERM (cargo watch kills with SIGTERM on recompile)
    unsafe {
        libc::signal(libc::SIGTERM, sigterm_handler as libc::sighandler_t);
    }

    run()
}

extern "C" fn sigterm_handler(_: libc::c_int) {
    restore_terminal();
    let pid = AMBIENT_PID.load(Ordering::Relaxed);
    if pid > 0 {
        unsafe { libc::kill(pid, libc::SIGTERM); }
    }
    std::process::exit(0);
}

fn run() -> Result<()> {
    // 1. Set up terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;
    terminal.clear()?;

    // 2. Run app loop
    let res = app_loop(&mut terminal);

    // 3. Restore terminal even if app_loop errors
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), DisableMouseCapture, LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    res
}

fn app_loop(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
) -> Result<()> {
    let mut app = App::new();
    if let Some(pid) = app.ambient_pid() {
        AMBIENT_PID.store(pid as i32, Ordering::Relaxed);
    }
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
        let size = terminal.size()?;
        app.last_frame = Some(size.into());
        terminal.draw(|frame| ui::draw(frame, &mut app))?;

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

        if app.mouse_capture_dirty {
            if app.mouse_capture {
                execute!(terminal.backend_mut(), EnableMouseCapture)?;
            } else {
                execute!(terminal.backend_mut(), DisableMouseCapture)?;
            }
            app.mouse_capture_dirty = false;
        }

        if app.cursor_dirty {
            if app.cursor_visible {
                terminal.show_cursor()?;
            } else {
                terminal.hide_cursor()?;
            }
            app.cursor_dirty = false;
        }

        while let Ok(resp) = resp_rx.try_recv() {
            app.handle_api_response(resp);
        }

        if let Some(req) = app.take_queued_request() {
            let is_begin = matches!(req, ApiRequest::BeginInquiry { .. });
            if is_begin {
                let ready = match app.ritual_opened_at {
                    Some(started) => started.elapsed().as_millis() >= app.ritual_min_delay_ms,
                    None => true,
                };
                if ready && app.begin_allowed {
                    let _ = req_tx.send(req);
                    app.ritual_opened_at = None;
                    app.begin_allowed = false;
                } else {
                    app.queued_request = Some(req);
                }
            } else {
                let _ = req_tx.send(req);
            }
        }

        if last_tick.elapsed() >= tick_rate {
            app.on_tick(last_tick.elapsed());
            last_tick = Instant::now();
        }
    }
}
