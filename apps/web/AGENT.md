# Note for Agents: Svelte 5 (Runes Mode)

This project uses **Svelte 5** with runes enabled. It is **not** Svelte 4.

## Key Differences

- **Reactive statements**: Use `$derived()` for computed values and `$effect()` for side effects. The legacy `$:` syntax is invalid in runes mode.
- **Default runes**: All components are compiled with `runes: true` automatically in Svelte 5.
- **Component props**: Props are declared with `export let` as before, but reactivity works differently.

## Common Pitfalls

- ❌ Invalid: `$: myValue = other + 1;`
- ✅ Valid: `const myValue = $derived(other + 1);`

- ❌ Invalid: `onclick|stopPropagation`
- ✅ Valid: `on:click|stopPropagation`

See the [Svelte 5 runes documentation](https://svelte.dev/docs/runes) for full details.

Always verify you are using Svelte 5 syntax when working in `apps/web/`.
