project := "ouracle"

greet name:
    echo "Welcome, {{name}}, to {{project}}."

set shell := ["fish", "-c"]

web:
    cd apps/web; bun run dev

api:
    cd api; bun dev

tui:
    cd apps/tui; cargo watch -x 'run'
