const mockConfig = { get: jest.fn() };
const mockApp = {
  get: jest.fn(),
  setGlobalPrefix: jest.fn(),
  useGlobalPipes: jest.fn(),
  enableCors: jest.fn(),
  listen: jest.fn(),
};
const mockCreate = jest.fn();
const mockSwaggerConfig = { openapi: "3.0.0" };
const mockBuilder = {
  setTitle: jest.fn(),
  setDescription: jest.fn(),
  setVersion: jest.fn(),
  addBearerAuth: jest.fn(),
  build: jest.fn(),
};
const mockCreateDocument = jest.fn();
const mockSwaggerSetup = jest.fn();

jest.mock("@nestjs/core", () => ({ NestFactory: { create: mockCreate } }));
jest.mock("@nestjs/swagger", () => {
  const actual = jest.requireActual<typeof import("@nestjs/swagger")>("@nestjs/swagger");

  return {
    ...actual,
    DocumentBuilder: jest.fn(() => mockBuilder),
    SwaggerModule: {
      ...actual.SwaggerModule,
      createDocument: mockCreateDocument,
      setup: mockSwaggerSetup,
    },
  };
});

describe("bootstrap", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockBuilder.setTitle.mockReturnValue(mockBuilder);
    mockBuilder.setDescription.mockReturnValue(mockBuilder);
    mockBuilder.setVersion.mockReturnValue(mockBuilder);
    mockBuilder.addBearerAuth.mockReturnValue(mockBuilder);
    mockBuilder.build.mockReturnValue(mockSwaggerConfig);
    mockCreateDocument.mockReturnValue({ paths: {} });
    mockSwaggerSetup.mockImplementation(
      (_path: string, _app: unknown, createDocument: () => unknown) => createDocument(),
    );
    mockConfig.get.mockImplementation((key: string, fallback: unknown) =>
      key === "WEB_ORIGIN" ? "https://app.example.com" : key === "API_PORT" ? 4010 : fallback,
    );
    mockApp.get.mockReturnValue(mockConfig);
    mockApp.listen.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue(mockApp);
  });

  it("installs the API prefix, strict validation, CORS, Swagger, and configured port", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await import("./main");
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mockApp.setGlobalPrefix).toHaveBeenCalledWith("api");
    expect(mockApp.useGlobalPipes).toHaveBeenCalledWith(
      expect.objectContaining({
        isTransformEnabled: true,
        transformOptions: { enableImplicitConversion: true },
        validatorOptions: expect.objectContaining({
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      }),
    );
    expect(mockApp.enableCors).toHaveBeenCalledWith({
      origin: "https://app.example.com",
      credentials: true,
    });
    expect(mockSwaggerSetup).toHaveBeenCalledWith("api/docs", mockApp, expect.any(Function));
    expect(mockCreateDocument).toHaveBeenCalledWith(mockApp, mockSwaggerConfig);
    expect(mockApp.listen).toHaveBeenCalledWith(4010);

    warn.mockRestore();
  });
});
