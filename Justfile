project := "ouracle"

greet name:
    echo "Welcome, {{name}}, to {{project}}."

set shell := ["fish", "-c"]

web:
    cd apps/web; bun run dev --host

api:
    cd api; bun dev

tui:
    cd apps/tui; cargo watch -x 'run'

dev:
    bash -lc 'trap \"kill 0\" EXIT INT TERM; (cd api && bun run dev) & (cd apps/web && bun run dev --host) & wait'
