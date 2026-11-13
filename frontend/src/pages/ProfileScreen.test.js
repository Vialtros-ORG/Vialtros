import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ProfileScreen from "./ProfileScreen";
import { getCurrentUser, getUserCache, saveUserCache, updateCurrentUser } from "../services/auth";
import { useNavigate } from "react-router-dom";

jest.mock("../services/auth", () => ({
  getCurrentUser: jest.fn(),
  getUserCache: jest.fn(),
  saveUserCache: jest.fn(),
  updateCurrentUser: jest.fn(),
}));
jest.mock("../components/dashboard/Sidebar", () => () => <aside>Menú</aside>);
jest.mock("react-router-dom", () => ({ useNavigate: jest.fn() }), { virtual: true });

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const navigate = jest.fn();
const user = { id: 8, first_name: "ana", last_name: "perez lopez", username: "ana_p", email: "ana@example.com", phone_number: "3001234567" };

async function renderProfile(role = "user") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ProfileScreen role={role} />);
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

function field(view, label) {
  const labels = [...view.container.querySelectorAll(".vt-profile-fields label")];
  return labels.find((item) => item.textContent.includes(label)).querySelector("input");
}

describe("ProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    useNavigate.mockReturnValue(navigate);
    getUserCache.mockReturnValue(user);
    getCurrentUser.mockResolvedValue(user);
    updateCurrentUser.mockResolvedValue({ ...user, id: 8 });
    window.history.replaceState({ idx: 1 }, "");
  });

  afterEach(() => localStorage.clear());

  it("loads cached and current profile data and saves normalized edits", async () => {
    const view = await renderProfile("driver");
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
    expect(view.container.textContent).toContain("ana perez lopez");
    expect(view.container.textContent).toContain("Conductor");
    expect(view.container.querySelector(".vt-profile-avatar").textContent).toContain("AP");

    await act(async () => view.container.querySelector(".vt-settings-edit").click());
    const firstName = field(view, "Nombre");
    const lastName = field(view, "Apellido");
    const email = field(view, "Correo");
    const phone = field(view, "Teléfono");
    await act(async () => {
      for (const [input, value] of [[firstName, "  mARía   jOSÉ "], [lastName, "gÓMEZ  ruIZ"], [email, "  maria@example.com "], [phone, " 3110000000 "]]) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await act(async () => view.container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(updateCurrentUser).toHaveBeenCalledWith({ first_name: "María José", last_name: "Gómez Ruiz", email: "maria@example.com", phone_number: "3110000000" });
    expect(saveUserCache).toHaveBeenLastCalledWith(expect.objectContaining({ first_name: "María José", id: 8 }));
    expect(view.container.querySelector('[role="status"]').textContent).toContain("Cambios guardados");
    await view.unmount();
  });

  it("restores unsaved edits on cancel and reports save and load failures", async () => {
    const view = await renderProfile();
    await act(async () => view.container.querySelector(".vt-settings-edit").click());
    const firstName = field(view, "Nombre");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(firstName, "Cambio");
      firstName.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => view.container.querySelector(".vt-settings-cancel").click());
    expect(field(view, "Nombre").value).toBe("ana");
    await act(async () => view.container.querySelector(".vt-settings-edit").click());
    updateCurrentUser.mockRejectedValueOnce(new Error("invalid"));
    await act(async () => view.container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(view.container.querySelector('[role="alert"]').textContent).toContain("No se guardaron los cambios");
    await view.unmount();

    getUserCache.mockReturnValue(null);
    getCurrentUser.mockRejectedValueOnce(new Error("offline"));
    const failed = await renderProfile();
    expect(failed.container.querySelector('[role="alert"]').textContent).toContain("No se pudieron cargar los datos");
    await failed.unmount();
  });

  it("validates photo type and size and stores an accepted image", async () => {
    class FakeFileReader {
      readAsDataURL() {
        this.result = "data:image/png;base64,aW1hZ2U=";
        this.onload();
      }
    }
    const originalReader = window.FileReader;
    window.FileReader = FakeFileReader;
    const view = await renderProfile();
    const photo = view.container.querySelector('input[type="file"]');
    const choose = async (file) => {
      Object.defineProperty(photo, "files", { configurable: true, value: [file] });
      await act(async () => photo.dispatchEvent(new Event("change", { bubbles: true })));
    };

    await choose({ type: "text/plain", size: 10 });
    expect(view.container.querySelector('[role="alert"]').textContent).toContain("Elige un archivo de imagen");
    await choose({ type: "image/png", size: 2 * 1024 * 1024 + 1 });
    expect(view.container.querySelector('[role="alert"]').textContent).toContain("menos de 2 MB");
    await choose({ type: "image/png", size: 1024 });
    expect(localStorage.getItem("profileImage_ana_p")).toContain("data:image/png");
    expect(view.container.querySelector(".vt-profile-avatar img")).not.toBeNull();
    await view.unmount();
    window.FileReader = originalReader;
  });

  it("uses safe initials and a dashboard fallback when there is no history entry", async () => {
    getUserCache.mockReturnValue({ username: "vialtros" });
    getCurrentUser.mockResolvedValue({ username: "vialtros" });
    window.history.replaceState({}, "");
    const view = await renderProfile("admin");
    expect(view.container.querySelector(".vt-profile-avatar").textContent).toContain("V");
    await act(async () => view.container.querySelector(".vt-settings-back").click());
    expect(navigate).toHaveBeenCalledWith("/dashboard");
    await view.unmount();
  });
});
