if (window.location.pathname.endsWith("/index.html")) {
  const canonicalPath = window.location.pathname.slice(0, -"index.html".length);
  window.location.replace(
    canonicalPath + window.location.search + window.location.hash
  );
}
