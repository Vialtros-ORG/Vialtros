import { getApiErrorMessage } from "./apiErrors";

describe("API error messages", () => {
  test("labels nested field errors and removes duplicate messages", () => {
    const message = getApiErrorMessage({
      response: {
        data: {
          password: ["Es obligatoria."],
          first_name: ["Usa letras.", "Usa letras."],
          extra_field: ["No válido."],
        },
      },
    });

    expect(message).toBe(
      "Contraseña: Es obligatoria. Nombre: Usa letras. extra field: No válido.",
    );
  });

  test("uses the fallback when the API response contains no readable messages", () => {
    expect(getApiErrorMessage({}, "Error de prueba")).toBe("Error de prueba");
  });
});
