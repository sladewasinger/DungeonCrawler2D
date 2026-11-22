# Modular Layered Character Renderer (`render/character/`)

Builds chunky, 1px-outlined `20×26` HD-pixel paper-doll sprite animations from
player appearance + equipped armor, matching the world's pixel scale:

- Layer order (back to front): optional cape -> body/limbs/under-tunic -> legs armor -> boots -> chest armor -> gloves -> hair (tucked when hooded) -> head armor (`leather-hood`).
- `characterSprites.ts` maintains a bounded 64-entry LRU cache (`idle` 4 frames, `run` 4 frames, and UI `previewUrl`), destroying evicted Pixi textures cleanly.
