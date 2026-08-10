import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import type { ReactNode } from "react";

GlobalRegistrator.register();

mock.module("@/components/MapPicker", () => ({
  MapPicker: ({
    onPointChange,
    stations,
    onStationSelect,
  }: {
    onPointChange: (point: { latitude: number; longitude: number }) => void;
    stations?: Array<{ latitude: number; longitude: number }>;
    onStationSelect?: (station: never) => void;
  }) => (
    <div>
      <button
        data-testid="map-picker"
        type="button"
        onClick={() => onPointChange({ latitude: -15.7801, longitude: -47.9292 })}
      >
        Selecionar ponto no mapa
      </button>
      {stations?.length ? (
        <button
          type="button"
          onClick={() => onStationSelect?.(stations[0] as never)}
        >
          Selecionar estação INMET no mapa
        </button>
      ) : null}
    </div>
  ),
}));

mock.module("recharts", () => {
  const passthrough =
    (name: string) =>
    ({
      children,
      dataKey,
      name: seriesName,
    }: {
      children?: ReactNode;
      dataKey?: string;
      name?: string;
    }) =>
      (
        <div
          data-key={dataKey}
          data-series-name={seriesName}
          data-testid={`recharts-${name}`}
        >
          {children}
        </div>
      );

  return {
    Bar: passthrough("bar"),
    CartesianGrid: passthrough("cartesian-grid"),
    ComposedChart: passthrough("composed-chart"),
    Line: passthrough("line"),
    ResponsiveContainer: passthrough("responsive-container"),
    Tooltip: passthrough("tooltip"),
    XAxis: passthrough("x-axis"),
    YAxis: passthrough("y-axis"),
  };
});

const { cleanup, fireEvent, render, screen, waitFor } = await import(
  "@testing-library/react"
);
const userEvent = (await import("@testing-library/user-event")).default;
const { App } = await import("./App");

const spreadsheetRows = [
  { month: "Janeiro", precipitation: "111", temperature: "24,7" },
  { month: "Fevereiro", precipitation: "107", temperature: "24.6" },
  { month: "Março", precipitation: "94", temperature: "23.5" },
  { month: "Abril", precipitation: "104", temperature: "20.2" },
  { month: "Maio", precipitation: "102", temperature: "17" },
  { month: "Junho", precipitation: "137", temperature: "14.5" },
  { month: "Julho", precipitation: "121", temperature: "14.1" },
  { month: "Agosto", precipitation: "122", temperature: "15.4" },
  { month: "Setembro", precipitation: "135", temperature: "16.6" },
  { month: "Outubro", precipitation: "117", temperature: "19.2" },
  { month: "Novembro", precipitation: "93", temperature: "21.4" },
  { month: "Dezembro", precipitation: "97", temperature: "23.3" },
];

beforeEach(() => {
  setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
  globalThis.fetch = mock(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("nominatim.openstreetmap.org")) {
      return {
        ok: true,
        json: async () => ({
          address: {
            city: "Brasília",
            state: "Distrito Federal",
            country: "Brasil",
          },
        }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        results: [
          {
            id: 1,
            name: "Niterói",
            admin1: "Rio de Janeiro",
            country: "Brasil",
            latitude: -22.8832,
            longitude: -43.1034,
            timezone: "America/Sao_Paulo",
          },
        ],
      }),
    };
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  setSystemTime();
  mock.restore();
});

describe("App spreadsheet parity", () => {
  test("busca local pelo combobox e seleciona resultado", async () => {
    const user = userEvent.setup();
    render(<App />);
    await selectOpenMeteo(user);

    await user.click(screen.getByRole("combobox", { name: "Buscar local" }));
    await user.type(screen.getByPlaceholderText("Ex.: Niterói, RJ"), "niteroi");

    await waitFor(() => {
      expect(screen.getByText("Niterói")).toBeTruthy();
    });

    await user.click(screen.getByText("Niterói"));

    expect(screen.getAllByText(/-22,8832/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Importar dados climáticos/i })).toBeTruthy();
  });

  test("renderiza metodologia, fontes e presets climáticos", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await selectOpenMeteo(user);

    expect(container.querySelector(".header-metrics")).toBeNull();
    expect(screen.getByText("Conceitos básicos e metodologia")).toBeTruthy();
    expect(screen.getByText("O que é o Balanço Hídrico (BH)?")).toBeTruthy();
    expect(screen.getByText("Entrada e saída de água no BH")).toBeTruthy();
    expect(screen.getByText("Por que estimar a Etp")).toBeTruthy();
    expect(screen.getByText("Índices na fórmula de Thornthwaite")).toBeTruthy();
    expect(screen.getByText("Correção de Etp para a latitude")).toBeTruthy();
    expect(screen.getByText("Superávit (SH) e Déficit (DH) Hídricos")).toBeTruthy();
    expect(container.querySelectorAll(".methodology-card")).toHaveLength(6);
    expect(screen.queryByText("Vazão como aplicação futura")).toBeNull();
    expect(container.querySelector(".methodology-formula-block")).toBeNull();
    const renderedFormulas = Array.from(
      container.querySelectorAll('annotation[encoding="application/x-tex"]'),
      (annotation) => annotation.textContent,
    );
    expect(renderedFormulas).toEqual(
      expect.arrayContaining([
        "BH = P - Etp",
        "i = (t / 5)^{1,514}",
        "I = soma(i)",
        "a = (675 * 10^{-9} * I^3) - (771 * 10^{-7} * I^2) + (0,01792 * I) + 0,49239",
        "\\text{Etp corrigida} = Etp * FC",
        "BH = P - \\text{Etp corrigida}",
      ]),
    );
    expect(screen.getAllByText(/Thornthwaite/).length).toBeGreaterThan(0);
    expect(
      screen.getByText("Fontes de dados da obtenção da precipitação e temperatura"),
    ).toBeTruthy();
    expect(screen.getByText("INMET por estação")).toBeTruthy();
    expect(screen.getByText("Open-Meteo/ERA5 por coordenada")).toBeTruthy();
    expect(screen.getByText("Normal estimada por coordenada")).toBeTruthy();
    expect(container.querySelectorAll(".climate-method-card")).toHaveLength(3);
    expect(screen.getByText("Referências e fontes")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open-Meteo Historical Weather API" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "INMET Normais Climatológicas do Brasil" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Nominatim" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "OpenStreetMap" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Thornthwaite, 1948" })).toHaveProperty(
      "href",
      "https://doi.org/10.2307/210739",
    );
    expect(screen.queryByText(/Edison/)).toBeNull();
    expect(screen.queryByText(/apostila/i)).toBeNull();
    expect(screen.queryByText("Parâmetros e fórmulas")).toBeNull();
    expect(screen.queryByText("Leitura rápida")).toBeNull();
    expect(screen.queryByText("Fatores de correção")).toBeNull();
    expect(screen.queryByText("2001-2026")).toBeNull();
    expect(screen.queryByText("1971-2000")).toBeNull();
    expect(screen.queryByLabelText("Início")).toBeNull();
    expect(screen.queryByLabelText("Fim")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Período de referência" }).textContent).toContain("1991-2020");

    await chooseCombobox(user, "Período de referência", "1961-1990");
    expect(screen.getByRole("combobox", { name: "Período de referência" }).textContent).toContain("1961-1990");

    await chooseCombobox(user, "Período de referência", "1981-2010");
    expect(screen.getByRole("combobox", { name: "Período de referência" }).textContent).toContain("1981-2010");

    await chooseCombobox(user, "Período de referência", "1940-1970");
    expect(screen.getByRole("combobox", { name: "Período de referência" }).textContent).toContain("1940-1970");

    await chooseCombobox(user, "Período de referência", "Personalizado");

    expect((screen.getByLabelText("Início") as HTMLInputElement).value).toBe("1940");
    expect((screen.getByLabelText("Fim") as HTMLInputElement).value).toBe("1970");
  });

  test("mantem estados decimais intermediarios nos campos de entrada", () => {
    render(<App />);

    const januaryTemperature = screen.getByLabelText(
      "Temperatura de Janeiro",
    ) as HTMLInputElement;
    const januaryPrecipitation = screen.getByLabelText(
      "Precipitação de Janeiro",
    ) as HTMLInputElement;

    fireEvent.change(januaryTemperature, { target: { value: "24," } });
    expect(januaryTemperature.value).toBe("24,");

    fireEvent.change(januaryTemperature, { target: { value: "24." } });
    expect(januaryTemperature.value).toBe("24.");

    fireEvent.change(januaryPrecipitation, { target: { value: "" } });
    expect(januaryPrecipitation.value).toBe("");
  });

  test("sinaliza no campo a temperatura fora da faixa aceita", async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText("Temperatura de Janeiro") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "127,1");

    expect(input.className).toContain("input-invalid");
    expect(input.getAttribute("aria-invalid")).toBe("true");

    fireEvent.focus(input);
    await waitFor(() => {
      expect(screen.getByRole("tooltip").textContent).toBe(
        "Janeiro: temperatura fora da faixa esperada (-60 °C a 70 °C).",
      );
    });
  });

  test("preenche os valores da planilha e exibe os resultados arredondados esperados", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    for (const row of spreadsheetRows) {
      fireEvent.change(screen.getByLabelText(`Precipitação de ${row.month}`), {
        target: { value: row.precipitation },
      });
      fireEvent.change(screen.getByLabelText(`Temperatura de ${row.month}`), {
        target: { value: row.temperature },
      });
    }

    expect(container.querySelector(".header-metrics")).toBeNull();

    expect(rowText(container, "Janeiro")).toContain("1,19");
    expect(rowText(container, "Janeiro")).toContain("11,23");
    expect(rowText(container, "Janeiro")).toContain("116,4");
    expect(rowText(container, "Janeiro")).toContain("138,5");
    expect(rowText(container, "Janeiro")).toContain("-27,5");

    expect(rowText(container, "Junho")).toContain("0,84");
    expect(rowText(container, "Junho")).toContain("5,01");
    expect(rowText(container, "Junho")).toContain("38,1");
    expect(rowText(container, "Junho")).toContain("32,0");
    expect(rowText(container, "Junho")).toContain("105,0");

    const report = screen.getByDisplayValue(
      /Síntese dos resultados/,
    ) as HTMLTextAreaElement;
    expect(report.value).toContain("Precipitação total: 1.340,0 mm");
    expect(report.value).toContain("Base técnica e metodológica preparada para o GeoCalc.");
    expect(report.value).not.toContain("Edison");
    expect(report.value).not.toContain("apostila");
    expect(report.value).toContain("ETP corrigida total: 941,9 mm");
    expect(report.value).toContain("Balanço hídrico anual: 398,1 mm");
    expect(report.value).toContain("Índice calorimétrico anual I: 95,902");
    expect(report.value).toContain("Expoente a: 2,097");
    expect(report.value).toContain("Maior déficit: Janeiro (-27,5 mm)");
    expect(report.value).toContain("Maior superávit: Junho (105,0 mm)");
    expect(report.value).toContain("https://doi.org/10.2307/210739");
    expect(report.value).not.toContain("jstor.org");
    expect(screen.getByText("Entenda as variáveis")).toBeTruthy();
    expect(screen.getAllByText("SH").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DH").length).toBeGreaterThan(0);
    expect(screen.queryByText("Preenchimento manual")).toBeNull();
    expect(screen.queryByText("A tabela começa vazia.")).toBeNull();
    expect(screen.queryByText("Relatório didático")).toBeNull();
  });

  test("exibe coordenada selecionada no mapa no campo de local", async () => {
    const user = userEvent.setup();
    render(<App />);
    await selectOpenMeteo(user);

    await user.click(screen.getByText("Selecionar ponto no mapa"));

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Buscar local" }).textContent).toContain(
        "Brasília",
      );
    });
    expect(screen.getAllByText(/-15,7801/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hemisfério").length).toBeGreaterThan(0);
    expect(screen.getByText("Latitude")).toBeTruthy();
    expect(screen.getByText("Longitude")).toBeTruthy();
    expect(screen.getAllByText("Latitude de fator").length).toBeGreaterThan(0);
  });

  test("seleciona INMET por estação e preenche a tabela", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "INMET 1991-2020" }));

    expect(screen.queryByRole("button", { name: /Importar dados climáticos/i })).toBeNull();
    expect(screen.queryByText("Selecione uma estação INMET no mapa ou na busca.")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Estação INMET" })).toBeTruthy();

    await user.click(screen.getByText("Selecionar estação INMET no mapa"));

    await waitFor(() => {
      expect((screen.getByLabelText("Precipitação de Janeiro") as HTMLInputElement).value).not.toBe("");
    });

    const report = screen.getByDisplayValue(
      /Síntese dos resultados/,
    ) as HTMLTextAreaElement;
    expect(report.value).toContain("Fonte dos dados: INMET Normais Climatológicas do Brasil 1991-2020");
    expect(report.value).toContain("Estação INMET:");
    expect(report.value).not.toContain("Open-Meteo Historical Weather API");
  });

  test("seleciona INMET 1981-2010 por estação e preenche a tabela", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "INMET 1981-2010" }));
    await user.click(screen.getByText("Selecionar estação INMET no mapa"));

    await waitFor(() => {
      expect((
        screen.getByLabelText("Precipitação de Janeiro") as HTMLInputElement
      ).value).toBe("39,7");
    });

    const report = screen.getByDisplayValue(
      /Síntese dos resultados/,
    ) as HTMLTextAreaElement;
    expect(report.value).toContain(
      "Fonte dos dados: INMET Normais Climatológicas do Brasil 1981-2010",
    );
    expect(report.value).toContain("Estação INMET: 82989 - ÁGUA BRANCA, AL");
  });

  test("usa INMET como fonte inicial e disponibiliza a normal 1961-1990", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("combobox", { name: "Estação INMET" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "INMET 1961-1990" }));
    await user.click(screen.getByText("Selecionar estação INMET no mapa"));

    await waitFor(() => {
      expect((screen.getByLabelText("Precipitação de Janeiro") as HTMLInputElement).value).not.toBe("");
    });
  });

  test("simplifica a sidebar", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: "Balanço Hídrico" })).toBeTruthy();
    expect(screen.queryByText("Modelos geoquímicos")).toBeNull();
    expect(screen.queryByText(/Ferramenta educacional/)).toBeNull();
  });

  test("usa linhas para precipitacao e ETP e barras para BH", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Precipitação de Janeiro"), {
      target: { value: "111" },
    });
    fireEvent.change(screen.getByLabelText("Temperatura de Janeiro"), {
      target: { value: "24,7" },
    });

    const bars = screen.getAllByTestId("recharts-bar");
    const lines = screen.getAllByTestId("recharts-line");

    expect(bars.some((bar) => bar.getAttribute("data-key") === "balance")).toBe(true);
    expect(lines.some((line) => line.getAttribute("data-key") === "precipitation")).toBe(true);
    expect(lines.some((line) => line.getAttribute("data-key") === "correctedEtp")).toBe(true);
  });

  test("exibe a ação de exportar Excel", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: /Exportar Excel/i })).toBeTruthy();
  });
});

function rowText(container: HTMLElement, month: string): string {
  const rows = Array.from(container.querySelectorAll("tbody tr"));
  const row = rows.find((item) => item.textContent?.includes(month));

  if (!row) {
    throw new Error(`Row not found: ${month}`);
  }

  return row.textContent ?? "";
}

async function chooseCombobox(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: string,
) {
  await user.click(screen.getByRole("combobox", { name: label }));
  const matches = screen.getAllByText(option);
  await user.click(matches[matches.length - 1]);
}

async function selectOpenMeteo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Open-Meteo\/ERA5/ }));
}
