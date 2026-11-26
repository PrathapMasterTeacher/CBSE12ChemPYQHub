"use strict";
if (new URLSearchParams(location.search).has("question")) {
  location.replace("./board-2026.html" + location.search + location.hash);
}
