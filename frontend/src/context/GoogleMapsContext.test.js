describe("GoogleMapsProvider without a configured key", () => {
  const originalApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  let container;
  let root;
  let act;
  let React;
  let mountRoot;
  let GoogleMapsProvider;
  let useGoogleMaps;

  beforeEach(() => {
    delete process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    jest.resetModules();
    React = require("react");
    act = React.act;
    ({ createRoot: mountRoot } = require("react-dom/client"));
    ({ GoogleMapsProvider, useGoogleMaps } = require("./GoogleMapsContext"));
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = mountRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    if (originalApiKey === undefined) delete process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    else process.env.REACT_APP_GOOGLE_MAPS_API_KEY = originalApiKey;
  });

  test("reports a missing key and keeps children available", () => {
    function ContextProbe() {
      const context = useGoogleMaps();
      return React.createElement("output", null, JSON.stringify(context));
    }

    act(() => {
      root.render(React.createElement(
        GoogleMapsProvider,
        null,
        React.createElement(ContextProbe),
      ));
    });

    expect(container.textContent).toContain('"missingApiKey":true');
    expect(container.textContent).toContain('"isLoaded":false');
  });
});
