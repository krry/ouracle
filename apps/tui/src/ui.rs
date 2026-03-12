use ratatui::{
    layout::{Constraint, Direction, Layout},
    style::{Color, Style},
    widgets::{Block, Borders, Paragraph, Wrap},
    Frame,
};
use textwrap::wrap;

use crate::app::App;

pub fn draw(frame: &mut Frame, app: &App) {
    let size = frame.area();

    // Simple vertical layout: main area + input line at bottom
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // status
            Constraint::Min(3),    // history + ambient aura
            Constraint::Length(3) // input box
        ])
        .split(size);

    let status_area = chunks[0];
    let main_area = chunks[1];
    let input_area = chunks[2];

    // call ambient aura renderer to decorate main_area first
    app.aura.render(frame, size);

    // let inner = Rect {
    //     x: size.x + 1,
    //     y: size.y + 1,
    //     width: size.width.saturating_sub(2),
    //     height: size.height.saturating_sub(2),
    // };

    let status = format!("mode={:?} stage={} pending={}", app.mode, app.stage, app.pending);
    let status_widget = Paragraph::new(status)
        .block(Block::default().borders(Borders::ALL).title("Status"))
        .wrap(Wrap { trim: true });
    frame.render_widget(status_widget, status_area);

    let main_chunks = if app.dev_mode {
        Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(65), Constraint::Percentage(35)])
            .split(main_area)
    } else {
        Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(100)])
            .split(main_area)
    };

    let history_area = main_chunks[0];
    let wrap_width = history_area.width.saturating_sub(2) as usize;
    let wrapped_lines = wrap_messages(&app.messages, wrap_width);
    let history = wrapped_lines.join("\n");
    let history_lines = wrapped_lines.len();
    let visible_lines = history_area.height.saturating_sub(2) as usize;
    let max_offset = history_lines.saturating_sub(visible_lines);
    let scroll = max_offset.saturating_sub(app.history_offset.min(max_offset)) as u16;
    let history_widget = Paragraph::new(history)
        .block(Block::default().borders(Borders::ALL).title("Thread"))
        .wrap(Wrap { trim: false })
        .scroll((scroll, 0));
    frame.render_widget(history_widget, history_area);

    if app.dev_mode && main_chunks.len() > 1 {
        let dev_area = main_chunks[1];
        let dev_chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Length(12), Constraint::Min(8), Constraint::Length(7)])
            .split(dev_area);

        let state_area = dev_chunks[0];
        let state_text = format_state(app);
        let state_widget = Paragraph::new(state_text)
            .block(Block::default().borders(Borders::ALL).title("Dev State"))
            .wrap(Wrap { trim: true });
        frame.render_widget(state_widget, state_area);

        let meta_area = dev_chunks[1];
        let meta_text = format_meta(app);
        let meta_widget = Paragraph::new(meta_text)
            .block(Block::default().borders(Borders::ALL).title("Dev Meta"))
            .wrap(Wrap { trim: true });
        frame.render_widget(meta_widget, meta_area);

        let legend_area = dev_chunks[2];
        let legend_text = format_legend();
        let legend_widget = Paragraph::new(legend_text)
            .block(Block::default().borders(Borders::ALL).title("Legend"))
            .wrap(Wrap { trim: true });
        frame.render_widget(legend_widget, legend_area);
    }

    // Input line
    let input_widget = Paragraph::new(app.input.as_str())
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("You")
                .border_style(Style::default().fg(Color::Cyan)),
        );
    frame.render_widget(input_widget, input_area);

    // Place cursor at end of input
    let x = input_area.x + 1 + app.input.len() as u16;
    let y = input_area.y + 1;
    frame.set_cursor_position((x, y));
}

fn format_meta(app: &App) -> String {
    let meta = match &app.last_meta {
        Some(m) => m,
        None => return "No API calls yet.".to_string(),
    };

    let mut lines = Vec::new();
    lines.push(format!("endpoint: {}", meta.endpoint));
    lines.push(format!("status: {}", meta.status));
    lines.push(format!("duration_ms: {}", meta.duration_ms));
    lines.push("request:".to_string());
    lines.push(meta.request.clone().unwrap_or_else(|| "null".to_string()));
    lines.push("response:".to_string());
    lines.push(meta.response.clone().unwrap_or_else(|| "null".to_string()));
    lines.join("\n")
}

fn format_state(app: &App) -> String {
    let mut lines = Vec::new();
    lines.push(format!("base_url: {}", app.base_url));
    lines.push(format!("mode: {:?}", app.mode));
    lines.push(format!("stage: {}", app.stage));
    lines.push(format!("turn: {}", app.last_turn.map(|v| v.to_string()).unwrap_or_else(|| "none".to_string())));
    lines.push(format!("pending: {}", app.pending));
    lines.push(format!("seeker_id: {}", app.seeker_id.as_deref().unwrap_or("none")));
    lines.push(format!("session_id: {}", app.session_id.as_deref().unwrap_or("none")));
    lines.push(format!("access_token: {}", short_token(app.access_token.as_deref())));
    lines.push(format!("refresh_token: {}", short_token(app.refresh_token.as_deref())));
    lines.join("\n")
}

fn short_token(token: Option<&str>) -> String {
    let Some(t) = token else {
        return "none".to_string();
    };
    if t.len() <= 14 {
        return t.to_string();
    }
    let head = &t[..6];
    let tail = &t[t.len() - 4..];
    format!("{}...{}", head, tail)
}

fn format_legend() -> String {
    let lines = [
        "/consent  /seeker  /covenant",
        "/begin    /prescribe [tarot|iching]",
        "/thread  /delete  /token",
        "/reintegrate yes|no",
        "/mouse on|off  /dev on|off",
        "/status  /help",
    ];
    lines.join("\n")
}

fn wrap_messages(messages: &[String], width: usize) -> Vec<String> {
    let mut out = Vec::new();
    for msg in messages {
        for line in msg.split('\n') {
            if width == 0 {
                out.push(line.to_string());
                continue;
            }
            let wrapped = wrap(line, width);
            if wrapped.is_empty() {
                out.push(String::new());
            } else {
                for w in wrapped {
                    out.push(w.into_owned());
                }
            }
        }
    }
    out
}
