const http = require("http");
const httpProxy = require("http-proxy");

const clientPort = process.env.CLIENT_PORT || 8080;
const clientHost = process.env.CLIENT_HOST || "localhost";
// const clientProtocol = process.env.CLIENT_PROTOCOL || "http";
const clientProtocol = "http";

const serverPort = process.env.SERVER_PORT || 8000;
const serverHost = process.env.SERVER_HOST || "localhost";
// const serverProtocol = process.env.SERVER_PROTOCOL || "http";
const serverProtocol = "http";

const catalystListenPort = process.env.X_ZOHO_CATALYST_LISTEN_PORT || 3001;

const clientTarget = `${clientProtocol}://${clientHost}:${clientPort}`;
const serverTarget = `${serverProtocol}://${serverHost}:${serverPort}`;

const proxyHandler = httpProxy.createProxyServer({
    ws: true,
    changeOrigin: true,
    xfwd: true
});

proxyHandler.on("error", (err, req, res) => {
    console.error("Proxy Failed with following error");
    console.error(err)

    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code: "FAILURE", message: "Service unavailable" }));
});

const proxyServer = http.createServer((req, res) => {
    console.log("REQUEST URL ===>>>", req.url);

    if (req.url.startsWith("/api")) {
        proxyHandler.web(req, res, { target: serverTarget });
    } else {
        proxyHandler.web(req, res, { target: clientTarget });
    }
});

proxyServer.on("error", (err) => {
    console.error("Proxy server error:", err.message);
    // For server-level errors like EADDRINUSE, we can't send a response
    // Log the error and exit or handle appropriately
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${catalystListenPort} is already in use. Please free the port or use a different one.`);
    }
    process.exit(1);
});

proxyServer.on("upgrade", (req, socket, head) => {
    console.log("Upgrade request received");
    if (req.url.startsWith("/api")) {
        proxyHandler.ws(req, socket, head, { target: serverTarget });
    } else {
        proxyHandler.ws(req, socket, head, { target: clientTarget });
    }
});

proxyServer.listen(catalystListenPort, () => {
    console.log(`Application port ::: ${catalystListenPort}`);
});