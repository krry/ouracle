project := "ouracle"

greet name:
    echo "Welcome, {{name}}, to {{project}}."

set shell := ["fish", "-c"]

apid:
    cd api; bun dev

api:
    cd api; bun start

tui:
    cd apps/tui; cargo run

tuid:
    cd apps/tui; cargo watch -x 'run'
