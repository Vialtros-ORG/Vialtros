import { connectTrackingWS } from "./ws";

describe("connectTrackingWS", () => {
  const originalWsUrl = process.env.REACT_APP_WS_URL;
  const originalWebSocket = global.WebSocket;
  let sockets;

  class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;

    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.close = jest.fn();
      this.send = jest.fn();
      sockets.push(this);
    }
  }

  beforeEach(() => {
    process.env.REACT_APP_WS_URL = "wss://api.vialtros.test/ws";
    localStorage.setItem("access", "token with spaces&symbols");
    global.WebSocket = MockWebSocket;
    sockets = [];
  });

  afterEach(() => {
    localStorage.removeItem("access");
    if (originalWsUrl === undefined) delete process.env.REACT_APP_WS_URL;
    else process.env.REACT_APP_WS_URL = originalWsUrl;
    global.WebSocket = originalWebSocket;
  });

  test("validates the route identifier and encodes authentication as a URL parameter", () => {
    const connection = connectTrackingWS("42", jest.fn());

    expect(sockets).toHaveLength(1);
    const socketUrl = new URL(sockets[0].url);
    expect(socketUrl.protocol).toBe("wss:");
    expect(socketUrl.pathname).toBe("/ws/tracking/42/");
    expect(socketUrl.searchParams.get("token")).toBe("token with spaces&symbols");
    connection.close();
    expect(sockets[0].close).toHaveBeenCalledTimes(1);
  });

  test.each(["0", "-1", "1.5", "1/../admin", "9007199254740992"])(
    "rejects unsafe route identifiers (%s)",
    (routeId) => {
      expect(() => connectTrackingWS(routeId, jest.fn())).toThrow(/routeId entero positivo/);
      expect(sockets).toHaveLength(0);
    },
  );
});
