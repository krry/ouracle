use color_eyre::eyre::Result;
use crossterm::{
    ExecutableCommand,
    event::{self, Event, KeyCode},
    terminal::{Clear, ClearType, disable_raw_mode, enable_raw_mode},
};
use std::f32::consts::PI;
use std::io::{Write, stdout};
use std::time::Duration;

const FIXED_COLS: usize = 40;
const FIXED_ROWS: usize = 24;
const BRAILLE_BASE: u32 = 0x2800;
const BRAILLE_ALL_DOTS: u8 = 63; // ⣿

fn braille_char(on: bool) -> char {
    if on {
        char::from_u32(BRAILLE_BASE + BRAILLE_ALL_DOTS as u32).unwrap_or('⣿')
    } else {
        ' '
    }
}

fn get_terminal_size() -> (usize, usize) {
    match crossterm::terminal::size() {
        Ok((cols, rows)) => (cols as usize, rows as usize),
        Err(_) => (80, 24),
    }
}

// Draw a circle outline (one cell thick) into the grid.
// Grid is 40×24; center (20,12); radius 9 cells.
fn render_circle(grid: &mut [bool]) {
    let cx = FIXED_COLS as f32 / 2.0;
    let cy = FIXED_ROWS as f32 / 2.0;
    let radius = 9.0;

    // Parameterize by angle, place points on the circumference.
    let steps = 100;
    for i in 0..steps {
        let theta = 2.0 * PI * (i as f32) / (steps as f32);
        let x = (cx + radius * theta.cos()).round() as usize;
        let y = (cy + radius * theta.sin()).round() as usize;
        if x < FIXED_COLS && y < FIXED_ROWS {
            let idx = y * FIXED_COLS + x;
            grid[idx] = true;
        }
    }
}

fn grid_to_string(grid: &[bool], actual_cols: usize, actual_rows: usize) -> String {
    let row_offset = (actual_rows.saturating_sub(FIXED_ROWS)) / 2;
    let col_offset = (actual_cols.saturating_sub(FIXED_COLS)) / 2;

    let mut s = String::with_capacity(actual_rows * (actual_cols + 2));
    for r in 0..actual_rows {
        for c in 0..actual_cols {
            if r >= row_offset
                && r < row_offset + FIXED_ROWS
                && c >= col_offset
                && c < col_offset + FIXED_COLS
            {
                let index = (r - row_offset) * FIXED_COLS + (c - col_offset);
                s.push(braille_char(grid[index]));
            } else {
                s.push(' ');
            }
        }
        if r < actual_rows - 1 {
            s.push('\n');
        }
    }
    s
}

fn render_static_logo(actual_cols: usize, actual_rows: usize) -> String {
    let logo = [
        "  _____                 _   _                 ",
        " |_   _|__ _ __  _ __  | |_| |__   ___  _ __  ",
        "   | |/ _ \\ '_ \\| '_ \\ | __| '_ \\ / _ \\| '_ \\ ",
        "   | |  __/ |_) | | | || |_| | | | (_) | | | |",
        "   |_|\\___| .__/|_| |_| \\__|_| |_|\\___/|_| |_|",
        "          |_|                                  ",
    ];
    let logo_height = logo.len();
    let logo_width = logo[0].len();
    let row_offset = (actual_rows.saturating_sub(logo_height)) / 2;
    let col_offset = (actual_cols.saturating_sub(logo_width)) / 2;

    let mut s = String::with_capacity(actual_rows * (actual_cols + 2));
    for r in 0..actual_rows {
        for c in 0..actual_cols {
            if r >= row_offset && r < row_offset + logo_height {
                let logo_row = r - row_offset;
                if c >= col_offset && c < col_offset + logo_width {
                    let ch = logo[logo_row].chars().nth(c - col_offset).unwrap_or(' ');
                    s.push(ch);
                } else {
                    s.push(' ');
                }
            } else {
                s.push(' ');
            }
        }
        if r < actual_rows - 1 {
            s.push('\n');
        }
    }
    s
}

pub fn run() -> Result<()> {
    let (actual_cols, actual_rows) = get_terminal_size();

    // Debug/check mode: print one frame and exit
    if std::env::var("TOROID_DUMP").is_ok() {
        let frame = if actual_cols >= FIXED_COLS && actual_rows >= FIXED_ROWS {
            let mut grid = vec![false; FIXED_COLS * FIXED_ROWS];
            render_circle(&mut grid);
            grid_to_string(&grid, actual_cols, actual_rows)
        } else {
            render_static_logo(actual_cols, actual_rows)
        };
        println!("{}", frame);
        return Ok(());
    }

    // Interactive mode
    enable_raw_mode()?;
    let mut out = stdout();
    out.execute(Clear(ClearType::All))?;
    out.flush().ok();

    loop {
        let frame = if actual_cols >= FIXED_COLS && actual_rows >= FIXED_ROWS {
            let mut grid = vec![false; FIXED_COLS * FIXED_ROWS];
            render_circle(&mut grid);
            // Future: animate dots here
            grid_to_string(&grid, actual_cols, actual_rows)
        } else {
            render_static_logo(actual_cols, actual_rows)
        };

        out.execute(crossterm::cursor::MoveTo(0, 0))?;
        write!(out, "{}", frame)?;
        out.flush()?;

        if event::poll(Duration::from_millis(50))?
            && let Event::Key(key) = event::read()?
            && (key.code == KeyCode::Char('q')
                || key.code == KeyCode::Esc
                || key.code == KeyCode::Enter)
        {
            break;
        }
    }

    disable_raw_mode()?;
    out.execute(Clear(ClearType::All))?;
    out.execute(crossterm::cursor::Show)?;
    println!("Goodbye.");
    Ok(())
}
