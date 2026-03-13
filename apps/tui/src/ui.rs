use ratatui::{
    layout::{Constraint, Direction, Layout, Margin},
    style::Style,
    text::{Line, Span},
    widgets::{Block, Borders, Clear, Paragraph, Wrap},
    Frame,
};
use textwrap::wrap;

use crate::app::App;
use crate::theme::{text_accent, text_fade, text_primary, text_secondary, text_warning};

pub fn draw(frame: &mut Frame, app: &mut App) {
    let size = frame.area();

    // Simple vertical layout: main area + input line at bottom
    let inner = size.inner(Margin { vertical: 3, horizontal: 3 });
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // status
            Constraint::Min(3),    // history + ambient aura
            Constraint::Length(3)  // input box
        ])
        .split(inner);

    let status_area = chunks[0];
    let main_area = chunks[1];
    let input_area = chunks[2];

    // call ambient aura renderer to decorate main_area first
    app.aura.render(frame, size, app.voice_intensity);

    if app.dev_mode {
        let status = format!("mode={:?} stage={} pending={}", app.mode, app.stage, app.pending);
        frame.render_widget(Clear, status_area);
        let status_widget = Paragraph::new(status)
            .block(Block::default().borders(Borders::ALL).title("Status"))
            .style(Style::default().fg(text_primary()))
            .wrap(Wrap { trim: true });
        frame.render_widget(status_widget, status_area);

        let main_chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(65), Constraint::Percentage(35)])
            .split(main_area);

        let history_area = main_chunks[0];
        let wrap_width = history_area.width.saturating_sub(2) as usize;
        let wrapped_lines = wrap_messages(&app.messages, wrap_width);
        let history = wrapped_lines.join("\n");
        let history_lines = wrapped_lines.len();
        let visible_lines = history_area.height.saturating_sub(2) as usize;
        let max_offset = history_lines.saturating_sub(visible_lines);
        let scroll = max_offset.saturating_sub(app.history_offset.min(max_offset)) as u16;
        frame.render_widget(Clear, history_area);
        let history_widget = Paragraph::new(history)
            .block(Block::default().borders(Borders::ALL).title("Thread"))
            .style(Style::default().fg(text_primary()))
            .wrap(Wrap { trim: false })
            .scroll((scroll, 0));
        frame.render_widget(history_widget, history_area);

        let dev_area = main_chunks[1];
        let dev_chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Length(12), Constraint::Min(8), Constraint::Length(7)])
            .split(dev_area);

        let state_area = dev_chunks[0];
        let state_text = format_state(app);
        frame.render_widget(Clear, state_area);
        let state_widget = Paragraph::new(state_text)
            .block(Block::default().borders(Borders::ALL).title("Dev State"))
            .style(Style::default().fg(text_primary()))
            .wrap(Wrap { trim: true });
        frame.render_widget(state_widget, state_area);

        let meta_area = dev_chunks[1];
        let meta_text = format_meta(app);
        frame.render_widget(Clear, meta_area);
        let meta_widget = Paragraph::new(meta_text)
            .block(Block::default().borders(Borders::ALL).title("Dev Meta"))
            .style(Style::default().fg(text_primary()))
            .wrap(Wrap { trim: true });
        frame.render_widget(meta_widget, meta_area);

        let legend_area = dev_chunks[2];
        let legend_text = format_legend();
        frame.render_widget(Clear, legend_area);
        let legend_widget = Paragraph::new(legend_text)
            .block(Block::default().borders(Borders::ALL).title("Legend"))
            .style(Style::default().fg(text_primary()))
            .wrap(Wrap { trim: true });
        frame.render_widget(legend_widget, legend_area);

        frame.render_widget(Clear, input_area);
        let input_widget = Paragraph::new(input_line(app))
            .block(
                Block::default()
                    .borders(Borders::ALL)
                    .title("Seeker")
                    .border_style(Style::default().fg(text_accent())),
            );
        let input_widget = input_widget.style(Style::default().fg(text_primary()));
        frame.render_widget(input_widget, input_area);

        let x = input_area.x + 1 + app.input.len() as u16;
        let y = input_area.y + 1;
        frame.set_cursor_position((x, y));
    } else {
        let max_width = 80u16.min(size.width.saturating_sub(2));
        let max_height = 24u16.min(size.height.saturating_sub(2));
        let start_x = size.x + (size.width.saturating_sub(max_width)) / 2;
        let start_y = size.y + (size.height.saturating_sub(max_height)) / 2;

        let center_area = ratatui::layout::Rect {
            x: start_x,
            y: start_y,
            width: max_width,
            height: max_height,
        };

        let center_chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Length(12), Constraint::Length(1), Constraint::Length(11)])
            .split(center_area);

        let priestess_area = center_chunks[0];
        let seeker_area = center_chunks[2];

        let wrap_width = priestess_area.width as usize;
        if app.priestess_transition_ms > 0.0 && !app.priestess_prev.is_empty() {
            let progress = (app.priestess_transition_ms / app.priestess_transition_duration_ms).clamp(0.0, 1.0);
            let shift = (progress * 6.0).round() as usize;
            let faded = text_fade(1.0 - progress);
            let prev_lines = wrap_messages(&[app.priestess_prev.clone()], wrap_width);
            let shifted_prev = shift_left_lines(&prev_lines, shift);
            draw_centered_lines_sparse(frame, priestess_area, &shifted_prev, faded, true);
        }

        let priestess_line = if app.priestess_display.is_empty() {
            String::new()
        } else {
            app.priestess_display.clone()
        };
        let wrapped_lines = wrap_messages(&[priestess_line], wrap_width);
        draw_centered_lines_sparse(frame, priestess_area, &wrapped_lines, text_secondary(), true);

        let seeker_chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Length(1), Constraint::Min(1)])
            .split(seeker_area);
        let input_area = seeker_chunks[0];
        let submissions_area = seeker_chunks[1];

        draw_centered_line_with_suffix(frame, input_area, &app.input, text_primary(), stt_status_tag(app));

        let submissions = if app.seeker_last_line.is_empty() {
            Vec::new()
        } else {
            vec![app.seeker_last_line.clone()]
        };
        let submissions = suppress_faded_line(&submissions, &app.seeker_fade_line, app.seeker_fade_ms);
        let fade_color = if app.seeker_fade_ms > 0.0 {
            let progress = (app.seeker_fade_ms / app.seeker_fade_duration_ms).clamp(0.0, 1.0);
            text_fade(1.0 - progress)
        } else {
            text_primary()
        };
        draw_centered_lines_sparse_with_first_color(
            frame,
            submissions_area,
            &submissions,
            text_primary(),
            fade_color,
        );

        let input_len = app.input.chars().count();
        let width = input_area.width as usize;
        let pad = width.saturating_sub(input_len) / 2;
        let x = input_area.x + pad as u16 + input_len as u16;
        let y = input_area.y;
        draw_cursor_glyph(frame, x, y, text_accent());
    }
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
    if let Some(err) = &app.tts_error {
        lines.push(format!("tts_error: {}", err));
    }
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
    lines.push(format!("stt_recording: {}", app.stt_recording));
    lines.push(format!("stt_error: {}", app.stt_error.as_deref().unwrap_or("none")));
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
        "/consent  /covenant-text",
        "/welcome  /covenant",
        "/begin  /intromit",
        "/prescribe [tarot|iching]",
        "/thread  /redact <id>",
        "/delete  /token",
        "/reintegrate yes|no",
        "/totem status|init|export|import",
        "/sessions (completed count)",
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

fn shift_left_lines(lines: &[String], shift: usize) -> Vec<String> {
    if shift == 0 {
        return lines.to_vec();
    }
    lines
        .iter()
        .map(|line| {
            let mut chars: Vec<char> = line.chars().collect();
            if shift >= chars.len() {
                return String::new();
            }
            chars.drain(0..shift);
            chars.into_iter().collect()
        })
        .collect()
}

fn draw_centered_lines_sparse(
    frame: &mut Frame,
    area: ratatui::layout::Rect,
    lines: &[String],
    color: ratatui::style::Color,
    bottom_align: bool,
) {
    let buf = frame.buffer_mut();
    let height = area.height as usize;
    let start_row = if bottom_align && lines.len() < height {
        height - lines.len()
    } else {
        0
    };

    for (i, line) in lines.iter().enumerate() {
        let row = start_row + i;
        if row >= height {
            break;
        }
        let len = line.chars().count();
        let pad = (area.width as usize).saturating_sub(len) / 2;
        let y = area.y + row as u16;
        let mut x = area.x + pad as u16;
        for ch in line.chars() {
            if x >= area.x.saturating_add(area.width) {
                break;
            }
            if let Some(cell) = buf.cell_mut((x, y)) {
                let mut symbol_buf = [0u8; 4];
                let symbol = ch.encode_utf8(&mut symbol_buf);
                cell.set_symbol(symbol);
                cell.set_style(Style::default().fg(color));
            }
            x += 1;
        }
    }
}

fn draw_centered_line_with_suffix(
    frame: &mut Frame,
    area: ratatui::layout::Rect,
    line: &str,
    color: ratatui::style::Color,
    suffix: Option<(String, ratatui::style::Color)>,
) {
    let suffix_text = suffix
        .as_ref()
        .map(|(text, _)| format!(" {}", text))
        .unwrap_or_default();
    let full_len = line.chars().count() + suffix_text.chars().count();
    let pad = (area.width as usize).saturating_sub(full_len) / 2;
    let y = area.y;
    let mut x = area.x + pad as u16;
    let buf = frame.buffer_mut();

    for ch in line.chars() {
        if x >= area.x.saturating_add(area.width) {
            break;
        }
        if let Some(cell) = buf.cell_mut((x, y)) {
            let mut symbol_buf = [0u8; 4];
            let symbol = ch.encode_utf8(&mut symbol_buf);
            cell.set_symbol(symbol);
            cell.set_style(Style::default().fg(color));
        }
        x += 1;
    }

    if let Some((_, suffix_color)) = suffix {
        for ch in suffix_text.chars() {
            if x >= area.x.saturating_add(area.width) {
                break;
            }
            if let Some(cell) = buf.cell_mut((x, y)) {
                let mut symbol_buf = [0u8; 4];
                let symbol = ch.encode_utf8(&mut symbol_buf);
                cell.set_symbol(symbol);
                cell.set_style(Style::default().fg(suffix_color));
            }
            x += 1;
        }
    }
}

fn draw_cursor_glyph(frame: &mut Frame, x: u16, y: u16, color: ratatui::style::Color) {
    let buf = frame.buffer_mut();
    if let Some(cell) = buf.cell_mut((x, y)) {
        cell.set_symbol("▌");
        cell.set_style(Style::default().fg(color));
    }
}

fn draw_centered_lines_sparse_with_first_color(
    frame: &mut Frame,
    area: ratatui::layout::Rect,
    lines: &[String],
    color: ratatui::style::Color,
    first_color: ratatui::style::Color,
) {
    let buf = frame.buffer_mut();
    let height = area.height as usize;

    for (i, line) in lines.iter().enumerate() {
        if i >= height {
            break;
        }
        let len = line.chars().count();
        let pad = (area.width as usize).saturating_sub(len) / 2;
        let y = area.y + i as u16;
        let mut x = area.x + pad as u16;
        let line_color = if i == 0 { first_color } else { color };
        for ch in line.chars() {
            if x >= area.x.saturating_add(area.width) {
                break;
            }
            if let Some(cell) = buf.cell_mut((x, y)) {
                let mut symbol_buf = [0u8; 4];
                let symbol = ch.encode_utf8(&mut symbol_buf);
                cell.set_symbol(symbol);
                cell.set_style(Style::default().fg(line_color));
            }
            x += 1;
        }
    }
}

fn suppress_faded_line(lines: &[String], faded: &str, fade_ms: f32) -> Vec<String> {
    if faded.is_empty() || fade_ms > 0.0 {
        return lines.to_vec();
    }
    let mut out = Vec::with_capacity(lines.len());
    let mut removed = false;
    for line in lines {
        if !removed && line == faded {
            removed = true;
            continue;
        }
        out.push(line.clone());
    }
    out
}

fn stt_status_tag(app: &App) -> Option<(String, ratatui::style::Color)> {
    if app.stt_error.is_some() {
        return Some(("[ stt error ]".to_string(), text_warning()));
    }
    if app.stt_recording {
        return Some(("[ ● rec ]".to_string(), text_accent()));
    }
    if app.stt_transcribing() {
        return Some(("[ … ]".to_string(), text_fade(0.7)));
    }
    None
}

fn input_line(app: &App) -> Line<'static> {
    let mut spans = Vec::new();
    spans.push(Span::styled(
        app.input.clone(),
        Style::default().fg(text_primary()),
    ));
    if let Some((text, color)) = stt_status_tag(app) {
        spans.push(Span::styled(format!(" {}", text), Style::default().fg(color)));
    }
    Line::from(spans)
}

// center clearing now handled by aura's torus math
