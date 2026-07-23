module hexdesk-agent

go 1.25.0

// Única dependencia: golang.org/x/sys (paquete oficial de Go) para el Windows
// Service real. Sigue siendo un binario único estático (CGO_ENABLED=0).

require golang.org/x/sys v0.47.0
