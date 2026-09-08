// If we had `import "server-only";` in app/actions/sevas.ts, it would explicitly fail client compilation.
// Does Next.js 14+ automatically treat "use server" files as server-only?
// Yes! "use server" guarantees the module is not sent to the client. The client imports a hidden stub that executes fetch('/some-action-url').
