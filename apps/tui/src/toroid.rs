use std::f32::consts::PI;
use std::time::{Duration, Instant};
use color_eyre::eyre::Result;
use crossterm::{
    event::{self, Event, KeyCode},
    terminal::{disable_raw_mode, enable_raw_mode, Clear, ClearType},
    ExecutableCommand,
};
use std::io::{stdout, Write};

const COLS: usize = 40;
const ROWS: usize = 24;

const BRAILLE_BASE: u32 = 0x2800;

fn braille_char(brightness: u8) -> char {
    let brightness = brightness.min(6);
    let patterns: [u8; 7] = [0, 1, 3, 7, 15, 31, 63];
    let code = BRAILLE_BASE + patterns[brightness as usize] as u32;
    char::from_u32(code).unwrap_or(' ')
}

#[derive(Clone, Copy)]
struct Torus {
    r_major: f32,
    r_minor: f32,
    k: f32,
    rot_speed: f32,
}

impl Torus {
    fn new(r_major: f32, r_minor: f32, k: f32) -> Self {
        Self {
            r_major,
            r_minor,
            k,
            rot_speed: 0.5,
        }
    }

    fn sample(&self, u: f32, v: f32) -> (f32, f32, f32) {
        let v_fold = v + self.k * u;
        let x = (self.r_major + self.r_minor * v_fold.cos()) * u.cos();
        let y = (self.r_major + self.r_minor * v_fold.cos()) * u.sin();
        let z = self.r_minor * v_fold.sin();
        (x, y, z)
    }

    fn normal(&self, u: f32, v: f32) -> (f32, f32, f32) {
        let v_fold = v + self.k * u;
        let dxdu = -(self.r_major + self.r_minor * v_fold.cos()) * u.sin();
        let dydu =  (self.r_major + self.r_minor * v_fold.cos()) * u.cos();
        let dzdu = -self.r_minor * v_fold.sin() * self.k;

        let dxdv = -self.r_minor * v_fold.sin() * u.cos();
        let dydv = -self.r_minor * v_fold.sin() * u.sin();
        let dzdv =  self.r_minor * v_fold.cos();

        let nx = dydu * dzdv - dzdu * dydv;
        let ny = dzdu * dxdv - dxdu * dzdv;
        let nz = dxdu * dydv - dydu * dxdv;
        let len = (nx*nx + ny*ny + nz*nz).sqrt();
        if len == 0.0 { (0.0, 0.0, 1.0) } else { (nx/len, ny/len, nz/len) }
    }
}

fn render_frame(torus: &Torus, time: f32, scale: f32) -> [[u8; COLS]; ROWS] {
    let width = COLS as f32;
    let height = ROWS as f32;

    let light = (1.0f32, -1.0f32, 1.0f32);
    let light_len = (light.0*light.0 + light.1*light.1 + light.2*light.2).sqrt();
    let light = (light.0/light_len, light.1/light_len, light.2/light_len);

    let rot_y = time * torus.rot_speed;
    let rot_x = time * torus.rot_speed * 0.6;

    let cy = rot_y.cos();
    let sy = rot_y.sin();
    let cx = rot_x.cos();
    let sx = rot_x.sin();

    let mut grid = [[0.0f32; COLS]; ROWS];

    let u_steps = 80;
    let v_steps = 40;
    for iu in 0..u_steps {
        let u = 2.0 * PI * (iu as f32) / (u_steps as f32);
        for iv in 0..v_steps {
            let v = 2.0 * PI * (iv as f32) / (v_steps as f32);
            let (x, y, z) = torus.sample(u, v);

            // Rotate
            let (x1, z1) = (x * cy - z * sy, x * sy + z * cy);
            let (y2, z2) = (y * cx - z1 * sx, y * sx + z1 * cx);
            let x2 = x1;

            // Project
            let d = 3.0 * torus.r_major;
            let denom = d + z2;
            if denom <= 0.1 { continue; }

            let proj_x = width/2.0 + scale * x2 / denom;
            let proj_y = height/2.0 + scale * y2 / denom;

            // Normal
            let (nx, ny, nz) = torus.normal(u, v);
            let (nx1, nz1) = (nx * cy - nz * sy, nx * sy + nz * cy);
            let (ny2, nz2) = (ny * cx - nz1 * sx, ny * sx + nz1 * cx);
            let nx2 = nx1;

            let dot = nx2*light.0 + ny2*light.1 + nz2*light.2;
            let brightness = dot.max(0.0).min(1.0);

            let col = proj_x.round() as isize;
            let row = proj_y.round() as isize;
            if col >= 0 && col < COLS as isize && row >= 0 && row < ROWS as isize {
                let cell = &mut grid[row as usize][col as usize];
                if *cell < brightness {
                    *cell = brightness;
                }
            }
        }
    }

    let mut out = [[0u8; COLS]; ROWS];
    for r in 0..ROWS {
        for c in 0..COLS {
            let level = (grid[r][c] * 7.0).round() as u8;
            out[r][c] = level.min(6);
        }
    }
    out
}

fn grid_to_string(grid: &[[u8; COLS]; ROWS]) -> String {
    let mut s = String::with_capacity(ROWS * (COLS + 2));
    for r in 0..ROWS {
        for c in 0..COLS {
            s.push(braille_char(grid[r][c]));
        }
        if r < ROWS - 1 { s.push('\n'); }
    }
    s
}

pub fn run() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let mut speed = 1.0f32;
    let mut scale = 12.0f32;
    let mut knot = 3.0f32;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--speed" if i + 1 < args.len() => { speed = args[i+1].parse().unwrap_or(speed); i += 2; }
            "--scale" if i + 1 < args.len() => { scale = args[i+1].parse().unwrap_or(scale); i += 2; }
            "--knot" if i + 1 < args.len() => { knot = args[i+1].parse().unwrap_or(knot); i += 2; }
            _ => { i += 1; }
        }
    }

    let torus = Torus::new(1.0, 0.4, knot);

    enable_raw_mode()?;
    let mut out = stdout();
    out.execute(Clear(ClearType::All))?;
    out.flush().ok();

    let start = Instant::now();
    let target_fps = 30.0;
    let frame_duration = Duration::from_secs_f32(1.0 / target_fps);

    loop {
        let frame_start = Instant::now();
        let elapsed = start.elapsed().as_secs_f32();
        let t = elapsed * speed;

        let grid = render_frame(&torus, t, scale);
        let frame = grid_to_string(&grid);

        out.execute(crossterm::cursor::MoveTo(0, 0))?;
        write!(out, "{}", frame)?;
        out.flush()?;

        if event::poll(Duration::from_millis(1)).unwrap_or(false) {
            if let Ok(Event::Key(key)) = event::read() {
                match key.code {
                    KeyCode::Char('q') | KeyCode::Esc => break,
                    KeyCode::Char('+') => { scale += 0.5; }
                    KeyCode::Char('-') => { scale = (scale - 0.5).max(1.0); }
                    KeyCode::Char(']') => { speed += 0.1; }
                    KeyCode::Char('[') => { speed = (speed - 0.1).max(0.1); }
                    _ => {}
                }
            }
        }

        let elapsed_frame = frame_start.elapsed();
        if elapsed_frame < frame_duration {
            std::thread::sleep(frame_duration - elapsed_frame);
        }
    }

    disable_raw_mode()?;
    out.execute(Clear(ClearType::All))?;
    out.execute(crossterm::cursor::Show)?;
    println!("Goodbye.");
    Ok(())
}
