use std::time::Duration;

use rand::{rngs::StdRng, Rng, SeedableRng};
use ratatui::{
    layout::Rect,
    style::Style,
    Frame,
};

use crate::theme::aura_color;

/// Slow breathing phase of the aura.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BreathPhase {
    Inhale,
    Exhale,
}

/// Glyph palette used by the aura renderer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuraGlyphMode {
    Braille,
    Taz,
    Math,
    Mahjong,
    Dominoes,
    Cards,
}

/// An expanding ripple started when the Priestess speaks.
#[derive(Debug, Clone)]
pub struct Ripple {
    pub t0: f32,
    pub speed: f32,
    pub width: f32,
    pub strength: f32,
    pub center: Option<(f32, f32)>,
    pub start_radius: f32,
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
    glyph_mode: AuraGlyphMode,
    braille_by_dots: [Vec<u8>; 9],
}

impl Aura {
    pub fn new() -> Self {
        let mut braille_by_dots = std::array::from_fn(|_| Vec::new());
        for pattern in 0u16..=255 {
            let dots = (pattern as u8).count_ones() as usize;
            braille_by_dots[dots].push(pattern as u8);
        }
        Aura {
            frame: 0,
            time_s: 0.0,
            phase: BreathPhase::Inhale,
            breath_t: 0.0,
            breath_duration: 60.0 / 7.0,
            ripples: Vec::new(),
            rng: StdRng::from_entropy(),
            glyph_mode: AuraGlyphMode::Braille,
            braille_by_dots,
        }
    }

    pub fn set_glyph_mode(&mut self, mode: AuraGlyphMode) {
        self.glyph_mode = mode;
    }

    pub fn glyph_mode(&self) -> AuraGlyphMode {
        self.glyph_mode
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
    pub fn launch_ripples(&mut self, base_strength: f32, pace: f32) {
        let now = self.time_s;
        for i in 0..3 {
            let jitter = (i as f32) * 0.1;
            let strength = (base_strength * (0.8 + 0.4 * self.rng.r#gen::<f32>())).clamp(0.0, 1.0);
            let speed = (0.35 + 0.2 * self.rng.r#gen::<f32>()) * pace.clamp(0.6, 2.4);
            let width = 0.1 + 0.05 * self.rng.r#gen::<f32>();
            self.ripples.push(Ripple {
                t0: now + jitter,
                speed,
                width,
                strength,
                center: None,
                start_radius: 1.0,
            });
        }
    }

    /// Launch a ripple centered at a mouse click, outside the hole.
    pub fn launch_ripple_at(&mut self, x: u16, y: u16, area: Rect, pace: f32) {
        let (hx, hy, cx, cy) = hole_geometry(area);
        let dx = x as f32 - cx;
        let dy = y as f32 - cy;
        let nx = dx / hx;
        let ny = dy / hy;
        let e = (nx * nx + ny * ny).sqrt();
        if e < 1.0 {
            return;
        }

        for i in 0..3 {
            let jitter = (i as f32) * 0.06;
            let strength = 0.75 + 0.25 * self.rng.r#gen::<f32>();
            let speed = (0.55 + 0.35 * self.rng.r#gen::<f32>()) * pace.clamp(0.6, 2.4);
            let width = 0.10 + 0.06 * self.rng.r#gen::<f32>();
            self.ripples.push(Ripple {
                t0: self.time_s + jitter,
                speed,
                width,
                strength,
                center: Some((nx, ny)),
                start_radius: 0.0,
            });
        }
    }

    /// Main render entry. `voice_intensity` is 0..1.
    pub fn render(&mut self, frame: &mut Frame, area: Rect, voice_intensity: f32) {
        let width = area.width as usize;
        let height = area.height as usize;

        if width == 0 || height == 0 {
            return;
        }

        let breath_env = self.breath_envelope();

        let cx = area.x as f32 + (area.width as f32 / 2.0);
        let cy = area.y as f32 + (area.height as f32 / 2.0);
        let max_dist = ((area.width as f32).hypot(area.height as f32)) / 2.0;

        let buf = frame.buffer_mut();

        for row in 0..height {
            for col in 0..width {
                let x = area.x as u16 + col as u16;
                let y = area.y as u16 + row as u16;

                let dx = x as f32 - cx;
                let dy = y as f32 - cy;
                let dist = (dx * dx + dy * dy).sqrt();
                let _r = (dist / max_dist).clamp(0.0, 1.0);

                // Match hole size to the 80x24 conversation block.
                let (hx, hy, _, _) = hole_geometry(area);

                let nx = dx / hx;
                let ny = dy / hy;
                let e = (nx * nx + ny * ny).sqrt();

                let ring_start: f32 = 1.0;
                let ring_width: f32 = 0.35;
                let ring_end = ring_start + ring_width;

                let noise = self.noise3(col as u32, row as u32, self.frame / 2) * 0.06;
                let shimmer = self.noise3(col as u32, row as u32, self.frame / 5);

                if e < ring_start {
                    let Some(cell) = buf.cell_mut((x, y)) else {
                        continue;
                    };
                    // Clear the hole every frame to avoid residual artifacts.
                    cell.set_symbol(" ");
                    cell.set_style(Style::default());

                    // Very light mist in the hole.
                    let mist = (noise * 0.7 + breath_env * 0.03 + (shimmer - 0.5) * 0.05).clamp(0.0, 1.0);
                    if mist < 0.18 {
                        continue;
                    }
                    let (ch, _) = self.glyph_for_energy_stochastic(mist, noise);
                    let mut symbol_buf = [0u8; 4];
                    let symbol = ch.encode_utf8(&mut symbol_buf);
                    cell.set_symbol(symbol);
                    let color = aura_color(mist, noise, shimmer);
                    cell.set_style(Style::default().fg(color));
                    continue;
                }

                let ring_t = ((e - ring_start) / (ring_end - ring_start)).clamp(0.0, 1.0);
                let ring_env = smoothstep(0.0, 1.0, ring_t);

                let base_energy = match self.phase {
                    BreathPhase::Inhale => breath_env * (1.0 - ring_t),
                    BreathPhase::Exhale => breath_env * ring_t,
                };

                let ripple_energy = self.ripple_energy(e, nx, ny, shimmer, noise);

                let ripple_mod = 0.45 + 0.35 * shimmer;
                let mut energy = (base_energy * 0.55 + ripple_energy * ripple_mod + noise + 0.05) * ring_env;
                energy *= 0.55 + 0.35 * voice_intensity;
                let mut energy = energy.clamp(0.0, 1.0);

                let jitter = (self.noise3(col as u32, row as u32, self.frame.wrapping_add(17) / 3) - 0.5) * 0.14;
                energy = (energy + jitter).clamp(0.0, 1.0);

                let blank_gate = self.noise3(col as u32, row as u32, self.frame / 4);
                let blank_thresh = if ripple_energy > 0.04 { 0.46 } else { 0.36 };
                if blank_gate < blank_thresh && energy < 0.7 {
                    continue;
                }

                let (ch, _tier) = self.glyph_for_energy_stochastic(energy, noise);
                let Some(cell) = buf.cell_mut((x, y)) else {
                    continue;
                };
                let mut symbol_buf = [0u8; 4];
                let symbol = ch.encode_utf8(&mut symbol_buf);
                cell.set_symbol(symbol);
                let color = aura_color(energy, noise, shimmer);
                cell.set_style(Style::default().fg(color));
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

    fn ripple_energy(&self, r: f32, nx: f32, ny: f32, shimmer: f32, noise: f32) -> f32 {
        let mut acc = 0.0;
        for ripple in &self.ripples {
            let age = self.time_s - ripple.t0;
            if age < 0.0 {
                continue;
            }
            let wobble = (shimmer - 0.5) * 0.08 + (noise - 0.5) * 0.06;
            let center_r = ripple.start_radius + ripple.speed * age * (1.0 + wobble);
            let dist = if let Some((cx, cy)) = ripple.center {
                let dx = nx - cx;
                let dy = ny - cy;
                (dx * dx + dy * dy).sqrt()
            } else {
                r
            };
            let dr = (dist - center_r).abs();
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

    fn glyph_for_energy_stochastic(&mut self, e: f32, _noise: f32) -> (char, u8) {
        const ENERGY_FLOOR: f32 = 0.12;
        const TIERS: usize = 4;

        if e < ENERGY_FLOOR {
            return (' ', 0);
        }

        let t = ((e - ENERGY_FLOOR) / (1.0 - ENERGY_FLOOR)).clamp(0.0, 1.0);
        let tier = (t * TIERS as f32).floor().min((TIERS - 1) as f32) as usize;

        match self.glyph_mode {
            AuraGlyphMode::Braille => {
                let t_skew = t.powf(2.2);
                let mut dots = 1 + (t_skew * 7.999).floor() as u8;
                // Bias toward lighter densities (0–2 dots).
                let roll = self.rng.r#gen::<f32>();
                if roll < 0.28 {
                    dots = dots.saturating_sub(1);
                }
                if roll < 0.12 {
                    dots = dots.saturating_sub(1);
                }
                if dots == 0 {
                    return (' ', 0);
                }
                let list = &self.braille_by_dots[dots as usize];
                let idx = self.rng.gen_range(0..list.len());
                let pattern = list[idx];
                (braille_char(pattern), dots)
            }
            AuraGlyphMode::Taz => {
                let ch = sample_tier(&mut self.rng, TAZ_TIERS[tier]);
                (ch, (tier + 1) as u8)
            }
            AuraGlyphMode::Math => {
                let ch = sample_tier(&mut self.rng, MATH_TIERS[tier]);
                (ch, (tier + 1) as u8)
            }
            AuraGlyphMode::Mahjong => {
                let ch = sample_tier(&mut self.rng, MAHJONG_TIERS[tier]);
                (ch, (tier + 1) as u8)
            }
            AuraGlyphMode::Dominoes => {
                let ch = sample_tier(&mut self.rng, DOMINOES_TIERS[tier]);
                (ch, (tier + 1) as u8)
            }
            AuraGlyphMode::Cards => {
                let ch = sample_tier(&mut self.rng, CARDS_TIERS[tier]);
                (ch, (tier + 1) as u8)
            }
        }
    }
}

fn braille_char(pattern: u8) -> char {
    char::from_u32(0x2800 + pattern as u32).unwrap_or(' ')
}

fn sample_tier(rng: &mut StdRng, tier: &[char]) -> char {
    if tier.is_empty() {
        return ' ';
    }
    let idx = rng.gen_range(0..tier.len());
    tier[idx]
}

const TAZ_TIERS: [&[char]; 4] = [
    &['.', ',', ':', '\''],
    &['!', '?', ';', '~', '^'],
    &['@', '#', '$', '%', '&'],
    &['*', '¶', '§', '†', '‽', '∅'],
];

const MATH_TIERS: [&[char]; 4] = [
    &['+', '-', '=', '·', '×', '÷'],
    &['±', '≈', '≠', '≤', '≥', '∝', '√'],
    &['∑', '∏', '∫', '∂', '∞', '∇'],
    &['∮', '∴', '∵', '∃', '∀', '∘', '⊕', '⊗'],
];

const MAHJONG_TIERS: [&[char]; 4] = [
    &['🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀍', '🀎', '🀏'],
    &['🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀖', '🀗', '🀘'],
    &['🀀', '🀁', '🀂', '🀃', '🀄', '🀅', '🀆'],
    &['🀙', '🀚', '🀛', '🀜', '🀝', '🀞', '🀟', '🀠', '🀡', '🀢', '🀣', '🀤', '🀥', '🀦', '🀧', '🀨', '🀩', '🀪', '🀫'],
];

const DOMINOES_TIERS: [&[char]; 4] = [
    &['🀰', '🀱', '🀲', '🀳', '🀴', '🀵', '🀶', '🀷'],
    &['🀸', '🀹', '🀺', '🀻', '🀼', '🀽', '🀾', '🀿'],
    &['🁀', '🁁', '🁂', '🁃', '🁄', '🁅', '🁆', '🁇'],
    &['🁈', '🁉', '🁊', '🁋', '🁌', '🁍', '🁎', '🁏'],
];

const CARDS_TIERS: [&[char]; 4] = [
    &['🂡', '🂢', '🂣', '🂤', '🂥', '🂦', '🂧', '🂨', '🂩'],
    &['🂱', '🂲', '🂳', '🂴', '🂵', '🂶', '🂷', '🂸', '🂹'],
    &['🃁', '🃂', '🃃', '🃄', '🃅', '🃆', '🃇', '🃈', '🃉'],
    &['🃑', '🃒', '🃓', '🃔', '🃕', '🃖', '🃗', '🃘', '🃙'],
];

fn hole_geometry(area: Rect) -> (f32, f32, f32, f32) {
    let target_half_w: f32 = 32.0;
    let target_half_h: f32 = 9.0;
    let half_w = (area.width as f32 / 2.0).max(1.0);
    let half_h = (area.height as f32 / 2.0).max(1.0);
    let hx = target_half_w.min(half_w - 1.0).max(1.0);
    let hy = target_half_h.min(half_h - 1.0).max(1.0);
    let cx = area.x as f32 + (area.width as f32 / 2.0);
    let cy = area.y as f32 + (area.height as f32 / 2.0);
    (hx, hy, cx, cy)
}

fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
