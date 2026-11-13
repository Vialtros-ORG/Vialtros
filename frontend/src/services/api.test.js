import api, { requestPasswordReset, resetPassword } from "./api";
import { isLocalAccessEnabled, isLocalAccessToken } from "./auth";

jest.mock("./auth", () => ({
  isLocalAccessEnabled: jest.fn(),
  isLocalAccessToken: jest.fn(),
}));

const requestInterceptor = api.interceptors.request.handlers[0].fulfilled;

describe("API service", () => {
  beforeEach(() => {
    localStorage.clear();
    delete process.env.REACT_APP_API_URL;
    delete process.env.REACT_APP_TRACKING_INGEST_TOKEN;
    jest.clearAllMocks();
  });

  it("uses the local tracking token for ingestion requests", () => {
    localStorage.setItem("access", "local-dev-access");
    isLocalAccessEnabled.mockReturnValue(true);
    isLocalAccessToken.mockReturnValue(true);
    const config = { url: "/tracking/ingest/", headers: {} };

    expect(requestInterceptor(config)).toBe(config);
    expect(config.headers).toMatchObject({
      Authorization: "Bearer local-dev-access",
      "X-Tracking-Token": "local-dev-access",
    });
  });

  it("adds a bearer token to regular requests but not token requests", () => {
    localStorage.setItem("access", "user-access-token");
    isLocalAccessEnabled.mockReturnValue(false);
    const regularRequest = { url: "/users/me/", headers: {} };
    const tokenRequest = { url: "/token/refresh/", headers: {} };

    requestInterceptor(regularRequest);
    requestInterceptor(tokenRequest);

    expect(regularRequest.headers.Authorization).toBe("Bearer user-access-token");
    expect(tokenRequest.headers.Authorization).toBeUndefined();
  });

  it("sends password reset requests to their API endpoints", async () => {
    const post = jest.spyOn(api, "post").mockResolvedValue({ data: { ok: true } });

    await requestPasswordReset("person@example.com");
    await resetPassword("reset-token", "new-password");

    expect(post).toHaveBeenNthCalledWith(1, "/auth/forgot-password/", {
      email: "person@example.com",
    });
    expect(post).toHaveBeenNthCalledWith(2, "/auth/reset-password/", {
      token: "reset-token",
      new_password: "new-password",
    });
  });
});
