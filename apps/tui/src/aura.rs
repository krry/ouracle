use std::time::Duration;

use rand::{rngs::StdRng, Rng, SeedableRng};
use ratatui::{
    layout::Rect,
    style::{Color, Style},
    Frame,
};

/// Slow breathing phase of the aura.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BreathPhase {
    Inhale,
    Exhale,
}

/// An expanding ripple started when the Priestess speaks.
#[derive(Debug, Clone)]
pub struct Ripple {
    pub t0: f32,
    pub speed: f32,
    pub width: f32,
    pub strength: f32,
}

/// Aura state: breathing field + ripples + RNG for puffs.
pub struct Aura {
    frame: u64,
    time_s: f32,
    phase: BreathPhase,
    breath_t: f32,
    breath_duration: f32,
    ripples: Vec<Ripple>,
    rng: StdRng,
}

impl Aura {
    pub fn new() -> Self {
        Aura {
            frame: 0,
            time_s: 0.0,
            phase: BreathPhase::Inhale,
            breath_t: 0.0,
            breath_duration: 60.0 / 7.0,
            ripples: Vec::new(),
            rng: StdRng::from_entropy(),
        }
    }

    /// Advance time and breath phase.
    pub fn tick(&mut self, dt: Duration) {
        self.frame = self.frame.wrapping_add(1);
        let dt_s = dt.as_secs_f32();
        self.time_s += dt_s;

        self.breath_t += dt_s / self.breath_duration;
        if self.breath_t >= 1.0 {
            self.breath_t -= 1.0;
            self.phase = match self.phase {
                BreathPhase::Inhale => BreathPhase::Exhale,
                BreathPhase::Exhale => BreathPhase::Inhale,
            };
        }

        let max_age = self.breath_duration * 3.0;
        self.ripples.retain(|r| self.time_s - r.t0 <= max_age);
    }

    /// Launch one or more ripples when the Priestess begins speaking.
    pub fn launch_ripples(&mut self, base_strength: f32) {
        let now = self.time_s;
        for i in 0..3 {
            let jitter = (i as f32) * 0.1;
            let strength = (base_strength * (0.8 + 0.4 * self.rng.r#gen::<f32>())).clamp(0.0, 1.0);
            let speed = 0.2 + 0.1 * self.rng.r#gen::<f32>();
            let width = 0.1 + 0.05 * self.rng.r#gen::<f32>();
            self.ripples.push(Ripple {
                t0: now + jitter,
                speed,
                width,
                strength,
            });
        }
    }

    /// Main render entry. `voice_intensity` is 0..1.
    pub fn render(&self, frame: &mut Frame, area: Rect, voice_intensity: f32) {
        let width = area.width as usize;
        let height = area.height as usize;

        if width == 0 || height == 0 {
            return;
        }

        let breath_env = self.breath_envelope();

        let cx = area.x as f32 + (area.width as f32 / 2.0);
        let cy = area.y as f32 + (area.height as f32 / 2.0);
        let max_dist = ((area.width as f32).hypot(area.height as f32)) / 2.0;

        let style = Style::default().fg(Color::Rgb(90, 150, 220));
        let buf = frame.buffer_mut();

        for row in 0..height {
            for col in 0..width {
                let x = area.x as u16 + col as u16;
                let y = area.y as u16 + row as u16;

                let dx = x as f32 - cx;
                let dy = y as f32 - cy;
                let dist = (dx * dx + dy * dy).sqrt();
                let r = (dist / max_dist).clamp(0.0, 1.0);

                let inner_radius: f32 = 0.30;
                let ring_width: f32 = 0.20;
                let ring_start = inner_radius;
                let ring_end = (inner_radius + ring_width).min(0.95_f32);

                let nx = dx / (area.width as f32 / 2.0);
                let ny = dy / (area.height as f32 / 2.0);
                let e = (nx * nx + ny * ny).sqrt().clamp(0.0, 1.0);

                let noise = self.noise3(col as u32, row as u32, self.frame / 2) * 0.06;

                if e < ring_start {
                    let mist = (noise + breath_env * 0.05).clamp(0.0, 1.0);
                    if mist < 0.12 {
                        continue;
                    }
                    let (ch, _) = Self::glyph_for_energy_stochastic(mist, noise);
                    let Some(cell) = buf.cell_mut((x, y)) else {
                        continue;
                    };
                    let mut symbol_buf = [0u8; 4];
                    let symbol = ch.encode_utf8(&mut symbol_buf);
                    cell.set_symbol(symbol);
                    cell.set_style(style);
                    continue;
                }

                let ring_t = ((e - ring_start) / (ring_end - ring_start)).clamp(0.0, 1.0);
                let ring_env = smoothstep(0.0, 1.0, ring_t);

                let base_energy = match self.phase {
                    BreathPhase::Inhale => breath_env * (1.0 - ring_t),
                    BreathPhase::Exhale => breath_env * ring_t,
                };

                let ripple_energy = self.ripple_energy(r);

                let mut energy = (base_energy * 0.55 + ripple_energy * 0.85 + noise + 0.05) * ring_env;
                energy *= 0.55 + 0.35 * voice_intensity;
                let mut energy = energy.clamp(0.0, 1.0);

                let jitter = (self.noise3(col as u32, row as u32, self.frame.wrapping_add(17) / 3) - 0.5) * 0.14;
                energy = (energy + jitter).clamp(0.0, 1.0);

                let blank_gate = self.noise3(col as u32, row as u32, self.frame / 4);
                if blank_gate < 0.32 && energy < 0.55 {
                    continue;
                }

                let (ch, _) = Self::glyph_for_energy_stochastic(energy, noise);
                let Some(cell) = buf.cell_mut((x, y)) else {
                    continue;
                };
                let mut symbol_buf = [0u8; 4];
                let symbol = ch.encode_utf8(&mut symbol_buf);
                cell.set_symbol(symbol);
                cell.set_style(style);
            }
        }
    }

    fn breath_envelope(&self) -> f32 {
        let s = (std::f32::consts::PI * self.breath_t).sin().max(0.0);
        match self.phase {
            BreathPhase::Inhale => s,
            BreathPhase::Exhale => s,
        }
    }

    fn ripple_energy(&self, r: f32) -> f32 {
        let mut acc = 0.0;
        for ripple in &self.ripples {
            let age = self.time_s - ripple.t0;
            if age < 0.0 {
                continue;
            }
            let center_r = ripple.speed * age;
            let dr = (r - center_r).abs();
            let ring_env = (1.0 - (dr / ripple.width)).clamp(0.0, 1.0);
            let max_age = self.breath_duration * 3.0;
            let time_env = (1.0 - age / max_age).clamp(0.0, 1.0);
            acc += ripple.strength * ring_env * time_env;
        }
        acc
    }

    fn noise3(&self, x: u32, y: u32, z: u64) -> f32 {
        let mut h = x.wrapping_mul(374761393)
            ^ y.wrapping_mul(668265263)
            ^ (z as u32).wrapping_mul(2246822519);
        h = (h ^ (h >> 13)).wrapping_mul(1274126177);
        let v = (h ^ (h >> 16)) & 0xffff;
        (v as f32) / 65535.0
    }

    fn glyph_for_energy_stochastic(e: f32, noise: f32) -> (char, u8) {
        let n = (noise * 7.0).floor() as i32;
        if e < 0.12 {
            (' ', 0)
        } else if e < 0.28 {
            match n % 3 {
                0 => ('⠁', 1),
                1 => ('⠂', 1),
                _ => ('⠄', 1),
            }
        } else if e < 0.5 {
            match n % 4 {
                0 => ('⠆', 2),
                1 => ('⠇', 2),
                2 => ('⠒', 2),
                _ => ('⠖', 2),
            }
        } else if e < 0.75 {
            match n % 4 {
                0 => ('⠦', 3),
                1 => ('⠧', 3),
                2 => ('⠶', 3),
                _ => ('⠷', 3),
            }
        } else {
            match n % 3 {
                0 => ('⣿', 4),
                1 => ('⣷', 4),
                _ => ('⣯', 4),
            }
        }
    }
}

fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
