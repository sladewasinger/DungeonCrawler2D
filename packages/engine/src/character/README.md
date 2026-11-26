# Character Appearance (`@dc2d/engine`)

Deterministic, schema-validated player appearance definitions shared between
client UI, procedural sprite compositor, and authoritative multiplayer snapshots:

- **Body (`male` | `female`)**: Base torso/chest silhouette (legacy `classic`/`slender` values migrate cleanly).
- **Skin (`fair` | `warm` | `tan` | `bronze` | `deep`)**: Skin tone identifier.
- **Eye Color (`brown` | `blue` | `green` | `hazel` | `amber` | `violet`)**: Iris pigment palette key.
- **Hair (`short` | `long` | `spiky` | `ponytail` | `bald`)**: Modular hair layer tucked cleanly under hoods.
- **Hair Color (`18` keys in `HAIR_COLORS`)**: `12` solid pigments (`brown`, `black`, `blonde`, `red`, `silver`, `teal`, `auburn`, `copper`, `ash`, `midnight`, `moss`, `violet`) + `6` two-tone gradients (`ember-fade`, `frost-fade`, `shadow-fade`, `forest-fade`, `sunset-fade`, `amethyst-fade`).
