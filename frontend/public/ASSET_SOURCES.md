# Browser asset sources

## Major Arcana images

The 22 Rider–Waite–Smith Major Arcana images in `assets/cards/` are public-domain reproductions. They were obtained from Wikimedia Commons and the `OriginalRiderWaite` deck mirror in TarotCaster. The application always reads these local copies so the atlas and reading result stay visually identical.

- Wikimedia Commons: <https://commons.wikimedia.org/wiki/Category:Rider-Waite_tarot_deck>
- TarotCaster mirror: <https://github.com/alamahant/TarotCaster/tree/master/decks/OriginalRiderWaite>

## MediaPipe browser runtime

The hand-tracking runtime under `vendor/mediapipe/` is copied from:

- `@mediapipe/hands` 0.4.1675469240
- `@mediapipe/camera_utils` 0.3.1675466862

MediaPipe is distributed under the Apache License 2.0. Package metadata and exact versions are also retained in `package.json` and `package-lock.json`.

- <https://github.com/google-ai-edge/mediapipe>
- <https://www.apache.org/licenses/LICENSE-2.0>
