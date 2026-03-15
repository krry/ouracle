project := "ouracle"

greet name:
    echo "Welcome, {{name}}, to {{project}}."

set shell := ["fish", "-c"]

dev:
    fish -c 'cd api; bun dev' & fish -c 'cd apps/web; bun run dev'

apid:
    cd api; bun dev

webd:
    cd apps/web; bun run dev

api:
    cd api; bun start

tui:
    cd apps/ripltui; cargo run

tuiw:
    cd apps/ripltui; cargo watch -x 'run'
