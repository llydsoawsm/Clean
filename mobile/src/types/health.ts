export type HealthResponse = {
  success: boolean;
  message: string;
  data: {
    api: string;
    database: string;
  };
};
