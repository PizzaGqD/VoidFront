# VoidFront Yandex Games Checklist

## Already prepared in code

- Single-only runtime and local authority mode.
- Yandex Games SDK bootstrap in `platform-adapter.js`.
- `LoadingAPI.ready()` call when the client is ready.
- Gameplay markup hooks: `GameplayAPI.start()` and `GameplayAPI.stop()`.
- `game_api_pause` and `game_api_resume` handling for pause/resume safety.
- Mobile fullscreen request path for gameplay sessions.
- Rotate prompt for portrait mobile when landscape gameplay is expected.
- Local progress save for guest play.
- Long-tap/context-menu guards on the main game surfaces.
- Yandex-ready build command and upload archive generation.
- Curated OST subset in the Yandex build to keep the uncompressed package under the 100 MB limit.

## Build for upload

Run:

```bash
npm run build:yandex
```

Artifacts:

- Folder: `dist/client`
- Upload archive: `dist/voidfront-yandex-upload.zip`
- Current uncompressed build size: about `56 MB`

Important:

- Upload the generated archive contents exactly as built.
- `index.html` is placed at the archive root by the packaging step.

## Manual steps in Yandex Games console

1. Create or update the game draft and upload `dist/voidfront-yandex-upload.zip`.
2. Select supported platforms honestly. If mobile is enabled, keep landscape orientation in the draft.
3. Fill required draft fields:
   - Title
   - Description
   - How to play
   - Version
   - Categories
   - Supported platforms
   - Orientation
   - Icon
   - Cover
   - Screenshots
4. Use real gameplay screenshots only.
5. Make sure the game title in the draft matches the in-game title.
6. Set the correct age rating tag.
7. Enable Yandex Advertising Network monetization in the draft.
8. If leaderboards will be used, create them in the console before release.
9. If cloud save is later added, declare it in the draft and retest account-switch behavior.

## Manual product decisions still open

- Choose whether this release is RU-only or multilingual.
- If multilingual, add full UI localization instead of Russian-only text.
- Decide whether to ship leaderboard integration in the first Yandex release.
- Decide whether rewarded ads should be added to the single-player economy loop.

## Pre-upload verification

1. Open the built game and confirm it starts without server dependencies.
2. Verify the game pauses audio and simulation when the tab is hidden.
3. Verify portrait mobile shows the rotate prompt and does not stretch UI.
4. Verify fullscreen entry works on mobile after the first player interaction.
5. Verify no browser scrolling or context menu appears over the game field.
6. Verify all progress survives page refresh in guest mode.
7. Verify ad calls, if added, happen only during logical pauses and only through the SDK.
8. Verify the total uncompressed build stays under 100 MB.

## Recommended follow-up

- Add Yandex leaderboard SDK integration if leaderboard is part of the release pitch.
- Add full locale tables if you want to publish outside RU-focused audiences.
- Run moderation-focused smoke tests on Android and iOS browsers before submission.
