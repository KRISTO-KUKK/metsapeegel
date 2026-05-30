# Sentinel comparison datasource

Added a separate Sentinel comparison datasource to the analysis panel. The new datasource stays idle during normal area analysis and only starts the ESTHub date lookup plus Maa-amet Sentinel WMS image probing after the user clicks `otsi võrdluspilte`.

The implementation adds a server-side `/api/sentinel-comparison` route, shared Sentinel comparison types, and a TypeScript port of the image selection logic from `orto_app/app.py`. It converts selected GeoJSON areas to EPSG:3301, scans current and previous month Sentinel dates, rejects blank images, estimates cloud cover, scores candidate images, and returns the best current/previous comparison image URLs with metadata.

The analysis UI now shows a `Sentinel võrdluspildid` source block with idle, loading, loaded, and error states. After loading, it displays the current-month and previous-month images together with date, score, cloud estimate, BBOX, and candidate scan counts.

Validation completed:

- `npm run build` passes in `metsapeegel`.
- `/api/sentinel-comparison` returns successful results for a selected area.
- Browser testing confirmed the `otsi võrdluspilte` button loads two Sentinel previews successfully.
