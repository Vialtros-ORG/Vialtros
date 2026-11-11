import { connectTrackingWS, getWebSocketProtocols, resolveWsBaseUrl } from "./ws";

class MockWebSocket {
  static CLOSED = 3;
  static instances = [];

  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = 0;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  sendMessage(data) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe("tracking WebSocket service", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    global.WebSocket = MockWebSocket;
    localStorage.clear();
    delete process.env.REACT_APP_WS_URL;
    delete process.env.REACT_APP_API_URL;
  });

  it("chooses a configured URL, maps HTTP protocols, and falls back to the browser host", () => {
    process.env.REACT_APP_WS_URL = " wss://tracking.example/ws/// ";
    expect(resolveWsBaseUrl()).toBe("wss://tracking.example/ws");
    delete process.env.REACT_APP_WS_URL;
    process.env.REACT_APP_API_URL = "https://api.example/v1";
    expect(resolveWsBaseUrl()).toBe("wss://api.example/ws");
    process.env.REACT_APP_API_URL = "not a url";
    expect(resolveWsBaseUrl()).toBe("ws://localhost/ws");
    localStorage.setItem("access", "token-demo");
    expect(getWebSocketProtocols()).toEqual(["vialtros", "vialtros.jwt.token-demo"]);
    localStorage.removeItem("access");
    expect(getWebSocketProtocols()).toEqual(["vialtros"]);
  });

  it("delivers raw messages and normalized nested or flat coordinates", () => {
    const onMessage = jest.fn();
    const onRawMessage = jest.fn();
    const onLocationUpdate = jest.fn();
    const connection = connectTrackingWS("17", onMessage, { onRawMessage, onLocationUpdate });
    const socket = MockWebSocket.instances[0];
    expect(socket.url).toContain("/tracking/17/");
    socket.onopen();
    socket.sendMessage({ event: "position_update", data: { lat: "3.88", lng: "-77.03" } });
    expect(onMessage).toHaveBeenCalledWith({ lat: "3.88", lng: "-77.03", latitude: 3.88, longitude: -77.03 });
    expect(onLocationUpdate).toHaveBeenCalledTimes(1);
    socket.sendMessage({ event: "heartbeat" });
    expect(onMessage).toHaveBeenLastCalledWith({ event: "heartbeat" });
    socket.onmessage({ data: "{bad json" });
    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onRawMessage).toHaveBeenCalledTimes(2);
    connection.close();
  });

  it("rejects invalid route ids and reconnects after an unexpected close", () => {
    expect(() => connectTrackingWS("no-es-id", jest.fn())).toThrow("routeId numerico");
    jest.useFakeTimers();
    const onClose = jest.fn();
    const connection = connectTrackingWS(4, jest.fn(), { onClose, reconnectDelayMs: 10, maxReconnectAttempts: 1 });
    const initialSocket = MockWebSocket.instances[0];
    initialSocket.onopen();
    initialSocket.onclose();
    expect(onClose).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(2);
    connection.close();
    jest.useRealTimers();
  });
});
