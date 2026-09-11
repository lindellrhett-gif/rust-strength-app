# Screenshots

App Store Connect wants **6.9-inch iPhone** screenshots: 1290 × 2796 (or
1320 × 2868). An iPhone 16 Pro has a 6.3-inch screen and takes 1206 × 2622
shots, which App Store Connect refuses.

`npm run screenshots` bridges that. It scales each image up to fit and centres
it on the app's own background, which on a 16 Pro leaves about two pixels of
near-black down each side, against a near-black app. You will not see it.

## How to do it

1. On your phone, take the screenshots. Side button + volume up.
2. AirDrop or email them to the PC.
3. Drop the PNGs into `store/screenshots/raw/`.
4. Name them so they sort into the order you want in the listing —
   `1-suggestion.png`, `2-workout.png`, and so on. App Store Connect shows them
   in upload order and the first one does most of the work.
5. Run:

   ```
   npm run screenshots
   ```

6. Upload everything from `store/screenshots/appstore/` under the 6.9" size.

Ten is the maximum. Six is plenty.

## Before you shoot

- Use the **demo account** with real logged sessions on it. Empty states look
  like an unfinished app, and the reviewer sees these too.
- Turn on Do Not Disturb so no notification banner lands in the shot.
- Charge the phone above 80% — a red battery icon in a store screenshot reads
  as carelessness.
- Check the status bar clock. It is in every shot, so make it something
  unremarkable.

## What to shoot

The order from `store/APP_STORE_LISTING.md`, leading with the thing no other
tracker does:

1. The add-set screen with the suggestion card filled in.
2. An active workout with sets grouped by exercise and the Up Next banner.
3. The post-workout summary showing a personal record.
4. The Home screen with the body chart.
5. The trophy shelf and level card.
6. The friend feed with reactions.

## Raw files are not committed

`raw/` is ignored by git — those are large, and they are only an intermediate
step. The finished `appstore/` images are kept, so there is always a record of
exactly what was submitted.
