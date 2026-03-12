use ratatui::{
    style::{Color, Style},
    widgets::{Block, Borders},
    Frame,
};
use ratatui::prelude::{Rect};

pub struct Aura {
    t: u64,
}

impl Aura {
    pub fn new() -> Self {
        Aura { t: 0 }
    }

    pub fn tick(&mut self) {
        self.t = self.t.wrapping_add(1);
    }

    pub fn render(&self, frame: &mut Frame, area: Rect) {
        // For now, just render a border with a color that slowly shifts.
        let colors = [Color::DarkGray, Color::Gray, Color::LightBlue, Color::Magenta];
        let idx = (self.t as usize / 5) % colors.len();
        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(colors[idx]));
        frame.render_widget(block, area);
    }
}
