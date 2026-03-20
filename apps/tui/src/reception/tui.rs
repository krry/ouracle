//! Ratatui reception flow — runs inside an existing terminal session.
//! Returns Some(Credentials) on success or None if the user aborts.

use std::io;
use std::time::{Duration, Instant};

use color_eyre::eyre::Result;
use crossterm::event::{self, Event, KeyCode, KeyEventKind};
use ratatui::layout::Rect;
use ratatui::style::{Color, Style};
use ratatui::widgets::{Block, Borders, Clear, Paragraph, Wrap};
use ratatui::{Frame, Terminal, backend::CrosstermBackend};

use ripl::aura::Aura;
use ripl::theme::text_accent;

use super::http::{self, Credentials};
use crate::Config;

// ─── Step machine ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
enum Step {
    Entry,
    Name,
    Password {
        name: String,
    },
    Covenant {
        lines: Vec<String>,
        offset: usize,
        /// Credentials already obtained (returning seeker covenant path)
        existing_creds: Option<Box<Credentials>>,
    },
    ReturningHandle,
    ReturningPassword {
        handle: String,
    },
}

struct State {
    step: Step,
    input: String,
    mask_input: bool,
    error: Option<String>,
    connecting: bool,
    aura: Aura,
}

enum Outcome {
    Continue,
    Done(Option<Credentials>),
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/// Run reception if no valid credentials are saved. Returns None if aborted.
pub fn ensure_credentials(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    cfg: &Config,
    base_url: &str,
) -> Result<Option<Credentials>> {
    // Fast path: try saved refresh token.
    if let Some(rt) = cfg.refresh_token() {
        let mut state = State::new(Step::Entry);
        state.connecting = true;
        terminal.draw(|f| draw(f, &mut state))?;

        match http::rotate_token(base_url, rt) {
            Ok(rotated) if rotated.stage != "known" => {
                return Ok(Some(rotated.credentials));
            }
            Ok(rotated) => {
                // Covenant update required — fetch text then enter Covenant step.
                terminal.draw(|f| draw(f, &mut state))?;
                let (_version, lines) = http::fetch_covenant(base_url)?;
                let step = Step::Covenant {
                    lines,
                    offset: 0,
                    existing_creds: Some(Box::new(rotated.credentials)),
                };
                return run_loop(terminal, base_url, step);
            }
            Err(_) => {
                // Refresh failed — fall through to full reception.
            }
        }
    }

    run_loop(terminal, base_url, Step::Entry)
}

// ─── Event loop ───────────────────────────────────────────────────────────────

fn run_loop(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    base_url: &str,
    initial_step: Step,
) -> Result<Option<Credentials>> {
    let mut state = State::new(initial_step);
    let tick_rate = Duration::from_millis(100);
    let mut last_tick = Instant::now();

    loop {
        terminal.draw(|f| draw(f, &mut state))?;

        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or(Duration::ZERO);

        if event::poll(timeout)? {
            let ev = event::read()?;
            match handle_event(&mut state, &ev, terminal, base_url)? {
                Outcome::Continue => {}
                Outcome::Done(result) => return Ok(result),
            }
        }

        if last_tick.elapsed() >= tick_rate {
            state.aura.tick(last_tick.elapsed());
            last_tick = Instant::now();
        }
    }
}

// ─── Event handler ────────────────────────────────────────────────────────────

fn handle_event(
    state: &mut State,
    event: &Event,
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    base_url: &str,
) -> Result<Outcome> {
    let Event::Key(key) = event else {
        return Ok(Outcome::Continue);
    };
    if key.kind != KeyEventKind::Press {
        return Ok(Outcome::Continue);
    }

    // Global: Esc always aborts.
    if key.code == KeyCode::Esc {
        return Ok(Outcome::Done(None));
    }

    match &state.step.clone() {
        Step::Entry => match key.code {
            KeyCode::Char('n') | KeyCode::Char('N') => {
                state.goto(Step::Name, false);
            }
            KeyCode::Char('r') | KeyCode::Char('R') => {
                state.goto(Step::ReturningHandle, false);
            }
            _ => {}
        },

        Step::Name => match key.code {
            KeyCode::Enter => {
                let name = state.input.trim().to_string();
                if name.is_empty() {
                    state.error = Some("name cannot be empty".into());
                } else {
                    state.goto(Step::Password { name }, true);
                }
            }
            KeyCode::Backspace => {
                state.input.pop();
            }
            KeyCode::Char(c) => {
                state.input.push(c);
            }
            _ => {}
        },

        Step::Password { name } => {
            let name = name.clone();
            match key.code {
                KeyCode::Enter => {
                    let password = state.input.trim().to_string();
                    if password.is_empty() {
                        state.error = Some("password cannot be empty".into());
                    } else {
                        state.connecting = true;
                        state.error = None;
                        terminal.draw(|f| draw(f, state))?;

                        match http::register_seeker(base_url, &name, &password) {
                            Ok((creds, _handle)) => {
                                state.connecting = false;
                                terminal.draw(|f| draw(f, state))?;
                                let (_version, lines) = http::fetch_covenant(base_url)?;
                                let step = Step::Covenant {
                                    lines,
                                    offset: 0,
                                    existing_creds: Some(Box::new(creds)),
                                };
                                state.goto(step, false);
                            }
                            Err(e) => {
                                state.connecting = false;
                                let msg = e.to_string();
                                if msg.contains("handle_exhausted") {
                                    state.error =
                                        Some("that name has no handles left — try another".into());
                                    state.goto(Step::Name, false);
                                } else {
                                    state.error = Some(msg);
                                }
                            }
                        }
                    }
                }
                KeyCode::Backspace => {
                    state.input.pop();
                }
                KeyCode::Char(c) => {
                    state.input.push(c);
                }
                _ => {}
            }
        }

        Step::Covenant { existing_creds, .. } => {
            // Extract owned copies from the cloned step before any mutable borrows.
            let creds_owned: Option<Credentials> = existing_creds.as_ref().map(|b| {
                let c = b.as_ref();
                Credentials {
                    seeker_id: c.seeker_id.clone(),
                    access_token: c.access_token.clone(),
                    refresh_token: c.refresh_token.clone(),
                }
            });

            match key.code {
                KeyCode::Char('y') | KeyCode::Char('Y') => {
                    if let Some(creds) = creds_owned {
                        state.connecting = true;
                        terminal.draw(|f| draw(f, state))?;
                        http::accept_covenant(base_url, &creds.access_token)?;
                        return Ok(Outcome::Done(Some(creds)));
                    }
                }
                KeyCode::Char('n') | KeyCode::Char('N') => {
                    return Ok(Outcome::Done(None));
                }
                KeyCode::Char('j') | KeyCode::Down => {
                    if let Step::Covenant { offset, lines, .. } = &mut state.step {
                        let max = lines.len().saturating_sub(1);
                        *offset = (*offset + 1).min(max);
                    }
                }
                KeyCode::Char('k') | KeyCode::Up => {
                    if let Step::Covenant { offset, .. } = &mut state.step {
                        *offset = offset.saturating_sub(1);
                    }
                }
                _ => {}
            }
        }

        Step::ReturningHandle => match key.code {
            KeyCode::Enter => {
                let handle = state.input.trim().to_string();
                if handle.is_empty() {
                    state.error = Some("handle cannot be empty".into());
                } else {
                    state.goto(Step::ReturningPassword { handle }, true);
                }
            }
            KeyCode::Backspace => {
                state.input.pop();
            }
            KeyCode::Char(c) => {
                state.input.push(c);
            }
            _ => {}
        },

        Step::ReturningPassword { handle } => {
            let handle = handle.clone();
            match key.code {
                KeyCode::Enter => {
                    let password = state.input.trim().to_string();
                    if password.is_empty() {
                        state.error = Some("password cannot be empty".into());
                    } else {
                        state.connecting = true;
                        state.error = None;
                        terminal.draw(|f| draw(f, state))?;

                        match http::sign_in(base_url, &handle, &password) {
                            Ok(rotated) if rotated.stage != "known" => {
                                return Ok(Outcome::Done(Some(rotated.credentials)));
                            }
                            Ok(rotated) => {
                                state.connecting = false;
                                terminal.draw(|f| draw(f, state))?;
                                let (_version, lines) = http::fetch_covenant(base_url)?;
                                let step = Step::Covenant {
                                    lines,
                                    offset: 0,
                                    existing_creds: Some(Box::new(rotated.credentials)),
                                };
                                state.goto(step, false);
                            }
                            Err(e) => {
                                state.connecting = false;
                                state.error = Some(e.to_string());
                            }
                        }
                    }
                }
                KeyCode::Backspace => {
                    state.input.pop();
                }
                KeyCode::Char(c) => {
                    state.input.push(c);
                }
                _ => {}
            }
        }
    }

    Ok(Outcome::Continue)
}

// ─── State helpers ────────────────────────────────────────────────────────────

impl State {
    fn new(step: Step) -> Self {
        Self {
            step,
            input: String::new(),
            mask_input: false,
            error: None,
            connecting: false,
            aura: Aura::new(),
        }
    }

    fn goto(&mut self, step: Step, mask: bool) {
        self.step = step;
        self.input.clear();
        self.mask_input = mask;
        self.error = None;
        self.connecting = false;
    }
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

fn draw(frame: &mut Frame, state: &mut State) {
    let size = frame.size();
    let voice_intensity: f32 = if state.connecting { 0.4 } else { 0.0 };
    state.aura.render(frame, size, voice_intensity);

    match &state.step {
        Step::Covenant { lines, offset, .. } => draw_covenant(frame, lines, *offset),
        _ => draw_input_screen(frame, state),
    }
}

fn draw_input_screen(frame: &mut Frame, state: &State) {
    let size = frame.size();

    let width = 60u16.min(size.width.saturating_sub(4));
    let height = 7u16;
    let x = size.x + (size.width.saturating_sub(width)) / 2;
    let y = size.y + (size.height.saturating_sub(height)) / 2;
    let area = Rect {
        x,
        y,
        width,
        height,
    };

    frame.render_widget(Clear, area);

    let (title, prompt) = step_labels(&state.step);
    let displayed_input = if state.mask_input {
        "•".repeat(state.input.len())
    } else {
        state.input.clone()
    };
    let input_line = if state.connecting {
        "connecting…".to_string()
    } else {
        format!("{prompt}: {displayed_input}")
    };

    let error_line = state.error.as_deref().unwrap_or("");
    let body = format!("{input_line}\n\n{error_line}");

    let widget = Paragraph::new(body)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(title)
                .border_style(Style::default().fg(text_accent())),
        )
        .style(Style::default().fg(Color::Reset))
        .wrap(Wrap { trim: false });
    frame.render_widget(widget, area);

    // Show terminal cursor at end of input for text-entry steps.
    let is_input_step = matches!(
        state.step,
        Step::Name | Step::Password { .. } | Step::ReturningHandle | Step::ReturningPassword { .. }
    );
    if is_input_step && !state.connecting {
        let cursor_x = area.x + 1 + prompt.len() as u16 + 2 + displayed_input.len() as u16;
        let cursor_y = area.y + 1;
        frame.set_cursor(cursor_x.min(area.x + area.width - 2), cursor_y);
    }
}

fn draw_covenant(frame: &mut Frame, lines: &[String], offset: usize) {
    let size = frame.size();
    let width = 70u16.min(size.width.saturating_sub(4));
    let height = 20u16.min(size.height.saturating_sub(4));
    let x = size.x + (size.width.saturating_sub(width)) / 2;
    let y = size.y + (size.height.saturating_sub(height)) / 2;
    let area = Rect {
        x,
        y,
        width,
        height,
    };

    frame.render_widget(Clear, area);

    let visible = (area.height.saturating_sub(4)) as usize;
    let start = offset.min(lines.len().saturating_sub(1));
    let visible_lines: Vec<&str> = lines[start..]
        .iter()
        .take(visible)
        .map(String::as_str)
        .collect();

    let mut body = visible_lines.join("\n");
    body.push_str("\n\n[y] accept   [n] decline");

    let widget = Paragraph::new(body)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("The Covenant")
                .border_style(Style::default().fg(text_accent())),
        )
        .style(Style::default().fg(Color::Reset))
        .wrap(Wrap { trim: true });
    frame.render_widget(widget, area);
}

fn step_labels(step: &Step) -> (&'static str, &'static str) {
    match step {
        Step::Entry => ("Ouracle", "[n] new   [r] returning   [Esc] quit"),
        Step::Name => ("New seeker", "name"),
        Step::Password { .. } => ("New seeker", "password"),
        Step::ReturningHandle => ("Welcome back", "handle"),
        Step::ReturningPassword { .. } => ("Welcome back", "password"),
        Step::Covenant { .. } => ("The Covenant", ""),
    }
}
