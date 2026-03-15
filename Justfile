project := "ouracle"

greet name:
    echo "Welcome, {{name}}, to {{project}}."

set shell := ["fish", "-c"]

apid:
    cd api; bun dev

api:
    cd api; bun start

tui:
    cd apps/ripltui; cargo run

tuiw:
    cd apps/ripltui; cargo watch -x 'run'
