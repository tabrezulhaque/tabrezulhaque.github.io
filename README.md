# JSONly — Universal JSON Parser

A lightweight, browser-only web app that:

- accepts JSON and text files or pasted content;
- safely repairs common JSON mistakes, including comments, trailing commas, unquoted keys, single quotes, smart quotes, code fences, and NDJSON;
- flattens nested records into useful spreadsheet columns;
- previews the result and exports a formatted `.xlsx` workbook;
- exports the cleaned JSON too.

## Run locally

Open `index.html` in a browser, or use any static server from this folder. The Excel download relies on the SheetJS CDN, so an internet connection is needed for that button the first time the page loads.

All parsing happens locally in the browser—files are not uploaded anywhere.
